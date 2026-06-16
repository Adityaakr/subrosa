//! Privacy verification (spec rule 4: prove privacy, don't assume it).
//!
//! Asks the **Miden testnet node** directly (`GetAccountDetails` RPC) what it
//! knows about two accounts created earlier in this build:
//!   - the OBX collateral faucet  → PUBLIC  account
//!   - the trader wallet          → PRIVATE account (holds 250 OBX locally)
//!
//! The node returns `FetchedAccount::Public(Box<Account>, _)` for public
//! accounts (full on-chain state) and `FetchedAccount::Private(AccountId, _)`
//! for private ones (a commitment only — no vault, no balances). If the node
//! only has a commitment for the trader, then the 250 OBX position is NOT
//! visible on-chain — which is the Subrosa guarantee.
//!
//! API verified against docs.rs/miden-client/0.14.9:
//!   - miden_client::rpc::Endpoint::testnet()
//!   - miden_client::rpc::GrpcClient::new(&Endpoint, timeout_ms: u64)
//!   - miden_client::rpc::NodeRpcClient::get_account_details(AccountId)
//!         -> Result<FetchedAccount, RpcError>
//!   - FetchedAccount::account() -> Option<&Account>, ::commitment() -> Word

use miden_client::account::AccountId;
use miden_client::rpc::{Endpoint, GrpcClient, NodeRpcClient};

// Default accounts from the Phase-1 lifecycle (see docs/PROGRESS.md).
const OBX_FAUCET: &str = "0x1201d9f8819d5220778535e4e2f08a"; // public
const TRADER: &str = "0xbe087c335e4431903f27774ffa7a84"; // private (holds 250 OBX)

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let rpc = GrpcClient::new(&Endpoint::testnet(), 10_000u64);

    println!("Querying the Miden testnet node (GetAccountDetails)...\n");

    let mut private_holds_only_commitment = false;

    // Optional argv: each "label=0xhexid"; otherwise use the defaults.
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let pairs: Vec<(String, String)> = if argv.is_empty() {
        vec![("OBX faucet".into(), OBX_FAUCET.into()), ("trader wallet".into(), TRADER.into())]
    } else {
        argv.iter()
            .filter_map(|a| a.split_once('=').map(|(l, id)| (l.to_string(), id.to_string())))
            .collect()
    };

    for (label, id_str) in pairs.iter().map(|(l, i)| (l.as_str(), i.as_str())) {
        let id = AccountId::from_hex(id_str).map_err(|e| format!("bad account id {id_str}: {e:?}"))?;
        let fetched = rpc
            .get_account_details(id)
            .await
            .map_err(|e| format!("node query failed for {id_str}: {e:?}"))?;

        let commitment = fetched.commitment();
        match fetched.account() {
            Some(_account) => {
                println!("{label}  [{id_str}]");
                println!("   node returned: FULL on-chain state (PUBLIC account)");
                println!("   commitment:    {commitment}");
                println!();
            }
            None => {
                println!("{label}  [{id_str}]");
                println!("   node returned: COMMITMENT ONLY (PRIVATE account)");
                println!("   commitment:    {commitment}");
                println!("   → no vault, no balance, no position visible on-chain");
                println!();
                private_holds_only_commitment = true;
            }
        }
    }

    if private_holds_only_commitment {
        println!("PRIVACY ASSERTION PASSED: the node holds only a commitment for the");
        println!("private trader — its 250 OBX balance is not on-chain.");
        Ok(())
    } else {
        Err("PRIVACY ASSERTION FAILED: expected the trader account to be private".into())
    }
}
