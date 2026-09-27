FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=10000
COPY package.json ./
COPY server.js zugang.js datenschutz.html ./
COPY public ./public
COPY daten ./daten
EXPOSE 10000
CMD ["node", "server.js"]
