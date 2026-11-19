<p align="center">
  <img src="public/logo.png" alt="Bookhoarder" width="120" />
</p>

<h1 align="center">Bookhoarder</h1>

<p align="center">
  A self-hosted EPUB library. Object storage is the only persistence layer —
  no database to provision, back up, or migrate between versions.
</p>

<p align="center">
  <a href="https://github.com/bookhoard/bookhoarder/actions/workflows/ci.yml"><img src="https://github.com/bookhoard/bookhoarder/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/bookhoard/bookhoarder/releases"><img src="https://img.shields.io/github/v/release/bookhoard/bookhoarder" alt="Latest release"></a>
  <a href="https://github.com/bookhoard/bookhoarder/pkgs/container/bookhoarder"><img src="https://img.shields.io/badge/ghcr.io-bookhoard%2Fbookhoarder-blue?logo=docker&logoColor=white" alt="Docker image"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License"></a>
  <a href="https://bookhoarder.dev"><img src="https://img.shields.io/badge/website-bookhoarder.dev-orange" alt="Website"></a>
  <a href="https://docs.bookhoarder.dev"><img src="https://img.shields.io/badge/docs-docs.bookhoarder.dev-blue" alt="Documentation"></a>
</p>

## Quickstart (Docker)

```bash
docker compose up
```

This starts the app plus a local MinIO instance (the S3-compatible bucket)
and creates the `bookhoard` bucket automatically. Open http://localhost:3000.

## Deploying

Docker is the fastest way to try it; Bookhoarder also runs as a Cloudflare
Worker or in Kubernetes — same image or source, different environment
variables. Full walkthroughs for each are in the docs:

- [Deploy with Docker](https://docs.bookhoarder.dev/deployment/docker)
- [Deploy to Cloudflare](https://docs.bookhoarder.dev/deployment/cloudflare)
- [Deploy on Kubernetes](https://docs.bookhoarder.dev/deployment/kubernetes)
- [Storage backends](https://docs.bookhoarder.dev/storage) — local disk, S3, or Cloudflare R2

## Local development

```bash
pnpm install
cp .env.example .env.local   # defaults to the local filesystem driver
pnpm dev
```

Open http://localhost:3000.

To develop against S3/MinIO instead of the local driver, run `docker compose up minio minio-init`
and set `STORAGE_DRIVER=s3` in `.env.local` (see `.env.example` for the rest of the S3 vars).

## Documentation

Full docs are at [docs.bookhoarder.dev](https://docs.bookhoarder.dev) (source: [bookhoard/docs](https://github.com/bookhoard/docs)), including a [features overview](https://docs.bookhoarder.dev/features) and [HTTP API reference](https://docs.bookhoarder.dev/api/overview).

## Features

- EPUB upload, ingest, and an in-browser reader (epub.js) with per-profile
  reading progress, ratings, and shelves
- Tags and series metadata per book, a tag filter on the library grid, and
  computed Smart Shelves (Unread, Currently Reading, Finished, 5-Star)
- Multi-profile support (admin/reader roles) with optional per-profile
  passwords
- Metadata lookup and cover fetching via Open Library, with manual editing
- Trending books, library search by title/author, and send-to-e-reader over SMTP
- One-click library backup from Settings (admin-only) — metadata-only by
  default, or a full export including every EPUB and cover
- Installable as a PWA for quick access from your phone or desktop home screen
- OPDS catalog feed (`/opds`) for browsing and downloading straight from any
  OPDS-compatible e-reader app — the URL is in Settings → E-Reader Email
- Built-in MCP endpoint, so Claude and other MCP clients can search your
  library, fix metadata, and organize shelves (Settings → MCP shows how to
  connect)
- Pluggable storage driver: local filesystem or S3-compatible object storage,
  including a configurable directory prefix for sharing a bucket with other
  apps (see `docker-compose.yml` for a MinIO-backed setup)

## License

Bookhoarder is licensed under the [GNU Affero General Public License v3.0](LICENSE).
You're free to self-host, modify, and use it — including internally at a
company — but if you run a modified version as a network service, you must
make your modified source available to its users.

