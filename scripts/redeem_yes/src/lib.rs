#![no_std]
#![feature(alloc_error_handler)]

//! Obscura tx-script: redeem a YES position (outcome = 1, 250 shares).
//! Succeeds only if the market resolved YES — the winning side.

extern crate alloc;

use bindings::miden::market::market::redeem;
use miden::{felt, tx_script, Word};

#[tx_script]
fn run(_arg: Word) {
    let _payout = redeem(felt!(1), felt!(250));
}
