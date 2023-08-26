# syntax=docker/dockerfile:1

FROM node:20 AS builder

WORKDIR /app

COPY ./src/ /app/src/
COPY ./package*.json ./tsconfig.json /app/

RUN npm install
RUN npm run build


FROM node:20.5-alpine3.17 AS flowR

LABEL author="Florian Sihler" git="https://github.com/Code-Inspect/flowr"

WORKDIR /app

RUN apk add --no-cache R

# we keep the package.json for module resolution
COPY package.json LICENSE /app/
RUN npm install --only=production

COPY --from=builder /app/dist /app/dist
RUN rm -rf /app/dist/tsconfig.tsbuildinfo

CMD ["node", "/app/dist/cli/slicer-app.js", "--", "--help"]
