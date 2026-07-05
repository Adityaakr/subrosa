//! Generic: submit a compiled transaction script (.masp) against an account.
//!
//! Usage: run_script <account_id_hex> <path_to.masp>
//!
//! Opens the CLI's existing `.miden` store/keystore, loads the compiled
//! transaction-script package, builds a custom-script transaction, proves it
//! locally, and submits it. Used to drive the market's `place` / `resolve`
//! procedures in the Phase-2 lifecycle. API verified against miden-client 0.15.3.

use std::path::PathBuf;
use std::sync::Arc;

use miden_client::account::AccountId;
use miden_client::builder::ClientBuilder;
use miden_client::keystore::FilesystemKeyStore;
use miden_client::transaction::{LocalTransactionProver, TransactionRequestBuilder, TransactionScript};
use miden_client::utils::Deserializable;
use miden_client::vm::Package;
use miden_client_sqlite_store::ClientBuilderSqliteExt;

const STORE: &str = "operator/.miden/store.sqlite3";
const KEYSTORE: &str = "operator/.miden/keystore";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let account_hex = args.next().ok_or("usage: run_script <account_id_hex> <script.masp>")?;
    let masp_path = args.next().ok_or("usage: run_script <account_id_hex> <script.masp>")?;

    let keystore = FilesystemKeyStore::new(PathBuf::from(KEYSTORE))?;
    let mut client = ClientBuilder::<FilesystemKeyStore>::for_testnet()
        .sqlite_store(PathBuf::from(STORE))
        .authenticator(Arc::new(keystore))
        .build()
        .await?;

    client.sync_state().await?;

    let bytes = std::fs::read(&masp_path)?;
    let package = Package::read_from_bytes(&bytes)?;
    let program = package
        .try_into_program()
        .map_err(|e| format!("{masp_path} is not an executable program: {e}"))?;
    let tx_script = TransactionScript::new(program);

    let account_id = AccountId::from_hex(&account_hex)?;
    let request = TransactionRequestBuilder::new()
        .custom_script(tx_script)
        .build()?;

    let prover = Arc::new(LocalTransactionProver::default());
    let tx_id = client
        .submit_new_transaction_with_prover(account_id, request, prover)
        .await?;

    println!("submitted {masp_path} against {account_hex}");
    println!("tx: {tx_id}");
    Ok(())
}
