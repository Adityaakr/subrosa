// @ts-nocheck
/* Obscura prototype — market & agent data (window.OBS) */
(function () {
  // a gently wandering odds history ending near `end`
  function series(end, n, vol) {
    const out = [];
    let v = end - (Math.random() * 8 - 4);
    for (let i = 0; i < n; i++) {
      v += (Math.random() - 0.5) * vol + (end - v) * 0.08;
      out.push(Math.max(4, Math.min(96, v)));
    }
    out[out.length - 1] = end;
    return out.map((x) => Math.round(x * 10) / 10);
  }

  const markets = [
    {
      id: "eth-4k", category: "Crypto", question: "Will ETH close above $4,000 on Jul 31?",
      yes: 63, volume: "$412k", liquidity: "$128k", closes: "Jul 31, 2026", closesIn: "45d",
      oracle: "Pragma", traders: 1840, change: +2.4,
    },
    {
      id: "miden-mainnet", category: "Infra", question: "Will Miden mainnet launch before Aug 1?",
      yes: 71, volume: "$126k", liquidity: "$64k", closes: "Aug 1, 2026", closesIn: "47d",
      oracle: "Optimistic", traders: 612, change: +5.1,
    },
    {
      id: "fed-sep", category: "Macro", question: "Will the Fed cut rates in September?",
      yes: 45, volume: "$908k", liquidity: "$240k", closes: "Sep 17, 2026", closesIn: "93d",
      oracle: "Pragma", traders: 4210, change: -1.8, noFavored: true,
    },
    {
      id: "wc-final", category: "Sports", question: "Will the home side win Saturday's fixture?",
      yes: 52, volume: "$74k", liquidity: "$38k", closes: "Jun 20, 2026", closesIn: "4d",
      oracle: "Pragma", traders: 980, change: +0.6,
    },
    {
      id: "gpt5", category: "Tech", question: "Will a frontier lab ship a new flagship model by Q3?",
      yes: 68, volume: "$203k", liquidity: "$92k", closes: "Sep 30, 2026", closesIn: "106d",
      oracle: "Optimistic", traders: 2350, change: +3.2,
    },
    {
      id: "btc-ath", category: "Crypto", question: "New BTC all-time high before October?",
      yes: 41, volume: "$1.2M", liquidity: "$420k", closes: "Sep 30, 2026", closesIn: "106d",
      oracle: "Pragma", traders: 7120, change: -2.1, noFavored: true,
    },
    {
      id: "agent-tvl", category: "DeFi", question: "Confidential-agent TVL tops $10M by year-end?",
      yes: 56, volume: "$58k", liquidity: "$30k", closes: "Dec 31, 2026", closesIn: "198d",
      oracle: "Optimistic", traders: 430, change: +1.1,
    },
    {
      id: "sol-flip", category: "Crypto", question: "Will SOL outperform ETH this quarter?",
      yes: 38, volume: "$167k", liquidity: "$71k", closes: "Sep 30, 2026", closesIn: "106d",
      oracle: "Pragma", traders: 1520, change: -0.9, noFavored: true,
    },
  ];
  markets.forEach((m) => { m.history = series(m.yes, 40, 3.2); });

  // the holder's private book (pre-seeded)
  const positions = [
    { id: "p-btc", marketId: "btc-ath", side: "NO", size: 80, avg: 61, shares: 131.1, pnl: +18.4, value: 98.4, commitment: "0x4a1c…b7e3", revealed: false },
    { id: "p-wc", marketId: "wc-final", side: "YES", size: 120, avg: 49, shares: 244.9, pnl: -6.2, value: 113.8, commitment: "0xc90f…21a8", revealed: false },
  ];

  const agents = [
    { id: "a1", name: "delta-neutral-01", strat: "Delta-neutral basket", status: "active", cap: 5000, deployed: 3180, cosign: false, markets: 14, since: "12d" },
    { id: "a2", name: "sharp-fade-02", strat: "Fade the crowd", status: "active", cap: 2500, deployed: 1420, cosign: false, markets: 8, since: "6d" },
    { id: "a3", name: "macro-momentum", strat: "Momentum on macro", status: "paused", cap: 25000, deployed: 0, cosign: true, markets: 5, since: "21d" },
    { id: "a4", name: "oracle-arb-09", strat: "Resolution arbitrage", status: "active", cap: 12000, deployed: 8640, cosign: true, markets: 21, since: "30d" },
  ];

  const CAT_COLOR = {
    Crypto: "#066EFF", Infra: "#FF5500", Macro: "#A300D6",
    Sports: "#16A34A", Tech: "#B8B8BE", DeFi: "#066EFF",
  };

  window.OBS = { markets, positions, agents, CAT_COLOR, series };
})();
