# syntax=docker/dockerfile:1

FROM node:25.2-alpine3.23 AS builder

WORKDIR /app

# copy the source and build files of all modules into the workdir
COPY ./src /app/src
COPY ./test /app/test
COPY ./package.json ./package-lock.json ./tsconfig.json /app/

# install python and build tools for node-gyp
RUN apk add --no-cache python3 make g++

# install and build all modules
RUN npm ci && npm run build:bundle-flowr


FROM node:25.2-alpine3.23 AS flowr

LABEL author="Florian Sihler" git="https://github.com/flowr-analysis/flowr"

WORKDIR /app

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories; apk add --no-cache --update icu-libs R

COPY ./scripts/demo.R LICENSE /app/

# copy all package.jsons so we can install them (see below)
COPY ./package.json ./package-lock.json /app/
COPY --from=builder /app/dist /app

# make new user and clean up the test files
RUN rm -rf /app/**/tsconfig.tsbuildinfo /app/**/*.d.ts /app/test/* && addgroup -S flowr && adduser -S flowr -G flowr
USER flowr

# we also configure basic memory options
ENTRYPOINT [\
   "node",\
   "--max-old-space-size=8192",\
   "--stack-size=8192",\
   "--max-semi-space-size=8192",\
   "/app/src/cli/flowr.min.js"\
  ]
