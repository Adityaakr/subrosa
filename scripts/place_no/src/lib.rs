#![no_std]
#![feature(alloc_error_handler)]

//! Obscura tx-script: place a NO position of 100 (side = 0).

extern crate alloc;

use bindings::miden::market::market::place;
use miden::{felt, tx_script, Word};

#[tx_script]
fn run(_arg: Word) {
    let _shares = place(felt!(0), felt!(100));
}
