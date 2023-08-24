# syntax=docker/dockerfile:1

FROM node:20 AS builder

WORKDIR /app

COPY ./src/ /app/src/
COPY ./test/ /app/test/
COPY ./package*.json ./tsconfig.json /app/

RUN npm install
RUN npm run build


FROM node:20.5-alpine3.17 AS flowR

LABEL author="Florian Sihler" git="https://github.com/Code-Inspect/flowr"

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY package.json LICENSE ./

RUN npm install --only=production

ENTRYPOINT ["npm", "run"]
