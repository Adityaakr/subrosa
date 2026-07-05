#![no_std]
#![feature(alloc_error_handler)]

//! Subrosa — place-position note (NO). A note a trader creates
//! from the browser, addressed to the NETWORK-mode market; when the operator
//! consumes it against the market it deposits the note's single fungible asset
//! and calls `place(NO, amount)` — moving public odds while keeping the holder's
//! separate position commitment private.

extern crate alloc;

use miden::{account, felt, note, Word};

#[account(market::Market)]
pub struct NativeAccount;

#[note]
struct PlaceNoNote {}

#[note]
impl PlaceNoNote {
    #[note_script]
    pub fn run(self, _arg: Word, account: &mut NativeAccount) {
        account.place(felt!(0));
    }
}
