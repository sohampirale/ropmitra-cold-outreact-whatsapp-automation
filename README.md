# Ropmitra Cold Outreach WhatsApp Automation

A stunning, lightweight, multi-user WhatsApp automation platform integrated with **Evolution API** and backed by a **zero-dependency SQLite job queue worker** (no Redis required). Designed specifically to run on resource-constrained servers such as **Oracle Always Free VMs**.

---

## ✨ Features

- 📱 **Evolution API QR Scanner**: Scan real-time Evolution API QR codes directly from the browser to connect your WhatsApp instance.
- 👥 **Multi-User Profile Support**: Support multiple users / team members, each with their own isolated WhatsApp instance session.
- 📁 **CSV Campaign Upload**: Upload simple CSV lists containing two columns (`phone` and `msg` / `message`). Automatically formats and validates phone numbers with `+91` international codes.
- ⏱️ **Safe 1 Message / 5 Minutes Rate Limiting**: Lightweight background queue sends messages sequentially at **300 seconds (5 mins)** intervals to prevent WhatsApp anti-spam flags.
- 🛑 **Queue Controls**: Pause, Resume, or Cancel campaigns anytime.
- 📊 **Complete Audit History & CSV Export**: Export complete campaign logs or global message histories as CSV files for reference.
- 🛠️ **Dev Mock Mode**: Test the complete UI, CSV upload, queue scheduler, and CSV export locally even without an active Evolution API container (`MOCK_EVOLUTION_API=true`).
- ☁️ **Oracle Always Free Ready**: Low memory footprint (<80 MB RAM) with included Dockerfile, `docker-compose.yml`, and PM2 deployment instructions.

---

## 📋 CSV Format Requirements

Your uploaded CSV file should have **2 columns**:
1. `phone`: Phone number (e.g. `+919876543210` or `9876543210`)
2. `msg` or `message`: The message text to deliver

### Sample CSV (`sample.csv`)
```csv
phone,msg
+919876543210,"Hi! Exploring WhatsApp outreach automation with Ropmitra."
+919812345678,"Hello, checking if you'd be interested in our services."
+919900011122,"Hey there! Sharing our latest updates with you."
```

---

## 🚀 Quickstart (Local Development)

### 1. Install Dependencies
```bash
npm install
cd frontend && npm install && cd ..
```

### 2. Configure Environment variables
Copy the `.env.example` file:
```bash
cp .env.example .env
```

### 3. Run Full-Stack Application
Start both the Express backend API and React Vite frontend concurrently:
```bash
npm run dev
```

- **Frontend Web UI**: `http://localhost:5173`
- **Backend API Server**: `http://localhost:3001`

---

## 🌐 Deploying on Oracle Always Free Tier

See [DEPLOY_ORACLE_FREE.md](file:///home/soham/coding/proj/ropmitra-cold-outreact-whatsapp-automation/DEPLOY_ORACLE_FREE.md) for step-by-step instructions on running either direct lightweight PM2 deployment or Docker Compose on Oracle Cloud VMs.

---

## 🏗️ Tech Stack
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS (Glassmorphism Dark Mode), Lucide Icons
- **Backend**: Node.js, Express, TypeScript
- **Database & Queue**: SQLite (`better-sqlite3`) + Built-in database worker loop (Zero Redis)
- **WhatsApp Integration**: Evolution API v1/v2 REST client