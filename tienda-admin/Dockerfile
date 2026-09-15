# Compila el cliente (React + Vite)
FROM node:20-slim AS client-build
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
# Vite incrusta las variables VITE_* en el bundle en tiempo de build, no de
# arranque — hay que recibirlas como build arg (Render las pasa solas si
# están seteadas como variable de entorno del servicio) y exponerlas al
# proceso de "npm run build".
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
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
