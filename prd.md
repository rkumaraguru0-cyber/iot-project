# SecureWatch IoT — Product Requirements Document

**Version:** 1.0  
**Status:** Awaiting Approval  
**Last Updated:** 2026-09-03  
**Architecture Basis:** Master Project Blueprint Revision 2 (Approved)

---

## Table of Contents

1. [Product Identity](#1-product-identity)
2. [Users and Roles](#2-users-and-roles)
3. [Functional Requirements](#3-functional-requirements)
4. [Security Intelligence Pipeline](#4-security-intelligence-pipeline)
5. [Anomaly Detection](#5-anomaly-detection)
6. [Risk Engine](#6-risk-engine)
7. [Event Correlation](#7-event-correlation)
8. [Incident Management](#8-incident-management)
9. [Firmware Security](#9-firmware-security)
10. [Device Lifecycle](#10-device-lifecycle)
11. [IoT Simulator](#11-iot-simulator)
12. [MQTT](#12-mqtt)
13. [REST API Requirements](#13-rest-api-requirements)
14. [Frontend Requirements](#14-frontend-requirements)
15. [Dashboard](#15-dashboard)
16. [Real-Time Requirements](#16-real-time-requirements)
17. [Database Requirements](#17-database-requirements)
18. [Security Requirements](#18-security-requirements)
19. [Non-Functional Requirements](#19-non-functional-requirements)
20. [Testing and Acceptance Criteria](#20-testing-and-acceptance-criteria)
21. [Demo Scenarios](#21-demo-scenarios)
22. [MVP Boundary](#22-mvp-boundary)
23. [Traceability Matrix](#23-traceability-matrix)
24. [Final Product Definition](#24-final-product-definition)

---

## 1. Product Identity

### 1.1 Product Name

**SecureWatch IoT**

### 1.2 Tagline

*Deterministic security intelligence for IoT device fleets.*

### 1.3 Product Vision

SecureWatch IoT is a centralized security command center for IoT device fleets. It continuously monitors device telemetry, detects anomalous behavior through transparent deterministic rules, scores device risk with full factor visibility, correlates security events into actionable incidents, manages firmware with a security-first lens, and provides a complete investigation-to-resolution workflow — all traceable from raw telemetry to final audit entry.

### 1.4 Problem Statement

Organizations operating IoT device fleets face blind spots (unknown device states), alert fatigue (uncorrelated noise), no incident workflow (no structured response process), firmware risk (unaudited updates), no explainability (opaque detections), no forensic trail (unrecoverable post-incident history), and no traceability (disconnected data points). SecureWatch IoT eliminates each of these by providing a unified, explainable, traceable security operations platform.

### 1.5 Product Positioning

SecureWatch IoT occupies the intersection of IoT device management and security operations. It is not a generic dashboard, not a SIEM, not an AI/ML experimentation platform, and not an enterprise organization-management product. It is purpose-built for a security operations team managing a fleet of heterogeneous IoT devices.

### 1.6 Primary Differentiators

| # | Differentiator | Description |
|---|---|---|
| D1 | **Deterministic explainable detection** | Every anomaly detection includes a human-readable explanation of which rule triggered, what the expected value was, and what the actual value was. No black-box. |
| D2 | **Transparent risk scoring** | Every device risk score comes with a factor-by-factor breakdown linking to specific evidence (events, firmware status). |
| D3 | **End-to-end security traceability** | Any incident can be traced backward through correlation → events → detection rules → raw telemetry → audit log. |
| D4 | **Event-to-incident correlation with explainability** | Related events are automatically grouped into incidents; the correlation reason is recorded and visible. |
| D5 | **Firmware vulnerability integration** | Firmware versions are cross-referenced against CVEs and factored into device risk scores. |
| D6 | **Built-in attack simulation** | An integrated IoT simulator generates both normal and attack-scenario telemetry for testing and demo. |
| D7 | **Security forensic timeline** | Every incident has a chronological timeline showing detections, state transitions, and operator actions. |

---

## 2. Users and Roles

### 2.1 Role Definitions

| Role | Scope | Description |
|---|---|---|
| `super_admin` | Platform-wide | Creates and manages organizations. Can view any organization's data for platform-level troubleshooting. Does not participate in day-to-day security operations. |
| `org_admin` | Own organization | Full permissions within their organization. Manages users (invite, deactivate, role assignment). Configures organization settings (SLA thresholds, auto-quarantine, alert preferences). |
| `security_analyst` | Own organization | Configures detection rules, manages firmware security metadata, accesses audit logs, and performs all operator duties. The senior technical security role. |
| `operator` | Own organization | Day-to-day security monitoring: views devices, triages and investigates events and incidents, manages incident lifecycle, views firmware. Cannot modify detection rules or security configuration. |
| `viewer` | Own organization | Read-only access to dashboard, devices, events, incidents. Cannot perform any write operation. |

### 2.2 Permission Matrix

| Resource / Action | `super_admin` | `org_admin` | `security_analyst` | `operator` | `viewer` |
|---|---|---|---|---|---|
| **Organizations** | | | | | |
| Create organization | ✅ | ❌ | ❌ | ❌ | ❌ |
| View own organization | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update organization settings | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Users** | | | | | |
| List users in org | ✅ | ✅ | ✅ | ✅ | ✅ |
| Invite user | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change user role | ✅ | ✅ | ❌ | ❌ | ❌ |
| Deactivate user | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit own profile | ✅ | ✅ | ✅ | ✅ | ✅ |
| Change own password | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Devices** | | | | | |
| Register device | ✅ | ✅ | ✅ | ❌ | ❌ |
| View devices | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update device metadata | ✅ | ✅ | ✅ | ❌ | ❌ |
| Change device lifecycle state | ✅ | ✅ | ✅ | ✅ | ❌ |
| Regenerate device API key | ✅ | ✅ | ✅ | ❌ | ❌ |
| Quarantine device | ✅ | ✅ | ✅ | ✅ | ❌ |
| Decommission device | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Telemetry** | | | | | |
| View telemetry | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ingest telemetry (device API key) | N/A | N/A | N/A | N/A | N/A |
| **Security Events** | | | | | |
| View events | ✅ | ✅ | ✅ | ✅ | ✅ |
| Acknowledge event | ✅ | ✅ | ✅ | ✅ | ❌ |
| Resolve event | ✅ | ✅ | ✅ | ✅ | ❌ |
| Mark event as false positive | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Anomaly Rules** | | | | | |
| View rules | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/edit/delete rules | ✅ | ✅ | ✅ | ❌ | ❌ |
| Enable/disable rules | ✅ | ✅ | ✅ | ❌ | ❌ |
| Test rule (dry-run) | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Incidents** | | | | | |
| View incidents | ✅ | ✅ | ✅ | ✅ | ✅ |
| Triage/investigate/contain/resolve | ✅ | ✅ | ✅ | ✅ | ❌ |
| Assign incident | ✅ | ✅ | ✅ | ✅ | ❌ |
| Add notes | ✅ | ✅ | ✅ | ✅ | ❌ |
| Record response actions | ✅ | ✅ | ✅ | ✅ | ❌ |
| Close incident | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Firmware** | | | | | |
| View firmware versions | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register firmware version | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update security metadata (CVEs) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create deployment | ✅ | ✅ | ✅ | ❌ | ❌ |
| View deployments | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Audit Logs** | | | | | |
| View audit logs | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Notifications** | | | | | |
| View own notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mark notifications read | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Dashboard** | | | | | |
| View dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Settings** | | | | | |
| View org settings | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit org settings | ✅ | ✅ | ❌ | ❌ | ❌ |

### 2.3 Organization Scoping Rule

Every API query is automatically scoped to `req.user.organizationId`. The only exception is `super_admin`, who may access any organization's data by providing an explicit `organizationId` query parameter for platform-level troubleshooting. Cross-organization data aggregation is not supported.

---

## 3. Functional Requirements

### FR-AUTH: Authentication

| ID | Requirement |
|---|---|
| FR-AUTH-01 | Users authenticate with email and password. |
| FR-AUTH-02 | Successful authentication returns a JWT access token (15-minute expiry) and sets an httpOnly secure cookie containing an opaque refresh token (7-day expiry). |
| FR-AUTH-03 | Access tokens are signed with HS256 using a server-side secret (`JWT_SECRET`). |
| FR-AUTH-04 | Access token payload contains `userId`, `organizationId`, `role`, `iat`, `exp`. |
| FR-AUTH-05 | Refresh tokens are opaque random strings. Only the SHA-256 hash is stored in the `refreshTokens` collection. |
| FR-AUTH-06 | Token refresh issues a new access + refresh token pair and invalidates the previous refresh token (rotation). |
| FR-AUTH-07 | Logout revokes all refresh tokens for the user. |
| FR-AUTH-08 | Access tokens are stored in JavaScript memory on the client. They are never placed in localStorage or sessionStorage. |
| FR-AUTH-09 | The client automatically refreshes the access token before it expires using the refresh token cookie. |
| FR-AUTH-10 | Failed login returns a generic `Invalid credentials` message without revealing whether the email or password was wrong. |

### FR-RBAC: Authorization

| ID | Requirement |
|---|---|
| FR-RBAC-01 | Authorization is enforced via Express middleware that checks `req.user.role` against the minimum required role for each route. |
| FR-RBAC-02 | The role hierarchy is: `super_admin` > `org_admin` > `security_analyst` > `operator` > `viewer`. A higher role inherits all lower-role permissions. |
| FR-RBAC-03 | Every route handler receives a pre-validated `req.user` object containing `userId`, `organizationId`, and `role`. |
| FR-RBAC-04 | An `orgScope` middleware automatically appends `organizationId` to all database queries, preventing cross-organization data access. |

### FR-MT: Multi-Tenancy

| ID | Requirement |
|---|---|
| FR-MT-01 | Every document in every collection (except platform-level collections) carries an `organizationId` field. |
| FR-MT-02 | Every database query for tenant-scoped data includes `organizationId` as a filter condition. This is enforced by middleware, not by individual route handlers. |
| FR-MT-03 | MQTT topics are prefixed with the organization slug, enforcing namespace isolation. |
| FR-MT-04 | The initial deployment includes one organization with sample users and devices. Adding additional organizations is a `super_admin` operation. |
| FR-MT-05 | No UI exists for switching between organizations, managing org hierarchies, or cross-org analytics. |

### FR-DEV: Device Registration & Management

| ID | Requirement |
|---|---|
| FR-DEV-01 | A device is registered with: `name`, `type` (enum: temperature_sensor, smart_camera, industrial_gateway, medical_monitor, smart_lock), `manufacturer`, `model`, `location` (string), `tags` (array of `{key, value}` pairs), `firmwareVersion` (string). |
| FR-DEV-02 | On registration, the system generates a cryptographically random 256-bit API key. The plaintext key is returned once in the registration response. Only the SHA-256 hash is stored. |
| FR-DEV-03 | Each device receives a system-generated `deviceId` in the format `DEV-{TYPE_PREFIX}-{RANDOM_6}` (e.g., `DEV-TS-A3F2B1`). |
| FR-DEV-04 | Devices are unique within an organization by `deviceId`. The compound index `{organizationId, deviceId}` enforces this. |
| FR-DEV-05 | Device metadata (name, location, tags) can be updated. Type, manufacturer, model cannot be changed after registration (decommission and re-register). |
| FR-DEV-06 | The device API key can be regenerated. Regeneration immediately invalidates the old key. |
| FR-DEV-07 | Device list supports pagination (limit/offset), filtering (by type, status, healthStatus, riskScore range, tags), sorting (by name, riskScore, lastSeenAt, createdAt), and text search on name. |
| FR-DEV-08 | `GET /devices/stats` returns aggregate counts: by status, by healthStatus, by risk severity bracket, total device count. |

### FR-DLC: Device Lifecycle

| ID | Requirement |
|---|---|
| FR-DLC-01 | Device lifecycle states: `registered`, `active`, `maintenance`, `quarantined`, `decommissioned`. |
| FR-DLC-02 | Valid transitions: `registered→active` (first telemetry received), `active→maintenance`, `maintenance→active`, `active→quarantined`, `quarantined→active`, `quarantined→decommissioned`, `active→decommissioned`, `maintenance→decommissioned`. |
| FR-DLC-03 | The `registered→active` transition happens automatically when the first telemetry is received. All other transitions are manual (operator/security_analyst/org_admin). |
| FR-DLC-04 | Quarantine can also be triggered automatically when the device's risk score exceeds a configurable threshold (default: 80). Auto-quarantine is disabled by default per organization. |
| FR-DLC-05 | Quarantined devices still accept telemetry (for monitoring) but the device is flagged in all UI views. |
| FR-DLC-06 | Decommissioned devices reject new telemetry. Historical data is retained. No risk scoring. |
| FR-DLC-07 | Every lifecycle state transition is recorded in the audit log and in the device's embedded timeline (last 50 entries). |

### FR-HEALTH: Device Health

| ID | Requirement |
|---|---|
| FR-HEALTH-01 | Health statuses: `healthy`, `degraded`, `offline`, `unknown`. |
| FR-HEALTH-02 | `healthy`: telemetry received within 1× the device's expected reporting interval. |
| FR-HEALTH-03 | `degraded`: no telemetry within 1×–3× the expected interval. |
| FR-HEALTH-04 | `offline`: no telemetry beyond 3× the expected interval. |
| FR-HEALTH-05 | `unknown`: device has never sent telemetry (status = `registered`). |
| FR-HEALTH-06 | Default expected reporting interval: 30 seconds. Configurable per device type. |
| FR-HEALTH-07 | Health status is recalculated on every telemetry receipt and periodically (every 60 seconds) for staleness checks. |

### FR-TEL: Telemetry

| ID | Requirement |
|---|---|
| FR-TEL-01 | Devices send telemetry via MQTT (primary) or REST (fallback). |
| FR-TEL-02 | Telemetry payload schema: `{ timestamp: ISO8601, metrics: { cpu_usage: number, memory_usage: number, temperature: number, network_in: number, network_out: number, battery_level: number, disk_usage: number, signal_strength: number, error_count: number, ...custom }, metadata: { ip: string, firmware_version: string, uptime: number } }`. |
| FR-TEL-03 | `timestamp` and `metrics` are required. `metadata` is optional. |
| FR-TEL-04 | All metric values are numbers. At least one metric must be present. |
| FR-TEL-05 | Telemetry is stored with a TTL index. Default retention: 30 days. Configurable per organization. |
| FR-TEL-06 | On ingestion, telemetry passes through the anomaly detection engine before storage. |

### FR-EVT: Security Events

| ID | Requirement |
|---|---|
| FR-EVT-01 | Security events are created by the anomaly detection engine when a rule evaluates to true. |
| FR-EVT-02 | Event statuses: `open`, `acknowledged`, `resolved`, `false_positive`. |
| FR-EVT-03 | Each event carries: `ruleId`, `deviceId`, `organizationId`, `rawTelemetryId`, `category`, `severity`, `confidence`, `explanation`, `occurrenceCount`, `firstOccurrence`, `lastOccurrence`. |
| FR-EVT-04 | Operators/security_analysts can acknowledge, resolve, or mark events as false positive. |
| FR-EVT-05 | Resolving or marking an event as false positive triggers risk score recalculation for the affected device. |
| FR-EVT-06 | Event list supports filtering by severity, category, status, deviceId, date range. |

### FR-RULE: Detection Rules

| ID | Requirement |
|---|---|
| FR-RULE-01 | Rules are stored in MongoDB. Each rule has a unique `ruleId`. |
| FR-RULE-02 | Rules can be system-global (`organizationId = null`) or organization-specific. |
| FR-RULE-03 | System rules can be cloned and customized per organization. System rules cannot be deleted. |
| FR-RULE-04 | The platform ships with 12 seed rules (see Section 5). |
| FR-RULE-05 | Security analysts can create, update, enable/disable, and soft-delete custom rules. |

### FR-RISK: Risk Scoring

| ID | Requirement |
|---|---|
| FR-RISK-01 | Every device has a risk score (0–100) with a severity label. |
| FR-RISK-02 | The score is computed from 7 weighted factors (see Section 6). |
| FR-RISK-03 | The factor breakdown is stored on the device document and returned with every device response. |
| FR-RISK-04 | The score is recalculated event-driven (not on every telemetry ingestion). See Section 6.5 for triggers. |

### FR-CORR: Event Correlation

| ID | Requirement |
|---|---|
| FR-CORR-01 | The correlation engine evaluates new security events against correlation strategies to group related events into incidents. |
| FR-CORR-02 | Three correlation strategies are implemented in MVP (see Section 7). |
| FR-CORR-03 | Correlation records which strategy matched and why (correlation explainability). |

### FR-INC: Incident Management

| ID | Requirement |
|---|---|
| FR-INC-01 | Incidents have 7 lifecycle states (see Section 8). |
| FR-INC-02 | Incidents carry an ID in the format `INC-YYYYMMDD-XXXX`. |
| FR-INC-03 | Incidents link to related security events, evidence, timeline, notes, response actions, and resolution. |
| FR-INC-04 | Incidents track SLA targets (time to triage, time to resolve) with breach flags. |

### FR-FW: Firmware Management

| ID | Requirement |
|---|---|
| FR-FW-01 | Firmware versions are registered with metadata: version (semver), deviceType, checksum (SHA-256), changelog, releaseDate. |
| FR-FW-02 | Each version has a security status: `secure`, `under_review`, `vulnerable`, `recalled`. |
| FR-FW-03 | CVEs can be associated with firmware versions. |
| FR-FW-04 | Deployment to vulnerable/recalled firmware is blocked. |
| FR-FW-05 | Deployments track per-device status: `pending → downloading → installing → verifying → success | failed | rolled_back`. |

### FR-AUDIT: Audit Logging

| ID | Requirement |
|---|---|
| FR-AUDIT-01 | Every security-relevant action is logged: logins, role changes, device state changes, event status changes, incident state transitions, rule modifications, firmware operations, setting changes. |
| FR-AUDIT-02 | Audit logs are append-only. No update or delete API exists. |
| FR-AUDIT-03 | Each entry includes: `action`, `actor` (userId or "system"), `actorIp`, `targetType`, `targetId`, `organizationId`, `details` (before/after), `timestamp`. |
| FR-AUDIT-04 | Default retention: 90 days (TTL). |

### FR-NOTIF: Notifications

| ID | Requirement |
|---|---|
| FR-NOTIF-01 | In-app notifications are generated on: critical/high security events, incident creation, incident state changes, device risk escalation to critical/severe, device quarantine. |
| FR-NOTIF-02 | Notifications are persisted in MongoDB and delivered in real-time via Socket.IO. |
| FR-NOTIF-03 | Users can view, mark as read, and mark all as read. |
| FR-NOTIF-04 | Notification retention: 30 days (TTL). |

### FR-RT: Real-Time Updates

| ID | Requirement |
|---|---|
| FR-RT-01 | Socket.IO pushes: new critical/high security events, incident creation, incident status changes, device status changes (quarantined/offline), device risk escalation to critical/severe, notifications. |
| FR-RT-02 | Socket.IO rooms: `org:{orgId}`, `user:{userId}`, `device:{deviceId}`, `incident:{incidentId}`. |
| FR-RT-03 | Socket.IO connection is authenticated via JWT. Unauthenticated connections are rejected. |

### FR-SIM: IoT Simulator

| ID | Requirement |
|---|---|
| FR-SIM-01 | The simulator is a separate Node.js application in the monorepo (`/simulator`). |
| FR-SIM-02 | It communicates with the platform via MQTT using device API keys. |
| FR-SIM-03 | It is developed incrementally: v1 (normal telemetry), v2 (controlled anomalies), v3 (attack scenarios). |
| FR-SIM-04 | From the platform's perspective, simulated devices are indistinguishable from real devices. |

---

## 4. Security Intelligence Pipeline

### 4.1 Pipeline Overview

```
Telemetry → Ingestion & Validation → Anomaly Detection → Security Event → Risk Recalculation → Event Correlation → Incident → Investigation → Response → Resolution → Audit Log
```

### 4.2 Stage Specifications

#### Stage 1: Telemetry Ingestion & Validation

| Aspect | Specification |
|---|---|
| **Input** | Raw JSON payload from MQTT `publish` event or REST `POST /api/v1/telemetry/ingest` |
| **Processing** | 1. Authenticate device (API key hash lookup). 2. Parse JSON. 3. Validate schema (required: `timestamp`, `metrics`). 4. Validate timestamp (within ±5 min of server time). 5. Deduplicate (reject if same deviceId + timestamp + metrics hash exists in last 5 min). 6. Normalize timestamp to UTC ISO 8601. |
| **Output** | Validated telemetry document ready for storage and detection |
| **Persistence** | Stored in `telemetry` collection with `organizationId`, `deviceId` |
| **Relationships** | References `devices` (deviceId). Referenced by `securityEvents` (rawTelemetryId). |
| **Failure behavior** | Invalid payload: drop silently, log error, increment device `malformedMessageCount`. Auth failure: reject connection/request, log attempt. DB write failure: buffer in memory (max 1000 messages), retry with backoff. |

#### Stage 2: Anomaly Detection

| Aspect | Specification |
|---|---|
| **Input** | Validated telemetry document + device context (type, status, org) + enabled rules matching device type |
| **Processing** | 1. Fetch applicable rules (matching device type, enabled, org-scoped or global). 2. For each rule: check cooldown → evaluate condition → check window persistence → generate detection if criteria met. |
| **Output** | Zero or more detection results, each with: `ruleId`, `ruleName`, `category`, `severity`, `confidence`, `explanation` (populated from template), `actualValue`, `thresholdValue` |
| **Persistence** | Detection results are transformed into security events (Stage 3) |
| **Relationships** | Reads `anomalyRules`. Reads recent `telemetry` for window calculations. |
| **Failure behavior** | Rule evaluation error: log error with rule ID, skip rule, continue processing other rules. Never block telemetry storage. |

#### Stage 3: Security Event Generation

| Aspect | Specification |
|---|---|
| **Input** | Detection results from Stage 2 |
| **Processing** | 1. Check for existing open event with same `ruleId` + `deviceId` within cooldown window. 2. If exists: increment `occurrenceCount`, update `lastOccurrence`. 3. If not exists: create new security event with status `open`. 4. Enrich with device metadata (device name, type). |
| **Output** | New or updated `securityEvent` document |
| **Persistence** | Stored in `securityEvents` collection |
| **Relationships** | References `anomalyRules` (ruleId), `devices` (deviceId), `telemetry` (rawTelemetryId). May be referenced by `incidents` (relatedEventIds). |
| **Failure behavior** | DB write failure: log critical error. Retry once. If still fails, the event is lost (acceptable — the next telemetry cycle will likely re-trigger). |

#### Stage 4: Risk Score Recalculation

| Aspect | Specification |
|---|---|
| **Input** | Security event creation/update notification + device's current state |
| **Processing** | Calculate all 7 risk factors (see Section 6). Sum weighted factors. Determine severity label. |
| **Output** | Updated `riskScore`, `riskFactors[]`, `riskSeverity` on the device document |
| **Persistence** | Denormalized onto `devices` collection (riskScore, riskFactors fields) |
| **Relationships** | Reads `securityEvents`, `firmwareVersions`, `devices` |
| **Failure behavior** | Calculation error: log error, retain previous score. Never set score to 0 on error. |

#### Stage 5: Event Correlation

| Aspect | Specification |
|---|---|
| **Input** | Newly created security event + recent events for the same device |
| **Processing** | 1. Check if device has an open incident → attach event, escalate severity if warranted. 2. If no open incident: evaluate correlation strategies (see Section 7). 3. If strategy matches: create incident with correlated events. 4. If no match and severity ≥ high: create standalone incident. 5. If no match and severity < high: event remains standalone. |
| **Output** | Incident created or updated, or no action |
| **Persistence** | Stored in `incidents` collection if created/updated |
| **Relationships** | References `securityEvents` (relatedEventIds), `devices` (deviceId) |
| **Failure behavior** | Correlation error: log error, create standalone incident for high/critical events, skip correlation for lower severity. |

#### Stage 6: Incident Creation / Update

| Aspect | Specification |
|---|---|
| **Input** | Correlated events or standalone high-severity event |
| **Processing** | Generate `incidentId` (INC-YYYYMMDD-XXXX). Set initial state to `detected`. Record correlation details. Calculate initial SLA deadlines. Emit Socket.IO event. Create notification. |
| **Output** | Incident document in `detected` state |
| **Persistence** | Stored in `incidents` collection |
| **Relationships** | References `devices`, `securityEvents`, `organizations` |
| **Failure behavior** | Incident creation failure: log critical error. Security events remain standalone. |

#### Stage 7–10: Investigation → Response → Resolution → Audit

These stages are human-driven (operator/security_analyst actions via the UI). Every action is recorded in the incident's `timeline` array and in the `auditLogs` collection.

---

## 5. Anomaly Detection

### 5.1 Rule Definitions

The platform ships with 12 seed rules. Each is defined below with implementation-ready precision.

---

#### RULE-001: High CPU Usage Sustained

| Field | Value |
|---|---|
| **Rule ID** | `RULE-001` |
| **Name** | High CPU Usage Sustained |
| **Description** | Detects sustained high CPU usage that may indicate cryptomining, malware, or resource exhaustion |
| **Category** | `threshold` |
| **Input Fields** | `metrics.cpu_usage` |
| **Condition** | `cpu_usage > 90` |
| **Window** | `consecutive`, size: 5 readings, minOccurrences: 5 |
| **Severity** | `medium` |
| **Confidence** | `medium` |
| **Cooldown** | 300 seconds (5 minutes) |
| **Explanation Template** | `CPU usage was {{actual}}% which exceeds threshold of 90% for {{count}} consecutive readings` |
| **Device Types** | `*` (all) |
| **Triggering telemetry** | 5 consecutive readings: `{ cpu_usage: 92 }`, `{ cpu_usage: 95 }`, `{ cpu_usage: 91 }`, `{ cpu_usage: 98 }`, `{ cpu_usage: 93 }` |
| **Non-triggering telemetry** | 4 readings above + 1 below: `{ cpu_usage: 92 }`, `{ cpu_usage: 95 }`, `{ cpu_usage: 88 }`, `{ cpu_usage: 91 }`, `{ cpu_usage: 93 }` (window broken by 88%) |

---

#### RULE-002: High Memory Usage Sustained

| Field | Value |
|---|---|
| **Rule ID** | `RULE-002` |
| **Name** | High Memory Usage Sustained |
| **Description** | Detects sustained memory usage indicating potential memory leak or resource exhaustion |
| **Category** | `threshold` |
| **Input Fields** | `metrics.memory_usage` |
| **Condition** | `memory_usage > 95` |
| **Window** | `consecutive`, size: 5, minOccurrences: 5 |
| **Severity** | `medium` |
| **Confidence** | `medium` |
| **Cooldown** | 300 seconds |
| **Explanation Template** | `Memory usage was {{actual}}% which exceeds threshold of 95% for {{count}} consecutive readings` |
| **Device Types** | `*` |
| **Triggering** | 5 consecutive: `{ memory_usage: 96 }`, `{ memory_usage: 97 }`, `{ memory_usage: 96 }`, `{ memory_usage: 98 }`, `{ memory_usage: 99 }` |
| **Non-triggering** | `{ memory_usage: 94 }` (below threshold) or 4 consecutive above + 1 below |

---

#### RULE-003: Temperature Outside Operating Range

| Field | Value |
|---|---|
| **Rule ID** | `RULE-003` |
| **Name** | Temperature Outside Operating Range |
| **Description** | Detects device temperature outside safe operating parameters, may indicate environmental attack or hardware failure |
| **Category** | `value` |
| **Input Fields** | `metrics.temperature` |
| **Condition** | `temperature < -40 OR temperature > 85` (industrial range in °C) |
| **Window** | None (single reading triggers) |
| **Severity** | `high` |
| **Confidence** | `high` |
| **Cooldown** | 600 seconds (10 minutes) |
| **Explanation Template** | `Temperature was {{actual}}°C which is outside the safe operating range of -40°C to 85°C` |
| **Device Types** | `*` |
| **Triggering** | `{ temperature: 92 }` or `{ temperature: -45 }` |
| **Non-triggering** | `{ temperature: 42 }` or `{ temperature: -20 }` |

---

#### RULE-004: Network Egress Spike

| Field | Value |
|---|---|
| **Rule ID** | `RULE-004` |
| **Name** | Network Egress Data Spike |
| **Description** | Detects sudden increase in outbound network traffic indicating potential data exfiltration |
| **Category** | `rate` |
| **Input Fields** | `metrics.network_out` |
| **Condition** | Current `network_out` > 10× the device's rolling average of the last 20 readings |
| **Window** | `sliding`, size: 3 readings, minOccurrences: 2 (2 of the last 3 must exceed 10×) |
| **Severity** | `high` |
| **Confidence** | `medium` |
| **Cooldown** | 600 seconds |
| **Explanation Template** | `Network egress was {{actual}} bytes which is {{multiplier}}x the baseline average of {{baseline}} bytes (2+ spikes in last 3 readings)` |
| **Device Types** | `*` |
| **Triggering** | Baseline avg: 500 bytes. Readings: `{ network_out: 6000 }`, `{ network_out: 450 }`, `{ network_out: 7500 }` (2 of 3 exceed 5000) |
| **Non-triggering** | Baseline avg: 500 bytes. Reading: `{ network_out: 4500 }` (below 10× = 5000) |

---

#### RULE-005: Device Offline Beyond Expected Interval

| Field | Value |
|---|---|
| **Rule ID** | `RULE-005` |
| **Name** | Device Offline — Heartbeat Failure |
| **Description** | Detects device that has stopped reporting telemetry beyond 3× its expected interval |
| **Category** | `heartbeat` |
| **Input Fields** | `device.lastSeenAt`, `device.expectedInterval` |
| **Condition** | `(now - lastSeenAt) > (expectedInterval × 3)` |
| **Window** | N/A (absence-based, evaluated periodically) |
| **Severity** | `medium` |
| **Confidence** | `high` |
| **Cooldown** | 900 seconds (15 minutes) |
| **Explanation Template** | `Device has not reported telemetry for {{duration}} which exceeds the expected interval of {{expected}}s by {{multiplier}}x` |
| **Device Types** | `*` |
| **Triggering** | Expected interval: 30s. Last seen: 120 seconds ago (4× > 3×) |
| **Non-triggering** | Expected interval: 30s. Last seen: 60 seconds ago (2× < 3×) |

---

#### RULE-006: Authentication Brute Force

| Field | Value |
|---|---|
| **Rule ID** | `RULE-006` |
| **Name** | Authentication Brute Force Attempt |
| **Description** | Detects repeated failed authentication attempts suggesting credential brute-forcing |
| **Category** | `auth` |
| **Input Fields** | Failed MQTT/REST authentication attempts counter per device ID (tracked in memory or Redis-like store) |
| **Condition** | `failedAuthAttempts >= 5` within a 10-minute sliding window |
| **Window** | `sliding`, size: 600 seconds, minOccurrences: 5 |
| **Severity** | `critical` |
| **Confidence** | `high` |
| **Cooldown** | 1800 seconds (30 minutes) |
| **Explanation Template** | `{{count}} failed authentication attempts detected for device {{deviceId}} within {{window}} minutes` |
| **Device Types** | `*` |
| **Triggering** | 5 failed MQTT connections with wrong API key for `DEV-TS-A3F2B1` within 8 minutes |
| **Non-triggering** | 3 failed attempts within 10 minutes (below threshold) |

---

#### RULE-007: Unregistered Firmware Version

| Field | Value |
|---|---|
| **Rule ID** | `RULE-007` |
| **Name** | Unregistered Firmware Detected |
| **Description** | Device reports a firmware version not registered in the platform, indicating potential firmware tampering |
| **Category** | `firmware` |
| **Input Fields** | `metadata.firmware_version` from telemetry, compared against `firmwareVersions` collection |
| **Condition** | Reported firmware version does not exist in `firmwareVersions` for this device type and organization |
| **Window** | None (single reading triggers) |
| **Severity** | `critical` |
| **Confidence** | `high` |
| **Cooldown** | 3600 seconds (1 hour) |
| **Explanation Template** | `Device reported firmware version "{{reported}}" which is not registered in the firmware registry for device type {{deviceType}}` |
| **Device Types** | `*` |
| **Triggering** | Telemetry `metadata.firmware_version = "1.9.9-hack"` and no such version in registry |
| **Non-triggering** | Telemetry `metadata.firmware_version = "1.2.3"` and version "1.2.3" exists in registry |

---

#### RULE-008: Off-Schedule Reporting

| Field | Value |
|---|---|
| **Rule ID** | `RULE-008` |
| **Name** | Telemetry Outside Scheduled Window |
| **Description** | Device reporting outside its expected operating schedule, may indicate unauthorized use |
| **Category** | `behavioral` |
| **Input Fields** | `telemetry.timestamp` compared against device profile schedule |
| **Condition** | Telemetry timestamp falls outside the device's expected operating hours (if defined) |
| **Window** | None (single reading triggers) |
| **Severity** | `low` |
| **Confidence** | `low` |
| **Cooldown** | 3600 seconds (1 hour) |
| **Explanation Template** | `Telemetry received at {{time}} which is outside the expected schedule of {{scheduleStart}} to {{scheduleEnd}}` |
| **Device Types** | `*` (only triggers if device has a defined schedule) |
| **Triggering** | Schedule: 06:00–22:00. Telemetry at 03:15 |
| **Non-triggering** | Schedule: 06:00–22:00. Telemetry at 14:30 |

---

#### RULE-009: Rapid Restart Cycle

| Field | Value |
|---|---|
| **Rule ID** | `RULE-009` |
| **Name** | Rapid Restart / Reboot Cycle |
| **Description** | Device rebooting excessively, indicating instability, crash loop, or exploitation attempt |
| **Category** | `rate` |
| **Input Fields** | `metrics.uptime` (uptime resets to near-zero on reboot) |
| **Condition** | `uptime < 120` seconds detected 3+ times within 10 minutes (uptime drops indicate reboots) |
| **Window** | `sliding`, size: 600 seconds, minOccurrences: 3 |
| **Severity** | `high` |
| **Confidence** | `high` |
| **Cooldown** | 1800 seconds (30 minutes) |
| **Explanation Template** | `Device rebooted {{count}} times within {{window}} minutes (uptime reset detected {{count}} times)` |
| **Device Types** | `*` |
| **Triggering** | 3 readings within 10 min: `{ uptime: 45 }`, `{ uptime: 30 }`, `{ uptime: 15 }` |
| **Non-triggering** | `{ uptime: 86400 }` (normal uptime) |

---

#### RULE-010: Physically Impossible Sensor Value

| Field | Value |
|---|---|
| **Rule ID** | `RULE-010` |
| **Name** | Physically Impossible Sensor Value |
| **Description** | Sensor reports a value that is physically impossible, indicating sensor failure or data manipulation |
| **Category** | `value` |
| **Input Fields** | `metrics.temperature`, `metrics.cpu_usage`, `metrics.memory_usage`, `metrics.battery_level` |
| **Condition** | `temperature < -273.15` OR `cpu_usage < 0` OR `cpu_usage > 100` OR `memory_usage < 0` OR `memory_usage > 100` OR `battery_level < 0` OR `battery_level > 100` |
| **Window** | None |
| **Severity** | `critical` |
| **Confidence** | `high` |
| **Cooldown** | 600 seconds |
| **Explanation Template** | `Physically impossible value detected: {{metric}} = {{actual}} (valid range: {{min}} to {{max}})` |
| **Device Types** | `*` |
| **Triggering** | `{ temperature: -300 }` or `{ cpu_usage: 150 }` |
| **Non-triggering** | `{ temperature: -40 }` or `{ cpu_usage: 99 }` |

---

#### RULE-011: Unexpected IP Range

| Field | Value |
|---|---|
| **Rule ID** | `RULE-011` |
| **Name** | Device Reporting from Unexpected Network |
| **Description** | Device telemetry arrives from an IP address outside the expected range, suggesting device relocation or network compromise |
| **Category** | `communication` |
| **Input Fields** | `metadata.ip` from telemetry, compared against device's registered expected IP prefix (if configured) |
| **Condition** | `metadata.ip` does not match any entry in the device's `expectedIpPrefixes` list (if configured; rule is skipped if no prefix is configured) |
| **Window** | None |
| **Severity** | `high` |
| **Confidence** | `medium` |
| **Cooldown** | 3600 seconds |
| **Explanation Template** | `Telemetry received from IP {{actual}} which does not match expected network prefixes: {{expected}}` |
| **Device Types** | `*` (only triggers if device has configured expected IP prefixes) |
| **Triggering** | Expected: `192.168.1.0/24`. Actual: `10.0.5.42` |
| **Non-triggering** | Expected: `192.168.1.0/24`. Actual: `192.168.1.105` |

---

#### RULE-012: Critical Battery Level

| Field | Value |
|---|---|
| **Rule ID** | `RULE-012` |
| **Name** | Critical Battery Level |
| **Description** | Battery-powered device has critically low battery, risking unmonitored offline state |
| **Category** | `threshold` |
| **Input Fields** | `metrics.battery_level` |
| **Condition** | `battery_level < 5` AND `battery_level >= 0` |
| **Window** | `consecutive`, size: 2, minOccurrences: 2 |
| **Severity** | `low` |
| **Confidence** | `high` |
| **Cooldown** | 1800 seconds |
| **Explanation Template** | `Battery level is {{actual}}% which is below the critical threshold of 5% for {{count}} consecutive readings` |
| **Device Types** | `*` (only triggers if `battery_level` is present in telemetry) |
| **Triggering** | 2 consecutive: `{ battery_level: 3 }`, `{ battery_level: 2 }` |
| **Non-triggering** | `{ battery_level: 6 }` (above threshold) |

---

### 5.2 Rule Evaluation Order

Rules are evaluated sequentially per telemetry document. The order does not affect outcome because rules are independent. All applicable rules are evaluated; one rule's result does not affect another's.

### 5.3 Cooldown State Storage

Cooldown state (last fire timestamp per rule + device combination) is stored in an in-memory Map. On server restart, cooldown state is lost. This is acceptable because cooldown is a noise-reduction mechanism, not a correctness guarantee.

---

## 6. Risk Engine

### 6.1 Score Range

**0–100**, where 0 = no known risk and 100 = maximum possible risk.

### 6.2 Risk Factors and Weights

| # | Factor | Symbol | Weight (Max) | Source | Calculation |
|---|---|---|---|---|---|
| F1 | Active critical security events | `Wc` | 25 | `securityEvents` where `deviceId = D`, `status ∈ {open, acknowledged}`, `severity = critical` | If count ≥ 1: value = 25. If count = 0: value = 0. |
| F2 | Active high security events | `Wh` | 15 | `securityEvents` where `deviceId = D`, `status ∈ {open, acknowledged}`, `severity = high` | `min(count × 5, 15)`. 1 event = 5, 2 = 10, 3+ = 15. |
| F3 | Firmware vulnerability status | `Wfv` | 20 | `firmwareVersions` where `version = device.currentFirmwareVersion` | `secure` = 0, `under_review` = 10, `vulnerable` = 20, `recalled` = 20. If no firmware record: 5 (unknown). |
| F4 | Firmware age | `Wfa` | 10 | `firmwareVersions.releaseDate` | `< 30 days` = 0, `30–90 days` = 5, `> 90 days` = 10. If no firmware record: 5. |
| F5 | Device health status | `Wdh` | 10 | `device.healthStatus` | `healthy` = 0, `degraded` = 5, `offline` = 10, `unknown` = 5. |
| F6 | Authentication anomalies (30 days) | `Waa` | 10 | `securityEvents` where `deviceId = D`, `category = auth`, `createdAt > (now - 30d)` | `min(count × 3, 10)`. 1 = 3, 2 = 6, 3 = 9, 4+ = 10. |
| F7 | Anomaly frequency (7 days) | `Waf` | 10 | `securityEvents` where `deviceId = D`, `createdAt > (now - 7d)` | `0 events` = 0, `1–2` = 2, `3–5` = 5, `6–10` = 8, `> 10` = 10. |

### 6.3 Formula

```
RiskScore = F1 + F2 + F3 + F4 + F5 + F6 + F7
```

No normalization needed. Maximum possible score = 25 + 15 + 20 + 10 + 10 + 10 + 10 = **100**.

### 6.4 Severity Thresholds

| Score Range | Severity | Label |
|---|---|---|
| 0–20 | `low` | Secure |
| 21–40 | `medium` | Caution |
| 41–60 | `high` | At Risk |
| 61–80 | `critical` | Critical |
| 81–100 | `severe` | Compromised |

### 6.5 Recalculation Triggers

1. New security event created for the device
2. Security event resolved or marked false positive
3. Device firmware version changes
4. Device health status changes
5. Firmware vulnerability metadata is updated (affects all devices running that version)
6. Manual recalculation requested by operator

### 6.6 Example Calculations

**Example A — Healthy Device (Score: 0)**

| Factor | Value | Detail |
|---|---|---|
| F1 Critical events | 0 | No active critical events |
| F2 High events | 0 | No active high events |
| F3 Firmware vuln | 0 | Firmware v2.1.0, status: secure |
| F4 Firmware age | 0 | Released 15 days ago |
| F5 Health | 0 | Healthy |
| F6 Auth anomalies | 0 | No auth anomalies in 30d |
| F7 Anomaly freq | 0 | No anomalies in 7d |
| **Total** | **0** | **Secure** |

**Example B — Compromised Device (Score: 85)**

| Factor | Value | Detail |
|---|---|---|
| F1 Critical events | 25 | 1 critical event: brute-force auth (EVT-001) |
| F2 High events | 10 | 2 high events: network spike (EVT-002), temp anomaly (EVT-003) |
| F3 Firmware vuln | 20 | Firmware v1.0.3 has CVE-2025-1234 (status: vulnerable) |
| F4 Firmware age | 10 | Released 200 days ago |
| F5 Health | 5 | Degraded |
| F6 Auth anomalies | 10 | 5 auth anomalies in 30d |
| F7 Anomaly freq | 5 | 4 anomalies in 7d |
| **Total** | **85** | **Compromised** |

**Example C — Moderate Risk Device (Score: 35)**

| Factor | Value | Detail |
|---|---|---|
| F1 Critical events | 0 | No critical events |
| F2 High events | 5 | 1 high event: network spike (EVT-010) |
| F3 Firmware vuln | 10 | Firmware under_review |
| F4 Firmware age | 5 | Released 60 days ago |
| F5 Health | 0 | Healthy |
| F6 Auth anomalies | 6 | 2 auth anomalies in 30d |
| F7 Anomaly freq | 8 | 8 anomalies in 7d |
| **Total** | **34** (rounds to bracket) | **Caution** |

### 6.7 Explainability Response Format

```json
{
  "score": 85,
  "severity": "severe",
  "label": "Compromised",
  "calculatedAt": "2026-09-03T04:00:00Z",
  "factors": [
    { "name": "Active critical events", "value": 25, "maxValue": 25, "detail": "1 critical event: brute-force auth attempt", "contributingIds": ["EVT-001"] },
    { "name": "Active high events", "value": 10, "maxValue": 15, "detail": "2 high events: network egress spike, temperature anomaly", "contributingIds": ["EVT-002", "EVT-003"] },
    { "name": "Firmware vulnerability", "value": 20, "maxValue": 20, "detail": "Firmware v1.0.3 — CVE-2025-1234 (CVSS 9.1), status: vulnerable" },
    { "name": "Firmware age", "value": 10, "maxValue": 10, "detail": "Firmware released 200 days ago" },
    { "name": "Device health", "value": 5, "maxValue": 10, "detail": "Device health: degraded — last seen 75s ago (expected: 30s)" },
    { "name": "Auth anomalies (30d)", "value": 10, "maxValue": 10, "detail": "5 authentication anomaly events in last 30 days" },
    { "name": "Anomaly frequency (7d)", "value": 5, "maxValue": 10, "detail": "4 anomaly events in last 7 days" }
  ]
}
```

---

## 7. Event Correlation

### 7.1 Strategies

#### Strategy 1: Same-Device Temporal Clustering

| Aspect | Value |
|---|---|
| **Strategy ID** | `CORR-TEMPORAL` |
| **Logic** | Multiple events from the same device within a time window |
| **Time Window** | 30 minutes (configurable) |
| **Minimum Event Count** | 3 |
| **Severity Requirement** | At least 1 event with severity ≥ medium |
| **Incident Severity** | Highest severity among correlated events |
| **Explanation Template** | `{{count}} events from device {{deviceId}} within {{window}} minutes: {{eventSummaries}}` |

#### Strategy 2: Same-Rule Repeated

| Aspect | Value |
|---|---|
| **Strategy ID** | `CORR-REPEATED` |
| **Logic** | Same rule fires for same device N times within a window |
| **Time Window** | 60 minutes |
| **Minimum Event Count** | 5 (same ruleId + same deviceId) |
| **Severity Requirement** | None (volume itself indicates escalation) |
| **Incident Severity** | One level above the rule's base severity (medium→high, high→critical). Critical stays critical. |
| **Explanation Template** | `Rule "{{ruleName}}" triggered {{count}} times for device {{deviceId}} within {{window}} minutes` |

#### Strategy 3: Severity Escalation

| Aspect | Value |
|---|---|
| **Strategy ID** | `CORR-ESCALATION` |
| **Logic** | Device already has an open incident AND a new event arrives with severity > current incident severity |
| **Time Window** | N/A (checks against open incidents) |
| **Minimum Event Count** | 1 (the new higher-severity event) |
| **Severity Requirement** | New event severity > incident current severity |
| **Incident Action** | Attach event to existing incident. Escalate incident severity to match new event. |
| **Explanation Template** | `Incident severity escalated from {{previous}} to {{new}} due to new {{eventSeverity}} event: {{eventExplanation}}` |

### 7.2 Correlation Flow

```
When a new SecurityEvent is created:
  1. Does this device have an open incident?
     YES → Attach event to incident.
           If event.severity > incident.severity → escalate (Strategy 3).
           DONE.
     NO  → Continue to step 2.
  
  2. Evaluate Strategy 1 (temporal):
     Query: events where deviceId = D, createdAt > (now - 30min), status ∈ {open, acknowledged}
     If count ≥ 3 AND at least 1 has severity ≥ medium:
       → Create incident with all matched events. Record strategy = CORR-TEMPORAL.
       DONE.
  
  3. Evaluate Strategy 2 (repeated):
     Query: events where deviceId = D, ruleId = this.ruleId, createdAt > (now - 60min)
     If count ≥ 5:
       → Create incident with all matched events. Record strategy = CORR-REPEATED.
       DONE.
  
  4. No correlation matched:
     If event.severity ≥ high:
       → Create standalone incident (no correlation). correlationDetails = null.
     Else:
       → Event remains standalone. May correlate later when more events arrive.
```

### 7.3 Incident Creation from Correlation

When an incident is created, the `correlationDetails` field records:

```json
{
  "strategyId": "CORR-TEMPORAL",
  "strategyName": "Same-Device Temporal Clustering",
  "matchReason": "3 events from device DEV-TS-A3F2B1 within 20 minutes: RULE-001 (CPU spike), RULE-004 (network egress spike), RULE-006 (auth brute force)",
  "timeWindowMinutes": 30,
  "eventCount": 3,
  "matchedAt": "2026-09-03T04:15:00Z"
}
```

---

## 8. Incident Management

### 8.1 States

| State | Meaning | Entry Condition |
|---|---|---|
| `detected` | System-created. No human has reviewed. | Automatic (correlation or standalone critical event) |
| `triaged` | Analyst reviewed and confirmed it warrants investigation | Operator/security_analyst transitions from `detected` |
| `investigating` | Active investigation in progress | Operator/security_analyst transitions from `triaged` |
| `containment` | Response action taken (quarantine, key revocation, etc.) | Operator/security_analyst transitions from `investigating` |
| `resolved` | Root cause addressed. Analyst believes threat eliminated. | Operator/security_analyst transitions from `containment` |
| `false_positive` | Investigation determined this is not a genuine threat | Operator/security_analyst transitions from `investigating` |
| `closed` | Final state. Resolution verified or false positive documented. | Security_analyst/org_admin transitions from `resolved` or `false_positive` |

### 8.2 Valid State Transitions

| From | To | Who Can Transition |
|---|---|---|
| `detected` | `triaged` | operator, security_analyst, org_admin |
| `triaged` | `investigating` | operator, security_analyst, org_admin |
| `investigating` | `containment` | operator, security_analyst, org_admin |
| `investigating` | `false_positive` | operator, security_analyst, org_admin |
| `containment` | `resolved` | operator, security_analyst, org_admin |
| `containment` | `investigating` | operator, security_analyst, org_admin |
| `resolved` | `closed` | security_analyst, org_admin |
| `false_positive` | `closed` | security_analyst, org_admin |

Any transition not in this table is **invalid** and must be rejected by the API with a 400 error.

### 8.3 Assignment

- Incidents can be assigned to any user within the organization.
- Assignment is optional. Unassigned incidents appear in a shared queue.
- Assignment does not restrict who can perform actions on the incident.

### 8.4 Investigation Notes

- Any operator or security_analyst can add text notes to an incident.
- Notes are embedded in the incident document: `notes: [{ timestamp, author, content }]`.
- Notes are append-only. No editing or deleting notes.

### 8.5 Evidence

Incidents carry an `evidence` array linking to supporting data:

```
evidence: [{
  type: "security_event" | "telemetry" | "device_state" | "audit_entry",
  entityId: ObjectId,
  addedAt: Date,
  addedBy: ObjectId | "system",
  note: string | null
}]
```

System automatically adds the correlated security events as evidence on creation. Analysts can manually add additional evidence items.

### 8.6 Response Actions

Recorded as entries in the `responseActions` array:

| Action | Effect |
|---|---|
| `quarantine_device` | Transitions device to `quarantined` state |
| `revoke_key` | Nullifies device API key hash. Device can no longer authenticate. |
| `rollback_firmware` | Creates a firmware deployment to roll back to previous version |
| `escalate` | Increases incident severity |
| `other` | Free-text description of custom action |

### 8.7 Resolution

Required fields when resolving:
- `summary`: what was done
- `rootCause`: why the incident occurred
- `preventiveMeasures`: what will prevent recurrence
- `resolvedBy`: the user who resolved it

Optional: `verifiedBy` (set when transitioning to `closed`).

### 8.8 SLA Tracking

| Severity | Time to Triage | Time to Resolve |
|---|---|---|
| critical | 15 minutes | 4 hours |
| high | 1 hour | 24 hours |
| medium | 4 hours | 72 hours |
| low | 24 hours | 7 days |

- `slaTriageDeadline = detectedAt + timeToTriage`
- `slaResolveDeadline = detectedAt + timeToResolve`
- `slaBreached = true` if `triagedAt > slaTriageDeadline` OR `resolvedAt > slaResolveDeadline`

SLA thresholds are configurable per organization.

---

## 9. Firmware Security

### 9.1 Firmware Entity

| Field | Type | Required | Description |
|---|---|---|---|
| `version` | String (semver) | Yes | e.g., "2.1.0" |
| `deviceType` | String (enum) | Yes | Which device type this firmware is for |
| `checksum` | String | Yes | SHA-256 of the firmware binary |
| `fileSize` | Number | No | Bytes |
| `releaseDate` | Date | Yes | When the version was released |
| `changelog` | String | No | What changed in this version |
| `securityStatus` | Enum | Yes | `secure`, `under_review`, `vulnerable`, `recalled` |
| `vulnerabilities` | Array | No | CVE references (see below) |
| `deploymentPolicy` | Enum | Yes | `allowed`, `blocked`, `restricted` |
| `uploadedBy` | ObjectId | Yes | User who registered this version |
| `organizationId` | ObjectId | Yes | Owning organization |

### 9.2 CVE Reference

```
{ cveId: "CVE-2025-1234", severity: "critical", description: "...", cvssScore: 9.1, reportedAt: Date }
```

### 9.3 Deployment Lifecycle

```
pending → downloading → installing → verifying → success
                                               → failed → rolled_back
```

### 9.4 Eligibility Rules

Before creating a deployment:
1. Firmware `securityStatus` must NOT be `vulnerable` or `recalled` → Block with 400 error
2. Firmware `deploymentPolicy` must be `allowed` or `restricted` (restricted = security_analyst+ only)
3. Firmware `deviceType` must match target device's type
4. Warning (not block) if target device has an open critical incident

### 9.5 Rollback

If deployment fails:
1. Platform records failure with error message
2. If previous firmware version is known and available, a rollback deployment can be created
3. Device's `currentFirmwareVersion` reverts to previous version
4. Rollback is recorded in audit log

---

## 10. Device Lifecycle

### 10.1 State Diagram

```
[registered] → (first telemetry) → [active]
[active] → (operator action) → [maintenance] → (operator action) → [active]
[active] → (quarantine trigger) → [quarantined] → (issue resolved) → [active]
[quarantined] → (unrecoverable) → [decommissioned]
[active] → (end of life) → [decommissioned]
[maintenance] → (end of life) → [decommissioned]
```

### 10.2 State Behaviors

| State | Accepts Telemetry | Anomaly Detection | Risk Scoring | Health Monitoring |
|---|---|---|---|---|
| `registered` | No (no key distributed yet*) | No | No | `unknown` |
| `active` | Yes | Yes | Yes | Yes |
| `maintenance` | Yes | Suppressed | Paused (retains last score) | Paused |
| `quarantined` | Yes | Yes | Yes | Yes |
| `decommissioned` | Rejected | No | No | N/A |

*Note: The API key is generated at registration, so technically the key exists. But the device is expected to transition to `active` on first telemetry.

---

## 11. IoT Simulator

### 11.1 Device Profiles

#### Profile: Temperature Sensor (`temperature_sensor`)

| Metric | Normal Min | Normal Max | Unit | Reporting Interval |
|---|---|---|---|---|
| `cpu_usage` | 5 | 30 | % | 30s |
| `memory_usage` | 20 | 50 | % | 30s |
| `temperature` | 18 | 28 | °C | 30s |
| `battery_level` | 0 | 100 | % (drain: 0.1/interval) | 30s |
| `network_out` | 100 | 500 | bytes | 30s |
| `signal_strength` | -70 | -30 | dBm | 30s |

#### Profile: Smart Camera (`smart_camera`)

| Metric | Normal Min | Normal Max | Unit | Reporting Interval |
|---|---|---|---|---|
| `cpu_usage` | 20 | 60 | % | 30s |
| `memory_usage` | 40 | 75 | % | 30s |
| `temperature` | 25 | 45 | °C | 30s |
| `network_out` | 5000 | 50000 | bytes | 30s |
| `disk_usage` | 30 | 80 | % | 30s |
| `error_count` | 0 | 2 | count | 30s |

#### Profile: Industrial Gateway (`industrial_gateway`)

| Metric | Normal Min | Normal Max | Unit | Reporting Interval |
|---|---|---|---|---|
| `cpu_usage` | 30 | 70 | % | 15s |
| `memory_usage` | 50 | 85 | % | 15s |
| `temperature` | 20 | 55 | °C | 15s |
| `network_in` | 10000 | 100000 | bytes | 15s |
| `network_out` | 10000 | 100000 | bytes | 15s |
| `uptime` | increments | - | seconds | 15s |

#### Profile: Medical Monitor (`medical_monitor`)

| Metric | Normal Min | Normal Max | Unit | Reporting Interval |
|---|---|---|---|---|
| `cpu_usage` | 10 | 40 | % | 30s |
| `memory_usage` | 25 | 60 | % | 30s |
| `temperature` | 20 | 35 | °C | 30s |
| `battery_level` | 0 | 100 | % (drain: 0.05/interval) | 30s |
| `signal_strength` | -60 | -20 | dBm | 30s |
| `error_count` | 0 | 0 | count | 30s |

#### Profile: Smart Lock (`smart_lock`)

| Metric | Normal Min | Normal Max | Unit | Reporting Interval |
|---|---|---|---|---|
| `cpu_usage` | 2 | 15 | % | 60s |
| `memory_usage` | 10 | 30 | % | 60s |
| `battery_level` | 0 | 100 | % (drain: 0.02/interval) | 60s |
| `signal_strength` | -80 | -40 | dBm | 60s |
| `error_count` | 0 | 1 | count | 60s |

### 11.2 Telemetry Message Format

```json
{
  "timestamp": "2026-09-03T04:00:30.000Z",
  "metrics": {
    "cpu_usage": 22.4,
    "memory_usage": 38.1,
    "temperature": 23.7,
    "battery_level": 87.2,
    "network_out": 312
  },
  "metadata": {
    "ip": "192.168.1.105",
    "firmware_version": "2.1.0",
    "uptime": 86400
  }
}
```

### 11.3 MQTT Topics

The simulator publishes to: `{orgSlug}/devices/{deviceId}/telemetry`

Authentication: `username` = `deviceId`, `password` = device API key.

### 11.4 Normal Behavior Generation

Each metric value is generated using Gaussian noise around the midpoint of the normal range:

```
value = midpoint + (random_gaussian() × stddev)
clamped to [min, max]
```

Where `stddev = (max - min) / 6` (99.7% of values within range).

Battery drain is linear per interval. Uptime increments by the interval duration.

### 11.5 Anomalous Behavior Modes (Simulator v2)

| Mode | CLI Flag | Behavior | Target Rules |
|---|---|---|---|
| Threshold violation | `--anomaly threshold` | CPU sustains > 90% for 10+ readings | RULE-001 |
| Network spike | `--anomaly network-spike` | network_out jumps to 50× normal for 5+ readings | RULE-004 |
| Impossible value | `--anomaly impossible-value` | Reports temperature = -300°C | RULE-010 |
| Heartbeat failure | `--anomaly heartbeat` | Stops publishing for 5 minutes | RULE-005 |
| Auth brute force | `--anomaly auth-bruteforce` | Connects with wrong API key 10 times in 2 minutes | RULE-006 |
| Firmware tamper | `--anomaly firmware-tamper` | Reports unregistered firmware version "9.9.9-tampered" | RULE-007 |

### 11.6 Attack Scenarios (Simulator v3)

**Scenario 1: Normal Fleet** — 10 mixed-type devices operating normally for 30 minutes.

**Scenario 2: Single Device Compromise** — 1 device shows: auth brute force (T+0min) → off-schedule reporting (T+5min) → network egress spike (T+10min) → firmware version change (T+15min). Expected: triggers RULE-006, RULE-008, RULE-004, RULE-007, correlation into single incident.

**Scenario 3: Firmware Exploit** — Device running vulnerable firmware shows: gradual CPU increase over 15 minutes → memory exhaustion → network spike. Expected: triggers RULE-001, RULE-002, RULE-004, high risk score due to firmware + events.

**Scenario 4: Gradual Degradation** — Device slowly drifts: temperature rises 0.5°C per minute for 30 minutes from 25°C to 40°C, then continues to 90°C. Expected: triggers RULE-003 when crossing 85°C.

**Scenario 5: Fleet-Wide Attack** — 5 devices simultaneously show auth brute force + network spikes. Expected: 5 separate incidents (one per device), all critical.

**Scenario 6: False Positive Validation** — Devices produce borderline values (CPU at 89%, temperature at 84°C, 4 auth failures). Expected: NO rules trigger (validates thresholds).

### 11.7 Device Registration with Platform

Before simulating, the simulator must:
1. Register devices via REST API `POST /api/v1/devices` (using a valid user JWT)
2. Store the returned API keys
3. Use those API keys for MQTT authentication

Alternatively, a seed script pre-registers simulator devices and stores keys in the simulator's config file.

---

## 12. MQTT

### 12.1 Broker

Aedes (Node.js embedded MQTT broker) running inside the same process as the Express server on a separate TCP port (default: 1883).

### 12.2 Authentication

| Aspect | Specification |
|---|---|
| Mechanism | API key in MQTT `password` field. `username` = `deviceId`. |
| Server validation | Aedes `authenticate` hook: look up device by `deviceId`, hash the provided password with SHA-256, compare against stored `apiKeyHash`. Reject if mismatch, device not found, device decommissioned, or org mismatch. |
| Session context | On successful auth, attach `{ deviceId, organizationId, organizationSlug }` to the MQTT client session for use in authorization hooks. |

### 12.3 Topic Naming

```
{orgSlug}/devices/{deviceId}/telemetry    — Device publishes metrics
{orgSlug}/devices/{deviceId}/status       — Device publishes status
{orgSlug}/devices/{deviceId}/commands     — Future: platform publishes to device
```

### 12.4 Organization Isolation

- Topics namespaced by `orgSlug`
- `authorizePublish` verifies `client.session.organizationSlug` matches topic prefix
- `authorizeSubscribe` verifies org match (devices can only subscribe to their own command topic)
- Cross-org topic access is impossible at the broker level

### 12.5 Device Authorization

- Aedes `authorizePublish` hook: verify topic matches `{orgSlug}/devices/{deviceId}/*` where deviceId and orgSlug are from the authenticated session
- Aedes `authorizeSubscribe` hook: devices may only subscribe to `{orgSlug}/devices/{deviceId}/commands`
- Wildcard subscriptions (`#`, `+`) are rejected for device clients

### 12.6 Payload Validation

| Check | Failure Action |
|---|---|
| JSON parse | Drop, log, increment device error counter |
| Missing `timestamp` | Drop, log |
| Missing `metrics` or empty metrics object | Drop, log |
| Timestamp > 5 min in future | Drop, log |
| Timestamp > 5 min in past | Accept but flag |
| Payload > 10KB | Drop, log |

### 12.7 Duplicate Handling

Key: SHA-256(`deviceId` + `timestamp` + JSON.stringify(`metrics`))

Maintain an in-memory Set (max 10,000 entries, FIFO eviction) of recent hashes. If hash exists, drop the message.

### 12.8 Replay Handling

Timestamp validation (±5 min window) prevents replay of old messages.

### 12.9 Connection Abuse

| Concern | Mitigation |
|---|---|
| Rapid connect/disconnect | Track per-deviceId. > 10 connections/min → 5-min block |
| Message flooding | Rate-limit per device: max 10 msg/sec. Drop excess. |
| Wrong-topic probing | Authorize hook rejection + log. 5+ failures → flag device |

### 12.10 Ingestion Flow

```
MQTT message → authenticate hook → authorizePublish hook → publish event handler
  → JSON parse → schema validate → deduplicate → create telemetry doc
  → update device.lastSeenAt → update device.healthStatus
  → run anomaly detection → store telemetry
  → [if anomaly] → create event → recalc risk → correlate → [maybe create incident]
```

---

## 13. REST API Requirements

### 13.1 Auth Domain

#### `POST /api/v1/auth/login`

| Aspect | Detail |
|---|---|
| Purpose | Authenticate user and issue tokens |
| Auth | None |
| Role | None |
| Request | `{ email: string, password: string }` |
| Response 200 | `{ accessToken: string, user: { id, email, displayName, role, organizationId } }` + Set-Cookie: `refreshToken` (httpOnly, secure) |
| Error 401 | `{ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } }` |
| Error 429 | Rate limited (10 req/min per IP) |

#### `POST /api/v1/auth/refresh`

| Aspect | Detail |
|---|---|
| Purpose | Issue new access + refresh token pair |
| Auth | Refresh token cookie |
| Role | None |
| Request | None (refresh token from cookie) |
| Response 200 | `{ accessToken: string }` + new Set-Cookie: `refreshToken` |
| Error 401 | Invalid or revoked refresh token |

#### `POST /api/v1/auth/logout`

| Aspect | Detail |
|---|---|
| Purpose | Revoke all refresh tokens for user |
| Auth | JWT |
| Role | Any |
| Request | None |
| Response 200 | `{ message: "Logged out" }` + Clear-Cookie |

#### `POST /api/v1/auth/register`

| Aspect | Detail |
|---|---|
| Purpose | Create first organization and admin user (initial setup) |
| Auth | None (only works if zero organizations exist) |
| Role | None |
| Request | `{ organizationName: string, email: string, password: string, displayName: string }` |
| Response 201 | `{ organization: {...}, user: {...}, accessToken: string }` |
| Error 409 | Organization already exists |

### 13.2 Users Domain

#### `GET /api/v1/users`

| Aspect | Detail |
|---|---|
| Purpose | List users in organization |
| Auth | JWT |
| Role | viewer+ |
| Request | Query: `?page=1&limit=20&role=operator&isActive=true` |
| Response 200 | `{ users: [{ id, email, displayName, role, isActive, lastLoginAt, createdAt }], total, page, limit }` |

#### `GET /api/v1/users/:id`

| Aspect | Detail |
|---|---|
| Purpose | Get user details |
| Auth | JWT |
| Role | viewer+ |
| Response 200 | `{ id, email, displayName, role, isActive, lastLoginAt, createdAt }` |
| Error 404 | User not found in this organization |

#### `POST /api/v1/users/invite`

| Aspect | Detail |
|---|---|
| Purpose | Invite new user to organization |
| Auth | JWT |
| Role | org_admin |
| Request | `{ email: string, role: string, displayName: string }` |
| Response 201 | `{ id, email, displayName, role, isActive: true, temporaryPassword: string }` |
| Error 409 | Email already registered |

#### `PATCH /api/v1/users/:id`

| Aspect | Detail |
|---|---|
| Purpose | Update user (role, active status) |
| Auth | JWT |
| Role | org_admin |
| Request | `{ role?: string, isActive?: boolean }` |
| Response 200 | Updated user object |

#### `GET /api/v1/users/me`

| Aspect | Detail |
|---|---|
| Purpose | Get current user profile |
| Auth | JWT |
| Role | Any |
| Response 200 | `{ id, email, displayName, role, organizationId, lastLoginAt }` |

#### `PATCH /api/v1/users/me`

| Aspect | Detail |
|---|---|
| Purpose | Update own profile |
| Auth | JWT |
| Role | Any |
| Request | `{ displayName?: string }` |
| Response 200 | Updated profile |

#### `PATCH /api/v1/users/me/password`

| Aspect | Detail |
|---|---|
| Purpose | Change own password |
| Auth | JWT |
| Role | Any |
| Request | `{ currentPassword: string, newPassword: string }` |
| Response 200 | `{ message: "Password updated" }` |
| Error 401 | Current password incorrect |

### 13.3 Organizations Domain

#### `GET /api/v1/organizations/current`

| Aspect | Detail |
|---|---|
| Purpose | Get current user's organization |
| Auth | JWT |
| Role | viewer+ |
| Response 200 | `{ id, name, slug, settings: { slaThresholds, autoQuarantine, alertPreferences }, createdAt }` |

#### `PATCH /api/v1/organizations/current`

| Aspect | Detail |
|---|---|
| Purpose | Update organization settings |
| Auth | JWT |
| Role | org_admin |
| Request | `{ name?: string, settings?: { slaThresholds?, autoQuarantine?: { enabled, threshold }, alertPreferences? } }` |
| Response 200 | Updated organization |

#### `POST /api/v1/organizations`

| Aspect | Detail |
|---|---|
| Purpose | Create new organization (platform admin) |
| Auth | JWT |
| Role | super_admin |
| Request | `{ name: string, slug: string }` |
| Response 201 | Organization object |

### 13.4 Devices Domain

#### `POST /api/v1/devices`

| Aspect | Detail |
|---|---|
| Purpose | Register new device |
| Auth | JWT |
| Role | security_analyst+ |
| Request | `{ name: string, type: enum, manufacturer: string, model: string, location?: string, tags?: [{key, value}], firmwareVersion?: string }` |
| Response 201 | `{ device: {...}, apiKey: string }` (apiKey shown once) |

#### `GET /api/v1/devices`

| Aspect | Detail |
|---|---|
| Purpose | List devices with filters |
| Auth | JWT |
| Role | viewer+ |
| Request | Query: `?page=1&limit=20&type=smart_camera&status=active&healthStatus=degraded&riskMin=40&riskMax=100&tag=floor:3&search=lobby&sortBy=riskScore&sortOrder=desc` |
| Response 200 | `{ devices: [{id, deviceId, name, type, status, healthStatus, riskScore, riskSeverity, currentFirmwareVersion, lastSeenAt, tags, createdAt}], total, page, limit }` |

#### `GET /api/v1/devices/:id`

| Aspect | Detail |
|---|---|
| Purpose | Device details |
| Auth | JWT |
| Role | viewer+ |
| Response 200 | Full device object including `riskScore`, `riskFactors[]`, `timeline` (last 50), tags, firmware info |

#### `PATCH /api/v1/devices/:id`

| Aspect | Detail |
|---|---|
| Purpose | Update device metadata or lifecycle state |
| Auth | JWT |
| Role | operator+ (state change), security_analyst+ (metadata) |
| Request | `{ name?, location?, tags?, status? }` |
| Response 200 | Updated device |
| Error 400 | Invalid state transition |

#### `POST /api/v1/devices/:id/regenerate-key`

| Aspect | Detail |
|---|---|
| Purpose | Generate new API key (invalidates old) |
| Auth | JWT |
| Role | security_analyst+ |
| Response 200 | `{ apiKey: string }` (shown once) |

#### `GET /api/v1/devices/:id/telemetry`

| Aspect | Detail |
|---|---|
| Purpose | Recent telemetry for device |
| Auth | JWT |
| Role | viewer+ |
| Request | Query: `?limit=100&from=ISO8601&to=ISO8601` |
| Response 200 | `{ telemetry: [{ timestamp, metrics, metadata }], total }` |

#### `GET /api/v1/devices/:id/events`

| Aspect | Detail |
|---|---|
| Purpose | Security events for device |
| Auth | JWT |
| Role | viewer+ |
| Request | Query: `?status=open&severity=critical&limit=50` |
| Response 200 | `{ events: [...], total }` |

#### `GET /api/v1/devices/:id/risk`

| Aspect | Detail |
|---|---|
| Purpose | Risk score breakdown |
| Auth | JWT |
| Role | viewer+ |
| Response 200 | Risk explainability object (see Section 6.7) |

#### `GET /api/v1/devices/stats`

| Aspect | Detail |
|---|---|
| Purpose | Aggregate device statistics |
| Auth | JWT |
| Role | viewer+ |
| Response 200 | `{ total, byStatus: {registered, active, ...}, byHealth: {healthy, degraded, ...}, byRisk: {secure, caution, ...} }` |

### 13.5 Telemetry Domain

#### `POST /api/v1/telemetry/ingest`

| Aspect | Detail |
|---|---|
| Purpose | REST fallback for telemetry ingestion |
| Auth | Device API key (`X-Device-API-Key` header) |
| Role | N/A (device auth) |
| Request | `{ timestamp: ISO8601, metrics: { ... }, metadata?: { ... } }` |
| Response 201 | `{ received: true }` |
| Error 401 | Invalid API key |
| Error 400 | Invalid payload schema |

### 13.6 Security Events Domain

#### `GET /api/v1/security-events`

| Aspect | Detail |
|---|---|
| Purpose | List security events |
| Auth | JWT |
| Role | viewer+ |
| Request | Query: `?page=1&limit=20&severity=critical&category=auth&status=open&deviceId=xxx&from=ISO&to=ISO` |
| Response 200 | `{ events: [{id, eventId, deviceId, deviceName, ruleId, ruleName, category, severity, confidence, status, explanation, occurrenceCount, firstOccurrence, lastOccurrence, incidentId, createdAt}], total, page, limit }` |

#### `GET /api/v1/security-events/:id`

| Aspect | Detail |
|---|---|
| Purpose | Event detail with linked telemetry |
| Auth | JWT |
| Role | viewer+ |
| Response 200 | Full event object + `{ triggeringTelemetry: {...}, rule: {...} }` |

#### `PATCH /api/v1/security-events/:id`

| Aspect | Detail |
|---|---|
| Purpose | Update event status |
| Auth | JWT |
| Role | operator+ |
| Request | `{ status: "acknowledged" | "resolved" | "false_positive" }` |
| Response 200 | Updated event |

#### `GET /api/v1/security-events/stats`

| Aspect | Detail |
|---|---|
| Purpose | Event counts by severity, category, status |
| Auth | JWT |
| Role | viewer+ |
| Response 200 | `{ bySeverity: {...}, byCategory: {...}, byStatus: {...}, total }` |

### 13.7 Incidents Domain

#### `GET /api/v1/incidents`

| Aspect | Detail |
|---|---|
| Purpose | List incidents |
| Auth | JWT |
| Role | viewer+ |
| Request | Query: `?page=1&limit=20&status=detected&severity=critical&assignedTo=userId&slaBreached=true` |
| Response 200 | `{ incidents: [{incidentId, title, severity, status, category, deviceId, deviceName, assignedTo, assignedToName, relatedEventCount, slaBreached, detectedAt, createdAt}], total, page, limit }` |

#### `GET /api/v1/incidents/:id`

| Aspect | Detail |
|---|---|
| Purpose | Full incident detail |
| Auth | JWT |
| Role | viewer+ |
| Response 200 | Complete incident object including timeline, notes, evidence, responseActions, resolution, correlationDetails, relatedEvents (populated) |

#### `PATCH /api/v1/incidents/:id/status`

| Aspect | Detail |
|---|---|
| Purpose | Transition incident state |
| Auth | JWT |
| Role | operator+ (most), security_analyst+ (close) |
| Request | `{ status: string, note?: string }` |
| Response 200 | Updated incident |
| Error 400 | Invalid state transition |

#### `PATCH /api/v1/incidents/:id/assign`

| Aspect | Detail |
|---|---|
| Purpose | Assign incident to user |
| Auth | JWT |
| Role | operator+ |
| Request | `{ assignedTo: userId }` |
| Response 200 | Updated incident |

#### `POST /api/v1/incidents/:id/notes`

| Aspect | Detail |
|---|---|
| Purpose | Add investigation note |
| Auth | JWT |
| Role | operator+ |
| Request | `{ content: string }` |
| Response 201 | Updated incident with new note |

#### `POST /api/v1/incidents/:id/actions`

| Aspect | Detail |
|---|---|
| Purpose | Record response action |
| Auth | JWT |
| Role | operator+ |
| Request | `{ action: enum, details: string }` |
| Response 201 | Updated incident with new action record |

#### `POST /api/v1/incidents/:id/resolve`

| Aspect | Detail |
|---|---|
| Purpose | Submit resolution |
| Auth | JWT |
| Role | operator+ |
| Request | `{ summary: string, rootCause: string, preventiveMeasures: string }` |
| Response 200 | Updated incident with resolution |

#### `GET /api/v1/incidents/stats`

| Aspect | Detail |
|---|---|
| Purpose | Incident counts |
| Auth | JWT |
| Role | viewer+ |
| Response 200 | `{ byStatus: {...}, bySeverity: {...}, slaBreached: number, total, mttt: number, mttr: number }` |

### 13.8 Firmware Domain

#### `POST /api/v1/firmware/versions`

| Aspect | Detail |
|---|---|
| Purpose | Register firmware version |
| Auth | JWT |
| Role | security_analyst+ |
| Request | `{ version: string, deviceType: string, checksum: string, releaseDate: ISO, changelog?: string }` |
| Response 201 | Firmware version object |

#### `GET /api/v1/firmware/versions`

| Aspect | Detail |
|---|---|
| Purpose | List firmware versions |
| Auth | JWT |
| Role | viewer+ |
| Request | Query: `?deviceType=smart_camera&securityStatus=vulnerable` |
| Response 200 | `{ versions: [...], total }` |

#### `GET /api/v1/firmware/versions/:id`

| Aspect | Detail |
|---|---|
| Purpose | Firmware version detail |
| Auth | JWT |
| Role | viewer+ |
| Response 200 | Full version with CVEs, deployments count |

#### `PATCH /api/v1/firmware/versions/:id`

| Aspect | Detail |
|---|---|
| Purpose | Update security metadata |
| Auth | JWT |
| Role | security_analyst+ |
| Request | `{ securityStatus?: enum, vulnerabilities?: [{ cveId, severity, description, cvssScore }], deploymentPolicy?: enum }` |
| Response 200 | Updated version |

#### `POST /api/v1/firmware/deployments`

| Aspect | Detail |
|---|---|
| Purpose | Create deployment |
| Auth | JWT |
| Role | security_analyst+ |
| Request | `{ firmwareVersionId: string, deviceIds: [string] }` |
| Response 201 | `{ deployments: [{ deploymentId, deviceId, status: "pending" }] }` |
| Error 400 | Firmware vulnerable/recalled or device type mismatch |

#### `GET /api/v1/firmware/deployments`

| Aspect | Detail |
|---|---|
| Purpose | List deployments |
| Auth | JWT |
| Role | viewer+ |
| Request | Query: `?status=pending&firmwareVersionId=xxx` |
| Response 200 | `{ deployments: [...], total }` |

#### `GET /api/v1/firmware/deployments/:id`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | viewer+ |
| Response 200 | Full deployment detail |

#### `PATCH /api/v1/firmware/deployments/:id/status`

| Aspect | Detail |
|---|---|
| Purpose | Update deployment status (device reports progress) |
| Auth | Device API key |
| Request | `{ status: enum, result?: { success, message, verificationChecksum? } }` |
| Response 200 | Updated deployment |

### 13.9 Anomaly Rules Domain

#### `GET /api/v1/anomaly-rules`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | viewer+ |
| Response 200 | `{ rules: [{ruleId, name, category, severity, enabled, deviceTypes, isSystem, lastTriggered, createdAt}], total }` |

#### `GET /api/v1/anomaly-rules/:id`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | viewer+ |
| Response 200 | Full rule definition |

#### `POST /api/v1/anomaly-rules`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | security_analyst+ |
| Request | Full rule definition (see Section 5 schema) |
| Response 201 | Created rule |

#### `PATCH /api/v1/anomaly-rules/:id`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | security_analyst+ |
| Request | Partial rule update |
| Response 200 | Updated rule |
| Error 403 | Cannot modify system rules (clone instead) |

#### `DELETE /api/v1/anomaly-rules/:id`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | security_analyst+ |
| Effect | Soft-delete (set `enabled: false`, `deleted: true`) |
| Error 403 | Cannot delete system rules |

### 13.10 Audit Logs Domain

#### `GET /api/v1/audit-logs`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | security_analyst+ |
| Request | Query: `?page=1&limit=50&action=device.quarantine&actor=userId&targetType=device&from=ISO&to=ISO` |
| Response 200 | `{ logs: [{action, actor, actorName, actorIp, targetType, targetId, details, timestamp}], total, page, limit }` |

### 13.11 Notifications Domain

#### `GET /api/v1/notifications`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | Any |
| Request | Query: `?read=false&limit=20` |
| Response 200 | `{ notifications: [{id, type, title, message, severity, read, relatedEntityType, relatedEntityId, createdAt}], total }` |

#### `PATCH /api/v1/notifications/:id/read`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | Any (own only) |
| Response 200 | Updated notification |

#### `PATCH /api/v1/notifications/read-all`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | Any |
| Response 200 | `{ updated: number }` |

#### `GET /api/v1/notifications/unread-count`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | Any |
| Response 200 | `{ count: number }` |

### 13.12 Dashboard Domain

#### `GET /api/v1/dashboard/summary`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | viewer+ |
| Response 200 | All dashboard widget data in one response (fleet posture, incident counts, SLA, critical events, health distribution, risk distribution, firmware exposure, top-risk devices) |

#### `GET /api/v1/dashboard/trends`

| Aspect | Detail |
|---|---|
| Auth | JWT |
| Role | viewer+ |
| Request | Query: `?days=7` |
| Response 200 | `{ anomalyTrend: [{ date, count }] }` |

**Total: 12 domains, 56 endpoints.** Every endpoint has a frontend consumer or system role.

---

## 14. Frontend Requirements

### Page 1: Login

| Aspect | Detail |
|---|---|
| Purpose | User authentication |
| Role access | None (public) |
| Data displayed | Email/password form |
| Actions | Submit login |
| Filters | None |
| Empty state | N/A |
| Loading state | Submit button shows spinner, disables |
| Error state | Inline error message below form: "Invalid credentials" |

### Page 2: Security Dashboard

| Aspect | Detail |
|---|---|
| Purpose | Security command center — shift-start overview |
| Role access | viewer+ |
| Data displayed | 10 widgets (see Section 15) |
| Actions | Click any widget to navigate to relevant page. Click incident/event/device to view detail. |
| Filters | None (shows current org state) |
| Empty state | Widgets show "No data" with helpful message. Dashboard still renders. |
| Loading state | Skeleton placeholders for each widget |
| Error state | Per-widget error boundary. One broken widget does not crash the page. |

### Page 3: Device Inventory

| Aspect | Detail |
|---|---|
| Purpose | Browse, filter, and manage device fleet |
| Role access | viewer+ (read), operator+ (state change), security_analyst+ (register) |
| Data displayed | Table: device name, type, status, health, risk score (with severity badge), firmware, last seen, tags |
| Actions | Register device, change state, bulk quarantine, search, filter, sort, navigate to detail |
| Filters | Type, status, health, risk range, tags, text search |
| Empty state | "No devices registered. Register your first device." |
| Loading state | Table skeleton rows |
| Error state | Error alert with retry button |

### Page 4: Device Detail

| Aspect | Detail |
|---|---|
| Purpose | Single-device deep dive |
| Role access | viewer+ |
| Data displayed | Metadata, lifecycle state badge, health status, risk score with factor breakdown, telemetry charts (line charts over time), security events list, firmware info, device timeline |
| Actions | Change state, quarantine, regenerate API key, view linked events/incidents |
| Filters | Telemetry time range, event severity filter |
| Empty state | "No telemetry data yet" for charts section |
| Loading state | Section-by-section skeleton |
| Error state | Per-section error boundary |

### Page 5: Security Events

| Aspect | Detail |
|---|---|
| Purpose | Browse and triage security events |
| Role access | viewer+ (read), operator+ (triage) |
| Data displayed | Table: severity badge, category, device name, rule name, status, explanation excerpt, occurrence count, first/last seen, linked incident |
| Actions | Acknowledge, resolve, mark false positive, navigate to event detail, navigate to linked incident |
| Filters | Severity, category, status, device, date range |
| Empty state | "No security events detected. Your fleet is operating normally." |
| Loading state | Table skeleton |
| Error state | Error alert |

### Page 6: Incident List

| Aspect | Detail |
|---|---|
| Purpose | Browse and manage incidents |
| Role access | viewer+ (read), operator+ (manage) |
| Data displayed | Table: incident ID, title, severity, status, device, assigned to, related event count, SLA breach indicator, detected date |
| Actions | Navigate to incident detail, filter, sort |
| Filters | Status, severity, assigned to, SLA breached, date range |
| Empty state | "No incidents detected." |
| Loading state | Table skeleton |
| Error state | Error alert |

### Page 7: Incident Detail

| Aspect | Detail |
|---|---|
| Purpose | Investigation workspace |
| Role access | viewer+ (read), operator+ (investigate) |
| Data displayed | Header (ID, title, severity, status, SLA status), correlation explanation, chronological timeline of events and actions, linked security events (with explanations and telemetry links), device context (name, type, current risk), notes, response actions, resolution |
| Actions | Transition state, assign, add note, record response action (quarantine, revoke key, etc.), submit resolution |
| Filters | None |
| Empty state | N/A (incident always has at least one linked event) |
| Loading state | Full page skeleton |
| Error state | Error alert |

### Page 8: Firmware Management

| Aspect | Detail |
|---|---|
| Purpose | Manage firmware versions and deployments |
| Role access | viewer+ (read), security_analyst+ (manage) |
| Data displayed | Versions table: version, device type, security status badge, CVE count, deployment count, release date. Deployments table: device, target version, status, initiated by, date. |
| Actions | Register version, update security metadata, add CVEs, create deployment, view deployment status |
| Filters | Device type, security status |
| Empty state | "No firmware versions registered." |
| Loading state | Table skeleton |
| Error state | Error alert |

### Page 9: Anomaly Rules

| Aspect | Detail |
|---|---|
| Purpose | Configure detection rules |
| Role access | viewer+ (read), security_analyst+ (manage) |
| Data displayed | Table: rule name, category, severity, enabled toggle, device types, system/custom badge, last triggered |
| Actions | Create rule, edit rule, enable/disable, clone system rule |
| Filters | Category, severity, enabled/disabled, system/custom |
| Empty state | N/A (seed rules always present) |
| Loading state | Table skeleton |
| Error state | Error alert |

### Page 10: Audit Log

| Aspect | Detail |
|---|---|
| Purpose | Forensic activity trail |
| Role access | security_analyst+ |
| Data displayed | Table: timestamp, actor (user name), action, target type, target ID, details summary |
| Actions | Filter, paginate. Read-only — no edit/delete. |
| Filters | Action type, actor, target type, date range |
| Empty state | "No audit log entries found for the selected filters." |
| Loading state | Table skeleton |
| Error state | Error alert |

### Page 11: User Management

| Aspect | Detail |
|---|---|
| Purpose | Manage organization users |
| Role access | org_admin |
| Data displayed | Table: email, display name, role, active status, last login |
| Actions | Invite user, change role, deactivate user |
| Filters | Role, active status |
| Empty state | "No users found." |
| Loading state | Table skeleton |
| Error state | Error alert |

### Page 12: Settings

| Aspect | Detail |
|---|---|
| Purpose | Organization settings and user profile |
| Role access | viewer+ (profile), org_admin (org settings) |
| Data displayed | Two tabs/sections: Organization Settings (SLA thresholds, auto-quarantine config, alert preferences), User Profile (display name, email (read-only), password change) |
| Actions | Update settings, change password |
| Filters | None |
| Empty state | N/A |
| Loading state | Form skeleton |
| Error state | Inline form errors |

---

## 15. Dashboard

### 15.1 Widget Specifications

| # | Widget | Type | Question Answered | Data Source | Click Action |
|---|---|---|---|---|---|
| W1 | Fleet Security Posture | Donut chart | "What % of devices are at elevated risk?" | Device riskScore aggregation by severity bracket | Navigate to device inventory filtered by risk |
| W2 | Active Incidents | Stat cards (one per severity) | "How many incidents need attention?" | Incidents where status ∉ {closed, false_positive} | Navigate to incidents filtered by severity |
| W3 | SLA Compliance | Stat card (green/red) | "Am I meeting SLA targets?" | Incidents with slaBreached flag | Navigate to incidents filtered by slaBreached=true |
| W4 | Critical Unacknowledged Events | Count + top 3 preview | "Are there critical events nobody has seen?" | Events: severity=critical, status=open | Navigate to events filtered by critical+open |
| W5 | Device Health | Stacked bar chart | "How many devices are healthy/degraded/offline?" | Device healthStatus aggregation | Navigate to inventory filtered by health |
| W6 | Risk Distribution | Histogram (5 buckets) | "What's my risk distribution?" | Device riskScore counts per bracket | Navigate to inventory filtered by bracket |
| W7 | Anomaly Trend (7d) | Line chart | "Trending up or down?" | Events by day, last 7 days | Navigate to events with date filter |
| W8 | Firmware Exposure | Stat cards | "How many devices on vulnerable firmware?" | Devices where firmware status = vulnerable/recalled | Navigate to firmware page |
| W9 | Top 5 Highest-Risk Devices | Ranked list with risk badge | "Which devices need immediate attention?" | Top 5 devices by riskScore descending | Click device to open detail |
| W10 | Recent Events (Live) | Scrolling list | "What just happened?" | Last 10 events via REST + Socket.IO for new events | Click event to open detail |

### 15.2 Widgets NOT on Dashboard

- Total user count
- Device registration trends
- System uptime
- Decorative maps

---

## 16. Real-Time Requirements

### 16.1 Socket.IO Events

| Event Name | Payload | Emitted To | Trigger |
|---|---|---|---|
| `security-event:new` | `{ eventId, severity, category, deviceId, deviceName, explanation }` | Room `org:{orgId}` | New critical/high security event created |
| `incident:new` | `{ incidentId, title, severity, deviceId, deviceName }` | Room `org:{orgId}` | Incident created |
| `incident:updated` | `{ incidentId, status, severity }` | Room `incident:{incidentId}` + `org:{orgId}` | Incident status/severity change |
| `device:status-changed` | `{ deviceId, status, previousStatus }` | Room `org:{orgId}` | Device quarantined/offline/decommissioned |
| `device:risk-escalated` | `{ deviceId, riskScore, riskSeverity }` | Room `org:{orgId}` | Risk score enters critical/severe bracket |
| `notification:new` | `{ notificationId, type, title, severity }` | Room `user:{userId}` | Any notification created |

### 16.2 What Stays REST-Only

Device registration, user management, firmware upload, audit log entries, rule creation, telemetry ingestion.

---

## 17. Database Requirements

### 17.1 Collection: `organizations`

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | |
| `name` | String | Yes | Organization display name |
| `slug` | String | Yes | URL-safe unique identifier |
| `settings` | Object | Yes | `{ slaThresholds: { critical: { triage: 15, resolve: 240 }, ... }, autoQuarantine: { enabled: false, threshold: 80 }, alertPreferences: { minSeverity: "medium" } }` |
| `createdAt` | Date | Auto | |
| `updatedAt` | Date | Auto | |

**Indexes:** Unique on `slug`.  
**TTL:** None.  
**Org scoping:** N/A (this IS the org entity).

### 17.2 Collection: `users`

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | |
| `email` | String | Yes | Unique across platform |
| `passwordHash` | String | Yes | bcrypt hash |
| `displayName` | String | Yes | |
| `role` | String (enum) | Yes | `super_admin`, `org_admin`, `security_analyst`, `operator`, `viewer` |
| `organizationId` | ObjectId | Yes | References `organizations` |
| `isActive` | Boolean | Yes | Default: true |
| `lastLoginAt` | Date | No | |
| `createdAt` | Date | Auto | |
| `updatedAt` | Date | Auto | |

**Indexes:** Unique on `email`. Compound `{organizationId, role}`.  
**TTL:** None.  
**Org scoping:** `organizationId` field.

### 17.3 Collection: `refreshTokens`

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | |
| `userId` | ObjectId | Yes | References `users` |
| `tokenHash` | String | Yes | SHA-256 hash of the refresh token |
| `expiresAt` | Date | Yes | Token expiry |
| `revokedAt` | Date | No | Set when revoked |
| `createdAt` | Date | Auto | |

**Indexes:** Index on `tokenHash`. TTL index on `expiresAt`.  
**TTL:** Automatic deletion via `expiresAt` TTL index.  
**Org scoping:** Implicit via `userId`.

### 17.4 Collection: `devices`

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | |
| `deviceId` | String | Yes | Human-readable ID (DEV-TS-A3F2B1) |
| `name` | String | Yes | Display name |
| `type` | String (enum) | Yes | `temperature_sensor`, `smart_camera`, `industrial_gateway`, `medical_monitor`, `smart_lock` |
| `manufacturer` | String | Yes | |
| `model` | String | Yes | |
| `location` | String | No | Free-text location |
| `tags` | Array of `{key, value}` | No | |
| `status` | String (enum) | Yes | `registered`, `active`, `maintenance`, `quarantined`, `decommissioned` |
| `healthStatus` | String (enum) | Yes | `healthy`, `degraded`, `offline`, `unknown` |
| `apiKeyHash` | String | Yes | SHA-256 of the API key. Null if revoked. |
| `currentFirmwareVersion` | String | No | |
| `riskScore` | Number | Yes | 0–100, default 0 |
| `riskSeverity` | String (enum) | Yes | `low`, `medium`, `high`, `critical`, `severe` |
| `riskFactors` | Array of factor objects | Yes | See Section 6.7 |
| `riskCalculatedAt` | Date | No | |
| `lastSeenAt` | Date | No | Last telemetry timestamp |
| `expectedReportingInterval` | Number | Yes | Seconds, default 30 |
| `timeline` | Array (capped 50) | Yes | `[{ timestamp, action, actor, details }]` |
| `malformedMessageCount` | Number | Yes | Default 0 |
| `organizationId` | ObjectId | Yes | |
| `createdAt` | Date | Auto | |
| `updatedAt` | Date | Auto | |

**Indexes:** Unique compound `{organizationId, deviceId}`. Compound `{organizationId, status}`. Compound `{organizationId, riskScore}`. Compound `{organizationId, type}`.  
**TTL:** None.  
**Org scoping:** `organizationId` field.

### 17.5 Collection: `telemetry`

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | |
| `deviceId` | ObjectId | Yes | References `devices` |
| `organizationId` | ObjectId | Yes | |
| `timestamp` | Date | Yes | Device-reported timestamp (normalized to UTC) |
| `metrics` | Object | Yes | `{ cpu_usage, memory_usage, temperature, network_in, network_out, battery_level, disk_usage, signal_strength, error_count, ... }` |
| `metadata` | Object | No | `{ ip, firmware_version, uptime }` |
| `receivedAt` | Date | Yes | Server receipt time |

**Indexes:** Compound `{deviceId, timestamp}` (desc). TTL on `receivedAt` (30 days default). Compound `{organizationId, timestamp}`.  
**TTL:** 30 days on `receivedAt`. Configurable per org (via application logic, not per-document TTL).  
**Org scoping:** `organizationId` field.

### 17.6 Collection: `anomalyRules`

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | |
| `ruleId` | String | Yes | Unique (e.g., RULE-001) |
| `name` | String | Yes | |
| `description` | String | Yes | |
| `category` | String (enum) | Yes | `threshold`, `rate`, `behavioral`, `communication`, `auth`, `firmware`, `heartbeat`, `value` |
| `enabled` | Boolean | Yes | |
| `deviceTypes` | Array or "*" | Yes | |
| `organizationId` | ObjectId or null | Yes | null = system global |
| `metric` | String | No | Field path in metrics (e.g., "cpu_usage") |
| `operator` | String (enum) | Yes | `gt`, `lt`, `gte`, `lte`, `eq`, `neq`, `absent`, `rate_exceeds`, `outside_schedule`, `not_in_list` |
| `value` | Mixed | Yes | Threshold value(s) |
| `window` | Object | No | `{ type, size, minOccurrences }` |
| `cooldownSeconds` | Number | Yes | |
| `severity` | String (enum) | Yes | |
| `confidence` | String (enum) | Yes | |
| `explanationTemplate` | String | Yes | |
| `isSystem` | Boolean | Yes | System rules cannot be deleted |
| `deleted` | Boolean | Yes | Soft-delete flag |
| `lastTriggeredAt` | Date | No | |
| `createdBy` | ObjectId or "system" | Yes | |
| `createdAt` | Date | Auto | |
| `updatedAt` | Date | Auto | |

**Indexes:** Unique on `ruleId`. Compound `{organizationId, enabled, category}`.  
**TTL:** None.  
**Org scoping:** `organizationId` field (null for system rules — visible to all orgs).

### 17.7 Collection: `securityEvents`

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | |
| `eventId` | String | Yes | e.g., EVT-001 |
| `deviceId` | ObjectId | Yes | |
| `organizationId` | ObjectId | Yes | |
| `ruleId` | String | Yes | References anomalyRules.ruleId |
| `rawTelemetryId` | ObjectId | Yes | References telemetry._id |
| `category` | String | Yes | From rule |
| `severity` | String (enum) | Yes | |
| `confidence` | String (enum) | Yes | |
| `status` | String (enum) | Yes | `open`, `acknowledged`, `resolved`, `false_positive` |
| `explanation` | String | Yes | Populated from template |
| `occurrenceCount` | Number | Yes | Default 1 |
| `firstOccurrence` | Date | Yes | |
| `lastOccurrence` | Date | Yes | |
| `resolvedAt` | Date | No | |
| `resolvedBy` | ObjectId | No | |
| `incidentId` | String | No | References incidents.incidentId |
| `createdAt` | Date | Auto | |
| `updatedAt` | Date | Auto | |

**Indexes:** Compound `{organizationId, status, severity}`. Compound `{deviceId, createdAt}`. Compound `{organizationId, category, createdAt}`. Index on `incidentId`.  
**TTL:** None (events are retained for investigation).  
**Org scoping:** `organizationId` field.

### 17.8 Collection: `incidents`

| Field | Type | Required | Description |
|---|---|---|---|
| `_id` | ObjectId | Auto | |
| `incidentId` | String | Yes | INC-YYYYMMDD-XXXX |
| `title` | String | Yes | Auto-generated from primary event |
| `description` | String | Yes | |
| `severity` | String (enum) | Yes | |
| `status` | String (enum) | Yes | 7 states (see Section 8) |
| `category` | String | Yes | |
| `organizationId` | ObjectId | Yes | |
| `deviceId` | ObjectId | Yes | |
| `assignedTo` | ObjectId | No | |
| `relatedEventIds` | Array of String | Yes | Event IDs |
| `correlationDetails` | Object or null | No | See Section 7.3 |
| `evidence` | Array | Yes | See Section 8.5 |
| `timeline` | Array | Yes | `[{ timestamp, action, actor, details }]` |
| `notes` | Array | Yes | `[{ timestamp, author, content }]` |
| `responseActions` | Array | Yes | See Section 8.6 |
| `resolution` | Object or null | No | See Section 8.7 |
| `riskScoreAtCreation` | Number | Yes | |
| `impactAssessment` | String | No | |
| `slaTriageDeadline` | Date | Yes | |
| `slaResolveDeadline` | Date | Yes | |
| `slaBreached` | Boolean | Yes | |
| `detectedAt` | Date | Yes | |
| `triagedAt` | Date | No | |
| `resolvedAt` | Date | No | |
| `closedAt` | Date | No | |
| `createdAt` | Date | Auto | |
| `updatedAt` | Date | Auto | |

**Indexes:** Compound `{organizationId, status, severity}`. Index `{deviceId, status}`. Index `{assignedTo, status}`. Unique on `incidentId`.  
**TTL:** None.  
**Org scoping:** `organizationId` field.

### 17.9 Collection: `firmwareVersions`

Fields per Section 9.1. **Indexes:** Unique compound `{organizationId, deviceType, version}`. Compound `{organizationId, securityStatus}`. **Org scoping:** `organizationId`.

### 17.10 Collection: `firmwareDeployments`

Fields per Section 9 deployment lifecycle. **Indexes:** Compound `{deviceId, status}`. Compound `{organizationId, status, initiatedAt}`. **Org scoping:** `organizationId`.

### 17.11 Collection: `auditLogs`

Fields per FR-AUDIT-03. **Indexes:** Compound `{organizationId, timestamp}`. Compound `{organizationId, action, timestamp}`. Compound `{actor, timestamp}`. **TTL:** 90 days on `timestamp`. **Org scoping:** `organizationId`.

### 17.12 Collection: `notifications`

Fields per FR-NOTIF. **Indexes:** Compound `{userId, read, createdAt}`. **TTL:** 30 days on `createdAt`. **Org scoping:** `organizationId`.

**Total: 12 collections.** No additional collections.

---

## 18. Security Requirements

### 18.1 Password Hashing

bcrypt, cost factor 12. Password minimum 8 characters. Must contain: 1 uppercase, 1 lowercase, 1 digit, 1 special character.

### 18.2 JWT

HS256 signing. `JWT_SECRET` from environment variable (minimum 256 bits). Access token: 15 minutes. Payload: `{ userId, organizationId, role, iat, exp }`.

### 18.3 Authorization

RBAC middleware per route. `orgScope` middleware on all tenant-scoped routes.

### 18.4 Input Validation

Joi schemas on every API endpoint. Validate request body, params, and query. Reject invalid input with 400 and descriptive error code.

### 18.5 Rate Limiting

`express-rate-limit`. Global: 100 req/min/IP. Auth endpoints: 10 req/min/IP. Telemetry ingest: 600 req/min/device.

### 18.6 Helmet

`helmet()` middleware for security headers (CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy).

### 18.7 CORS

Whitelist frontend origin only. No wildcard `*`. Credentials: true (for cookies).

### 18.8 Secrets

All secrets in environment variables. `.env` file `.gitignore`'d. `.env.example` with placeholders.

### 18.9 Error Handling

Generic messages to clients. No stack traces in production. Structured format: `{ error: { code, message } }`.

### 18.10 Audit Logging

Append-only. No update/delete APIs. Every security-relevant mutation logged.

### 18.11 MQTT Security

Device API key auth. Topic authorization. Org namespace isolation. Payload validation. Duplicate/replay prevention. Connection abuse limits. (Full specification in Section 12.)

### 18.12 Organization Isolation

Every query scoped by `organizationId`. Middleware-enforced. MQTT topic namespacing. JWT carries `organizationId`.

### 18.13 API Key Security

256-bit cryptographically random. SHA-256 hashed storage. Shown once at registration. Regeneration invalidates old key.

---

## 19. Non-Functional Requirements

### 19.1 Performance

| Metric | Target |
|---|---|
| API response (p95) | < 500ms |
| Dashboard load | < 2 seconds |
| Telemetry ingestion | 100 msg/sec sustained |
| Rule evaluation | < 100ms per telemetry message |
| Risk recalculation | < 200ms per device |

### 19.2 Reliability

- MongoDB reconnection with exponential backoff
- In-memory telemetry buffer (max 1000 messages) during brief DB outages
- Graceful shutdown: drain connections, flush buffers
- Process crash recovery via restart

### 19.3 Scalability

- Target: 1,000 devices, 50 concurrent users
- Single-instance application. No horizontal scaling.
- Indexes designed for target scale.
- TTL prevents unbounded growth.

### 19.4 Maintainability

- Layered architecture: routes → controllers → services → models
- Consistent error handling patterns
- Environment-based configuration
- ESLint + Prettier
- README with setup instructions

### 19.5 Accessibility

- WCAG 2.1 Level AA
- Keyboard navigation
- ARIA labels on interactive elements
- Sufficient color contrast for severity badges

### 19.6 Responsiveness

- Tailwind responsive breakpoints
- Sidebar collapses on small screens
- Tables scroll horizontally on mobile
- Dashboard widgets reflow to single column

### 19.7 Observability

- Winston logger (JSON, severity levels)
- Morgan HTTP request logging
- Health check: `GET /api/v1/health` → `{ status: "ok", uptime, dbConnected, mqttBrokerActive }`

---

## 20. Testing and Acceptance Criteria

### 20.1 Authentication Module

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-AUTH-01 | Login with valid credentials | Integration | Returns 200 with accessToken and sets refreshToken cookie |
| T-AUTH-02 | Login with invalid password | Integration | Returns 401 with "Invalid credentials" (no user enumeration) |
| T-AUTH-03 | Access protected route without token | Integration | Returns 401 |
| T-AUTH-04 | Access protected route with expired token | Integration | Returns 401 |
| T-AUTH-05 | Refresh token rotation | Integration | Issues new token pair, invalidates old refresh token |
| T-AUTH-06 | Logout revokes refresh tokens | Integration | All refresh tokens for user are revoked |
| T-AUTH-07 | Rate limiting on login | Integration | Returns 429 after 10 failed attempts per minute |

### 20.2 RBAC Module

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-RBAC-01 | Viewer cannot create device | Integration | Returns 403 |
| T-RBAC-02 | Operator cannot create detection rule | Integration | Returns 403 |
| T-RBAC-03 | Security analyst can create rule | Integration | Returns 201 |
| T-RBAC-04 | Org admin can invite user | Integration | Returns 201 |
| T-RBAC-05 | Cross-org access blocked | Integration | User A cannot access Org B's devices (returns empty list or 403) |

### 20.3 Detection Engine

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-DET-01 | RULE-001 fires on 5 consecutive CPU > 90% | Unit | Security event created with correct explanation |
| T-DET-02 | RULE-001 does NOT fire on 4 consecutive readings | Unit | No event created |
| T-DET-03 | Cooldown prevents re-fire within window | Unit | Second identical detection within cooldown increments occurrenceCount instead of creating new event |
| T-DET-04 | RULE-006 fires on 5 failed auth in 10 min | Unit | Critical event created |
| T-DET-05 | RULE-010 fires on impossible value | Unit | Critical event with correct explanation |
| T-DET-06 | Normal telemetry triggers no rules | Unit | Zero events generated |
| T-DET-07 | Explanation contains correct actual/threshold values | Unit | String interpolation verified |
| T-DET-08 | Disabled rules are skipped | Unit | Disabled rule does not evaluate |
| T-DET-09 | Org-scoped rule only applies to its org | Unit | Rule with orgId=X does not fire for orgId=Y devices |

### 20.4 Risk Engine

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-RISK-01 | Deterministic: same input = same score | Unit | Two calculations with identical state produce identical score |
| T-RISK-02 | Score = 0 for healthy device with no events | Unit | All factors return 0 |
| T-RISK-03 | Score = 100 for maximally compromised device | Unit | All factors at maximum |
| T-RISK-04 | Factor isolation: changing one factor only changes that contribution | Unit | Modifying F3 (firmware vuln) does not affect F1 (critical events) |
| T-RISK-05 | Factor breakdown contains contributing event IDs | Unit | `contributingIds` arrays are populated correctly |

### 20.5 Correlation Engine

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-CORR-01 | 3 events same device in 30 min → incident created | Unit | Incident created with CORR-TEMPORAL strategy |
| T-CORR-02 | 2 events same device in 30 min → no incident | Unit | Events remain standalone |
| T-CORR-03 | Same rule 5 times in 60 min → incident created | Unit | Incident created with CORR-REPEATED strategy |
| T-CORR-04 | New event on device with open incident → attached | Unit | Event added to existing incident |
| T-CORR-05 | Higher severity event escalates incident | Unit | Incident severity updates |
| T-CORR-06 | correlationDetails records strategy and reason | Unit | matchReason is human-readable and accurate |

### 20.6 Incident Lifecycle

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-INC-01 | Valid state transition succeeds | Integration | detected → triaged returns 200 |
| T-INC-02 | Invalid state transition rejected | Integration | detected → resolved returns 400 |
| T-INC-03 | Only security_analyst+ can close | Integration | Operator trying to close returns 403 |
| T-INC-04 | Resolution requires required fields | Integration | Missing rootCause returns 400 |
| T-INC-05 | SLA breach flag calculated correctly | Unit | slaBreached = true when triagedAt > deadline |

### 20.7 Firmware Module

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-FW-01 | Deployment blocked for vulnerable firmware | Integration | Returns 400 |
| T-FW-02 | CVE association updates security status | Integration | Adding critical CVE changes status |
| T-FW-03 | Risk recalculates when firmware status changes | Integration | Device risk score updates |

### 20.8 MQTT Module

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-MQTT-01 | Valid API key authenticates | Integration | MQTT connection accepted |
| T-MQTT-02 | Invalid API key rejected | Integration | MQTT connection refused |
| T-MQTT-03 | Wrong topic rejected | Integration | Publish to other device's topic fails |
| T-MQTT-04 | Malformed JSON dropped | Integration | No telemetry stored, error logged |
| T-MQTT-05 | Duplicate message deduplicated | Integration | Second identical message not stored |

### 20.9 Traceability Tests

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-TRACE-01 | Event references valid telemetry | Integration | `rawTelemetryId` resolves to existing telemetry document |
| T-TRACE-02 | Event references valid rule | Integration | `ruleId` resolves to existing rule |
| T-TRACE-03 | Incident references valid events | Integration | Every `relatedEventId` resolves to existing event |
| T-TRACE-04 | Full backward trace | E2E | Given incident → resolve all events → resolve all telemetry → all references valid |

### 20.10 Simulator Tests

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-SIM-01 | Normal telemetry conforms to profile schema | Unit | All metrics within profile ranges |
| T-SIM-02 | Anomaly mode triggers expected rules | E2E | `--anomaly threshold` → RULE-001 fires |
| T-SIM-03 | Scenario 2 produces incident | E2E | Single device compromise creates incident with 3+ correlated events |

### 20.11 Frontend Tests

| Test ID | Description | Type | Acceptance Criteria |
|---|---|---|---|
| T-FE-01 | Login page submits and redirects | Component | Successful login navigates to dashboard |
| T-FE-02 | Protected route redirects unauthenticated | Component | Attempting dashboard without auth redirects to login |
| T-FE-03 | Device inventory renders and filters | Component | Table renders devices, filter by type works |
| T-FE-04 | Risk factor breakdown renders | Component | Factor table displays all 7 factors with values |

---

## 21. Demo Scenarios

### Scenario 1: Brute Force Attack on Smart Camera

**Narrative:** A smart camera in the lobby is under a brute-force authentication attack. The attacker is trying random API keys to gain control of the camera.

**Steps:**
1. Simulator sends 10 failed MQTT auth attempts for DEV-SC-001 within 3 minutes
2. RULE-006 triggers → critical security event EVT-001 created
3. Risk score recalculates: F1 (critical event) = 25, F6 (auth anomalies) = 3 → score jumps to 28+ ("Caution")
4. Event appears in dashboard widget W10 (Recent Events) and W4 (Critical Unacknowledged)
5. Notification pushed to all org users via Socket.IO
6. Operator clicks event → navigates to event detail → sees explanation: "10 failed authentication attempts for device DEV-SC-001 within 3 minutes"
7. Operator acknowledges event → navigates to device detail → sees risk factor breakdown
8. If auto-quarantine enabled and risk exceeds threshold → device quarantined automatically
9. Operator opens incident → adds note → records response action: revoke API key → marks resolved
10. Entire chain traceable: telemetry → RULE-006 → EVT-001 → INC-20260903-0001 → response → audit log

**Demonstrates:** D1 (explainability), D2 (risk transparency), D3 (traceability), D7 (timeline)

---

### Scenario 2: Firmware Vulnerability Exploitation

**Narrative:** An industrial gateway is running firmware v1.0.3 which has a known critical CVE. The device starts showing escalating anomalies — CPU spike, memory exhaustion, network exfiltration — indicating active exploitation.

**Steps:**
1. Security analyst marks firmware v1.0.3 as `vulnerable` with CVE-2025-1234 (CVSS 9.1)
2. Risk recalculates for all devices running v1.0.3: F3 (firmware vuln) = 20, F4 (age) = 10 → base score 30+
3. Dashboard widget W8 (Firmware Exposure) shows "3 devices on vulnerable firmware"
4. Simulator gradually increases CPU on DEV-GW-001: 45% → 60% → 78% → 91% → 95% (sustained)
5. RULE-001 triggers at 5th consecutive reading > 90% → medium event EVT-010
6. Simulator spikes network_out to 50× baseline → RULE-004 triggers → high event EVT-011
7. Simulator pushes memory to 97% sustained → RULE-002 triggers → medium event EVT-012
8. Correlation engine: 3 events from same device within 10 minutes → CORR-TEMPORAL → Incident INC-20260903-0002 created with severity `high`
9. Risk score: F1=0, F2=15 (2 high events), F3=20 (vuln firmware), F4=10 (old), F5=0, F6=0, F7=8 (6 anomalies/7d) → score 53 ("At Risk")
10. Operator investigates incident → sees correlation explanation → sees all 3 events with explanations → sees firmware CVE → deploys firmware v2.1.0 → resolves incident

**Demonstrates:** D1 (explainability), D2 (risk), D3 (traceability), D4 (correlation), D5 (firmware), D6 (simulator), D7 (timeline)

---

### Scenario 3: False Positive Validation

**Narrative:** A temperature sensor near a server room legitimately reads higher temperatures. The detection system fires but the operator validates it as expected behavior.

**Steps:**
1. Simulator sets DEV-TS-002 temperature to 82°C (below 85°C RULE-003 threshold) sustained
2. No rules fire — validates that borderline values do NOT trigger false positives
3. Simulator pushes DEV-TS-002 temperature to 87°C → RULE-003 triggers → high event EVT-020
4. Operator reviews event → sees explanation: "Temperature was 87°C which is outside safe range -40°C to 85°C"
5. Operator marks event as `false_positive` with note: "Server room, expected operating temperature"
6. Risk score recalculates downward (F2 high event removed)
7. False-positive tracking updates for RULE-003 (future: false positive rate reporting)

**Demonstrates:** D1 (explainability), accurate thresholds, false positive handling workflow

---

## 22. MVP Boundary

### Tier 1: Must-Have (MVP)

Authentication (JWT + refresh), RBAC (5 roles), multi-tenancy (data-level), user management, device CRUD + lifecycle, telemetry ingestion (MQTT + REST), anomaly detection (12 rules), security events, risk scoring (7 factors), event correlation (3 strategies), incident lifecycle (7 states), firmware registry + CVEs + deployments, audit logging, notifications (Socket.IO), dashboard (10 widgets), all 12 pages, simulator v1 + v2, end-to-end traceability, explainability.

### Tier 2: Strong Differentiators

Attack-pattern correlation, rule dry-run testing, auto-quarantine, firmware eligibility blocking, CSV export, simulator v3, fleet posture score, SLA breach alerts, dark mode.

### Tier 3: Optional Enhancements

Email notifications, PDF incident reports, MQTT firmware commands, device comparison, rule import/export, dashboard widget customization.

### Tier 4: Explicitly Excluded

AI/ML detection, AI/ML explainability, packet inspection, multi-cloud, custom RBAC builder, GraphQL, microservices, blockchain audit, chat features, enterprise org management, billing/subscriptions.

---

## 23. Traceability Matrix

| Req ID | Requirement | Backend Module | API Endpoints | DB Collection | Frontend Page | Tests |
|---|---|---|---|---|---|---|
| FR-AUTH-01–10 | Authentication | `middleware/auth`, `services/auth` | `POST auth/login`, `POST auth/refresh`, `POST auth/logout`, `POST auth/register` | `users`, `refreshTokens` | Login | T-AUTH-01–07 |
| FR-RBAC-01–04 | Authorization | `middleware/rbac`, `middleware/orgScope` | All protected endpoints | `users` | All pages (guards) | T-RBAC-01–05 |
| FR-MT-01–05 | Multi-tenancy | `middleware/orgScope` | All tenant-scoped endpoints | All collections (`organizationId`) | N/A (infrastructure) | T-RBAC-05 |
| FR-DEV-01–08 | Device management | `services/device` | `POST/GET/PATCH devices`, `POST devices/:id/regenerate-key`, `GET devices/stats` | `devices` | Device Inventory, Device Detail | T-FE-03 |
| FR-DLC-01–07 | Device lifecycle | `services/device` | `PATCH devices/:id` (status) | `devices`, `auditLogs` | Device Detail, Device Inventory | T-INC-01–02 (state validation pattern) |
| FR-HEALTH-01–07 | Device health | `services/health` | `GET devices/:id` (healthStatus field) | `devices`, `telemetry` | Device Detail, Dashboard (W5) | T-MQTT-01 (health update on telemetry) |
| FR-TEL-01–06 | Telemetry | `services/telemetry`, `mqtt/handler` | `POST telemetry/ingest` | `telemetry` | Device Detail (charts) | T-MQTT-01–05 |
| FR-EVT-01–06 | Security events | `services/detection`, `services/event` | `GET/PATCH security-events`, `GET security-events/stats` | `securityEvents` | Security Events, Device Detail | T-DET-01–09 |
| FR-RULE-01–05 | Detection rules | `services/detection` | `GET/POST/PATCH/DELETE anomaly-rules` | `anomalyRules` | Anomaly Rules | T-DET-08–09 |
| FR-RISK-01–04 | Risk scoring | `services/risk` | `GET devices/:id/risk` | `devices` (riskScore, riskFactors) | Device Detail | T-RISK-01–05 |
| FR-CORR-01–03 | Correlation | `services/correlation` | N/A (internal, triggered by event creation) | `incidents`, `securityEvents` | Incident Detail (correlation explanation) | T-CORR-01–06 |
| FR-INC-01–04 | Incidents | `services/incident` | `GET/PATCH incidents`, `POST incidents/:id/notes`, `POST incidents/:id/actions`, `POST incidents/:id/resolve`, `GET incidents/stats` | `incidents` | Incident List, Incident Detail | T-INC-01–05 |
| FR-FW-01–05 | Firmware | `services/firmware` | `POST/GET/PATCH firmware/versions`, `POST/GET/PATCH firmware/deployments` | `firmwareVersions`, `firmwareDeployments` | Firmware Management | T-FW-01–03 |
| FR-AUDIT-01–04 | Audit logging | `services/audit` | `GET audit-logs` | `auditLogs` | Audit Log | Implicit in all mutation tests |
| FR-NOTIF-01–04 | Notifications | `services/notification`, `socket/emitter` | `GET/PATCH notifications` | `notifications` | Notification bell (all pages) | T-FE-02 |
| FR-RT-01–03 | Real-time | `socket/server` | N/A (Socket.IO events) | N/A | Dashboard (W10), Notification bell | T-SIM-02–03 |
| FR-SIM-01–04 | Simulator | `simulator/` (separate app) | N/A (uses MQTT + REST) | N/A (creates telemetry via MQTT) | N/A | T-SIM-01–03 |
| — | Traceability | All modules | All relevant endpoints | `telemetry` → `securityEvents` → `incidents` → `auditLogs` | Incident Detail (evidence links) | T-TRACE-01–04 |
| — | Dashboard | `services/dashboard` | `GET dashboard/summary`, `GET dashboard/trends` | Aggregates from multiple collections | Security Dashboard | Implicit in E2E |

---

## 24. Final Product Definition

### 24.1 Final Feature Inventory

| # | Feature | Tier |
|---|---|---|
| 1 | JWT authentication with refresh token rotation | MVP |
| 2 | RBAC with 5 roles and permission matrix | MVP |
| 3 | Data-level multi-tenancy with org scoping | MVP |
| 4 | User management (invite, role change, deactivate) | MVP |
| 5 | Device registration with API key generation | MVP |
| 6 | Device lifecycle (5 states with valid transitions) | MVP |
| 7 | Device health monitoring | MVP |
| 8 | MQTT telemetry ingestion with Aedes | MVP |
| 9 | REST telemetry fallback | MVP |
| 10 | Anomaly detection engine (12 seed rules, 8 categories) | MVP |
| 11 | Security event management | MVP |
| 12 | Deterministic risk scoring (7 factors, 0–100) | MVP |
| 13 | Event correlation (3 strategies) | MVP |
| 14 | Incident lifecycle (7 states) | MVP |
| 15 | Incident investigation (notes, evidence, actions, resolution) | MVP |
| 16 | Firmware version registry with CVE association | MVP |
| 17 | Firmware deployment tracking | MVP |
| 18 | Audit logging (append-only) | MVP |
| 19 | In-app notifications (Socket.IO) | MVP |
| 20 | Security dashboard (10 widgets) | MVP |
| 21 | IoT simulator v1 (normal) + v2 (anomalous) | MVP |
| 22 | End-to-end traceability | MVP |
| 23 | Explainable detections and risk scores | MVP |

### 24.2 Final Page Inventory

| # | Page | Implementation Phase | Description & Delivery Scope |
|---|---|---|---|
| 1 | Login | Phase 3 | Authentication UI, credentials form, token acquisition, route guards |
| 2 | Security Dashboard | Phase 11 | Central command center (10 widgets, fleet posture, live alerts, Socket.IO) |
| 3 | Device Inventory | Phase 4 | Device table, multi-filter, search, status badges, registration modal |
| 4 | Device Detail | Phase 4, 6, 8 | Metadata/lifecycle (Ph 4), telemetry charts (Ph 6), risk & event breakdown (Ph 8) |
| 5 | Security Events | Phase 8 | Event queue, triage actions (ack/resolve/false positive), explanation viewer |
| 6 | Incident List | Phase 9 | Correlated incident table, severity badges, SLA status, assignment filters |
| 7 | Incident Detail | Phase 9 | Investigation workspace, evidence chain, timeline, response actions, resolution |
| 8 | Firmware Management | Phase 10 | Firmware registry, CVE manager, eligibility checks, deployment tracker |
| 9 | Anomaly Rules | Phase 7 | Rule browser, threshold configuration, custom rule editor, dry-run tester |
| 10 | Audit Log | Phase 11 | Tamper-evident activity log, actor/action filters, forensic details modal |
| 11 | User Management | Phase 4 | Team member list, invitation modal, role assignment, deactivation |
| 12 | Settings | Phase 4 | Organization settings (SLA, auto-quarantine) & user profile / password change |

### 24.3 Final Database Entity Inventory

| # | Collection | Documents (est. at 1000 devices) | Organization Scoped | TTL / Retention |
|---|---|---|---|---|
| 1 | `organizations` | 1–5 | Self (Root Tenant Entity) | None |
| 2 | `users` | 10–50 | `organizationId` | None |
| 3 | `refreshTokens` | 10–50 (active) | Implicit via `userId` | 7 Days (TTL index) |
| 4 | `devices` | 1,000 | `organizationId` | None |
| 5 | `telemetry` | ~2.8M/month (1000 × 2/min × 30d) | `organizationId` | 30 Days (TTL index) |
| 6 | `anomalyRules` | 12–30 | `organizationId` (or null for system) | None |
| 7 | `securityEvents` | 100–10,000 | `organizationId` | None (Forensic persistence) |
| 8 | `incidents` | 10–500 | `organizationId` | None (Forensic persistence) |
| 9 | `firmwareVersions` | 20–100 | `organizationId` | None |
| 10 | `firmwareDeployments` | 100–1,000 | `organizationId` | None |
| 11 | `auditLogs` | 1,000–50,000 | `organizationId` | 90 Days (TTL index) |
| 12 | `notifications` | 100–5,000 | `organizationId` | 30 Days (TTL index) |

### 24.4 Final API Domain Inventory

| # | Domain | Endpoint Count | Primary Role Scope |
|---|---|---|---|
| 1 | `auth` | 4 | Public / Authenticated |
| 2 | `users` | 7 | `viewer+` (read), `org_admin` (mutate), `all` (me) |
| 3 | `organizations` | 3 | `viewer+` (read), `org_admin` (settings), `super_admin` (create) |
| 4 | `devices` | 9 | `viewer+` (read), `operator+` (lifecycle), `security_analyst+` (keys/register) |
| 5 | `telemetry` | 1 | Device API Key (`X-Device-API-Key`) |
| 6 | `security-events` | 4 | `viewer+` (read), `operator+` (triage/status) |
| 7 | `incidents` | 8 | `viewer+` (read), `operator+` (investigate/notes/actions), `security_analyst+` (close) |
| 8 | `firmware` | 8 | `viewer+` (read), `security_analyst+` (versions/deploy), Device API Key (progress) |
| 9 | `anomaly-rules` | 5 | `viewer+` (read), `security_analyst+` (manage) |
| 10 | `audit-logs` | 1 | `security_analyst+` (read-only) |
| 11 | `notifications` | 4 | `viewer+` (own notifications) |
| 12 | `dashboard` | 2 | `viewer+` (aggregated fleet metrics) |
| | **Total** | **56** | Fully consumed by UI & Devices |

### 24.5 Final Technology Inventory

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | Core runtime for backend, broker, and simulator |
| API Framework | Express.js | 4.x | REST API routing and middleware pipeline |
| Database | MongoDB | 7.x | Primary document store |
| ODM | Mongoose | 8.x | Object Data Modeling, schema validation, index management |
| Frontend | React | 18.x | Single Page Application framework |
| Build Tool | Vite | 5.x | High-performance frontend bundler |
| Styling | Tailwind CSS | 3.x | Modern utility-first CSS framework |
| MQTT Broker | Aedes | Latest | Embedded MQTT broker for device telemetry ingestion |
| Real-time | Socket.IO | 4.x | Server-to-client event streaming for SOC dashboard |
| Auth & Crypto | jsonwebtoken + bcryptjs | Latest | HS256 JWT generation, bcrypt password hashing (cost 12) |
| Validation | Joi | Latest | Request payload, parameter, and query schema validation |
| Logging | Winston + Morgan | Latest | Structured JSON application logging & HTTP access logging |
| Security | Helmet + express-rate-limit + cors | Latest | Security headers, rate limiting, and CORS whitelist |
| State Management | React Context + useReducer + TanStack Query | Latest | Client auth/global state + server state caching |
| Testing | Jest + Supertest + React Testing Library | Latest | Automated unit, integration, and component testing |

### 24.6 Authoritative 14-Phase Implementation Sequence

| Phase | Name | Dependencies | Deliverables | Test Milestone |
|---|---|---|---|---|
| **Phase 1** | Project & Monorepo Foundation | None | Monorepo layout (`/server`, `/client`, `/simulator`), ESLint/Prettier, Docker Compose | Clean build across all packages |
| **Phase 2** | Database Foundation | Phase 1 | 12 Mongoose schemas, compound indexes, TTL indexes, DB connection manager | Automated schema & index validation test |
| **Phase 3** | Authentication & RBAC | Phase 2 | JWT HS256 auth, refresh token rotation, RBAC middleware, Page 1 (Login UI) | Auth flow & role boundary tests (T-AUTH, T-RBAC) |
| **Phase 4** | Organization & Device Management | Phase 3 | Org scoping, Device CRUD, API keys, Page 3 (Inventory), Page 11 (Users), Page 12 (Settings) | Device lifecycle & API key auth tests |
| **Phase 5** | Minimal IoT Telemetry Simulator (v1) | Phase 4 | Deterministic normal telemetry generator for 5 device profiles | Simulator produces valid telemetry JSON |
| **Phase 6** | MQTT + Telemetry Ingestion | Phase 4, 5 | Embedded Aedes broker, MQTT auth hook, REST ingest fallback, Page 4 (Telemetry Charts) | MQTT message ingestion & deduplication tests (T-MQTT) |
| **Phase 7** | Detection / Anomaly Engine | Phase 6 | 12 deterministic rules, cooldown cache, Page 9 (Anomaly Rules UI) | Rule triggering & false positive tests (T-DET-01–09) |
| **Phase 8** | Security Events & Risk Engine | Phase 7 | Security event lifecycle, 7-factor deterministic risk engine, Page 5 (Events), Page 4 (Risk breakdown) | Risk score determinism & factor breakdown tests (T-RISK) |
| **Phase 9** | Event Correlation & Incident Management | Phase 8 | 3 correlation strategies, 7 incident states, Page 6 (Incident List), Page 7 (Incident Detail Workspace) | Correlation & incident state transition tests (T-CORR, T-INC) |
| **Phase 10** | Firmware Security & Deployment | Phase 4, 8 | Firmware registry, CVE evaluator, deployment manager, rollback, Page 8 (Firmware UI) | Firmware eligibility & risk impact tests (T-FW) |
| **Phase 11** | Frontend Dashboard & Real-Time Integration | Phase 8, 9, 10 | Page 2 (Security Dashboard - 10 widgets), Page 10 (Audit Log UI), Socket.IO server & client hooks | Real-time push & dashboard data integration tests |
| **Phase 12** | Full IoT Simulator & Security Scenarios (v2/v3) | Phase 5, 7, 9 | Multi-scenario simulator CLI, 6 anomaly modes, 6 attack scenarios | End-to-end attack scenario execution |
| **Phase 13** | Testing & Security Hardening | Phase 1–12 | Full automated test suite (Unit, Integration, E2E), OWASP audit, rate limit verification | 100% passing test suite across all domains |
| **Phase 14** | Documentation, Deployment & Final Demo | Phase 13 | README, Docker Compose setup, API docs, 3 polished demo scenario scripts | One-command startup & live demo execution |

### 24.7 Final Success Criteria

The platform is considered complete and production-ready when:

1. ✅ A user can log in, see the dashboard, and understand fleet security posture at a glance
2. ✅ Devices can be registered, managed through lifecycle states, and monitored via MQTT telemetry
3. ✅ The detection engine correctly fires for each of the 12 seed rules when presented with anomalous data
4. ✅ The detection engine does NOT fire for normal data (false positive validation)
5. ✅ Every security event has a human-readable explanation referencing the triggering rule, actual value, and threshold
6. ✅ Every device has a risk score with a factor-by-factor breakdown containing traceable evidence
7. ✅ Related events are automatically correlated into incidents with an explanation of why they were grouped
8. ✅ An operator can investigate an incident: review timeline, add notes, record response actions, submit resolution
9. ✅ Any incident can be traced backward: incident → events → detection rules → raw telemetry → audit log
10. ✅ Firmware versions with CVEs affect device risk scores and block unauthorized deployments
11. ✅ The simulator produces both normal and anomalous telemetry that the platform correctly processes in real-time
12. ✅ The audit log records every security-relevant action in an append-only collection
13. ✅ Multi-tenancy is enforced at data and communication layers; no cross-tenant leakage is possible
14. ✅ The system feels like a high-grade security operations tool, clearly differentiated from a generic IoT dashboard

---

> [!NOTE]
> This PRD is the single authoritative source of truth for SecureWatch IoT. No code has been written. No packages installed. No project structure created. Awaiting approval to proceed to Phase 1 implementation.

