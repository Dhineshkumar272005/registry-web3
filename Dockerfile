FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_ENV
ARG NEXT_PUBLIC_REGISTRY_ADDRESS
ARG NEXT_PUBLIC_RPC
ARG NEXT_PUBLIC_CHAIN_ID_HEX
ARG NEXT_PUBLIC_CHAIN_NAME
ARG NEXT_PUBLIC_CHAIN_SYMBOL
ARG NEXT_PUBLIC_CHAIN_SHORT
ARG NEXT_PUBLIC_EXPLORER
ARG NEXT_PUBLIC_ORG_NAME
ARG NEXT_PUBLIC_CONTACT_EMAIL
ARG NEXT_PUBLIC_AUDIT_URL
ARG NEXT_PUBLIC_LEGAL_REVIEWED
ARG NEXT_PUBLIC_LEGAL_UPDATED
ARG NEXT_PUBLIC_CONTENT_REVIEWED
RUN npm run build
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/scripts/preflight.js ./scripts/preflight.js
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/api/live || exit 1
CMD ["sh", "-c", "node scripts/preflight.js runtime && node server.js"]
