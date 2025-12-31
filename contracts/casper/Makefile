prepare:
	cd contract && rustup target add wasm32-unknown-unknown
	cd receiver && rustup target add wasm32-unknown-unknown

build-contract: prepare
	cd contract && cargo build --release --target wasm32-unknown-unknown
	wasm-strip contract/target/wasm32-unknown-unknown/release/contract.wasm 2>/dev/null | true

	cd receiver && cargo build --release --target wasm32-unknown-unknown
	wasm-strip receiver/target/wasm32-unknown-unknown/release/receiver.wasm 2>/dev/null | true

test: build-contract
	mkdir -p tests/wasm

	# Copy WASMs for tests
	cp contract/target/wasm32-unknown-unknown/release/contract.wasm tests/wasm
	cp receiver/target/wasm32-unknown-unknown/release/receiver.wasm tests/wasm

	cd tests && cargo test -- --nocapture

clippy:
	cd contract && cargo clippy --all-targets -- -D warnings
	cd receiver && cargo clippy --all-targets -- -D warnings
	cd tests && cargo clippy --all-targets -- -D warnings

check-lint: clippy
	cd contract && cargo fmt -- --check
	cd receiver && cargo fmt -- --check
	cd tests && cargo fmt -- --check

lint: clippy
	cd contract && cargo fmt
	cd receiver && cargo fmt
	cd tests && cargo fmt

clean:
	cd contract && cargo clean
	cd receiver && cargo clean
	cd tests && cargo clean
	rm -rf tests/wasm
