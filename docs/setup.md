# Development & Operations Setup Guide

## System Requirements

- **Node.js**: `v20.x LTS` or higher
- **npm**: `v10.x` or higher
- **MongoDB**: `v6.0` or higher (running locally on port 27017 or remote replica set)

## Initial Workspace Setup

1. Clone the repository and install all workspace dependencies:
   ```bash
   npm install
   ```

2. Setup server environment variables:
   ```bash
   cp .env.example server/.env
   ```

3. Setup simulator environment variables:
   ```bash
   cp .env.example simulator/.env
   ```

## Running the Development Services

### Run Server (Backend REST API + Embedded MQTT Broker)
```bash
npm run dev:server
```
- Server URL: `http://localhost:5000`
- Health check: `http://localhost:5000/api/v1/health`
- Embedded MQTT Broker: `mqtt://localhost:1883`

### Run Client (React SOC Frontend)
```bash
npm run dev:client
```
- Client URL: `http://localhost:5173`

### Run Simulator (IoT Fleet Simulator)
```bash
# Standard Console Simulator
npm run dev:simulator

# Run Scenario 2 with Time Acceleration
node simulator/src/index.js --scenario 2 --time-scale 10 --mode console
```

## Running Automated Verification & Tests
```bash
# Run all workspace test suites (Server 37 suites + Simulator 7 suites)
npm test

# Build client production bundle
npm run build:client
```
