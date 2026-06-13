#![no_std]
#![feature(alloc_error_handler)]

//! Obscura tx-script: optimistic resolver records outcome YES (1).

extern crate alloc;

use bindings::miden::market::market::resolve;
use miden::{felt, tx_script, Word};

#[tx_script]
fn run(_arg: Word) {
    resolve(felt!(1));
}
