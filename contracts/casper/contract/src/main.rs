#![no_std]
#![no_main]

#[cfg(not(target_arch = "wasm32"))]
compile_error!("compile with '--target wasm32-unknown-unknown'");

extern crate alloc;

use alloc::{
    boxed::Box,
    string::{String, ToString},
    vec,
    vec::Vec,
};

use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};

use casper_contract::contract_api::cryptography::verify_signature;
use casper_contract::contract_api::runtime::blake2b;

use casper_types::{
    bytesrepr::{Bytes, ToBytes},
    contracts::{ContractHash, EntryPoint, EntryPoints},
    runtime_args,
    ApiError,
    CLType,
    CLValue,
    EntryPointAccess,
    EntryPointType,
    NamedKeys,
    Parameter,
    PublicKey,
    Signature,
    URef,
};

/// ------------------------------------------------
/// Named Keys
/// ------------------------------------------------

const KEY_NONCE: &str = "nonce";
const KEY_SUPPORTED_CHAINS: &str = "supported_chains";
const KEY_EXECUTED_MESSAGES: &str = "executed_messages";
const KEY_RELAYER_PUBKEY: &str = "relayer_pubkey";
const KEY_MESSAGES: &str = "messages";

/// Casper chain id
const CASPER_CHAIN_ID: u32 = 3;

/// ------------------------------------------------
/// Errors
/// ------------------------------------------------

#[repr(u16)]
enum Error {
    UnsupportedChain = 1,
    AlreadyExecuted = 2,
    InvalidReceiver = 3,
    MissingKey = 4,
    InvalidSignature = 5,
}

impl From<Error> for ApiError {
    fn from(e: Error) -> Self {
        ApiError::User(e as u16)
    }
}

/// ------------------------------------------------
/// Install
/// ------------------------------------------------

#[no_mangle]
pub extern "C" fn call() {
    let relayer_pubkey: Bytes = runtime::get_named_arg("relayer_pubkey");

    if relayer_pubkey.len() != 64 {
        runtime::revert(Error::InvalidSignature);
    }

    // Create storage
    let nonce = storage::new_uref(0u64);
    let relayer = storage::new_uref(relayer_pubkey);

    let supported = storage::new_dictionary(KEY_SUPPORTED_CHAINS).unwrap_or_revert();
    let executed = storage::new_dictionary(KEY_EXECUTED_MESSAGES).unwrap_or_revert();
    let messages = storage::new_dictionary(KEY_MESSAGES).unwrap_or_revert();

    let mut named_keys = NamedKeys::new();
    named_keys.insert(KEY_NONCE.to_string(), nonce.into());
    named_keys.insert(KEY_RELAYER_PUBKEY.to_string(), relayer.into());
    named_keys.insert(KEY_SUPPORTED_CHAINS.to_string(), supported.into());
    named_keys.insert(KEY_EXECUTED_MESSAGES.to_string(), executed.into());
    named_keys.insert(KEY_MESSAGES.to_string(), messages.into());

    // Entry points
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        "send_message",
        vec![
            Parameter::new("dst_chain_id", CLType::U32),
            Parameter::new("receiver", CLType::List(Box::new(CLType::U8))),
            Parameter::new("payload", CLType::List(Box::new(CLType::U8))),
        ],
        CLType::List(Box::new(CLType::U8)),
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "execute_message",
        vec![
            Parameter::new("src_chain_id", CLType::U32),
            Parameter::new("src_gateway", CLType::List(Box::new(CLType::U8))),
            Parameter::new("receiver", CLType::List(Box::new(CLType::U8))),
            Parameter::new("nonce", CLType::U64),
            Parameter::new("payload", CLType::List(Box::new(CLType::U8))),
            Parameter::new("signature", CLType::List(Box::new(CLType::U8))),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    entry_points.add_entry_point(EntryPoint::new(
        "set_supported_chain",
        vec![
            Parameter::new("chain_id", CLType::U32),
            Parameter::new("supported", CLType::Bool),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // Deploy contract
    let (contract_hash, _) = storage::new_contract(
        entry_points.into(),
        Some(named_keys),
        None,
        None,
        None,
    );

    runtime::put_key("knotx_gateway", contract_hash.into());
}

/// ------------------------------------------------
/// send_message
/// ------------------------------------------------

#[no_mangle]
pub extern "C" fn send_message() {
    let dst_chain_id: u32 = runtime::get_named_arg("dst_chain_id");
    let receiver: Bytes = runtime::get_named_arg("receiver");
    let payload: Bytes = runtime::get_named_arg("payload");

    let supported = get_dictionary(KEY_SUPPORTED_CHAINS);
    let allowed: Option<bool> =
        storage::dictionary_get(supported, &dst_chain_id.to_string()).unwrap_or_revert();

    if allowed != Some(true) {
        runtime::revert(Error::UnsupportedChain);
    }

    let nonce_ref = get_uref(KEY_NONCE);
    let nonce: u64 = storage::read(nonce_ref).unwrap_or_revert().unwrap_or(0);
    storage::write(nonce_ref, nonce + 1);

    let message_bytes = build_message_bytes(
        CASPER_CHAIN_ID,
        dst_chain_id,
        &runtime::get_caller().to_bytes().unwrap_or_default(),
        receiver.as_ref(),
        nonce,
        payload.as_ref(),
    );

    let key = message_key(&message_bytes);
    let messages = get_dictionary(KEY_MESSAGES);
    storage::dictionary_put(messages, &key, Bytes::from(message_bytes.clone()));

    runtime::ret(CLValue::from_t(Bytes::from(message_bytes)).unwrap_or_revert());
}

/// execute_message
#[no_mangle]
pub extern "C" fn execute_message() {
    let src_chain_id: u32 = runtime::get_named_arg("src_chain_id");
    let src_gateway: Bytes = runtime::get_named_arg("src_gateway");
    let receiver: Bytes = runtime::get_named_arg("receiver");
    let nonce: u64 = runtime::get_named_arg("nonce");
    let payload: Bytes = runtime::get_named_arg("payload");
    let signature: Bytes = runtime::get_named_arg("signature");

    let message_bytes = build_message_bytes(
        src_chain_id,
        CASPER_CHAIN_ID,
        src_gateway.as_ref(),
        receiver.as_ref(),
        nonce,
        payload.as_ref(),
    );

    verify_relayer_signature(&message_bytes, signature.as_ref());

    let message_key = message_key(&message_bytes);
    let executed = get_dictionary(KEY_EXECUTED_MESSAGES);

    let seen: Option<bool> =
        storage::dictionary_get(executed, &message_key).unwrap_or_revert();

    if seen == Some(true) {
        runtime::revert(Error::AlreadyExecuted);
    }

    storage::dictionary_put(executed, &message_key, true);

    if receiver.len() != 32 {
        runtime::revert(Error::InvalidReceiver);
    }

    let mut arr = [0u8; 32];
    arr.copy_from_slice(receiver.as_ref());
    let receiver_hash = ContractHash::new(arr);

    runtime::call_contract::<()>(
        receiver_hash,
        "on_call",
        runtime_args! {
            "src_chain_id" => src_chain_id,
            "src_gateway" => src_gateway,
            "payload" => payload,
        },
    );
}

/// Admin
#[no_mangle]
pub extern "C" fn set_supported_chain() {
    let chain_id: u32 = runtime::get_named_arg("chain_id");
    let supported: bool = runtime::get_named_arg("supported");

    let dict = get_dictionary(KEY_SUPPORTED_CHAINS);
    storage::dictionary_put(dict, &chain_id.to_string(), supported);
}

/// Signature verification
fn verify_relayer_signature(message: &[u8], signature: &[u8]) {
    let pubkey_bytes: Bytes =
        storage::read(get_uref(KEY_RELAYER_PUBKEY)).unwrap_or_revert().unwrap_or_revert();

    let pubkey = PublicKey::Secp256k1(pubkey_bytes.as_ref().try_into().unwrap());
    let sig = Signature::Secp256k1(signature.try_into().unwrap());

    verify_signature(message, &sig, &pubkey)
        .unwrap_or_revert_with(Error::InvalidSignature);
}

/// Helpers
fn build_message_bytes(
    src_chain_id: u32,
    dst_chain_id: u32,
    src_gateway: &[u8],
    receiver: &[u8],
    nonce: u64,
    payload: &[u8],
) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&src_chain_id.to_be_bytes());
    out.extend_from_slice(&dst_chain_id.to_be_bytes());
    out.extend_from_slice(src_gateway);
    out.extend_from_slice(receiver);
    out.extend_from_slice(&nonce.to_be_bytes());
    out.extend_from_slice(payload);
    out
}

fn get_uref(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert_with(Error::MissingKey)
        .into_uref()
        .unwrap_or_revert()
}

fn get_dictionary(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert_with(Error::MissingKey)
        .into_uref()
        .unwrap_or_revert()
}

fn to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0xf) as usize] as char);
    }
    s
}

fn message_key(message: &[u8]) -> String {
    let digest = blake2b(message);
    to_hex(&digest)
}