.PHONY: dev dev-demo build start lint install docker-up docker-down docker-logs clean cf-deploy cf-deploy-unlocked cf-build cf-preview

dev: ## Run the Next.js dev server (clears the .next cache first to avoid stale UI)
	rm -rf .next
	pnpm dev

dev-demo: ## Run the Next.js dev server in read-only demo mode (clears the .next cache first)
	rm -rf .next
	NEXT_PUBLIC_DEMO_MODE=true pnpm dev

build: ## Production build
	pnpm build

start: ## Run the production build
	pnpm start

lint: ## Lint the project
	pnpm lint

install: ## Install dependencies
	pnpm install

docker-up: ## Rebuild and start app + MinIO via docker compose
	docker compose up --build

docker-down: ## Stop docker compose stack
	docker compose down

docker-logs: ## Tail docker compose logs
	docker compose logs -f

clean: ## Remove build artifacts
	rm -rf .next

cf-build: ## Build for Cloudflare Workers without deploying
	STORAGE_DRIVER=r2 R2_BUCKET_BINDING=BOOKHOARD_BUCKET pnpm build:cloudflare

cf-preview: ## Build and run the Cloudflare Worker locally via wrangler
	STORAGE_DRIVER=r2 R2_BUCKET_BINDING=BOOKHOARD_BUCKET pnpm preview:cloudflare

cf-deploy: ## Deploy the demo to Cloudflare, read-only (uploads/deletes/settings disabled)
	STORAGE_DRIVER=r2 R2_BUCKET_BINDING=BOOKHOARD_BUCKET NEXT_PUBLIC_DEMO_MODE=true pnpm build:cloudflare
	npx wrangler deploy

cf-deploy-unlocked: ## Deploy the demo to Cloudflare with uploads/deletes/settings enabled — lock it back down with cf-deploy when done
	STORAGE_DRIVER=r2 R2_BUCKET_BINDING=BOOKHOARD_BUCKET pnpm build:cloudflare
	npx wrangler deploy
