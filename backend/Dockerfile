FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./

# Prisma 7's config requires DATABASE_URL while generating the client. This
# placeholder is build-only; Railway supplies the real private URL at runtime.
RUN DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" npm run prisma:generate \
    && npm run build

ENV NODE_ENV=production
EXPOSE 4400

CMD ["npm", "run", "start:prod"]
