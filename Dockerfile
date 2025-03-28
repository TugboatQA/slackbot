FROM node:20.13.1-alpine3.19 as build

WORKDIR /app
COPY . .
RUN npm install --verbose

CMD ["npm", "start"]

