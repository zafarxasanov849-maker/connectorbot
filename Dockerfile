# ---- Build bosqichi ----
FROM node:20-alpine AS builder
WORKDIR /app

# Avval faqat manifestlarni ko'chirib, kesh-dan foydalanamiz
COPY package.json package-lock.json ./
RUN npm ci

# Manba kodni ko'chirib, TypeScript'ni kompilyatsiya qilamiz
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Ishlab chiqarish (production) bosqichi ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Faqat production bog'liqliklar
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Kompilyatsiya qilingan kodni build bosqichidan olamiz
COPY --from=builder /app/dist ./dist
# Mini App dashboard statik fayllari
COPY webapp ./webapp

# Bot + barcha workerlar + web-server bitta jarayonda (startAll)
CMD ["node", "dist/startAll.js"]
