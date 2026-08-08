# optional full-history signature database. The default is a tiny image with no data (image stays small);
# bake the full bundle in by overriding with the published data image:
#   docker build --build-arg SIGDB_IMAGE=ghcr.io/flowr-analysis/flowr-sigdb:latest ...
ARG SIGDB_IMAGE=busybox:stable
FROM ${SIGDB_IMAGE} AS sigdb-full
RUN mkdir -p /data/sigdb

FROM node:25.3-alpine3.23 AS builder

WORKDIR /app

# copy the source and build files of all modules into the workdir
COPY ./src /app/src
COPY ./test /app/test
COPY ./scripts /app/scripts
COPY ./package.json ./package-lock.json ./tsconfig.json /app/

# install python and build tools for node-gyp
RUN apk add --no-cache python3 make g++

RUN npm ci && npm run build:bundle-flowr && npx ts-node --transpile-only scripts/sigdb-decompress-all.ts dist/src/data/sigdb

# merge in the full-history database when one was provided via SIGDB_IMAGE (the default busybox ships none),
# then decompress all shards so they're ready for fast queries
COPY --from=sigdb-full /data/sigdb/ /tmp/sigdb-full/
RUN if ls /tmp/sigdb-full/*.br >/dev/null 2>&1; then \
      cp /tmp/sigdb-full/* dist/src/data/sigdb/ && npx ts-node --transpile-only scripts/sigdb-decompress-all.ts dist/src/data/sigdb; \
    fi; rm -rf /tmp/sigdb-full

# make sure the image ships the FULL bundle: a local build already copied current.*/history.* in; a fresh
# clone shipped only the base floor, so download whatever the committed link file lists but is still missing
# (from the free release), then decompress all shards. Never fails the build (offline -> base floor).
RUN npx ts-node --transpile-only scripts/sigdb-bake.ts dist/src/data/sigdb && npx ts-node --transpile-only scripts/sigdb-decompress-all.ts dist/src/data/sigdb

# stage the sigdb bundle aside so the final image copies it as its own layer (it is large and versioned
# independently of the code, so a code-only rebuild reuses the cached database layer and vice versa)
RUN mv dist/src/data/sigdb /app/sigdb-bundle


FROM node:25.3-alpine3.23 AS flowr

LABEL author="Florian Sihler" git="https://github.com/flowr-analysis/flowr"

WORKDIR /app

# persist the v8 module compile cache so container startup skips recompiling the bundle
ENV NODE_COMPILE_CACHE=/app/.compile-cache

COPY ./scripts/demo.R LICENSE /app/
# the signature databases as their own image layer, before the code copy, so a code-only change reuses it
COPY --from=builder /app/sigdb-bundle /app/src/data/sigdb
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
