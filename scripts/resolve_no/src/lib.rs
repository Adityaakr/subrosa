#![no_std]
#![feature(alloc_error_handler)]

use miden::{account, felt, tx_script, Word};

#[account(market::Market)]
pub struct NativeAccount;

#[tx_script]
fn run(_arg: Word, account: &mut NativeAccount) {
    account.resolve(felt!(2));
}
