# SecureWatch IoT — Architectural Foundation

## Monorepo Layout

The repository is structured as an npm workspaces monorepo containing three primary execution targets:

1. **`server/`**: Express.js REST API layer that hosts domain routing (63 REST endpoints across 15 route modules), detection services, 3-factor risk scoring, 3-strategy incident correlation, OTA firmware management, and the embedded Aedes MQTT broker (`aedes ^0.51.3`).
2. **`client/`**: React 18 single-page application built with Vite, Tailwind CSS, TanStack React Query v5, and lightweight custom SVG charts.
3. **`simulator/`**: Standalone Node.js CLI process with 5 device profiles, 6 anomaly modes, 6 multi-stage scenarios, time scaling (`--time-scale`), and dual transports (MQTT and REST fallback).

## Layered Server Architecture

The backend follows a strict layered pattern:

```
[HTTP Request] ➔ [apiLimiter / authLimiter / ingestLimiter] ➔ [Express Route] ➔ [Joi Validation] ➔ [RBAC & Org Scope Middleware]
                                                                                                                │
                                                                                                                ▼
[Mongoose Models] ◄── [MongoDB Database] ◄── [Domain Services] ◄── [Controller Handlers]
```

## Core Security & Reliability Baseline

- **Input Validation**: Joi middleware strictly validates params, body, and query schemas on every endpoint.
- **Tenant Isolation**: Every database query against tenant-scoped data automatically applies `organizationId` matching via `orgScope.js`.
- **Cryptographic Security**: API keys (`DEV_KEY_...`) and refresh tokens are stored exclusively as SHA-256 one-way hashes.
- **Security Headers**: Helmet middleware protects all HTTP endpoints (HSTS, frameguard, XSS protection).
- **Cross-Origin Resource Sharing**: CORS whitelisting bound to client origin configuration.
- **Structured Logging**: JSON logging via Winston with Morgan request tracing.
- **Graceful Shutdown**: Intercepts `SIGINT`/`SIGTERM` to cleanly drain MQTT, WebSockets, HTTP, and MongoDB connections.
- **Fail-Safe Error Handling**: Centralized error middleware ensures internal stack traces are suppressed in production (`NODE_ENV=production`).
