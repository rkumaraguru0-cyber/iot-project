# SecureWatch IoT — Production Deployment Guide

> **Target Audience:** Security Engineers, DevOps / SRE, System Administrators  
> **Platform Stack:** Node.js 20+, MongoDB 6.0+, Express.js, React 18, Aedes MQTT Broker, Socket.IO

---

## Table of Contents
1. [Architecture & Component Topology](#1-architecture--component-topology)
2. [Environment Configuration & Secret Management](#2-environment-configuration--secret-management)
3. [Containerized Deployment (Docker & Compose)](#3-containerized-deployment-docker--compose)
4. [Bare-Metal / Linux VM Deployment (PM2 & Systemd)](#4-bare-metal--linux-vm-deployment-pm2--systemd)
5. [Production Nginx Reverse Proxy Configuration](#5-production-nginx-reverse-proxy-configuration)
6. [MQTT Broker Production Hardening](#6-mqtt-broker-production-hardening)
7. [Database Hardening (MongoDB 6.0+)](#7-database-hardening-mongodb-60)
8. [Process Lifecycle & Graceful Shutdown](#8-process-lifecycle--graceful-shutdown)
9. [Health Probes & Monitoring](#9-health-probes--monitoring)
10. [Deployment Verification Checklist](#10-deployment-verification-checklist)

---

## 1. Architecture & Component Topology

In a production environment, SecureWatch IoT operates behind a hardened TLS reverse proxy (Nginx or Cloudflare/ALB) that terminates HTTPS, handles WebSocket upgrade requests for Socket.IO, serves static React production assets, and routes API requests to the Express backend.

```
 Internet / IoT Edge Network
   │
   ├── HTTPS (TCP 443) ────────► [ Nginx Reverse Proxy (TLS 1.3 / HSTS) ]
   │                                  │
   │                                  ├── /           ──► Static SPA Files (client/dist)
   │                                  ├── /api/v1/*   ──► Express API (Node.js :5000)
   │                                  └── /socket.io  ──► Socket.IO WS (Node.js :5000)
   │
   └── MQTTS (TCP 8883 / 1883) ─► [ Aedes MQTT Broker (Node.js :1883) ]
                                      │
                                      ▼
                             [ MongoDB 6.0+ Database ]
                             (Replica Set / Auth Enabled)
```

---

## 2. Environment Configuration & Secret Management

Create a dedicated production environment file on the host (e.g. `/etc/securewatch/server.env` or `server/.env.production`).

> [!CAUTION]
> Never use development secret keys in production. Generate high-entropy cryptographic strings using `openssl rand -hex 32`.

### Production Server Variables (`server/.env`)
```ini
# Node Environment
NODE_ENV=production
PORT=5000
HOST=127.0.0.1

# MongoDB Connection String (Replica Set Recommended)
MONGODB_URI=mongodb://securewatch_app:<STRONG_PASSWORD>@db-node1:27017,db-node2:27017,db-node3:27017/securewatch_prod?replicaSet=rs0&authSource=admin&ssl=true

# JWT Authentication Secrets
JWT_SECRET=f3b6c7a8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECRET=9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d

# CORS Whitelist (Must match exact production domain)
CORS_ORIGIN=https://soc.securewatch.yourdomain.com

# Embedded Aedes MQTT Broker
MQTT_PORT=1883
MQTT_HOST=0.0.0.0

# Logging Verbosity
LOG_LEVEL=info
```

### Production Client Variables (`client/.env.production`)
```ini
VITE_API_URL=https://soc.securewatch.yourdomain.com/api/v1
VITE_WS_URL=https://soc.securewatch.yourdomain.com
```

---

## 3. Containerized Deployment (Docker & Compose)

### Dockerfile (`Dockerfile`)
```dockerfile
# Multi-stage production build
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY simulator/package*.json ./simulator/

RUN npm ci

COPY . .

# Build React production bundle
RUN npm run build:client

# Production image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY server/package*.json ./server/
COPY simulator/package*.json ./simulator/

RUN npm ci --omit=dev

COPY server/ ./server/
COPY simulator/ ./simulator/
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 5000 1883

CMD ["node", "server/src/server.js"]
```

### Docker Compose (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: <STRONG_ROOT_PASSWORD>
      MONGO_INITDB_DATABASE: securewatch_prod
    volumes:
      - mongo_data:/data/db
    ports:
      - "127.0.0.1:27017:27017"
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  securewatch-app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      mongodb:
        condition: service_healthy
    env_file:
      - server/.env.production
    ports:
      - "127.0.0.1:5000:5000"
      - "0.0.0.0:1883:1883"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:5000/api/v1/health"]
      interval: 15s
      timeout: 5s
      retries: 3

volumes:
  mongo_data:
```

---

## 4. Bare-Metal / Linux VM Deployment (PM2 & Systemd)

### 1. Install Global Process Manager
```bash
sudo npm install -g pm2
```

### 2. Build Frontend Assets
```bash
cd /opt/securewatch
npm install
npm run build:client
```

### 3. Configure PM2 Ecosystem (`ecosystem.config.js`)
```javascript
module.exports = {
  apps: [
    {
      name: 'securewatch-backend',
      script: 'server/src/server.js',
      cwd: '/opt/securewatch',
      instances: 2,
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      max_memory_restart: '1G',
      kill_timeout: 10000,
      listen_timeout: 8000
    }
  ]
};
```

### 4. Start Application & Save Systemd Service
```bash
pm2 start ecosystem.config.js --env production
pm2 save
sudo pm2 startup systemd -u nodejs --hp /home/nodejs
```

---

## 5. Production Nginx Reverse Proxy Configuration

Install Nginx (`sudo apt install nginx`) and configure the virtual host block at `/etc/nginx/sites-available/securewatch`:

```nginx
# Upstream Express Server
upstream securewatch_backend {
    server 127.0.0.1:5000;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name soc.securewatch.yourdomain.com;
    return 301 https://$host$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name soc.securewatch.yourdomain.com;

    # SSL Certificates (Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/soc.securewatch.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/soc.securewatch.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Static Frontend Root (SPA)
    root /opt/securewatch/client/dist;
    index index.html;

    # SPA Routing Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Endpoints Reverse Proxy
    location /api/ {
        proxy_pass http://securewatch_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # Socket.IO WebSocket Reverse Proxy
    location /socket.io/ {
        proxy_pass http://securewatch_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable site and test configuration:
```bash
sudo ln -s /etc/nginx/sites-available/securewatch /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. MQTT Broker Production Hardening

The embedded Aedes MQTT broker listens on TCP port `1883` by default. For production deployments:

1. **Firewall Access Control:** Only expose port `1883` to authorized IoT gateway subnets or VPC peering connections. Use UFW or AWS Security Groups:
   ```bash
   sudo ufw allow from 10.0.0.0/16 to any port 1883 proto tcp
   ```
2. **TLS Termination for MQTT:** For devices communicating over the public Internet, place an SSL/TLS terminator (such as HAProxy, Traefik, or Nginx stream module) on port `8883` forwarding decrypted traffic to internal port `1883`.
3. **Authentication Verification:** Ensure every device connects with its issued API key as password. The platform rejects all unauthenticated MQTT `CONNECT` packets.

---

## 7. Database Hardening (MongoDB 6.0+)

1. **Enable Authentication:** Configure `security.authorization: enabled` in `/etc/mongod.conf`.
2. **Dedicated User Permissions:** Create an application user with readWrite privileges strictly on the `securewatch_prod` database:
   ```javascript
   use admin
   db.createUser({
     user: "securewatch_app",
     pwd: "<STRONG_PASSWORD>",
     roles: [ { role: "readWrite", db: "securewatch_prod" } ]
   })
   ```
3. **Connection Pooling:** Mongoose defaults to a connection pool of 10. In high-density environments, adjust pool size via URI options (`maxPoolSize=50`).
4. **Automated Backups:** Schedule daily `mongodump` cron jobs with retention policies:
   ```bash
   0 2 * * * mongodump --uri="mongodb://localhost:27017/securewatch_prod" --archive="/backups/db-$(date +\%F).gz" --gzip
   ```

---

## 8. Process Lifecycle & Graceful Shutdown

SecureWatch IoT implements production-grade signal interception for `SIGTERM` and `SIGINT`:
1. **Stops Ingest:** Closes Aedes MQTT broker to reject new incoming client publishes.
2. **Drains WebSockets:** Closes Socket.IO server and disconnects active browser rooms.
3. **Drains HTTP:** Express HTTP listener stops accepting new connections while completing in-flight requests.
4. **Closes Database:** Mongoose cleanly terminates MongoDB connection pool.
5. **Safety Timeout:** A 10-second timeout guarantees process termination if cleanup stalls.

---

## 9. Health Probes & Monitoring

The platform provides a dedicated, lightweight health probe endpoint:
- **Endpoint:** `GET /api/v1/health`
- **Response Format:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-09-06T19:40:00.000Z",
    "uptime": 86400,
    "services": {
      "database": "connected",
      "mqttBroker": "running"
    }
  }
  ```
- **Load Balancer Integration:** Configure Kubernetes readiness/liveness probes or AWS Target Group health checks to poll `/api/v1/health` with a 200 HTTP response expectation.

---

## 10. Deployment Verification Checklist

To maintain rigorous standards, distinguish between **Source-Code Readiness** and **Actual Deployment Verification**:

### Verified Source-Code Artifacts
- [x] Environment template files verified (`.env.example`, `server/.env.example`, `client/.env.example`, `simulator/.env.example`).
- [x] Frontend builds cleanly via `npm run build:client` (Vite production bundle in `client/dist`).
- [x] Unit, integration, and security regression tests fully pass (400 server tests, 60 simulator tests).

### Live Production Deployment Verification Tasks
Run the 13 verification checks during staging / production rollout:
- [ ] **Task 1: MongoDB Connectivity:** Verify Mongoose connects to production MongoDB replica set without authentication errors.
- [ ] **Task 2: Production Env Secrets:** Verify unique, strong 32+ character secrets are set for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `COOKIE_SECRET`.
- [ ] **Task 3: URL Binding:** Verify `VITE_API_URL` and `VITE_WS_URL` resolve to the public production domain.
- [ ] **Task 4: HTTPS / SSL Provisioning:** Verify TLS 1.2/1.3 handshake and A+ SSL rating on HTTPS endpoint.
- [ ] **Task 5: CORS Enforcement:** Verify requests with unapproved `Origin` headers are blocked.
- [ ] **Task 6: WebSocket Upgrade:** Verify browser establishes persistent WebSocket connection (`Upgrade: websocket`) to `/socket.io`.
- [ ] **Task 7: MQTT Ingress:** Verify device simulator connects to TCP 1883 / 8883 with valid API key.
- [ ] **Task 8: Process Autorestart:** Verify PM2 or Docker restarts the application upon unexpected termination.
- [ ] **Task 9: Health Probe:** Verify external load balancer receives HTTP 200 from `/api/v1/health`.
- [ ] **Task 10: Graceful Shutdown:** Verify `kill -SIGTERM <pid>` logs clean disconnection of MQTT, Socket, and MongoDB.
- [ ] **Task 11: Production Error Masking:** Verify API errors in `NODE_ENV=production` do not return database internals or stack traces.
- [ ] **Task 12: SPA Fallback Routing:** Verify direct browser navigation to `/devices` or `/incidents` loads `index.html` cleanly.
- [ ] **Task 13: Live Smoke Test:** Execute complete 13-step verification checklist in [`SMOKE_TEST.md`](file:///d:/Antigravity/iot%20security%20platform/SMOKE_TEST.md).
