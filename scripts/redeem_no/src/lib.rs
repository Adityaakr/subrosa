#![no_std]
#![feature(alloc_error_handler)]

//! Obscura tx-script: attempt to redeem a NO position (outcome = 2, 100 shares).
//! MUST abort when the market resolved YES — losing notes can't redeem.

extern crate alloc;

use bindings::miden::market::market::redeem;
use miden::{felt, tx_script, Word};

#[tx_script]
fn run(_arg: Word) {
    let _payout = redeem(felt!(2), felt!(100));
}
