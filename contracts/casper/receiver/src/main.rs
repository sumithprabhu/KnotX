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
use casper_types::{
    contracts::{EntryPoint, EntryPoints},
    CLType, EntryPointAccess, EntryPointType, NamedKeys
};

const KEY_COUNT: &str = "count";

#[no_mangle]
pub extern "C" fn call() {
    // initialize counter
    let count_uref = storage::new_uref(0u64);

    let mut named_keys = NamedKeys::new();
    named_keys.insert(KEY_COUNT.to_string(), count_uref.into());

    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        "on_call",
        vec![],            // no required args
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    let (contract_hash, _) = storage::new_contract(entry_points.into(), Some(named_keys), None, None, None);

    runtime::put_key("mock_receiver", contract_hash.into());
}

#[no_mangle]
pub extern "C" fn on_call() {
    let count_uref = runtime::get_key(KEY_COUNT)
        .unwrap_or_revert()
        .into_uref()
        .unwrap_or_revert();

    let current: u64 = storage::read(count_uref)
        .unwrap_or_revert()
        .unwrap_or(0);

    storage::write(count_uref, current + 1);
}
