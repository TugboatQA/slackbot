FROM node:22.12.0-alpine3.19 as build

WORKDIR /app
COPY . .
RUN npm install --verbose

CMD ["npm", "start"]

