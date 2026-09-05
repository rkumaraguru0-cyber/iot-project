# SecureWatch IoT — Architectural Foundation

## Monorepo Layout

The repository is structured as an npm workspaces monorepo containing three primary execution targets:

1. **`server/`**: Express.js REST API layer that hosts domain routing, detection services, risk scoring algorithms, incident state machines, and the embedded Aedes MQTT broker.
2. **`client/`**: React 18 single-page application built with Vite and Tailwind CSS.
3. **`simulator/`**: Standalone Node.js CLI process responsible for generating normal device telemetry (Phase 5) and simulating cyber attack scenarios (Phase 12).

## Layered Server Architecture

The backend follows a strict layered pattern:

```
[HTTP Request] ➔ [Express Route] ➔ [Joi Validation] ➔ [RBAC & Org Scope Middleware]
                                                             │
                                                             ▼
[Mongoose Models] ◄── [Database] ◄── [Domain Service] ◄── [Controller]
```

## Security Design Baseline

- **Input Validation**: Joi middleware validates params, body, and query schemas before controller execution.
- **Access Isolation**: Every tenant-scoped request is filtered by `organizationId`.
- **Security Headers**: Standardized Helmet middleware protects all HTTP endpoints.
- **Cross-Origin Resource Sharing**: CORS whitelisting bound to client origin configuration.
- **Structured Logging**: JSON logging via Winston with Morgan request tracing.
- **Fail-Safe Error Handling**: Centralized error middleware ensuring zero internal stack trace leakage in production.
