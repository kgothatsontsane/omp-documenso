#!/usr/bin/env bash

# Exit on error.
set -e

SCRIPT_DIR="$(readlink -f "$(dirname "$0")")"
WEB_APP_DIR="$SCRIPT_DIR/.."

# Store the original directory
ORIGINAL_DIR=$(pwd)

# Set up trap to ensure we return to original directory
trap 'cd "$ORIGINAL_DIR"' EXIT

cd "$WEB_APP_DIR"

rm -rf build ../../api/server-output

start_time=$(date +%s)

echo "[Build]: Extracting and compiling translations (non-fatal; committed .mjs catalogs are used if this fails)"
npm run translate --prefix ../../ || echo "[Build]: translate step failed, using committed catalogs"

# npm ci's Prisma postinstall can emit an incomplete client when prisma-kysely
# isn't on PATH for the generator subprocess. Regenerate it explicitly so the
# types (DocumentStatus, EnvelopeType, ...) resolve for the typecheck below.
export PATH="$PWD/../../node_modules/.bin:$PATH"
echo "[Build]: Regenerating Prisma client"
prisma generate --schema ../../packages/prisma/schema.prisma

echo "[Build]: Building app"
npm run build:app

echo "[Build]: Building server"
npm run build:server

# Copy over the entry point for the server.
cp server/main.js build/server/main.js

# Copy over all web.js translations (only the compiled .mjs catalogs are imported at
# runtime; the .po source catalogs share a basename with the .mjs and make Vercel's
# function bundler reject the directory, so drop them).
cp -r ../../packages/lib/translations build/server/hono/packages/lib/translations
find build/server/hono/packages/lib/translations -name '*.po' -delete
# Rollup's preserveModules keeps the bare import specifier, emitting a nested
# translations/translations/... directory. Remove it so only the correct
# translations/<locale>/web.mjs layout remains (Vercel rejects duplicate basenames).
rm -rf build/server/hono/packages/lib/translations/translations

# Mirror the built server/client output into the api function path so Vercel's nft
# tracer can resolve ./build/server/... and ./build/client/... from api/index.mjs and
# api/static.mjs. Without this, the function bundle is missing router.js and the
# translation catalogs, causing FUNCTION_INVOCATION_FAILED at runtime.
rm -rf build ../../api/server-output
cp -R build ../../api/server-output
cp package.json ../../api/server-output/package.json

# Time taken
end_time=$(date +%s)

echo "[Build]: Done in $((end_time - start_time)) seconds"
