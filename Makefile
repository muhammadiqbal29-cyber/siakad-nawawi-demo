# ==========================================
# Konfigurasi Termux (Staging)
# ==========================================
STAGING_USER=u0_a129
STAGING_IP=100.77.99.42
STAGING_PORT=8022
STAGING_DIR=~/siakad-nawawi

# ==========================================
# Konfigurasi IDCloudHost (Production)
# ==========================================
PROD_USER=iqbalmahad4039
PROD_IP=210.79.190.11
PROD_PORT=22
PROD_DIR=/var/www/siakad-nawawi-be-fe-terbaru

.PHONY: deploy-staging deploy-prod

# ------------------------------------------
# Perintah: make deploy-staging
# ------------------------------------------
deploy-staging:
	@echo "🚀 Memulai Deployment ke Termux (Staging)..."
	@echo "🎨 Membangun Aplikasi Web di Laptop Lokal..."
	cd frontend && cp .env.staging .env.production.local && npm install && npm run build
	@echo "📥 Menarik kode terbaru di server..."
	ssh -p $(STAGING_PORT) $(STAGING_USER)@$(STAGING_IP) "cd $(STAGING_DIR) && git fetch origin main && git reset --hard origin/main"
	@echo "🔐 Mengirim file rahasia dan hasil build ke server..."
	scp -P $(STAGING_PORT) .env.staging $(STAGING_USER)@$(STAGING_IP):$(STAGING_DIR)/.env.staging
	scp -P $(STAGING_PORT) frontend/.env.staging $(STAGING_USER)@$(STAGING_IP):$(STAGING_DIR)/frontend/.env.staging
	scp -P $(STAGING_PORT) backend/oauth_credentials.json $(STAGING_USER)@$(STAGING_IP):$(STAGING_DIR)/backend/oauth_credentials.json
	scp -P $(STAGING_PORT) backend/token.json $(STAGING_USER)@$(STAGING_IP):$(STAGING_DIR)/backend/token.json
	scp -r -P $(STAGING_PORT) frontend/build $(STAGING_USER)@$(STAGING_IP):$(STAGING_DIR)/frontend/
	@echo "🚀 Restarting Services..."
	ssh -p $(STAGING_PORT) $(STAGING_USER)@$(STAGING_IP) "\
		cd $(STAGING_DIR) && \
		cp .env.staging .env && \
		echo '📦 Membangun Backend Golang...' && \
		cd backend && GOTOOLCHAIN=local go build -o server && cd .. && \
		echo '🔄 Merestart PM2...' && \
		pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs"
	@echo "✅ Deploy ke Staging Selesai!"

# ------------------------------------------
# Perintah: make deploy-prod
# ------------------------------------------
deploy-prod:
	@echo "🚀 Memulai Deployment ke IDCloudHost (Production)..."
	@echo "🎨 Membangun Aplikasi Web di Laptop Lokal..."
	cd frontend && cp .env.production .env.production.local && npm install && npm run build
	@echo "📥 Menarik kode terbaru di server..."
	ssh -p $(PROD_PORT) $(PROD_USER)@$(PROD_IP) "cd $(PROD_DIR) && git fetch origin main && git reset --hard origin/main"
	@echo "🔐 Mengirim file rahasia dan hasil build ke server..."
	scp -P $(PROD_PORT) .env.production $(PROD_USER)@$(PROD_IP):$(PROD_DIR)/.env.production
	scp -P $(PROD_PORT) frontend/.env.production $(PROD_USER)@$(PROD_IP):$(PROD_DIR)/frontend/.env.production
	scp -P $(PROD_PORT) backend/oauth_credentials.json $(PROD_USER)@$(PROD_IP):$(PROD_DIR)/backend/oauth_credentials.json
	scp -P $(PROD_PORT) backend/token.json $(PROD_USER)@$(PROD_IP):$(PROD_DIR)/backend/token.json
	scp -r -P $(PROD_PORT) frontend/build $(PROD_USER)@$(PROD_IP):$(PROD_DIR)/frontend/
	@echo "🚀 Restarting Services..."
	ssh -p $(PROD_PORT) $(PROD_USER)@$(PROD_IP) "\
		cd $(PROD_DIR) && \
		cp .env.production .env && \
		echo '📦 Membangun Backend Golang...' && \
		cd backend && export PATH=$$PATH:/usr/local/go/bin && go build -o server && cd .. && \
		echo '🔄 Merestart PM2...' && \
		pm2 restart ecosystem.config.cjs || pm2 start ecosystem.config.cjs"
	@echo "✅ Deploy ke Production Selesai!"
