#!/bin/bash
# ============================================================
# 3Boxes HRMS - Hostinger VPS Deployment Script
# ============================================================
# Run this script on the VPS to set up the application
# Usage: bash deploy/hostinger-setup.sh
#
# Prerequisites:
#   - Hostinger VPS with Ubuntu 22.04+
#   - Root or sudo access
#   - Domain 3boxeshrms.com pointed to VPS IP
#   - Wildcard DNS record: *.3boxeshrms.com → VPS IP

set -e

echo "========================================"
echo "  3Boxes HRMS - Hostinger VPS Setup"
echo "========================================"

# ----- Configuration -----
APP_DIR="/home/3boxeshrms"
APP_USER="3boxes"
REPO_URL="https://github.com/maheshkpreddy/nexus-hrms.git"
NODE_VERSION="20"
DOMAIN="3boxeshrms.com"

# ----- Step 1: System Dependencies -----
echo ""
echo "📦 Step 1: Installing system dependencies..."
sudo apt update
sudo apt install -y curl wget git nginx postgresql postgresql-contrib certbot python3-certbot-nginx build-essential

# ----- Step 2: Node.js -----
echo ""
echo "📦 Step 2: Installing Node.js ${NODE_VERSION}..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "  ✓ Node.js $(node -v), npm $(npm -v)"

# ----- Step 3: PM2 -----
echo ""
echo "📦 Step 3: Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi
echo "  ✓ PM2 $(pm2 -v)"

# ----- Step 4: Create App User -----
echo ""
echo "👤 Step 4: Creating application user..."
if ! id "$APP_USER" &> /dev/null; then
    sudo useradd -m -s /bin/bash "$APP_USER"
    echo "  ✓ User $APP_USER created"
else
    echo "  ✓ User $APP_USER already exists"
fi

# ----- Step 5: PostgreSQL Setup -----
echo ""
echo "🗄️  Step 5: Setting up PostgreSQL..."
sudo systemctl start postgresql
sudo systemctl enable postgresql

DB_USER="3boxes_user"
DB_NAME="3boxes_hrms"
DB_PASS=$(openssl rand -hex 16)

# Check if database already exists
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "  ✓ Database $DB_NAME already exists"
else
    sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    echo "  ✓ Database $DB_NAME created with user $DB_USER"
    echo "  ⚠️  Database password: $DB_PASS (save this!)"
fi

# ----- Step 6: Clone / Update Repository -----
echo ""
echo "📥 Step 6: Cloning repository..."
sudo mkdir -p "$APP_DIR/app"
sudo mkdir -p "$APP_DIR/logs"

if [ -d "$APP_DIR/app/.git" ]; then
    cd "$APP_DIR/app"
    sudo -u "$APP_USER" git pull origin main
    echo "  ✓ Repository updated"
else
    sudo -u "$APP_USER" git clone "$REPO_URL" "$APP_DIR/app"
    cd "$APP_DIR/app"
    echo "  ✓ Repository cloned"
fi

# ----- Step 7: Environment Configuration -----
echo ""
echo "⚙️  Step 7: Configuring environment..."
if [ ! -f "$APP_DIR/app/.env" ]; then
    cat > "$APP_DIR/app/.env" << EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
POSTGRES_PRISMA_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?connect_timeout=10"
POSTGRES_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
JWT_SECRET="$(openssl rand -hex 32)"
NEXT_PUBLIC_BASE_URL="https://${DOMAIN}"
NEXT_PUBLIC_ROOT_DOMAIN="${DOMAIN}"
NODE_ENV="production"
PORT="3000"
EOF
    echo "  ✓ .env file created"
else
    echo "  ✓ .env file already exists"
fi

# ----- Step 8: Install Dependencies & Build -----
echo ""
echo "📦 Step 8: Installing dependencies and building..."
cd "$APP_DIR/app"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npx prisma generate
sudo -u "$APP_USER" npm run build
echo "  ✓ Build complete"

# ----- Step 9: Database Migration & Seed -----
echo ""
echo "🗄️  Step 9: Running database migrations..."
cd "$APP_DIR/app"
sudo -u "$APP_USER" npx prisma db push
echo "  ✓ Database schema synced"

echo ""
echo "🌱 Seeding MarqAI Tech Group data..."
sudo -u "$APP_USER" npx tsx prisma/seed-marqai.ts
echo "  ✓ Seed data loaded"

# ----- Step 10: Nginx Configuration -----
echo ""
echo "🌐 Step 10: Configuring Nginx..."
sudo cp "$APP_DIR/app/deploy/nginx-3boxeshrms.conf" /etc/nginx/sites-available/"$DOMAIN"
if [ ! -L /etc/nginx/sites-enabled/"$DOMAIN" ]; then
    sudo ln -s /etc/nginx/sites-available/"$DOMAIN" /etc/nginx/sites-enabled/
fi
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx
echo "  ✓ Nginx configured"

# ----- Step 11: SSL Certificate -----
echo ""
echo "🔒 Step 11: Setting up SSL certificate..."
echo "  Note: If DNS hasn't propagated yet, run this manually later:"
echo "  sudo certbot --nginx -d $DOMAIN -d *.$DOMAIN --dns-cloudflare"
echo ""
echo "  For now, trying HTTP challenge for main domain..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email admin@"$DOMAIN" || {
    echo "  ⚠️  SSL setup failed. DNS may not be ready yet."
    echo "  Run manually later: sudo certbot --nginx -d $DOMAIN -d *.$DOMAIN"
}

# ----- Step 12: PM2 Startup -----
echo ""
echo "🚀 Step 12: Starting the application with PM2..."
cd "$APP_DIR/app"
sudo cp "$APP_DIR/app/deploy/ecosystem.config.js" "$APP_DIR/ecosystem.config.js"
sudo -u "$APP_USER" pm2 start "$APP_DIR/ecosystem.config.js"
sudo -u "$APP_USER" pm2 save
sudo env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" 2>/dev/null || true
echo "  ✓ Application started"

# ----- Step 13: Set Permissions -----
echo ""
echo "🔐 Step 13: Setting file permissions..."
sudo chown -R "$APP_USER:$APP_USER" "$APP_DIR"
sudo chmod -R 755 "$APP_DIR/app"
echo "  ✓ Permissions set"

# ----- Done -----
echo ""
echo "========================================"
echo "  ✅ Setup Complete!"
echo "========================================"
echo ""
echo "  🌐 Main site:       https://$DOMAIN"
echo "  🏢 MarqAI Tech:    https://marqaitechgroup.$DOMAIN"
echo ""
echo "  📊 PM2 status:      pm2 status"
echo "  📋 PM2 logs:        pm2 logs 3boxes-hrms"
echo "  🔄 Restart app:     pm2 restart 3boxes-hrms"
echo ""
echo "  ⚠️  If SSL failed, run manually after DNS propagation:"
echo "     sudo certbot --nginx -d $DOMAIN"
echo "     For wildcard: sudo certbot certonly --dns-cloudflare -d *.$DOMAIN"
echo ""
echo "  📝 Next steps:"
echo "  1. Verify DNS records point to this VPS"
echo "  2. Set up wildcard SSL if using subdomain routing"
echo "  3. Test login at https://marqaitechgroup.$DOMAIN"
echo ""
