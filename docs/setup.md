# Development Setup Guide

## System Requirements

- **Node.js**: `v20.x LTS` or higher
- **npm**: `v10.x` or higher
- **MongoDB**: `v7.x` or higher

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

### Run Server (Backend REST API)
```bash
npm run dev:server
```
- Server URL: `http://localhost:5000`
- Health check: `http://localhost:5000/api/v1/health`

### Run Client (React Frontend)
```bash
npm run dev:client
```
- Client URL: `http://localhost:5173`

### Run Simulator (IoT Fleet Simulator)
```bash
npm run dev:simulator
```

## Running Verification & Tests
```bash
npm test
```
