#![no_std]
#![feature(alloc_error_handler)]

//! Obscura — minimal binary prediction market.
//! Public reserves + optimistic resolution; positions ride in private notes.

extern crate alloc;

use miden::{component, felt, Felt, StorageValue};

// resolution: 0 = Unresolved, 1 = ResolvedYes, 2 = ResolvedNo.

#[component]
struct Market {
    #[storage(description = "YES outcome reserve (public)")]
    yes_reserve: StorageValue<Felt>,
    #[storage(description = "NO outcome reserve (public)")]
    no_reserve: StorageValue<Felt>,
    #[storage(description = "cumulative traded volume (public, display)")]
    total_volume: StorageValue<Felt>,
    #[storage(description = "resolution: 0=unresolved, 1=YES, 2=NO (public)")]
    resolution: StorageValue<Felt>,
}

#[component]
impl Market {
    pub fn get_yes_reserve(&self) -> Felt { self.yes_reserve.get() }
    pub fn get_no_reserve(&self) -> Felt { self.no_reserve.get() }
    pub fn get_total_volume(&self) -> Felt { self.total_volume.get() }
    pub fn get_resolution(&self) -> Felt { self.resolution.get() }

    pub fn place(&mut self, side: Felt, amount: Felt) -> Felt {
        // No betting once the market is resolved.
        assert!(self.resolution.get() == felt!(0));
        if side == felt!(1) {
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

    pub fn resolve(&mut self, outcome: Felt) {
        assert!(self.resolution.get() == felt!(0));
        assert!(outcome == felt!(1) || outcome == felt!(2));
        self.resolution.set(outcome);
    }
}
