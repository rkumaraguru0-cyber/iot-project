# SecureWatch IoT — 13-Step Post-Deployment Smoke Test Checklist

> **Purpose:** Step-by-step verification checklist to validate a fresh local, staging, or production deployment.  
> **Pre-requisite:** Backend API running at `http://localhost:5000` (or target URL), MongoDB connected, MQTT broker listening on port 1883.

---

## Quick Reference Summary

| Step # | Subsystem / Capability | Verification Method | Expected Result |
| :---: | :--- | :--- | :--- |
| **1** | Health & Readiness | `GET /api/v1/health` | HTTP 200 `status: "healthy"` |
| **2** | Platform Bootstrap & Auth | `POST /api/v1/auth/register` & `login` | JWT access token + httpOnly cookie |
| **3** | RBAC & Tenant Isolation | `GET /api/v1/users` with viewer token | Cross-tenant rejection & role check |
| **4** | Device Registration & Key | `POST /api/v1/devices` | Plaintext API key issued, hash stored |
| **5** | REST Telemetry Ingest | `POST /api/v1/telemetry/ingest` | HTTP 201 telemetry persisted |
| **6** | MQTT Ingest & Auth | MQTT publish to `<org>/devices/<id>/telemetry` | Aedes broker auth & ingest |
| **7** | Time Window Validation | Telemetry with timestamp > $\pm 5$ min | HTTP 400 rejection for stale telemetry |
| **8** | Anomaly Rule Dry-Run | `POST /api/v1/rules/test` | Dry-run breach evaluated without save |
| **9** | Security Event Aggregation | Consecutive anomalies within 1 hour | `EVT-...` generated & count incremented |
| **10** | 3-Factor Risk Recalculation | `GET /api/v1/devices/:id/risk` | 0–100 score + 3 explainable factors |
| **11** | Incident Correlation & SLAs | 3 events in 30 min (`CORR-TEMPORAL`) | `INC-...` created with SLA deadlines |
| **12** | Firmware OTA & Rollback | `POST /deployments` $\to$ status $\to$ rollback | `rolled_back` status transition |
| **13** | Rate Limiting & WebSocket | Rapid request burst & Socket.IO room join | HTTP 429 & real-time event received |

---

## Detailed Step-by-Step Test Procedures

### Step 1: Health & Readiness Probe
Verify database connection and MQTT broker initialization:
```bash
curl -s http://localhost:5000/api/v1/health | jq .
```
**Expected Response:**
```json
{
  "status": "healthy",
  "services": {
    "database": "connected",
    "mqttBroker": "running"
  }
}
```

---

### Step 2: Super Admin Bootstrap & Login
Bootstrap initial tenant organization and administrative user:
```bash
curl -s -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "orgName": "Acme Corp",
    "orgSlug": "acme-corp",
    "displayName": "Super Admin",
    "email": "admin@acme.com",
    "password": "Password123!"
  }' | jq .
```
Log in to receive JWT token:
```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"Password123!"}' | jq -r '.token')
echo "JWT Token: $TOKEN"
```

---

### Step 3: RBAC & Tenant Isolation
Verify current user identity and organization scope:
```bash
curl -s http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq .
```
**Expected Response:**
- `email`: `admin@acme.com`
- `role`: `super_admin`
- `organization.slug`: `acme-corp`

---

### Step 4: Device Registration & API Key Issuance
Register an industrial gateway device:
```bash
DEVICE_RESP=$(curl -s -X POST http://localhost:5000/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "DEV-SMOKE-001",
    "name": "Smoke Test Gateway",
    "type": "industrial_gateway",
    "location": "Testing Lab"
  }')

DEVICE_ID=$(echo $DEVICE_RESP | jq -r '.device._id')
API_KEY=$(echo $DEVICE_RESP | jq -r '.apiKey')
echo "Device ID: $DEVICE_ID, API Key: $API_KEY"
```

---

### Step 5: REST Telemetry Ingest
Submit valid baseline telemetry using the device's plaintext API key:
```bash
curl -s -X POST http://localhost:5000/api/v1/telemetry/ingest \
  -H "X-Device-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"deviceId\": \"DEV-SMOKE-001\",
    \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
    \"metrics\": {
      \"cpu_usage\": 45.2,
      \"memory_usage\": 52.0,
      \"temperature\": 32.5,
      \"battery_level\": 98.0,
      \"network_in\": 120,
      \"network_out\": 85,
      \"error_count\": 0
    },
    \"metadata\": {
      \"uptime\": 3600,
      \"ip\": \"192.168.1.100\",
      \"firmware_version\": \"1.0.0\"
    }
  }" | jq .
```
**Expected Response:** HTTP 201 with `success: true`.

---

### Step 6: MQTT Ingest & Authentication
Test MQTT ingestion via CLI or Node.js MQTT client:
```bash
node -e "
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883', {
  clientId: 'smoke-test-client',
  username: 'DEV-SMOKE-001',
  password: '$API_KEY'
});
client.on('connect', () => {
  client.publish('acme-corp/devices/DEV-SMOKE-001/telemetry', JSON.stringify({
    deviceId: 'DEV-SMOKE-001',
    timestamp: new Date().toISOString(),
    metrics: { cpu_usage: 48.0, temperature: 33.0 },
    metadata: { uptime: 3620 }
  }), {}, () => {
    console.log('MQTT Telemetry Published Successfully');
    client.end();
  });
});
"
```

---

### Step 7: Telemetry Timestamp Window Rejection
Verify that telemetry outside the $\pm 5$ minute window is strictly rejected:
```bash
curl -s -X POST http://localhost:5000/api/v1/telemetry/ingest \
  -H "X-Device-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "DEV-SMOKE-001",
    "timestamp": "2020-01-01T00:00:00.000Z",
    "metrics": { "cpu_usage": 50.0 },
    "metadata": { "uptime": 100 }
  }' | jq .
```
**Expected Response:** HTTP 400 Bad Request with error indicating timestamp outside valid ingestion window.

---

### Step 8: Anomaly Rule Dry-Run Testing
Test rule logic against synthetic telemetry without database persistence:
```bash
curl -s -X POST http://localhost:5000/api/v1/rules/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule": {
      "name": "High CPU Test Rule",
      "metric": "cpu_usage",
      "operator": ">",
      "threshold": 90.0,
      "severity": "critical"
    },
    "sampleTelemetry": {
      "metrics": { "cpu_usage": 95.5 }
    }
  }' | jq .
```
**Expected Response:** HTTP 200 with `triggered: true` and `observedValue: 95.5`.

---

### Step 9: Security Event Generation & 1-Hour Aggregation
Send anomalous telemetry (CPU > 90%) to trigger a Security Event:
```bash
for i in {1..3}; do
  curl -s -X POST http://localhost:5000/api/v1/telemetry/ingest \
    -H "X-Device-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"deviceId\": \"DEV-SMOKE-001\",
      \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\",
      \"metrics\": { \"cpu_usage\": 96.0, \"network_out\": 50000 },
      \"metadata\": { \"uptime\": 4000 }
    }" > /dev/null
done

# Query security events
curl -s "http://localhost:5000/api/v1/security-events?deviceId=$DEVICE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```
**Expected Response:** Security Event document with `occurrenceCount: 3` and status `open`.

---

### Step 10: 3-Factor Risk Score Calculation
Verify that the device's composite risk score was calculated:
```bash
curl -s "http://localhost:5000/api/v1/devices/$DEVICE_ID/risk" \
  -H "Authorization: Bearer $TOKEN" | jq .
```
**Expected Response:**
- `riskScore`: Bounded 0–100 integer
- `riskSeverity`: `high`, `critical`, or `severe`
- `riskFactors`: Array containing exactly 3 factors (`Active Security Events`, `Device Communication Health`, `Anomaly Repetition & Malformed Traffic`).

---

### Step 11: Incident Correlation & SLA Deadlines
Verify that repeated critical security events automatically created an Incident:
```bash
curl -s "http://localhost:5000/api/v1/incidents?deviceId=$DEVICE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```
**Expected Response:**
- `incidentId`: `INC-YYYYMMDD-HEX4`
- `correlationDetails.strategyId`: `CORR-TEMPORAL` or `CORR-REPEATED`
- `slaTriageDeadline` and `slaResolveDeadline` properly populated.

---

### Step 12: Firmware Deployment & Explicit Rollback
1. Register a firmware version:
```bash
FW_RESP=$(curl -s -X POST http://localhost:5000/api/v1/firmware/versions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.1.0",
    "deviceType": "industrial_gateway",
    "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "fileSize": 1048576,
    "changelog": "Smoke test firmware update"
  }')
FW_ID=$(echo $FW_RESP | jq -r '.firmwareVersion._id')

# 2. Schedule deployment
DEP_RESP=$(curl -s -X POST http://localhost:5000/api/v1/firmware/deployments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"firmwareVersionId\": \"$FW_ID\",
    \"deviceIds\": [\"$DEVICE_ID\"]
  }")
DEP_ID=$(echo $DEP_RESP | jq -r '.deployments[0]._id')

# 3. Transition to failed
curl -s -X PATCH "http://localhost:5000/api/v1/firmware/deployments/$DEP_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"downloading"}' > /dev/null

curl -s -X PATCH "http://localhost:5000/api/v1/firmware/deployments/$DEP_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"failed"}' > /dev/null

# 4. Trigger explicit incident-response rollback
INC_ID=$(curl -s "http://localhost:5000/api/v1/incidents?deviceId=$DEVICE_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.incidents[0]._id')

curl -s -X POST "http://localhost:5000/api/v1/incidents/$INC_ID/actions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"rollback_firmware","details":"Rolling back failed smoke test deployment"}' | jq .
```
**Expected Response:** Deployment status transitioned to `rolled_back`.

---

### Step 13: Rate Limiting & WebSocket Verification
1. **Rate Limiting:** Send 15 rapid requests to `/api/v1/auth/login` to trigger HTTP 429 Too Many Requests.
2. **WebSocket Streaming:** Connect browser to `http://localhost:5173` and observe real-time incident badge incrementing upon new alert triggers.

---

## Smoke Test Troubleshooting Guide

| Issue / Symptom | Possible Cause | Resolution |
| :--- | :--- | :--- |
| **`GET /health` returns `database: disconnected`** | MongoDB daemon not running or invalid URI in `server/.env` | Start `mongod` service or check `MONGODB_URI` |
| **`POST /telemetry/ingest` returns 401** | Invalid or revoked API key | Ensure `X-Device-API-Key` matches the plaintext key from registration |
| **MQTT Client Connection Refused** | Port 1883 blocked by firewall or broker not listening | Verify `MQTT_PORT=1883` and check local port via `netstat -an` |
| **Telemetry returns 400 Bad Request** | Timestamp out of $\pm 5$ min window | Use current UTC time: `$(date -u +"%Y-%m-%dT%H:%M:%SZ")` |
| **Socket.IO Real-Time Updates Not Received** | CORS mismatch or missing Bearer token on connection | Ensure `CORS_ORIGIN` matches frontend URL and token is valid |
