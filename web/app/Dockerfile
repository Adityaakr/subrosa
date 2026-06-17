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
# bring the built app + the deps preview needs (vite)
COPY --from=build /app /app
EXPOSE 4173
# $PORT is provided by Railway; GUARDIAN_URL is read by vite.config.ts at boot.
CMD ["sh", "-c", "npm run preview -- --host 0.0.0.0 --port ${PORT:-4173}"]
