#![no_std]
#![no_main]

#[cfg(not(target_arch = "wasm32"))]
compile_error!("compile with '--target wasm32-unknown-unknown'");

extern crate alloc;

use alloc::vec;

use casper_contract::contract_api::{runtime, storage};
use casper_types::{
    contracts::{EntryPoint, EntryPoints},
    CLType, EntryPointAccess, EntryPointType,
};

#[no_mangle]
pub extern "C" fn on_call() {
    // Accept the call — no-op
}

#[no_mangle]
pub extern "C" fn call() {
    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        "on_call",
        vec![],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    let (contract_hash, _) = storage::new_contract(entry_points.into(), None, None, None, None);

    runtime::put_key("mock_receiver", contract_hash.into());
}
