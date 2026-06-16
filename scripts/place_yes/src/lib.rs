#![no_std]
#![feature(alloc_error_handler)]

//! Subrosa — transaction script: place a YES position of 250 on the market.
//!
//! Calls the deployed `market` account's `place(side, amount)` procedure
//! (YES = 1). This moves the PUBLIC reserves (yes_reserve += 250, volume += 250)
//! → the implied odds shift on-chain, visibly. The trader's private position
//! note is issued separately and stays a commitment.
//!
//! Binding path derived from contracts/market generated WIT:
//!   package `miden:market`, interface `market`, func `place`.

extern crate alloc;

use bindings::miden::market::market::place;
use miden::{felt, tx_script, Word};

#[tx_script]
fn run(_arg: Word) {
    // side = YES (1), amount = 250
    let _shares = place(felt!(1), felt!(250));
}
