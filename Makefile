# Subrosa — build & demo helpers
# The on-chain contracts/scripts build with the midenup toolchain (`cargo miden`);
# the client builds with stable cargo.

MIDEN_BIN := $(HOME)/Library/Application Support/midenup/toolchains/0.14.0/bin
MC        := $(HOME)/.cargo/bin/miden-client

.PHONY: help contracts scripts client verify-privacy fmt clean

help:
	@echo "make contracts       - build the market account component (-> .masp)"
	@echo "make scripts          - build all transaction scripts (-> .masp)"
	@echo "make client           - build the Rust client binaries"
	@echo "make verify-privacy   - query the node: public vs private accounts"
	@echo "make clean            - remove build artifacts"

contracts:
	cd contracts/market && cargo miden build

scripts:
	for s in place_yes place_no resolve_yes redeem_yes redeem_no; do \
		(cd scripts/$$s && cargo miden build); \
	done

client:
	cd client && cargo build

verify-privacy: client
	cd client && cargo run --bin verify_privacy

clean:
	rm -rf contracts/*/target scripts/*/target client/target
