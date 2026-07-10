# 🚀 Deploying Ropmitra WhatsApp Automation on Oracle Always Free VM

This guide explains how to deploy this project on an **Oracle Always Free VM** (e.g., AMD VM.Standard.E2.1.Micro or ARM VM.Standard.A1.Flex) with minimal RAM/CPU overhead.

---

## 1. Prerequisites on your Oracle Cloud VM

SSH into your Oracle VM instance and ensure Node.js 20+ and Docker are installed:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git build-essential

# Verify versions
node -v
npm -v
```

---

## 2. Clone the Repository & Configure Environment

```bash
git clone https://github.com/sohampirale/ropmitra-cold-outreact-whatsapp-automation.git
cd ropmitra-cold-outreact-whatsapp-automation

# Copy the example environment file
cp .env.example .env
```

Edit your `.env` file (`nano .env`):
- Set `PORT=3001` (or port 80 if running behind Nginx).
- Set `EVOLUTION_API_URL` and `EVOLUTION_API_KEY` to your live Evolution API endpoint.
- Set `MOCK_EVOLUTION_API=false` when connecting to real WhatsApp instances.

---

## 3. Option A: Direct Lightweight Deployment with PM2 (Recommended for 1GB RAM VM)

Using direct Node.js + SQLite requires **zero container overhead (<80MB RAM)**:

```bash
# Install root & workspace dependencies
npm install

# Build frontend static files
npm run build

# Install PM2 process manager globally
sudo npm install -g pm2

# Start the full-stack server
pm2 start backend/src/index.ts --interpreter ./node_modules/.bin/tsx --name ropmitra-automation

# Save PM2 process so it starts on server reboot
pm2 save
pm2 startup
```

---

## 4. Option B: Docker Compose Deployment

If you prefer containerized deployment:

```bash
sudo apt install -y docker.io docker-compose
sudo docker-compose up -d --build
```

---

## 5. Opening Oracle Cloud Security Rules (Firewall)

Oracle VMs block inbound traffic by default:
1. In Oracle Cloud Console -> Networking -> Virtual Cloud Networks -> Security Lists:
   - Add **Ingress Rule**: Source `0.0.0.0/0`, Protocol `TCP`, Destination Port Range `3001` (and `8080` if running Evolution API container).
2. Inside the VM OS firewall (iptables / ufw):
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT
   sudo netfilter-persistent save
   ```

Now open `http://<YOUR_ORACLE_VM_PUBLIC_IP>:3001` in any browser to access the Ropmitra dashboard!
