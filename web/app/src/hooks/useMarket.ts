import { useCallback, useEffect, useState } from "react";
import { useMiden, useMidenClient } from "@miden-sdk/react";
import { AccountId } from "@miden-sdk/miden-sdk";
import { MARKET_ID_HEX, SLOT_YES, SLOT_NO, SLOT_VOL, SLOT_RES } from "@/config";

export type MarketState = {
  yes: bigint;
  no: bigint;
  volume: bigint;
  resolution: bigint; // 0 unresolved, 1 YES, 2 NO
};

// Reads the market account's PUBLIC storage (reserves + resolution) live from
// the testnet node. Mirrors the verified read pattern: import → sync → getAccount
// → storage().getItem(slot). All WASM calls serialized via runExclusive.
export function useMarket() {
  const { isReady, runExclusive } = useMiden();
  const client = useMidenClient();
  const [state, setState] = useState<MarketState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isReady || !client) return;
    setLoading(true);
    try {
      await runExclusive(async () => {
        const id = AccountId.fromHex(MARKET_ID_HEX);
        if (!(await client.getAccount(id))) {
          await client.importAccountById(id);
        }
        await client.syncState();
        const acct = await client.getAccount(id);
        if (!acct) {
          setState(null);
          setError(`market account not found on-chain (${MARKET_ID_HEX})`);
          return;
        }
        const st = acct.storage();
        const read = (slot: string): bigint => {
          const w = st.getItem(slot);
          return w ? w.toU64s()[0] : 0n;
        };
        setState({
          yes: read(SLOT_YES),
          no: read(SLOT_NO),
          volume: read(SLOT_VOL),
          resolution: read(SLOT_RES),
        });
        setError(null);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [isReady, client, runExclusive]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  return { state, error, loading, reload: load };
}
