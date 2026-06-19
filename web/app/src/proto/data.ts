// @ts-nocheck
/* Subrosa prototype — market & agent data (window.OBS) */
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
  ];
  markets.forEach((m) => { m.history = series(m.yes, 40, 3.2); });

  // The holder's private book starts EMPTY — it fills with the REAL positions
  // you place (each a real on-chain commitment). Nothing pre-seeded/mock.
  const positions = [];

  // The one real agent: the Node runner with an OpenRouter brain. Trades sub-cap
  // autonomously; above the cap a human co-signs via Guardian. (Runs server-side;
  // this is its real configuration, not a fabricated fleet.)
  const agents = [
    { id: "subrosa-01", name: "subrosa-agent-01", strat: "OpenRouter LLM over live on-chain odds", status: "active", cap: 500, deployed: 0, cosign: true, markets: 3, since: "live" },
  ];

  const CAT_COLOR = {
    Crypto: "#066EFF", Infra: "#FF5500", Macro: "#A300D6",
    Sports: "#16A34A", Tech: "#B8B8BE", DeFi: "#066EFF",
  };

  window.OBS = { markets, positions, agents, CAT_COLOR, series };
})();
