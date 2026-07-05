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
      id: "miden-mainnet", category: "Sports", question: "Will Morocco win the 2026 FIFA World Cup?",
      yes: 42, volume: "0 OBX", liquidity: "0 OBX", closes: "Jul 20, 2026", closesIn: "15d",
      oracle: "Polymarket / UMA", traders: 0, change: 0,
      polymarketSlug: import.meta.env.VITE_POLYMARKET_SLUG || "will-morocco-win-the-2026-fifa-world-cup-464",
    },
    {
      id: "eth-4k", category: "Crypto", question: "Will Ethereum reach $2,000 in July?",
      yes: 33.5, volume: "0 OBX", liquidity: "0 OBX", closes: "Aug 1, 2026", closesIn: "26d",
      oracle: "Polymarket / UMA", traders: 0, change: 0,
      polymarketSlug: "will-ethereum-reach-2000-in-july-2026",
    },
    {
      id: "fed-sep", category: "Macro", question: "Fed rate cut by September 2026 meeting?",
      yes: 5.1, volume: "0 OBX", liquidity: "0 OBX", closes: "Sep 16, 2026", closesIn: "73d",
      oracle: "Polymarket / UMA", traders: 0, change: 0, noFavored: true,
      polymarketSlug: "fed-rate-cut-by-september-2026-meeting-264-382",
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
