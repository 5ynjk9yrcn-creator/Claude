# Zero dependencies means the image is just Node plus this source tree.
FROM node:22-alpine

RUN apk add --no-cache git tini && addgroup -S radar && adduser -S radar -G radar

WORKDIR /app
COPY --chown=radar:radar . .

RUN mkdir -p /data && chown -R radar:radar /data
USER radar

ENV NODE_ENV=production \
    PORT=8080 \
    DATABASE_PATH=/data/sunsetradar.db \
    REPOS_DIR=/data/repos

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "bin/sunsetradar.js", "serve"]
