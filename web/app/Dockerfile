# Subrosa frontend — production image for Railway.
#
# `vite preview` is the server (configured in vite.config.ts to send the
# cross-origin-isolation headers the WASM client needs and to proxy /guardian
# to the Guardian service). Railway injects $PORT; we bind 0.0.0.0.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
# --include=dev so vite/tsc are present even if Railway sets NODE_ENV=production
RUN npm install --include=dev
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
# Slim runtime: only the built static site + the tiny zero-dependency server.
# (Copying the build stage's node_modules made a multi-GB image that timed out
# on push — the Miden SDK ships several ~14MB WASM variants.)
COPY --from=build /app/dist ./dist
COPY --from=build /app/serve.mjs ./serve.mjs
EXPOSE 4173
# $PORT is provided by Railway; GUARDIAN_URL is read by serve.mjs at boot.
CMD ["node", "serve.mjs"]
