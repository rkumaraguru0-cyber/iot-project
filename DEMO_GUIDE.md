# SecureWatch IoT — Live Demonstration & Evaluation Guide

> **Purpose:** Scripted end-to-end live demonstration of SecureWatch IoT for stakeholders, evaluators, and security analysts.  
> **Coverage:** Personas, RBAC access, real-time dashboard, and all **6 Simulator Cyber Attack Scenarios**.

---

## Table of Contents
1. [Demonstration Preparation & Setup](#1-demonstration-preparation--setup)
2. [User Personas & Role Matrix](#2-user-personas--role-matrix)
3. [Demo Flow 1: Platform Bootstrap & RBAC Login](#3-demo-flow-1-platform-bootstrap--rbac-login)
4. [Demo Flow 2: Device Provisioning & Cryptographic Keys](#4-demo-flow-2-device-provisioning--cryptographic-keys)
5. [Demo Flow 3: Scenario 1 — Normal Fleet Baseline](#5-demo-flow-3-scenario-1--normal-fleet-baseline)
6. [Demo Flow 4: Scenario 2 — Single Device 4-Stage Compromise](#6-demo-flow-4-scenario-2--single-device-4-stage-compromise)
7. [Demo Flow 5: Scenario 3 — Vulnerable Firmware Exploit & Rollback](#7-demo-flow-5-scenario-3--vulnerable-firmware-exploit--rollback)
8. [Demo Flow 6: Scenario 4 — Gradual Degradation & Sensor Drift](#8-demo-flow-6-scenario-4--gradual-degradation--sensor-drift)
9. [Demo Flow 7: Scenario 5 — Fleet-Wide Synchronized Attack](#9-demo-flow-7-scenario-5--fleet-wide-synchronized-attack)
10. [Demo Flow 8: Scenario 6 — False Positive Validation](#10-demo-flow-8-scenario-6--false-positive-validation)
11. [Evaluation Scorecard & Key Takeaways](#11-evaluation-scorecard--key-takeaways)

---

## 1. Demonstration Preparation & Setup

### Start Backend, Frontend & Database
Open three terminal windows:

```bash
# Terminal 1: Start Express API + Embedded Aedes MQTT Broker
npm run dev:server

# Terminal 2: Start React SOC Frontend
npm run dev:client
```

Open your browser to `http://localhost:5173`.

---

## 2. User Personas & Role Matrix

To demonstrate the 4-tier RBAC hierarchy, use the following roles:

| Persona | Role | Email | Password | Primary Demo Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `super_admin` | `admin@securewatch.io` | `Admin123!` | System bootstrap, organization creation |
| **Security Lead** | `org_admin` | `lead@acme.com` | `Lead123!` | User invites, SLA settings, rule deletion |
| **Senior Analyst**| `security_analyst` | `analyst@acme.com` | `Analyst123!` | Event resolution, rule creation, rollback, key revoke |
| **SOC Operator** | `operator` | `operator@acme.com` | `Operator123!` | Event acknowledgement, incident triage, quarantine |
| **Executive** | `viewer` | `viewer@acme.com` | `Viewer123!` | Read-only dashboards, audit logs, reports |

---

## 3. Demo Flow 1: Platform Bootstrap & RBAC Login

### Step 1: Initial Bootstrap
If the database is fresh (0 organizations), navigate to `http://localhost:5173/login` and click **Bootstrap Initial Admin**:
- **Organization Name:** Acme Industrial Corp (`acme-corp`)
- **Admin Email:** `admin@securewatch.io`
- **Password:** `Admin123!`

### Step 2: Login Verification
1. Log in with `admin@securewatch.io`.
2. Notice the top banner displays the authenticated tenant: **Acme Industrial Corp** and Role: **Super Admin**.
3. Navigate to **Users & RBAC** to invite `analyst@acme.com` (`security_analyst`) and `operator@acme.com` (`operator`).

---

## 4. Demo Flow 2: Device Provisioning & Cryptographic Keys

1. Navigate to **Devices** $\to$ **Register Device**.
2. Register a new Smart Camera:
   - **Device ID:** `DEV-SC-002`
   - **Name:** Perimeter Gate Camera #2
   - **Device Type:** `smart_camera`
   - **Location:** East Perimeter Zone
3. Click **Register**.
4. **Key Security Highlight:** The modal presents the plaintext API key (e.g. `DEV_KEY_A1B2C3...`). Emphasize that the server only stores the SHA-256 one-way hash (`apiKeyHash`), preventing database credential leakage.

---

## 5. Demo Flow 3: Scenario 1 — Normal Fleet Baseline

Demonstrates normal operating baseline across 10 mixed devices with zero intentional anomalies.

### Run Simulator (Terminal 3)
```bash
node simulator/src/index.js --scenario 1 --time-scale 5 --mode console
```

### Observed SOC Behavior
1. **Live Metrics:** Telemetry records stream into MongoDB.
2. **Dashboard Posture:**
   - Fleet Health: `100% Healthy`
   - Risk Distribution: `10/10 Low Risk (Score < 20)`
   - Active Incidents: `0`
   - Anomaly Trend: Flat baseline with zero triggered alerts.

---

## 6. Demo Flow 4: Scenario 2 — Single Device 4-Stage Compromise

Demonstrates a sophisticated 4-stage sequential cyber attack against a smart camera.

### Run Simulator (Terminal 3)
```bash
node simulator/src/index.js --scenario 2 --time-scale 10 --mode rest --api-url http://localhost:5000/api/v1
```

> [!NOTE]
> In live REST transport mode, the simulator transmits current system timestamps to comply with Phase 6 $\pm 5$ min time window validation.

### Multi-Stage Attack Progression & Analyst Response

#### Stage 1 (0–5m): Auth Brute Force
- **Simulation:** 10 rapid failed authentication attempts with invalid device credentials.
- **SOC Alert:** Security Event generated: `EVT-AUTH-BRUTEFORCE` on `DEV-SC-002`.

#### Stage 2 (5–10m): Off-Schedule Reporting
- **Simulation:** Telemetry emitted outside regular schedule.
- **SOC Alert:** Anomaly logged for timing deviation.

#### Stage 3 (10–15m): Network Egress Spike
- **Simulation:** Outbound network traffic surges to $50\times$ baseline ($50,000\text{ KB/s}$).
- **SOC Alert:** High-severity Security Event triggered.
- **Risk Recalculation:** `DEV-SC-002` Risk Score surges to **High / Critical (75+)**.
- **Automated Correlation:** Phase 9 Correlation Engine matches Strategy 1 (`CORR-TEMPORAL`: 3 events within 30 min) and automatically generates Incident **`INC-XXXX`**.

#### Stage 4 (15–20m): Firmware Version Tamper
- **Simulation:** Metadata injected with tampered version `9.9.9-pwned`.
- **SOC Alert:** Critical security event attached to existing incident via Strategy 3 (`CORR-ESCALATION`).

### SOC Mitigation Workflow
1. Navigate to **Incidents** $\to$ Open `INC-XXXX`.
2. Review the automated Incident Timeline and Evidence Graph.
3. As `operator`, transition status: `detected` $\to$ `triaged` $\to$ `investigating`.
4. Click **Response Actions** $\to$ Select **Quarantine Device**.
5. **Result:** Device status immediately updates to `quarantined`. Socket.IO broadcasts the update, and the device is isolated from the active fleet.

---

## 7. Demo Flow 5: Scenario 3 — Vulnerable Firmware Exploit & Rollback

Demonstrates an industrial gateway exploit caused by buggy firmware 1.0.3 and the explicit rollback workflow.

### Run Simulator (Terminal 3)
```bash
node simulator/src/index.js --scenario 3 --time-scale 10 --mode rest --api-url http://localhost:5000/api/v1
```

### Attack Progression
1. **Gradual CPU Ramp:** Gateway `DEV-IG-003` escalates CPU from $45\% \to 95\%$.
2. **Memory Exhaustion:** Memory usage exceeds $96.5\%$.
3. **Egress Spike:** Data exfiltration spike triggered.
4. **Incident Created:** Correlated incident opened with severity **High**.

### Analyst Rollback Workflow
1. Navigate to **Incidents** $\to$ Open the active incident on `DEV-IG-003`.
2. As `security_analyst`, select **Record Action** $\to$ **Rollback Firmware**.
3. **Execution:** The incident service calls `firmwareService.rollbackFailedDeploymentForDevice`, restoring the device's known-good stable firmware version.
4. The deployment status updates to `rolled_back`, and an audit log entry is permanently recorded.

---

## 8. Demo Flow 6: Scenario 4 — Gradual Degradation & Sensor Drift

Demonstrates subtle linear temperature drift ($+0.5^\circ\text{C}/\text{min}$) on `DEV-TS-001`.

### Run Simulator (Terminal 3)
```bash
node simulator/src/index.js --scenario 4 --time-scale 20 --mode rest --api-url http://localhost:5000/api/v1
```

### Observation
1. At 30m logical time ($40^\circ\text{C}$): Temperature remains in warning threshold.
2. At 70m logical time ($60^\circ\text{C}$): Crosses threshold rule `RULE-TEMP-HIGH` $\to$ Medium Security Event created.
3. At 120m logical time ($85^\circ\text{C}$): Crosses critical threshold $\to$ High Severity Alert triggered.
4. Demonstrates continuous time-series monitoring and deterministic threshold tripping without false alarms.

---

## 9. Demo Flow 7: Scenario 5 — Fleet-Wide Synchronized Attack

Demonstrates coordinated attack targeting all 5 devices simultaneously.

### Run Simulator (Terminal 3)
```bash
node simulator/src/index.js --scenario 5 --time-scale 10 --mode rest --api-url http://localhost:5000/api/v1
```

### SOC Behavior
1. All 5 devices simultaneously experience 10 failed auth attempts followed by $50\times$ egress spikes.
2. **Dashboard View:** Top Risk Devices widget immediately populates with 5 devices in **Critical / Severe** risk status.
3. **SLA Widget:** 5 concurrent incident SLA countdown timers activate in the SOC header.

---

## 10. Demo Flow 8: Scenario 6 — False Positive Validation

Demonstrates precision tuning of the anomaly engine.

### Run Simulator (Terminal 3)
```bash
node simulator/src/index.js --scenario 6 --time-scale 10 --mode rest --api-url http://localhost:5000/api/v1
```

### Evaluation Criteria
- **Metrics Injected:** CPU: 80–84%, Temp: 55–58°C, Memory: 85–88%, Battery: 20–25%, 4 failed auth attempts.
- **Expected Outcome:** **Zero anomalies triggered. Zero security events created. Zero false positive incidents.**
- Proves the platform's deterministic thresholds eliminate alert fatigue.

---

## 11. Evaluation Scorecard & Key Takeaways

| Feature Area | Demonstration Proof Points | Verified In |
| :--- | :--- | :---: |
| **Multi-Tenancy & RBAC** | Strict tenant isolation, 4-tier role hierarchy, cryptographic password & token hashing | Demo Flow 1 & 2 |
| **Deterministic Threat Detection**| 6 anomaly modes, cross-field checks, sliding telemetry window, 0 false alarms on borderline data | Demo Flow 3, 6, 8 |
| **Transparent Risk Scoring** | Explainable 3-factor composite risk model (0–100) with no black-box ML weights | Demo Flow 4 & 7 |
| **Automated Incident Correlation** | 3 correlation strategies (`CORR-TEMPORAL`, `CORR-REPEATED`, `CORR-ESCALATION`) + SLA countdowns | Demo Flow 4, 5, 7 |
| **Automated Remediation** | One-click device quarantine, API key revocation, and incident-response firmware rollback | Demo Flow 4 & 5 |
| **Real-Time SOC Observability** | Sub-second WebSocket streaming via Socket.IO, custom SVG/Tailwind responsive widgets | All Demo Flows |
