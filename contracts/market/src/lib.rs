#![no_std]
#![feature(alloc_error_handler)]

//! Subrosa — minimal binary prediction market (Phase 1).
//!
//! A PUBLIC account holding the per-outcome reserves that back a trivial CPMM.
//! The reserves are public on purpose: that is what makes the *odds* trustworthy.
//! The trader's position (which side, how much, who) is carried separately as a
//! programmable note. The current operator beta uses public execution notes;
//! private/encrypted transport can replace that routing without changing this
//! collateral-enforcing account component.
//!
//! Trivial CPMM for v1 (spec §9.3): a buy simply adds `amount` to the chosen
//! outcome's reserve. Implied odds are derived OFF-chain from the public
//! reserves: price(YES) = no_reserve / (yes_reserve + no_reserve). We keep all
//! in-VM math to field addition only (no in-field division) and let the client
//! compute display odds — LMSR / on-chain pricing is a Phase-2 fast-follow.
//!
//! API verified against the `miden` 0.12 SDK (docs.rs/miden/0.12.0):
//!   - `#[component]` on struct + impl; `&self` = read, `&mut self` = write
//!   - `StorageValue<T>`: `get(&self) -> T`, `set(&mut self, T) -> T` (prev)
//!   - `Felt`, `felt!`

extern crate alloc;

use miden::{active_note, component, component_storage, felt, native_account, Felt, StorageValue};

// Outcome encoding passed to `place`: YES = 1, NO = 0 (compared inline; `felt!`
// is not const-callable so it can't be a `const`).

// Resolution encoding (public storage `resolution`):
//   0 = Unresolved, 1 = ResolvedYes, 2 = ResolvedNo.

#[component_storage]
struct MarketStorage {
    #[storage(description = "YES outcome reserve (public)")]
    yes_reserve: StorageValue<Felt>,
    #[storage(description = "NO outcome reserve (public)")]
    no_reserve: StorageValue<Felt>,
    #[storage(description = "cumulative traded volume (public, display)")]
    total_volume: StorageValue<Felt>,
    #[storage(description = "resolution: 0=unresolved, 1=YES, 2=NO (public)")]
    resolution: StorageValue<Felt>,
}

/// Public API implemented by every Subrosa market account.
#[component]
trait Market {
    fn get_yes_reserve(&self) -> Felt;
    fn get_no_reserve(&self) -> Felt;
    fn get_total_volume(&self) -> Felt;
    fn get_resolution(&self) -> Felt;
    fn resolve(&mut self, outcome: Felt);
    fn place(&mut self, side: Felt) -> Felt;
    fn redeem(&self, outcome: Felt, shares: Felt) -> Felt;
}

#[component]
impl Market for MarketStorage {
    /// Public: current YES reserve.
    fn get_yes_reserve(&self) -> Felt {
        self.yes_reserve.get()
    }

    /// Public: current NO reserve.
    fn get_no_reserve(&self) -> Felt {
        self.no_reserve.get()
    }

    /// Public: cumulative traded volume.
    fn get_total_volume(&self) -> Felt {
        self.total_volume.get()
    }

    /// Public: resolution state (0 = unresolved, 1 = YES won, 2 = NO won).
    fn get_resolution(&self) -> Felt {
        self.resolution.get()
    }

    /// Optimistic resolver: record the final outcome (1 = YES, 2 = NO).
    ///
    /// Only callable on a transaction authorized by the market account's key
    /// (the resolver authority for v1). Resolution is one-shot: aborts if the
    /// market is already resolved, so the outcome can't be flipped after the
    /// fact. Once set, the redemption guard (position note script) pays out only
    /// the winning side.
    fn resolve(&mut self, outcome: Felt) {
        // one-shot: must currently be Unresolved (0)
        assert!(self.resolution.get() == felt!(0));
        // outcome must be YES (1) or NO (2)
        assert!(outcome == felt!(1) || outcome == felt!(2));
        self.resolution.set(outcome);
    }

    /// Place a position on `side` (YES = 1, NO = 0), collateralized by the
    /// active note's single fungible asset.
    ///
    /// Trivial CPMM: add `amount` to the chosen outcome's reserve, which moves
    /// the public implied odds, and bump total volume. Returns the shares minted
    /// (1:1 with `amount` for v1). The *position itself* is delivered to the
    /// trader as a separate private note — it is never written into this public
    /// account, so no holder/side/size is revealed here.
    fn place(&mut self, side: Felt) -> Felt {
        // No betting once the market is resolved.
        assert!(self.resolution.get() == felt!(0));
        assert!(side == felt!(0) || side == felt!(1));

        // Derive the amount from collateral instead of trusting caller input.
        let assets = active_note::get_assets();
        assert!(assets.len() == 1);
        let asset = assets[0];
        assert!(asset.value[1] == felt!(0));
        assert!(asset.value[2] == felt!(0));
        assert!(asset.value[3] == felt!(0));
        let amount = asset.value[0];
        assert!(amount != felt!(0));
        native_account::add_asset(asset);

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

    /// Redemption guard (spec §9.5). A position note carrying `outcome` calls
    /// this when redeemed. Succeeds (returns the redeemable `shares`) only if the
    /// market is resolved AND the note's outcome is the winning side; otherwise
    /// it aborts the transaction, so losing/invalid notes can never redeem.
    ///
    /// v1 keeps payout trivial (1:1 shares) and the pool-payout note plumbing is
    /// a fast-follow; the assertion *is* the trustless settlement rule and is
    /// what this procedure proves on-chain.
    fn redeem(&self, outcome: Felt, shares: Felt) -> Felt {
        let res = self.resolution.get();
        // market must be resolved (1 = YES, 2 = NO; 0 = unresolved → abort)
        assert!(res != felt!(0));
        // only the winning side may redeem
        assert!(outcome == res);
        shares
    }
}
