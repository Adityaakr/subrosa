//! Privacy verification (prove privacy, don't assume it).
//!
//! Queries the Miden testnet node (`GetAccountDetails`) and reports whether each
//! account is PUBLIC (full state) or PRIVATE (commitment only).

use miden_client::account::AccountId;
use miden_client::rpc::{Endpoint, GrpcClient, NodeRpcClient};

const OBX_FAUCET: &str = "0x1201d9f8819d5220778535e4e2f08a"; // public
const TRADER: &str = "0xbe087c335e4431903f27774ffa7a84"; // private (holds 250 OBX)

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let rpc = GrpcClient::new(&Endpoint::testnet(), 10_000u64);
    println!("Querying the Miden testnet node (GetAccountDetails)...\n");
    let mut private_holds_only_commitment = false;

    for (label, id_str) in [("OBX faucet", OBX_FAUCET), ("trader wallet", TRADER)] {
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
        println!("PRIVACY ASSERTION PASSED: the node holds only a commitment for the private account.");
        Ok(())
    } else {
        Err("PRIVACY ASSERTION FAILED: expected a private account".into())
    }
}
