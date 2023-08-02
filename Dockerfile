FROM node:20-alpine

RUN apk add chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app
COPY package.json .
COPY package-lock.json .

RUN npm ci

COPY . .

CMD [ "npm", "start" ]