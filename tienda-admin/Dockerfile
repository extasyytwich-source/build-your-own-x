# Compila el cliente (React + Vite)
FROM node:20-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Instala las dependencias del servidor (solo producción)
FROM node:20-slim AS server-deps
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

# Imagen final: servidor + cliente ya compilado, listo para correr
FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/
COPY --from=client-build /app/client/dist ./client/dist

WORKDIR /app/server
EXPOSE 4000
CMD ["node", "src/index.js"]
