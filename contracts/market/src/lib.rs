#![no_std]
#![feature(alloc_error_handler)]

//! Obscura — minimal binary prediction market (Phase 1).
//! Public reserves backing a trivial CPMM; positions ride in private notes.

extern crate alloc;

use miden::{component, felt, Felt, StorageValue};

const YES: Felt = felt!(1);

#[component]
struct Market {
    #[storage(description = "YES outcome reserve (public)")]
    yes_reserve: StorageValue<Felt>,
    #[storage(description = "NO outcome reserve (public)")]
    no_reserve: StorageValue<Felt>,
    #[storage(description = "cumulative traded volume (public, display)")]
    total_volume: StorageValue<Felt>,
}

#[component]
impl Market {
    pub fn get_yes_reserve(&self) -> Felt { self.yes_reserve.get() }
    pub fn get_no_reserve(&self) -> Felt { self.no_reserve.get() }
    pub fn get_total_volume(&self) -> Felt { self.total_volume.get() }

    pub fn place(&mut self, side: Felt, amount: Felt) -> Felt {
        if side == YES {
            let r = self.yes_reserve.get();
            self.yes_reserve.set(r + amount);
        } else {
            let r = self.no_reserve.get();
            self.no_reserve.set(r + amount);
        }
        let v = self.total_volume.get();
        self.total_volume.set(v + amount);
        amount
    }
}
