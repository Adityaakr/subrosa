#![no_std]
#![feature(alloc_error_handler)]

//! Subrosa — place-position note (NO, 100). A PRIVATE note a trader creates
//! from the browser, addressed to the NETWORK-mode market; when the operator
//! consumes it against the market it calls `place(NO, 100)` — moving public
//! odds — while the note stays a commitment on-chain. (Fixed amount in v1; a
//! parametrized note hit a midenc f32-const limitation reading Felt inputs.)

extern crate alloc;

use bindings::miden::market::market::place;
use bindings::Account;
use miden::{felt, note, Word};

#[note]
struct PlaceNoNote {}

#[note]
impl PlaceNoNote {
    #[note_script]
    pub fn run(self, _arg: Word, _account: &mut Account) {
        place(felt!(0), felt!(100));
    }
}
