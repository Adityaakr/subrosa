// One-time stale-network migration wipe.
//
// Miden testnet was upgraded/reset to the 0.15.x protocol with a NEW genesis
// commitment. Two consequences for any client that still holds 0.14-era state:
//   1. the node rejects the old client version outright at the RPC accept-header
//      handshake ("accept header validation failed … please check your version");
//   2. accounts/notes created by the 0.14 client carry an account-ID encoding the
//      0.15 prover rejects ("`0` is not a known account ID version"), so even
//      after the SDK bump, those rows poison syncState / proveTransaction.
//
// The local IndexedDB (`MidenClientDB_{network_id}`, i.e. `MidenClientDB_mtst`
// for testnet) and the cached Guardian betting identities are therefore dead
// weight on the reset network. We delete them ONCE, before the Miden client
// opens the DB, keyed by a network-epoch marker so it never re-wipes a healthy
// 0.15 store. Bump NET_EPOCH again if the testnet is ever reset anew.

const NET_EPOCH = "miden-0.15-testnet";
const EPOCH_LS = "subrosa.net.epoch";
const GUARDIAN_LS_PREFIX = "subrosa.guardian.identity.";
const DB_PREFIX = "MidenClientDB_";
const FALLBACK_DB = "MidenClientDB_mtst"; // testnet, when databases() is unavailable

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    try {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = finish;
      req.onerror = finish;
      // Another tab holds the DB open — don't hang boot; it clears on next load.
      req.onblocked = finish;
    } catch {
      finish();
    }
    // Hard cap so a stuck delete can never block the app from rendering.
    setTimeout(finish, 4000);
  });
}

export async function resetStaleNetworkState(): Promise<void> {
  try {
    if (localStorage.getItem(EPOCH_LS) === NET_EPOCH) return; // already migrated
  } catch {
    // localStorage blocked (private mode / partitioned) — attempt the wipe anyway.
  }

  // Find every MidenClientDB_* database. databases() is Chromium-only; elsewhere
  // we fall back to the known testnet name.
  let names: string[] = [FALLBACK_DB];
  try {
    if (typeof indexedDB.databases === "function") {
      const dbs = await indexedDB.databases();
      const found = dbs
        .map((d) => d.name)
        .filter((n): n is string => !!n && n.startsWith(DB_PREFIX));
      if (found.length) names = found;
    }
  } catch {
    // keep the fallback
  }

  for (const n of names) await deleteDb(n);

  // Drop EVERY cached account reference (wallet id, test faucet id, positions,
  // co-sign ids, Guardian identities). All of them point at accounts/notes that
  // lived in the IndexedDB we just deleted — keeping a stale `subrosa.wallet.id`
  // makes the dapp show a phantom 0-OBX wallet whose account no longer exists,
  // so funding/placing target a missing account. Clear all `subrosa.*` keys
  // except our own epoch marker so the reset network starts from a clean slate.
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k !== EPOCH_LS && (k.startsWith("subrosa.") || k.startsWith(GUARDIAN_LS_PREFIX))) stale.push(k);
    }
    for (const k of stale) localStorage.removeItem(k);
  } catch {
    // ignore
  }

  try {
    localStorage.setItem(EPOCH_LS, NET_EPOCH);
  } catch {
    // ignore — worst case we wipe again next load, which is harmless on a fresh store.
  }
}
