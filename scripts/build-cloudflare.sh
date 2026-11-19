#!/bin/sh
# Next.js auto-loads .env during every `next build` and inlines whatever it
# finds into the compiled output — including secrets that have nothing to do
# with Cloudflare (S3_ACCESS_KEY, SMTP passwords, etc. from a developer's
# local self-hosted setup). Rather than maintaining a list of vars to blank
# out (easy to miss one — that's exactly how a real key got leaked once),
# .env is hidden from Next entirely for the duration of this build.
set -e

# A prior run that got killed (SIGKILL can't be trapped) can strand .env
# under this name — put it back before doing anything else.
if [ -f .env.hidden-for-cloudflare-build ] && [ ! -f .env ]; then
  mv .env.hidden-for-cloudflare-build .env
fi

if [ -f .env ]; then
  mv .env .env.hidden-for-cloudflare-build
  trap 'mv .env.hidden-for-cloudflare-build .env' EXIT
fi

# OpenNext rejects patch releases newer than the ones it has tested. The
# app builds and runs fine on them, so skip that gate until OpenNext catches up.
CLOUDFLARE_BUILD=true npx opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion
