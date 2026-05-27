#!/bin/sh
# Fix uploads volume ownership at runtime (volume may be root-owned from Docker)
if [ -d /app/uploads ] && [ "$(stat -c '%U' /app/uploads)" != "app" ]; then
    chown -R app:app /app/uploads
fi
exec su-exec app "$@"
