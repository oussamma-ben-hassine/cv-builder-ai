FROM node:20-alpine

WORKDIR /app

# Copie du manifeste de dépendances
COPY package.json ./

# Installation des dépendances
RUN npm install --omit=dev

# Copie du code source, des assets et des tests
COPY src ./src
COPY public ./public
COPY tests ./tests

# Exécution des tests automatisés ciblés pendant le build
RUN node --test tests/cv-builder.test.js && rm -rf /app/data

# Préparation du répertoire de persistance et utilisateur non-privilégié
RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

ENV PORT=3000 \
    NODE_ENV=production \
    DATA_DIR=/app/data

CMD ["node", "src/server.js"]
