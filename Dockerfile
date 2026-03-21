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

# Chromium for DOCX -> HTML -> PDF conversion (Puppeteer)
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-dejavu-core \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=build /app/.output ./.output
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma

# Ensure Prisma client is generated for the runtime environment
# and copy engines into Nitro output node_modules
RUN npx prisma generate \
  && mkdir -p ./.output/server/node_modules/.prisma \
  && cp -r ./node_modules/.prisma/* ./.output/server/node_modules/.prisma/

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
