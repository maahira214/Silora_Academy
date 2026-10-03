# Nightly database backup to Cloudflare R2. pg_dump/pg_restore come from the same
# Postgres major version as the database (17), so dumps always restore cleanly.
FROM postgres:17-alpine
RUN apk add --no-cache nodejs npm
WORKDIR /backup
RUN npm init -y >/dev/null && npm install --omit=dev aws4fetch@1.0.20 && npm cache clean --force
COPY scripts/backup.mjs ./backup.mjs
# Overrides the postgres image's entrypoint: this container only runs the backup schedule.
ENTRYPOINT []
CMD ["node", "backup.mjs", "schedule"]
