# syntax=docker/dockerfile:1

FROM node:25.3-alpine3.23 AS builder

WORKDIR /app

# copy the source and build files of all modules into the workdir
COPY ./src /app/src
COPY ./test /app/test
COPY ./scripts /app/scripts
COPY ./package.json ./package-lock.json ./tsconfig.json /app/

# install python and build tools for node-gyp
RUN apk add --no-cache python3 make g++

# install and build all modules, then ship the sigdb dictionary uncompressed so the first package
# lookup skips its brotli decompression (the shards stay compressed and decompress lazily)
RUN npm ci && npm run build:bundle-flowr && node scripts/sigdb-decompress-dict.mjs dist/src/data/sigdb


FROM node:25.3-alpine3.23 AS flowr

LABEL author="Florian Sihler" git="https://github.com/flowr-analysis/flowr"

WORKDIR /app

# persist the v8 module compile cache so container startup skips recompiling the bundle
ENV NODE_COMPILE_CACHE=/app/.compile-cache

COPY ./scripts/demo.R LICENSE /app/
COPY --from=builder /app/dist /app
COPY ./package.json ./package-lock.json /app/

# install deps, make new user and clean up the test files
RUN npm ci --omit=dev --omit=optional && npm cache clean --force && \
    echo "http://dl-cdn.alpinelinux.org/alpine/edge/community\nhttp://dl-cdn.alpinelinux.org/alpine/edge/main"  \
          >> /etc/apk/repositories; apk add --no-cache icu-libs=76.1-r1 R=4.5.2-r0 && \
    rm -rf /app/package.json /app/node_modules/**/*.md /app/node_modules/.bin  \
           /app/node_modules/**/LICENSE /app/package-lock.json \
           /app/**/tsconfig.tsbuildinfo /app/**/*.d.ts /app/test/* && \
    addgroup -S flowr && adduser -S flowr -G flowr && \
    mkdir -p /app/.compile-cache && chown -R flowr:flowr /app/.compile-cache
USER flowr

# prime the compile cache with a real analysis so the hot path is warm on first run
RUN node /app/src/cli/flowr.min.js --execute ":dataflowsilent file://demo.R" >/dev/null

# we also configure basic memory options
ENTRYPOINT [\
   "node",\
   "--max-old-space-size=8192",\
   "--stack-size=8192",\
   "/app/src/cli/flowr.min.js"\
  ]
