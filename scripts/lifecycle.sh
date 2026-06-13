#!/usr/bin/env bash
# Phase-2 full lifecycle driver against the market account.
# Usage: lifecycle.sh <market_account_hex>
# Steps 1-4 must succeed (retry on transient RPC h2 errors); step 5 (redeem NO)
# MUST abort — losing positions can never redeem.
set -u
cd "$(dirname "$0")/.."
MKT="$1"
RUN=./client/target/debug/run_script

run_expect_ok() {  # $1=label  $2=masp
  local label="$1" masp="$2" out tries=0
  while :; do
    tries=$((tries+1))
    out="$("$RUN" "$MKT" "$masp" 2>&1)"
    if echo "$out" | grep -q 'tx:'; then
      echo "[OK]   $label -> $(echo "$out" | grep -oE 'tx: 0x[0-9a-f]+')"
      return 0
    fi
    if echo "$out" | grep -qiE 'h2 protocol error|GoAway|Transport|tonic::transport' && [ $tries -lt 5 ]; then
      echo "[retry $tries] $label (transient RPC)"; sleep 4; continue
    fi
    echo "[FAIL] $label"; echo "$out" | tail -3; return 1
  done
}

run_expect_abort() {  # $1=label  $2=masp
  local label="$1" masp="$2" out
  out="$("$RUN" "$MKT" "$masp" 2>&1)"
  if echo "$out" | grep -q 'tx:'; then
    echo "[BUG]  $label SUCCEEDED but should have aborted (loser redeemed!)"; return 1
  fi
  echo "[OK]   $label correctly aborted: $(echo "$out" | grep -oiE 'assert[^"]*|FailedAssertion|execution|RpcError' | head -1)"
  return 0
}

echo "### open -> place YES & NO -> resolve -> redeem (winner) -> redeem (loser, aborts)"
run_expect_ok    "place YES 250" scripts/place_yes/target/miden/debug/place_yes.masp || exit 1
run_expect_ok    "place NO 100"  scripts/place_no/target/miden/debug/place_no.masp   || exit 1
run_expect_ok    "resolve YES"   scripts/resolve_yes/target/miden/debug/resolve_yes.masp || exit 1
run_expect_ok    "redeem YES (winner)" scripts/redeem_yes/target/miden/debug/redeem_yes.masp || exit 1
run_expect_abort "redeem NO (loser)"   scripts/redeem_no/target/miden/debug/redeem_no.masp
echo "### lifecycle complete"
