//! Submit the `place(YES, 250)` call on the deployed market account.
//!
//! Opens the SAME store/keystore the CLI created (`.miden/`), loads the compiled
//! transaction script (`scripts/place_yes/.../place_yes.masp`), and
//! executes + proves (locally) + submits a transaction against the market. This
//! moves the market's PUBLIC reserves on-chain (yes_reserve += 250, volume +=
//! 250) → the implied odds shift visibly, while any trader position stays a
//! private commitment.
//!
//! API verified against vendored miden-client 0.14.9 source:
//!   - miden_client_sqlite_store::ClientBuilderSqliteExt::sqlite_store(PathBuf)
//!   - miden_client::keystore::FilesystemKeyStore::new(PathBuf) (sync, Result)
//!   - miden_client::builder::ClientBuilder::for_testnet().build().await
//!   - miden_client::vm::Package::read_from_bytes -> try_into_program
//!   - miden_client::transaction::TransactionScript::new(Program)
//!   - TransactionRequestBuilder::new().custom_script(..).build()
//!   - Client::submit_new_transaction_with_prover(id, req, Arc<LocalTransactionProver>)

use std::path::PathBuf;
use std::sync::Arc;

use miden_client::account::AccountId;
use miden_client::builder::ClientBuilder;
use miden_client::keystore::FilesystemKeyStore;
use miden_client::transaction::{LocalTransactionProver, TransactionRequestBuilder, TransactionScript};
use miden_client::utils::Deserializable;
use miden_client::vm::Package;
use miden_client_sqlite_store::ClientBuilderSqliteExt;

const MARKET: &str = "0xb8512d8a8a4de2104378207209afd8";
const STORE: &str = ".miden/store.sqlite3";
const KEYSTORE: &str = ".miden/keystore";
const MASP: &str = "scripts/place_yes/target/miden/debug/place_yes.masp";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Open the existing CLI store + keystore; testnet RPC via for_testnet().
    let keystore = FilesystemKeyStore::new(PathBuf::from(KEYSTORE))?;
    let mut client = ClientBuilder::<FilesystemKeyStore>::for_testnet()
        .sqlite_store(PathBuf::from(STORE))
        .authenticator(Arc::new(keystore))
        .build()
        .await?;

    client.sync_state().await?;

    // Load the compiled transaction-script package -> TransactionScript.
    let bytes = std::fs::read(MASP)?;
    let package = Package::read_from_bytes(&bytes)?;
    let program = package
        .try_into_program()
        .map_err(|e| format!("place_yes.masp is not an executable program: {e}"))?;
    let tx_script = TransactionScript::new(program);

    let market_id = AccountId::from_hex(MARKET)?;
    let request = TransactionRequestBuilder::new()
        .custom_script(tx_script)
        .build()?;

    // Prove locally (matches the CLI's known-good proving path).
    let prover = Arc::new(LocalTransactionProver::default());
    let tx_id = client
        .submit_new_transaction_with_prover(market_id, request, prover)
        .await?;

    println!("place(YES, 250) submitted — tx: {tx_id}");
    println!("run `miden-client sync` then `account -s {MARKET}` to see reserves move.");
    Ok(())
}
