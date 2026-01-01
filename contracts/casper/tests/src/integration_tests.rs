fn main() {
    panic!("Run `cargo test`, not `cargo run`");
}

#[cfg(test)]
mod tests {
    use casper_engine_test_support::{
        ExecuteRequestBuilder, LmdbWasmTestBuilder, DEFAULT_ACCOUNT_ADDR, LOCAL_GENESIS_REQUEST,
    };

    use casper_execution_engine::engine_state::Error;
    use casper_execution_engine::execution::ExecError;

    use casper_execution_engine::runtime::cryptography::blake2b;
    use casper_types::contracts::ContractHash;
    use casper_types::URef;
    use casper_types::{bytesrepr::Bytes, runtime_args, ApiError, Key, StoredValue};

    use k256::ecdsa::signature::Signer;
    use k256::ecdsa::{Signature as K256Signature, SigningKey};
    use rand_core::OsRng;

    const CONTRACT_WASM: &str = "contract.wasm";
    const RECEIVER_WASM: &str = "receiver.wasm";

    const KEY_NONCE: &str = "nonce";
    const KEY_MESSAGES: &str = "messages";
    const KEY_EXECUTED_MESSAGES: &str = "executed_messages";

    const CASPER_CHAIN_ID: u32 = 3;
    const DST_CHAIN_ID: u32 = 1;

    // ------------------------------------------------
    // Helpers
    // ------------------------------------------------

    fn install(builder: &mut LmdbWasmTestBuilder) -> ContractHash {
        let install = ExecuteRequestBuilder::standard(
            *DEFAULT_ACCOUNT_ADDR,
            CONTRACT_WASM,
            runtime_args! {
                "relayer_pubkey" => Bytes::from(vec![1u8; 33]),
            },
        )
        .build();

        builder.exec(install).commit().expect_success();

        let account = builder
            .get_account(*DEFAULT_ACCOUNT_ADDR)
            .expect("account exists");

        for (_name, key) in account.named_keys().iter() {
            if let Key::Hash(hash) = key {
                return ContractHash::new(*hash);
            }
        }

        panic!("contract hash not found");
    }

    fn install_with_pubkey(
        builder: &mut LmdbWasmTestBuilder,
        relayer_pubkey: Bytes,
    ) -> ContractHash {
        let install = ExecuteRequestBuilder::standard(
            *DEFAULT_ACCOUNT_ADDR,
            CONTRACT_WASM,
            runtime_args! {
                "relayer_pubkey" => relayer_pubkey,
            },
        )
        .build();

        builder.exec(install).commit().expect_success();

        let account = builder
            .get_account(*DEFAULT_ACCOUNT_ADDR)
            .expect("account exists");

        for (_name, key) in account.named_keys().iter() {
            if let Key::Hash(hash) = key {
                return ContractHash::new(*hash);
            }
        }

        panic!("contract hash not found");
    }

    fn install_receiver(builder: &mut LmdbWasmTestBuilder) -> ContractHash {
        let install =
            ExecuteRequestBuilder::standard(*DEFAULT_ACCOUNT_ADDR, RECEIVER_WASM, runtime_args! {})
                .build();

        builder.exec(install).commit().expect_success();

        let account = builder.get_account(*DEFAULT_ACCOUNT_ADDR).expect("account");

        for (_name, key) in account.named_keys().iter() {
            if let Key::Hash(hash) = key {
                return ContractHash::new(*hash);
            }
        }

        panic!("contract hash not found");
    }

    fn set_supported_chain(
        builder: &mut LmdbWasmTestBuilder,
        contract: ContractHash,
        chain_id: u32,
        supported: bool,
    ) {
        let call = ExecuteRequestBuilder::contract_call_by_hash(
            *DEFAULT_ACCOUNT_ADDR,
            contract.into(),
            "set_supported_chain",
            runtime_args! {
                "chain_id" => chain_id,
                "supported" => supported,
            },
        )
        .build();

        builder.exec(call).commit().expect_success();
    }

    fn send_message(
        builder: &mut LmdbWasmTestBuilder,
        contract: ContractHash,
        dst_chain_id: u32,
        receiver: Bytes,
        payload: Bytes,
    ) {
        let call = ExecuteRequestBuilder::contract_call_by_hash(
            *DEFAULT_ACCOUNT_ADDR,
            contract.into(),
            "send_message",
            runtime_args! {
                "dst_chain_id" => dst_chain_id,
                "receiver" => receiver,
                "payload" => payload,
            },
        )
        .build();

        builder.exec(call).commit().expect_success();
    }

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

    fn hex(bytes: &[u8]) -> String {
        const HEX: &[u8; 16] = b"0123456789abcdef";
        let mut s = String::with_capacity(bytes.len() * 2);
        for &b in bytes {
            s.push(HEX[(b >> 4) as usize] as char);
            s.push(HEX[(b & 0xf) as usize] as char);
        }
        s
    }

    fn sign_message(message: &[u8]) -> (Bytes, Bytes) {
        let signing_key = SigningKey::random(&mut OsRng);
        let verify_key = signing_key.verifying_key();

        let sig: K256Signature = signing_key.sign(message);

        let pubkey = verify_key.to_encoded_point(false);
        let pubkey_bytes = Bytes::from(verify_key.to_encoded_point(true).as_bytes().to_vec());
        let sig_bytes = Bytes::from(sig.to_bytes().to_vec());

        (pubkey_bytes, sig_bytes)
    }

    fn message_key(message: &[u8]) -> String {
        let digest = blake2b(message);
        hex::encode(digest)
    }

    // ------------------------------------------------
    // Tests
    // ------------------------------------------------

    #[test]
    fn install_creates_named_keys() {
        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();

        let contract = install(&mut builder);

        for key in [KEY_NONCE, KEY_MESSAGES] {
            assert!(
                builder
                    .query(None, Key::Hash(contract.value()), &[key.to_string()])
                    .is_ok(),
                "missing key {}",
                key
            );
        }
    }

    #[test]
    fn send_message_increments_nonce() {
        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();

        let contract = install(&mut builder);
        set_supported_chain(&mut builder, contract, DST_CHAIN_ID, true);

        send_message(
            &mut builder,
            contract,
            DST_CHAIN_ID,
            Bytes::from(vec![0u8; 32]),
            Bytes::from(vec![1u8]),
        );

        let nonce: u64 = builder
            .query(None, Key::Hash(contract.value()), &[KEY_NONCE.to_string()])
            .unwrap()
            .as_cl_value()
            .unwrap()
            .clone()
            .into_t()
            .unwrap();

        assert_eq!(nonce, 1);
    }

    #[test]
    fn send_message_reverts_on_unsupported_chain() {
        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();

        let contract = install(&mut builder);

        let call = ExecuteRequestBuilder::contract_call_by_hash(
            *DEFAULT_ACCOUNT_ADDR,
            contract.into(),
            "send_message",
            runtime_args! {
                "dst_chain_id" => 999u32,
                "receiver" => Bytes::from(vec![0u8; 32]),
                "payload" => Bytes::from(vec![1u8]),
            },
        )
        .build();

        builder.exec(call).commit().expect_failure();

        let err = builder.get_error().unwrap();
        assert!(matches!(
            err,
            Error::Exec(ExecError::Revert(ApiError::User(1)))
        ));
    }

    #[test]
    fn send_message_stores_message_by_nonce() {
        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();

        let contract = install(&mut builder);
        set_supported_chain(&mut builder, contract, DST_CHAIN_ID, true);

        let receiver = Bytes::from(vec![9u8; 32]);
        let payload = Bytes::from(vec![1u8, 2u8, 3u8]);

        send_message(
            &mut builder,
            contract,
            DST_CHAIN_ID,
            receiver.clone(),
            payload.clone(),
        );

        // Canonical message bytes (nonce = 0 for first message)
        let message_bytes = build_message_bytes(
            CASPER_CHAIN_ID,
            DST_CHAIN_ID,
            &DEFAULT_ACCOUNT_ADDR.value(),
            receiver.as_ref(),
            0,
            payload.as_ref(),
        );

        // Dictionary keys must be short → hash
        let digest = blake2b(&message_bytes);
        let message_id = "0";

        let contract = builder.get_contract(contract).expect("contract");

        let messages_uref = contract
            .named_keys()
            .get("messages")
            .expect("messages named key")
            .into_uref()
            .expect("messages should be URef");

        let stored = builder
            .query_dictionary_item(None, messages_uref, &message_id)
            .expect("dictionary item")
            .as_cl_value()
            .expect("cl value")
            .clone()
            .into_t::<Bytes>()
            .expect("bytes");

        assert_eq!(stored.as_ref(), message_bytes);
    }

    #[test]
    fn execute_message_marks_message_as_expected() {
        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();

        let receiver_contract = install_receiver(&mut builder);
        let receiver = Bytes::from(receiver_contract.value().to_vec());

        let payload = Bytes::from(vec![1, 2, 3]);

        let message = build_message_bytes(
            1,
            CASPER_CHAIN_ID,
            &[9u8; 32],
            receiver.as_ref(),
            0,
            payload.as_ref(),
        );

        let (relayer_pubkey, signature) = sign_message(&message);
        let contract = install_with_pubkey(&mut builder, relayer_pubkey.clone());

        let call = ExecuteRequestBuilder::contract_call_by_hash(
            *DEFAULT_ACCOUNT_ADDR,
            contract.into(),
            "execute_message",
            runtime_args! {
                "src_chain_id" => 1u32,
                "src_gateway" => Bytes::from(vec![9u8; 32]),
                "receiver" => receiver,
                "nonce" => 0u64,
                "payload" => payload,
                "signature" => signature,
            },
        )
        .build();

        builder.exec(call).commit().expect_success();

        let digest = blake2b(&message);
        let key = hex(&digest);

        let contract = builder.get_contract(contract).expect("contract");

        let messages_uref = contract
            .named_keys()
            .get("executed_messages")
            .expect("messages named key")
            .into_uref()
            .expect("messages should be URef");

        let executed = builder
            .query_dictionary_item(None, messages_uref, &key)
            .expect("dictionary item")
            .as_cl_value()
            .expect("cl value")
            .clone()
            .into_t::<bool>()
            .expect("bool");

        assert!(executed);
    }

    #[test]
    fn execute_message_increments_receiver_counter() {
        let mut builder = LmdbWasmTestBuilder::default();
        builder.run_genesis(LOCAL_GENESIS_REQUEST.clone()).commit();

        // Install receiver
        let receiver_contract = install_receiver(&mut builder);
        let receiver = Bytes::from(receiver_contract.value().to_vec());

        let payload = Bytes::from(vec![1, 2, 3]);

        let message = build_message_bytes(
            1,
            CASPER_CHAIN_ID,
            &[9u8; 32],
            receiver.as_ref(),
            0,
            payload.as_ref(),
        );

        let (relayer_pubkey, signature) = sign_message(&message);
        let gateway = install_with_pubkey(&mut builder, relayer_pubkey);

        let call = ExecuteRequestBuilder::contract_call_by_hash(
            *DEFAULT_ACCOUNT_ADDR,
            gateway.into(),
            "execute_message",
            runtime_args! {
                "src_chain_id" => 1u32,
                "src_gateway" => Bytes::from(vec![9u8; 32]),
                "receiver" => receiver,
                "nonce" => 0u64,
                "payload" => payload,
                "signature" => signature,
            },
        )
        .build();

        builder.exec(call).commit().expect_success();

        // Read receiver counter
        let counter: u64 = builder
            .query(
                None,
                Key::Hash(receiver_contract.value()),
                &["count".to_string()],
            )
            .unwrap()
            .as_cl_value()
            .unwrap()
            .clone()
            .into_t()
            .unwrap();

        assert_eq!(counter, 1);
    }
}
