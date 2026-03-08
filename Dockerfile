FROM node:20-bullseye AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-bullseye AS runner

WORKDIR /app
ENV NODE_ENV=production

# LibreOffice for DOCX -> PDF conversion
RUN apt-get update \
  && apt-get install -y --no-install-recommends libreoffice fonts-dejavu-core \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

# Ensure Prisma client is generated for the runtime environment
RUN npx prisma generate

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
