# web/landing — marketing site

A static landing page for Subrosa, built to the Miden brand design language
(Space Grotesk / Inter / JetBrains Mono, Miden orange on near-black, grid + glow
texture, mono `PRIVATE`/`PUBLIC`/`ORACLE` label motif).

```bash
cd web/landing && python3 -m http.server 8000   # http://localhost:8000
```

- `index.html` — the page (hero, the privacy unlock, how-it-works, confidential
  agents, live markets, CTA).
- `styles.css` + `tokens/*.css` — design tokens (colors, type, spacing).
- `assets/logo/` — wordmark. `image-slot.js` — drop-in image placeholder.

Phase 3 wires this to a real Next.js app using the Miden web client (WASM) so
proving happens in-browser. (Brand currently uses the "Obscura" working codename
in copy/logo; rebrand to Subrosa is a pending task.)
