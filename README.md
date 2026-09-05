# SecureWatch IoT

> **Deterministic Security Intelligence for IoT Device Fleets**

SecureWatch IoT is a centralized security command center for IoT device fleets built on the MERN stack (MongoDB, Express.js, React, Node.js). It provides continuous security monitoring, deterministic rule-based anomaly detection, transparent 7-factor risk scoring, event correlation into actionable incidents, firmware security lifecycle tracking, and an integrated IoT fleet simulator.

---

## Monorepo Architecture

```
securewatch-iot/
├── client/         # React 18 + Vite + Tailwind CSS Single Page Application
├── server/         # Express.js REST API + Embedded Aedes MQTT Broker + MongoDB
├── simulator/      # Node.js IoT Device Fleet Simulator (MQTT/REST)
├── docs/           # Architectural, API, and setup documentation
├── package.json    # Root npm workspaces configuration
└── prd.md          # Master Product Requirements Document (Single Source of Truth)
```

---

## Prerequisites

- **Node.js**: v20.x LTS or higher
- **npm**: v10.x or higher
- **MongoDB**: v7.x or higher (local or MongoDB Atlas connection)

---

## Quick Start (Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy the example environment file for the server:
```bash
cp .env.example server/.env
```

### 3. Run the Applications

- **Start Server (API + Health Endpoint)**:
  ```bash
  npm run dev:server
  ```
  API runs at `http://localhost:5000`  
  Health Check: `http://localhost:5000/api/v1/health`

- **Start Frontend (Client)**:
  ```bash
  npm run dev:client
  ```
  UI runs at `http://localhost:5173`

- **Start Simulator Foundation**:
  ```bash
  npm run dev:simulator
  ```

---

## Implementation Status

We are currently following the approved **14-Phase Implementation Roadmap** defined in [`prd.md`](./prd.md):

- [x] **Phase 1: Project & Monorepo Foundation** (Current)
- [ ] **Phase 2: Database Foundation**
- [ ] **Phase 3: Authentication & RBAC**
- [ ] **Phase 4: Organization & Device Management**
- [ ] **Phase 5: Minimal IoT Telemetry Simulator (v1)**
- [ ] **Phase 6: MQTT + Telemetry Ingestion**
- [ ] **Phase 7: Detection / Anomaly Engine**
- [ ] **Phase 8: Security Events & Risk Engine**
- [ ] **Phase 9: Event Correlation & Incident Management**
- [ ] **Phase 10: Firmware Security & Deployment**
- [ ] **Phase 11: Frontend Dashboard & Real-Time Integration**
- [ ] **Phase 12: Full IoT Simulator & Security Scenarios (v2/v3)**
- [ ] **Phase 13: Testing & Security Hardening**
- [ ] **Phase 14: Documentation, Deployment & Final Demo**
