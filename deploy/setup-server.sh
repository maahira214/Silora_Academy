#!/usr/bin/env bash
# One-time setup of a fresh AWS Lightsail Ubuntu 24.04 server for Silora Academy.
# Run from the repository folder on the server:  bash deploy/setup-server.sh
# Safe to run again: each step skips work that is already done.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> System updates and automatic security updates"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git unattended-upgrades ufw
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Docker (official apt repository)"
if ! command -v docker >/dev/null; then
  sudo install -m 0755 -d /etc/apt/keyrings
  sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  sudo chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" |
    sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
fi

echo "==> 2 GB swap (headroom for building the app on a 2 GB server)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Firewall: SSH, HTTP, HTTPS only"
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw --force enable

echo "==> Settings file deploy/.env"
if [ ! -f deploy/.env ]; then
  cp deploy/.env.production.example deploy/.env
  sed -i "s/^POSTGRES_PASSWORD=\"\"/POSTGRES_PASSWORD=\"$(openssl rand -hex 24)\"/" deploy/.env
  sed -i "s/^CRON_SECRET=\"\"/CRON_SECRET=\"$(openssl rand -hex 32)\"/" deploy/.env
  chmod 600 deploy/.env
  echo "Created deploy/.env with generated passwords."
  echo "Now fill in the Google, R2 and Sentry values:  nano deploy/.env"
else
  echo "deploy/.env already exists; left unchanged."
fi

echo
echo "Setup done. Log out and back in (so Docker works without sudo), then run:  bash deploy/deploy.sh"
