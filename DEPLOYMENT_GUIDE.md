# 🚀 Ropmitra WhatsApp Outreach Automation - VPS Deployment Guide

This document describes the production architecture, server details, and maintenance commands for the **Ropmitra WhatsApp Cold Outreach Automation** project deployed on Oracle Cloud VPS.

---

## 📌 Server & Architecture Overview

* **VPS Public IP**: `140.245.228.27`
* **SSH Alias**: `ssh 2` (`ubuntu@140.245.228.27`)
* **Project Directory on VPS**: `/opt/ropmitra-automation`
* **Evolution API Directory on VPS**: `/opt/evolution-api`

### 🌐 Live Public Endpoints

| Service | Public URL | Internal Target |
| :--- | :--- | :--- |
| **Ropmitra App (Frontend & API)** | `http://140.245.228.27/` | `http://127.0.0.1:3001` |
| **Evolution API Backend** | `http://140.245.228.27/prod/` | `http://127.0.0.1:8080` |

---

## 🏗️ Port & Nginx Reverse Proxy Setup

Nginx listens on **TCP Port 80** and routes requests internally:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    server_name _;

    # ── PRODUCTION EVOLUTION API (Port 8080) ──
    location /prod/ {
        rewrite ^/prod/(.*)$ /$1 break;
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
    }

    # ── ROPMITRA AUTOMATION APP (Port 3001) ──
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_cache off;
    }
}
```

---

## 🐋 Active Docker Containers

1. **`ropmitra-automation`** (App + SQLite Queue Worker)
   * Container Name: `ropmitra-automation`
   * Bound Port: `3001:3001`
   * Volume Mount: `/opt/ropmitra-automation/data` -> `/app/data` (Persists SQLite DB)

2. **`evolution-api-prod`** (Evolution API v2.3.7)
   * Container Name: `evolution-api-prod`
   * Bound Port: `8080:8080`
   * Auth Key: `apikey-ropmitra-prod-12345`

---

## 🛠️ Common Maintenance Commands

### 1. View Ropmitra App Logs
```bash
ssh 2 "sudo docker logs ropmitra-automation --tail 50 -f"
```

### 2. View Evolution API Logs
```bash
ssh 2 "sudo docker logs evolution-api-prod --tail 50 -f"
```

### 3. Deploy New Code Updates to VPS
Run locally from your development machine:
```bash
# 1. Build frontend locally
npm run build

# 2. Sync to VPS
rsync -avz --exclude 'node_modules' --exclude '.git' ./ 2:/opt/ropmitra-automation/

# 3. Restart container on VPS
ssh 2 "cd /opt/ropmitra-automation && sudo docker compose up -d --build"
```

### 4. Check Running Containers & RAM Usage
```bash
ssh 2 "sudo docker ps && free -h"
```

---

## 🔑 Environment Variables (`/opt/ropmitra-automation/.env`)

```env
PORT=3001
DB_PATH=/app/data/automation.db
EVOLUTION_API_URL=http://140.245.228.27/prod
EVOLUTION_API_KEY=apikey-ropmitra-prod-12345
MOCK_EVOLUTION_API=false
DEFAULT_SEND_INTERVAL_SECONDS=300
```
