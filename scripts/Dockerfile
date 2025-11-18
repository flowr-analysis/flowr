# syntax=docker/dockerfile:1

FROM node:25.0-alpine3.22 AS builder

WORKDIR /app

# copy the source and build files of all modules into the workdir
COPY ./src /app/src
COPY ./test /app/test
COPY ./package.json ./package-lock.json ./tsconfig.json /app/

# install python and build tools for node-gyp
RUN apk add --no-cache python3 make g++

# install and build all modules
RUN npm ci && npm run build:bundle-flowr


FROM node:25.0-alpine3.22 AS flowr

LABEL author="Florian Sihler" git="https://github.com/flowr-analysis/flowr"

WORKDIR /app

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories; apk add --no-cache --update icu-libs R

COPY ./scripts/demo.R LICENSE /app/

# copy all package.jsons so we can install them (see below)
COPY ./package.json ./package-lock.json /app/

# install python and build tools for node-gyp
RUN apk add --no-cache python3 make g++

# install all modules so that we have dependencies in here too
# (we don't copy them from the builder because builder modules include dev deps too)
RUN npm ci --omit=dev

COPY --from=builder /app/dist /app/dist

# make new user
RUN rm -rf /app/**/tsconfig.tsbuildinfo /app/dist/**/*.d.ts && addgroup -S flowr && adduser -S flowr -G flowr
USER flowr

ENTRYPOINT [\
    "node",\
    # configure basic memory options
    "--max-old-space-size=8192",\
    "--stack-size=8192",\
    "--max-semi-space-size=8192",\
    "/app/dist/src/cli/flowr.min.js"\
   ]
