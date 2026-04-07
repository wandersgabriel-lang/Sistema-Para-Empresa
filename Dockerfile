FROM node:25-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3210

COPY package.json ./
COPY index.html ./
COPY CSS ./CSS
COPY JS ./JS
COPY IMG ./IMG
COPY server.js ./

RUN mkdir -p /app/data

EXPOSE 3210

CMD ["node", "server.js"]
