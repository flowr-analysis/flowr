# syntax=docker/dockerfile:1

FROM node:22.6-alpine3.19 AS builder

WORKDIR /app

# copy the source and build files of all modules into the workdir
# (by doing this, we explicitly omit test sources)
COPY ./src /app/src
COPY ./package.json ./package-lock.json ./tsconfig.json /app/
COPY ./src/r-bridge/lang-4.x/tree-sitter/tree-sitter-r.wasm /app/dist/r-bridge/lang-4.x/tree-sitter/
COPY ./src/r-bridge/lang-4.x/tree-sitter/tree-sitter.wasm /app/dist/r-bridge/lang-4.x/tree-sitter/

# install and build all modules
RUN npm ci && npm run build


FROM node:22.6-alpine3.19 AS flowr

LABEL author="Florian Sihler" git="https://github.com/flowr-analysis/flowr"

WORKDIR /app

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/community" >> /etc/apk/repositories; apk add --no-cache --update R

COPY ./scripts/demo.R LICENSE /app/

# copy all package.jsons so we can install them (see below)
COPY ./package.json ./package-lock.json /app/

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
    "/app/dist/cli/flowr.js"\
   ]
