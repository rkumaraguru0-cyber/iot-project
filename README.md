# SecureWatch IoT Platform

> **Enterprise-Grade IoT Security Operations Center (SOC) & Fleet Telemetry Security Intelligence**
> Built strictly on the MERN Stack: MongoDB, Express.js, React 18, Node.js + Embedded Aedes MQTT Broker + Socket.IO

---

## Table of Contents
1. [Platform Overview & Architecture](#1-platform-overview--architecture)
2. [Complete Phase 1–13 Feature Inventory](#2-complete-phase-113-feature-inventory)
3. [MERN & Monorepo Architecture](#3-mern--monorepo-architecture)
4. [Data Architecture & Mongoose Models](#4-data-architecture--mongoose-models)
5. [Authentication, RBAC & Multi-Tenancy](#5-authentication-rbac--multi-tenancy)
6. [MQTT Telemetry & Broker Architecture](#6-mqtt-telemetry--broker-architecture)
7. [The Central Security Pipeline](#7-the-central-security-pipeline)
8. [Real-Time SOC Dashboard & Visualizations](#8-real-time-soc-dashboard--visualizations)
9. [Attack Telemetry Simulator Engine](#9-attack-telemetry-simulator-engine)
10. [Security Hardening & Dependency Advisories](#10-security-hardening--dependency-advisories)
11. [Environment Configuration](#11-environment-configuration)
12. [Local Development Setup](#12-local-development-setup)
13. [Production Deployment Procedure Summary](#13-production-deployment-procedure-summary)
14. [Comprehensive API Reference](#14-comprehensive-api-reference)
15. [Demo & Smoke Testing Guides](#15-demo--smoke-testing-guides)
16. [Phase 14 Scope & Deployment Verification Boundaries](#16-phase-14-scope--deployment-verification-boundaries)

---

## 1. Platform Overview & Architecture

SecureWatch IoT is a specialized, multi-tenant Security Operations Center (SOC) platform engineered to defend, monitor, and manage heterogeneous IoT device fleets. Unlike general IoT management platforms, SecureWatch focuses strictly on **deterministic security intelligence, threat detection, transparent risk scoring, automated incident response, and firmware integrity**.

```
                           +-------------------------------------------------------------+
                           |                     IoT Device Fleet                        |
                           |  (Sensors, Cameras, Industrial Gateways, Medical Monitors)  |
                           +------------------------------+------------------------------+
                                                          |
                                      +-------------------+-------------------+
                                      |                                       |
                           MQTT Telemetry (TCP 1883)               REST Telemetry (HTTP POST)
                                      |                                       |
                                      v                                       v
                           +----------------------+               +-----------------------+
                           | Embedded Aedes MQTT  |               |  Express REST API     |
                           | Broker (Auth & ACL)  |               |  (/telemetry/ingest)  |
                           +----------+-----------+               +-----------+-----------+
                                      |                                       |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +---------------------------------------+
                                      |     Telemetry Validation & Ingest     |
                                      |     (+/-5m Timestamp / Device Sync)   |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +---------------------------------------+
                                      |    Phase 7 Anomaly Detection Engine   |
                                      |    (System Rules + Tenant Rules)      |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +---------------------------------------+
                                      |  Phase 8 Security Event & Risk Engine |
                                      |  (1h Atomic Window / 3-Factor Risk)   |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +---------------------------------------+
                                      | Phase 9 Incident Correlation Engine   |
                                      | (3 Strategies + SLAs + Auto-Response) |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +---------------------------------------+
                                      |  Phase 10 OTA Firmware Security &     |
                                      |  Incident-Response Rollback           |
                                      +-------------------+-------------------+
                                                          |
                                                          v
                                      +---------------------------------------+
                                      | Phase 11 Real-Time SOC UI (Socket.IO) |
                                      | (React 18 + Custom SVG Charts)        |
                                      +---------------------------------------+
```

---

## 2. Complete Phase 1–13 Feature Inventory

| Phase | Core Domain | Architectural Capabilities & Delivered Modules | Key Source Files |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Foundation & Tenancy | Multi-tenant data model, `Organization` collection, bootstrap admin flow (`POST /api/v1/auth/register`), JWT authentication middleware, tenant-scoped query middleware (`orgScope`). | [`Organization.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/models/Organization.js)<br>[`orgScope.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/middleware/orgScope.js) |
| **Phase 2** | User & RBAC | 4-tier organization RBAC hierarchy (`viewer` < `operator` < `security_analyst` < `org_admin`) + `super_admin`, bcrypt password hashing, refresh token rotation in httpOnly cookie (`RefreshToken`), user invites. | [`User.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/models/User.js)<br>[`rbac.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/middleware/rbac.js) |
| **Phase 3** | Device Registry | Device inventory, cryptographic API key generation (`crypto.randomBytes`) and SHA-256 one-way hashing (`apiKeyHash`), lifecycle status (`active`, `inactive`, `quarantined`, `decommissioned`), health status (`healthy`, `degraded`, `offline`), key regeneration. | [`Device.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/models/Device.js)<br>[`device.service.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/services/device.service.js) |
| **Phase 4** | Audit & Security Controls | Immutable `AuditLog` collection, `logAuditEvent` helper, automated tracking for security-critical admin actions (device status, role changes, API key revocations, incident actions). | [`AuditLog.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/models/AuditLog.js)<br>[`audit.service.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/services/audit.service.js) |
| **Phase 5** | MQTT Broker Integration | Embedded Aedes MQTT broker (`aedes ^0.51.3`) listening on TCP port 1883, client authentication hook against `Device.apiKeyHash`, topic ACL enforcement for `<orgSlug>/devices/<deviceId>/telemetry`. | [`aedesBroker.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/mqtt/aedesBroker.js)<br>[`authorizer.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/mqtt/authorizer.js) |
| **Phase 6** | Telemetry Pipeline | Dual ingest (MQTT topic subscription + REST fallback `POST /api/v1/telemetry/ingest`), strict timestamp validation ($\pm 5$ min time window), device health tracking, Mongoose `Telemetry` time-series collection. | [`Telemetry.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/models/Telemetry.js)<br>[`telemetry.service.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/services/telemetry.service.js) |
| **Phase 7** | Anomaly Detection Engine | Rule-based engine (`ruleEvaluator.js`) supporting numeric comparisons (`>`, `<`, `>=`, `<=`, `==`, `!=`), cross-field deviation checks, sliding telemetry buffer (`telemetryBuffer.js`), cooldown manager (`cooldownManager.js`), dry-run endpoint. | [`AnomalyRule.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/models/AnomalyRule.js)<br>[`ruleEvaluator.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/services/anomaly/ruleEvaluator.js) |
| **Phase 8** | Security Events & Risk Engine | Persisted `SecurityEvent` model (`open`, `acknowledged`, `resolved`, `false_positive`), 1-hour atomic aggregation window (`EVT-...`), 3-factor composite risk engine (max 60 events + max 20 health + max 20 anomalies = 0-100 score). | [`SecurityEvent.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/models/SecurityEvent.js)<br>[`risk.service.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/services/risk.service.js) |
| **Phase 9** | Incident Response & SLAs | 3 correlation strategies (`CORR-TEMPORAL`, `CORR-REPEATED`, `CORR-ESCALATION`), incident state machine, authoritative SLA tracking (Critical: 15m/4h, High: 1h/24h, Medium: 4h/72h, Low: 24h/7d), response actions (`quarantine_device`, `revoke_key`, `rollback_firmware`). | [`Incident.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/models/Incident.js)<br>[`correlation.service.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/services/correlation.service.js) |
| **Phase 10** | OTA Firmware Management | `FirmwareVersion` registry, SHA-256 payload integrity, `FirmwareDeployment` tracking with OTA state machine (`pending` $\to$ `downloading` $\to$ `installing` $\to$ `verifying` $\to$ `success`/`failed`), explicit rollback service (`rollback_firmware`). | [`FirmwareVersion.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/models/FirmwareVersion.js)<br>[`firmware.service.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/services/firmware.service.js) |
| **Phase 11** | Real-Time Dashboard & UI | Single-Page Application (Vite + React 18 + Tailwind CSS), custom SVG charts, Socket.IO rooms per tenant (`org:<orgId>`), in-app Notification center. | [`dashboard.service.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/services/dashboard.service.js)<br>[`client/src/components/dashboard/`](file:///d:/Antigravity/iot%20security%20platform/client/src/components/dashboard/) |
| **Phase 12** | Attack Telemetry Simulator | Standalone CLI simulator (`simulator/`) with 5 device profiles, 6 anomaly modes, 6 multi-stage attack scenarios, time scaling (`--time-scale`), and dual transports (MQTT/REST). | [`scenarioRunner.js`](file:///d:/Antigravity/iot%20security%20platform/simulator/src/scenarios/scenarioRunner.js)<br>[`scenarioDefinitions.js`](file:///d:/Antigravity/iot%20security%20platform/simulator/src/scenarios/scenarioDefinitions.js) |
| **Phase 13** | Testing & Hardening | 37 server Jest suites (400 tests), 7 simulator Jest suites (60 tests), global rate limiter (`apiLimiter`), auth limiter (`authLimiter`), ingest limiter (`telemetryIngestLimiter`), OWASP hardening audit. | [`securityHardening.test.js`](file:///d:/Antigravity/iot%20security%20platform/server/tests/securityHardening.test.js)<br>[`rateLimiter.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/middleware/rateLimiter.js) |

---

## 3. MERN & Monorepo Architecture

The repository is organized as an npm workspaces monorepo:

```
iot security platform/
├── client/                     # React 18 Single-Page Application (Vite, Tailwind CSS, TanStack Query)
│   ├── src/
│   │   ├── components/         # Modular SOC UI widgets (Dashboard, Devices, Events, Incidents, Firmware)
│   │   ├── contexts/           # React Contexts (AuthContext, SocketContext)
│   │   ├── pages/              # Primary route views
│   │   └── services/           # Axios API clients
│   └── package.json
├── server/                     # Express.js REST API + Aedes MQTT Broker + Mongoose ORM
│   ├── src/
│   │   ├── config/             # Environment, Database, and Broker configurations
│   │   ├── controllers/        # Express route controllers
│   │   ├── middleware/         # Auth, RBAC, Rate Limiting, Validation, Org Scoping
│   │   ├── models/             # 13 Mongoose Schemas and Models
│   │   ├── mqtt/               # Embedded Aedes MQTT broker, Auth, and Message Router
│   │   ├── routes/             # 15 Express Route modules (63 REST endpoints)
│   │   ├── services/           # Core domain logic (Anomaly, Risk, Correlation, Firmware, Notifications)
│   │   ├── socket/             # Socket.IO event emitter and room management
│   │   └── validators/         # Joi schema validators
│   ├── tests/                  # 37 Jest test suites (400 automated unit & integration tests)
│   └── package.json
├── simulator/                  # Node.js IoT Fleet Telemetry & Attack Simulation Engine
│   ├── src/
│   │   ├── engine/             # Fleet simulator, Device Profile generators, Anomaly Injector
│   │   ├── scenarios/          # 6 Multi-stage attack scenario definitions and Runner
│   │   ├── transports/         # MQTT and REST output dispatchers
│   │   └── config.js           # CLI arguments and environment options
│   ├── tests/                  # 7 Jest test suites (60 tests)
│   └── package.json
├── docs/                       # Architectural and setup guides
├── DEPLOYMENT.md               # Production deployment, Docker, Nginx, and SSL guide
├── DEMO_GUIDE.md               # 6-Scenario demonstration script & evaluation walkthrough
├── SMOKE_TEST.md               # 13-Step post-deployment verification checklist
├── package.json                # Root workspaces manifest
└── prd.md                      # Product Requirements Document
```

---

## 4. Data Architecture & Mongoose Models

SecureWatch IoT defines 13 strongly typed Mongoose collections in `server/src/models/`:

1. **`Organization`**: Multi-tenant container holding company metadata, subscription status, and configurable SLA thresholds.
2. **`User`**: User accounts with bcrypt-hashed passwords, assigned role, and organization reference.
3. **`RefreshToken`**: Cryptographically secure token hashes supporting sliding-session refresh token rotation.
4. **`Device`**: Device registry storing hardware metadata, SHA-256 API key hash, lifecycle state (`active`, `inactive`, `quarantined`, `decommissioned`), communication health (`healthy`, `degraded`, `offline`), and cached risk scores.
5. **`Telemetry`**: Time-series telemetry entries storing device metrics (`cpu_usage`, `memory_usage`, `temperature`, `battery_level`, `network_in`, `network_out`, `error_count`), timestamps, and metadata.
6. **`AnomalyRule`**: Rule specifications defining numeric evaluation conditions, device type targets, severity, and custom expressions.
7. **`Anomaly`**: Detection log documents linking triggered rule breaches to exact telemetry documents.
8. **`SecurityEvent`**: Consolidated security alerts aggregating repeated anomalies within a 1-hour window (`open`, `acknowledged`, `resolved`, `false_positive`).
9. **`Incident`**: Correlated security incidents with automated timeline tracking, evidence items, notes, response actions, and SLA deadlines.
10. **`FirmwareVersion`**: Firmware release registry storing version numbers, target device types, and SHA-256 checksums.
11. **`FirmwareDeployment`**: OTA deployment tasks tracking stage transitions (`pending` $\to$ `downloading` $\to$ `installing` $\to$ `verifying` $\to$ `success`/`failed` $\to$ `rolled_back`).
12. **`Notification`**: In-app analyst notifications with severity badges, entity references, and read state.
13. **`AuditLog`**: Immutable audit logs capturing all administrative and security actions.

---

## 5. Authentication, RBAC & Multi-Tenancy

### Role-Based Access Control (RBAC) Matrix
The platform enforces a strict 4-tier organization hierarchy plus a platform-level Super Administrator:

| Capability / Resource | `viewer` | `operator` | `security_analyst` | `org_admin` | `super_admin` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **View Dashboard, Devices, Telemetry** | Yes | Yes | Yes | Yes | Yes |
| **Acknowledge Security Events** | No | Yes | Yes | Yes | Yes |
| **Resolve / Dismiss Security Events** | No | No | Yes | Yes | Yes |
| **Triage & Transition Incidents** | No | Yes | Yes | Yes | Yes |
| **Execute Quarantine & Rollback Actions** | No | No | Yes | Yes | Yes |
| **Create & Edit Custom Anomaly Rules** | No | No | Yes | Yes | Yes |
| **Register Devices & Regenerate API Keys** | No | No | Yes | Yes | Yes |
| **Upload Firmware & Schedule Deployments**| No | No | Yes | Yes | Yes |
| **Invite & Manage Organization Users** | No | No | No | Yes | Yes |
| **Update Org SLA & Alert Settings** | No | No | No | Yes | Yes |
| **Create New Tenant Organizations** | No | No | No | No | Yes |

### Tenant Isolation
Every database query against tenant-scoped data automatically applies `organizationId` matching via [`orgScope.js`](file:///d:/Antigravity/iot%20security%20platform/server/src/middleware/orgScope.js). Cross-tenant access is strictly rejected at the middleware boundary.

---

## 6. MQTT Telemetry & Broker Architecture

- **Broker Engine:** Embedded Aedes MQTT broker (`aedes ^0.51.3`) listening on TCP port 1883.
- **Client Authentication:** During MQTT `CONNECT`, `aedes.authenticate` verifies the device's provided password (API key) by computing its SHA-256 hash and verifying existence in the `Device` collection.
- **Topic Authorization & Namespace:** Devices are strictly restricted to publishing and subscribing to their own dedicated topic namespace:
  ```
  <orgSlug>/devices/<deviceId>/telemetry
  ```
- **Message Dispatch:** Validated MQTT payloads are parsed by `messageHandler.js` and forwarded to `telemetry.service.js` for time window verification ($\pm 5$ min), database persistence, and pipeline ingestion.

---

## 7. The Central Security Pipeline

```
1. Telemetry Ingest (MQTT/REST)
   ├── Validate Timestamp (+/-5m window)
   ├── Record metrics in Telemetry collection
   └── Update Device lastSeenAt & healthStatus
         │
         v
2. Phase 7: Anomaly Detection Engine
   ├── Match candidate rules (System + Tenant)
   ├── Evaluate sliding buffer & consecutive counts
   └── Persist Anomaly document on breach
         │
         v
3. Phase 8: Security Event Engine
   ├── Check 1-hour atomic aggregation window
   ├── Aggregate occurrences or create EVT-YYYYMMDD-HEX6
   └── Trigger non-blocking Device Risk recalculation
         │
         v
4. Phase 8: 3-Factor Risk Engine (0-100)
   ├── Factor 1: Active Security Events (Max 60 pts)
   ├── Factor 2: Device Communication Health (Max 20 pts)
   ├── Factor 3: Anomaly Repetition & Malformed Traffic (Max 20 pts)
   └── Classify Severity: Low (0-19), Medium (20-49), High (50-74), Critical (75-89), Severe (90-100)
         │
         v
5. Phase 9: Incident Correlation Engine
   ├── Evaluate Strategy 1 (CORR-TEMPORAL: >=3 events in 30m)
   ├── Evaluate Strategy 2 (CORR-REPEATED: >=5 rule breaches in 60m)
   ├── Evaluate Strategy 3 (CORR-ESCALATION: Attach & escalate open incident)
   └── Calculate SLA deadlines (Critical: 15m/4h, High: 1h/24h, Medium: 4h/72h, Low: 24h/7d)
         │
         v
6. Incident Response & Mitigation
   ├── Quarantine Device (Device status -> quarantined)
   ├── Revoke API Key (apiKeyHash -> null)
   └── Rollback Firmware (Invokes Phase 10 rollbackFailedDeploymentForDevice)
```

---

## 8. Real-Time SOC Dashboard & Visualizations

The frontend dashboard provides high-density, real-time visualization tailored for security analysts:
- **WebSocket Streaming:** Socket.IO client listens on tenant-isolated room (`org:<orgId>`) for real-time telemetry updates, security event triggers, risk score changes, and incident status transitions.
- **Custom Chart Implementations:** Built with lightweight, custom React SVG and Tailwind CSS widgets (no heavy external chart libraries like Recharts):
  - `AnomalyTrendWidget`: 7-day contiguous UTC trend bar visualization.
  - `RiskDistributionWidget`: Fleet-wide risk posture tier breakdown.
  - `FleetPostureWidget`: Real-time active/quarantined/degraded device meters.
  - `TopRiskDevicesWidget`: Ranked high-risk device inventory with explainable factor breakdown.
  - `SlaComplianceWidget`: Real-time incident SLA triage and resolution countdown timers.

---

## 9. Attack Telemetry Simulator Engine

The standalone simulator (`simulator/`) generates realistic baseline and multi-stage cyber attack telemetry.

### 5 Device Profiles
1. `temperature_sensor` (Industrial environment temperature & humidity)
2. `smart_camera` (Surveillance camera with high bandwidth and fps telemetry)
3. `industrial_gateway` (Edge computing node with multi-core CPU and memory metrics)
4. `medical_monitor` (Patient biometric and battery telemetry)
5. `smart_lock` (Facility access point with battery and state telemetry)

### 6 Anomaly Modes
- `threshold`: Injects continuous out-of-bounds CPU ($92.0\% - 98.0\%$) across $\ge 10$ intervals.
- `network-spike`: Injects massive egress network traffic ($50\times$ baseline) across $\ge 5$ intervals.
- `impossible-value`: Injects physically impossible reading ($\text{temperature} = -300.0^\circ\text{C}$).
- `heartbeat`: Suppresses telemetry transmission for $300\text{s}$ without mutating server database state.
- `auth-bruteforce`: Simulates 10 rapid failed authentication attempts over MQTT or REST within 2 minutes.
- `firmware-tamper`: Injects an unauthorized firmware version string (`9.9.9-pwned`) into telemetry metadata.

### 6 Multi-Stage Attack Scenarios
1. **Scenario 1 (`Normal Fleet`):** 10 devices operating with standard Gaussian telemetry for 30m with 0 anomalies.
2. **Scenario 2 (`Single Device Compromise`):** 1 smart camera 4-stage compromise: Auth brute force $\to$ off-schedule reporting $\to$ network egress spike $\to$ firmware version tamper. *(Note: Live transport uses current system timestamp to satisfy Phase 6 $\pm 5$ min time window validation).*
3. **Scenario 3 (`Firmware Exploit`):** 1 industrial gateway running vulnerable firmware 1.0.3: Gradual CPU ramp ($45\% \to 95\%$) $\to$ memory exhaustion ($>90\%$) $\to$ network egress spike ($50\times$).
4. **Scenario 4 (`Gradual Degradation`):** 1 temperature sensor temperature drifts $+0.5^\circ\text{C}/\text{min}$ from $25^\circ\text{C}$ to $90^\circ\text{C}$ over 130 minutes.
5. **Scenario 5 (`Fleet-Wide Attack`):** 5 devices simultaneously subjected to auth brute force (10 attempts each) followed by simultaneous network egress spikes ($50\times$).
6. **Scenario 6 (`False Positive Validation`):** Fleet-wide borderline safe metrics (CPU: 80-84%, Temp: 55-58°C, Memory: 85-88%, Battery: 20-25%, 4 auth failures). Exactly 0 rules triggered.

### CLI Flags
```bash
node simulator/src/index.js [options]

Options:
  --org-slug <slug>         Organization slug (default: 'default-org')
  --org-id <id>             Organization ObjectId
  --device-count <count>    Number of devices to simulate (default: 5)
  --interval <ms|s>         Emission interval (default: 5000ms)
  --mode <mode>             Output mode: 'console' | 'dry-run' | 'mqtt' | 'rest'
  --anomaly <mode>          Inject standalone anomaly mode
  --target-device <id>      Target specific device ID
  --scenario <1-6>          Run multi-stage scenario (1 to 6)
  --time-scale <multiplier> Time acceleration factor (e.g. 10 for 10x speed, alias -s)
  --duration <s|m>          Simulation duration override
  --seed <number>           PRNG seed for reproducible random generation
  --api-url <url>           Target REST API URL
  --mqtt-url <url>          Target MQTT broker URL
```

---

## 10. Security Hardening & Dependency Advisories

### Application-Level Security Controls
- **Rate Limiting:** `express-rate-limit` enforces global limits (`apiLimiter`: 300 req/15 min), auth limits (`authLimiter`: 10 req/15 min), and ingest limits (`telemetryIngestLimiter`: 600 req/min).
- **Token Security:** Device API keys and refresh tokens are stored exclusively as SHA-256 one-way hashes.
- **Input Validation:** Every endpoint validates incoming parameters, bodies, and queries with strict Joi schemas.
- **Security Headers:** Configured via `helmet` for XSS protection, MIME sniffing protection, frameguard, and HSTS.

### Known Transitive Dependency Advisories
During the Phase 13 security audit, 3 transitive package advisories were identified:
1. `esbuild` (transitive via Vite dev tooling): Affects local dev server only; zero production runtime exposure.
2. `qs` (transitive via Express body parser): Parsing vulnerability mitigated by strict upstream Joi request schema validation.
3. `uuid` (transitive): Internal identifier generation vulnerability mitigated by native Node.js `crypto.randomBytes` used for all security-sensitive tokens and IDs.

---

## 11. Environment Configuration

### Server Environment (`server/.env`)
```ini
NODE_ENV=development
PORT=5000
HOST=0.0.0.0
MONGODB_URI=mongodb://127.0.0.1:27017/securewatch_iot
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=super_secret_refresh_key_at_least_32_chars
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECRET=super_secret_cookie_signing_key_32_chars
CORS_ORIGIN=http://localhost:5173
MQTT_PORT=1883
MQTT_HOST=0.0.0.0
LOG_LEVEL=info
```

### Client Environment (`client/.env`)
```ini
VITE_API_URL=http://localhost:5000/api/v1
VITE_WS_URL=http://localhost:5000
```

### Simulator Environment (`simulator/.env`)
```ini
SIMULATOR_API_URL=http://localhost:5000/api/v1
SIMULATOR_MQTT_URL=mqtt://localhost:1883
ORGANIZATION_SLUG=default-org
ORGANIZATION_ID=default-org
SIMULATION_DEVICE_COUNT=5
SIMULATION_INTERVAL_MS=5000
SIMULATION_MODE=console
LOG_LEVEL=info
```

---

## 12. Local Development Setup

### 1. Prerequisites
- Node.js `v20.x LTS` or higher
- npm `v10.x` or higher
- MongoDB `v6.0` or higher (running locally on port 27017)

### 2. Installation
```bash
# Clone repository and install all workspace dependencies
npm install
```

### 3. Environment Setup
```bash
cp .env.example server/.env
cp .env.example simulator/.env
```

### 4. Running Development Services
```bash
# Terminal 1: Backend Server (API + Aedes MQTT Broker + Socket.IO)
npm run dev:server

# Terminal 2: Frontend Client (Vite React UI)
npm run dev:client

# Terminal 3: IoT Fleet Simulator (Console / MQTT / Scenarios)
npm run dev:simulator
```

### 5. Running Automated Tests
```bash
# Run complete test suite (Server + Simulator)
npm test

# Run individual workspaces
npm run test:server
npm run test:simulator
```

---

## 13. Production Deployment Procedure Summary

For complete production deployment instructions, Docker containerization, Nginx reverse proxy configuration, and SSL provisioning, refer to [`DEPLOYMENT.md`](file:///d:/Antigravity/iot%20security%20platform/DEPLOYMENT.md).

```bash
# Build frontend production assets
npm run build:client

# Start production server
NODE_ENV=production npm run start --workspace=server
```

---

## 14. Comprehensive API Reference

The server exposes **63 registered REST endpoints** under the `/api/v1` prefix:

### Health & Auth Endpoints
- `GET /api/v1/health` — Public service health and MongoDB connectivity status.
- `POST /api/v1/auth/register` — Initial platform bootstrap (active only when 0 organizations exist).
- `POST /api/v1/auth/login` — Authenticate user and issue JWT access token & httpOnly refresh cookie.
- `POST /api/v1/auth/refresh` — Rotate refresh token and issue new access token.
- `POST /api/v1/auth/logout` — Revoke active refresh token and clear cookie.
- `GET /api/v1/auth/me` — Retrieve current authenticated user session context.

### Device Management
- `POST /api/v1/devices` — Register new device and issue cryptographic API key (`security_analyst+`).
- `GET /api/v1/devices` — List organization devices with filtering and pagination (`viewer+`).
- `GET /api/v1/devices/stats` — Aggregate device counts by status, health, and risk tier (`viewer+`).
- `GET /api/v1/devices/:id` — Retrieve full device details (`viewer+`).
- `PATCH /api/v1/devices/:id` — Update device metadata or status (`operator+`).
- `POST /api/v1/devices/:id/regenerate-key` — Invalidate previous key and issue new API key (`security_analyst+`).
- `GET /api/v1/devices/:id/risk` — Explainable risk score breakdown (`viewer+`).
- `GET /api/v1/devices/:id/telemetry` — Historical time-series telemetry (`viewer+`).
- `GET /api/v1/devices/:id/anomalies` — Device anomaly detection history (`viewer+`).
- `GET /api/v1/devices/:id/security-events` — Device security events (`viewer+`).
- `GET /api/v1/devices/:id/incidents` — Device correlated incidents (`viewer+`).

### Telemetry Ingest
- `POST /api/v1/telemetry/ingest` — REST fallback telemetry ingest (`X-Device-API-Key` required).

### Anomaly Rules & Detection
- `GET /api/v1/rules` — List available system and custom tenant rules (`viewer+`).
- `POST /api/v1/rules/test` — Dry-run rule evaluation without database persistence (`operator+`).
- `GET /api/v1/rules/:id` — Get rule details by ID (`viewer+`).
- `POST /api/v1/rules` — Create custom tenant rule (`security_analyst+`).
- `PATCH /api/v1/rules/:id` — Update tenant rule (`security_analyst+`).
- `DELETE /api/v1/rules/:id` — Soft-delete tenant rule (`org_admin+`).
- `GET /api/v1/anomalies` — List anomaly detection logs (`viewer+`).

### Security Events & Risk
- `GET /api/v1/security-events` — List security events with pagination and filters (`viewer+`).
- `GET /api/v1/security-events/:id` — Retrieve single security event (`viewer+`).
- `PATCH /api/v1/security-events/:id/status` — Transition event status (`operator+` for ack, `security_analyst+` for resolve).
- `GET /api/v1/risk/summary` — Fleet-wide risk posture aggregation (`viewer+`).

### Incidents & Response
- `GET /api/v1/incidents` — List correlated incidents (`viewer+`).
- `GET /api/v1/incidents/stats` — Incident counts, MTTA, and MTTR metrics (`viewer+`).
- `GET /api/v1/incidents/:id` — Full incident investigation details (`viewer+`).
- `PATCH /api/v1/incidents/:id/status` — Transition incident lifecycle state (`operator+`).
- `PATCH /api/v1/incidents/:id/assign` — Assign incident to user (`operator+`).
- `POST /api/v1/incidents/:id/notes` — Append analyst note (`operator+`).
- `POST /api/v1/incidents/:id/actions` — Execute mitigation action (`operator+` for quarantine, `security_analyst+` for rollback/revoke).
- `POST /api/v1/incidents/:id/evidence` — Attach evidence entity (`operator+`).
- `POST /api/v1/incidents/:id/resolve` — Submit resolution summary and root cause (`operator+`).

### Firmware Management
- `POST /api/v1/firmware/versions` — Register new firmware version (`security_analyst+`).
- `GET /api/v1/firmware/versions` — List firmware versions (`viewer+`).
- `GET /api/v1/firmware/versions/:id` — Get firmware version details (`viewer+`).
- `PATCH /api/v1/firmware/versions/:id` — Update firmware metadata (`security_analyst+`).
- `POST /api/v1/firmware/deployments` — Schedule OTA deployment (`security_analyst+`).
- `GET /api/v1/firmware/deployments` — List deployments (`viewer+`).
- `GET /api/v1/firmware/deployments/:id` — Get deployment details (`viewer+`).
- `PATCH /api/v1/firmware/deployments/:id/status` — Report OTA stage status (Dual JWT / Device Key).

### Dashboard, Notifications & Administration
- `GET /api/v1/dashboard/summary` — SOC summary posture counts (`viewer+`).
- `GET /api/v1/dashboard/trends` — 7-day UTC security event trends (`viewer+`).
- `GET /api/v1/notifications` — List analyst notifications (`viewer+`).
- `GET /api/v1/notifications/unread-count` — Unread count (`viewer+`).
- `PATCH /api/v1/notifications/read-all` — Mark all as read (`viewer+`).
- `PATCH /api/v1/notifications/:id/read` — Mark single notification read (`viewer+`).
- `GET /api/v1/audit-logs` — Query immutable audit trail (`security_analyst+`).
- `GET /api/v1/users` — List organization users (`viewer+`).
- `POST /api/v1/users/invite` — Invite new user (`org_admin+`).
- `GET /api/v1/users/:id` — Get user profile (`viewer+`).
- `PATCH /api/v1/users/:id` — Update user role or status (`org_admin+`).
- `GET /api/v1/users/me` — Get profile (Self).
- `PATCH /api/v1/users/me` — Update profile (Self).
- `PATCH /api/v1/users/me/password` — Change password (Self).
- `GET /api/v1/organizations/current` — Current tenant settings (`viewer+`).
- `PATCH /api/v1/organizations/current` — Update tenant SLA & alert settings (`org_admin+`).
- `POST /api/v1/organizations` — Create tenant organization (`super_admin`).

---

## 15. Demo & Smoke Testing Guides

- **Live Demonstration Guide:** Step-by-step walkthrough of all 6 attack scenarios, persona workflows, and expected SOC interface behavior is detailed in [`DEMO_GUIDE.md`](file:///d:/Antigravity/iot%20security%20platform/DEMO_GUIDE.md).
- **Post-Deployment Smoke Test:** 13-step operational checklist covering health probes, authentication, MQTT validation, incident correlation, and rollback integration is detailed in [`SMOKE_TEST.md`](file:///d:/Antigravity/iot%20security%20platform/SMOKE_TEST.md).

---

## 16. Phase 14 Scope & Deployment Verification Boundaries

To preserve strict engineering rigor, the platform differentiates between **Source-Code Readiness** and **Actual Deployment Verification**:
- **Source-Code Readiness:** Verified. All configuration templates, build scripts, test suites, and models are implemented, passing, and frozen on `main`.
- **Live Deployment Verification:** Operational verification (production TLS termination, cloud MongoDB replica set connectivity, public reverse proxy DNS routing, external MQTT broker firewall traversal, and smoke test execution) must be performed within the target cloud hosting environment as outlined in [`DEPLOYMENT.md`](file:///d:/Antigravity/iot%20security%20platform/DEPLOYMENT.md).

---

## License
MIT License. Built for IoT Fleet Security Operations.
