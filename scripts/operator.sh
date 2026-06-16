#!/usr/bin/env bash
# Subrosa — operator step (the off-chain action you run to settle a bet on-chain).
#
# A browser user places a PRIVATE position (proved in their browser). The shared
# market's public odds are then moved on-chain by this operator (which holds the
# market key) — exactly how a real prediction market separates private intent
# from the public, settled pool.
#
# Usage:
#   scripts/operator.sh yes        # apply a YES bet  (place_yes.masp)
#   scripts/operator.sh no         # apply a NO bet   (place_no.masp)
#   MARKET=0x... scripts/operator.sh yes
#
# After it runs, refresh the web app — the LIVE odds bar reflects the new reserves.
set -u
cd "$(dirname "$0")/.."

MARKET="${MARKET:-0x5ff0303f0b795d1039ca5b51d8480b}"   # the market the web app reads
SIDE="${1:-yes}"
MC="${MIDEN_CLI:-$HOME/.cargo/bin/miden-client}"
RUN=./client/target/debug/run_script

case "$SIDE" in
  yes) MASP=scripts/place_yes/target/miden/debug/place_yes.masp ;;
  no)  MASP=scripts/place_no/target/miden/debug/place_no.masp ;;
  *)   echo "usage: operator.sh yes|no"; exit 1 ;;
esac

reserves() {
  "$MC" account -s "$MARKET" 2>/dev/null \
    | grep -E 'market::(yes_reserve|no_reserve|total_volume)' \
    | sed -E 's/.*market::([a-z_]+).*(0x[0-9a-f]{64}).*/\1 \2/' \
    | while read -r n h; do
        printf '  %-13s %s\n' "$n" "$(python3 -c "print(int.from_bytes(bytes.fromhex('$h'[2:])[:8],'little'))")"
      done
}

echo "market: $MARKET"
echo "odds before:"; reserves
echo "settling $SIDE on-chain (place via the proven run_script path)…"
tries=0
while :; do
  tries=$((tries+1))
  out="$("$RUN" "$MARKET" "$MASP" 2>&1)"
  if echo "$out" | grep -q 'tx:'; then
    echo "  committed $(echo "$out" | grep -oE 'tx: 0x[0-9a-f]+')"
    break
  fi
  if echo "$out" | grep -qiE 'h2 protocol error|GoAway|Transport' && [ $tries -lt 5 ]; then
    echo "  transient RPC error, retrying ($tries)…"; sleep 4; continue
  fi
  echo "  FAILED:"; echo "$out" | tail -3; exit 1
done
sleep 4; "$MC" sync >/dev/null 2>&1
echo "odds after:"; reserves
echo "→ refresh the web app; the live odds bar now reflects this."
