.PHONY: up down build rebuild logs ps restart stop clean verify test demo trust

COMPOSE ?= docker compose

# Bring the whole stack up: builds the app image, starts the app and the
# Caddy HTTPS proxy, waits for the app healthcheck. Everything runs locally;
# nothing is pulled from or calls out to a cloud service at runtime.
up:
	$(COMPOSE) up --build -d
	@echo ""
	@echo "MERIDIAN // VANTAGE is running: https://localhost"
	@echo "(self-signed certificate — see 'make trust', or accept the browser warning once)"

down:
	$(COMPOSE) down

stop:
	$(COMPOSE) stop

build:
	$(COMPOSE) build

rebuild:
	$(COMPOSE) build --no-cache

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

restart:
	$(COMPOSE) restart

# Remove containers, networks and the named volumes (Caddy's local CA/cert
# cache included) — a clean slate.
clean:
	$(COMPOSE) down -v --remove-orphans

# Trust Caddy's local root CA in the host's trust store so the browser stops
# warning about the self-signed certificate. Requires the Caddy CLI on the
# host (brew install caddy / apt install caddy) — optional, purely cosmetic.
trust:
	docker run --rm -v meridian-vantage_caddy_data:/data:ro -v /tmp/meridian-ca:/out alpine \
		sh -c "cp /data/caddy/pki/authorities/local/root.crt /out/meridian-vantage-root.crt"
	@echo "Root CA exported to /tmp/meridian-ca/meridian-vantage-root.crt — import it into your OS/browser trust store."

# Run the full verification suite (typecheck, lint, vitest, headless demo,
# production build) inside a throwaway container built from the same
# devDependencies as the builder stage — no local Node install required.
verify:
	docker build --target builder -t meridian-vantage-builder:local .
	docker run --rm meridian-vantage-builder:local npm run verify

test:
	docker build --target builder -t meridian-vantage-builder:local .
	docker run --rm meridian-vantage-builder:local npm test

demo:
	docker build --target builder -t meridian-vantage-builder:local .
	docker run --rm meridian-vantage-builder:local npm run demo
