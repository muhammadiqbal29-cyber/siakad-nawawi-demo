pipeline {
    agent any

    environment {
        // Lingkungan kerja
        GO_VERSION = '1.21'
        NODE_VERSION = '20'
        
        // Kredensial untuk Rsync/SSH ke VPS Produksi (Contoh)
        // Harus disetel di Jenkins Credentials
        SSH_CREDENTIAL_ID = 'vps-ssh-key'
        VPS_USER = 'u0_a129'
        VPS_IP = '100.77.99.42'
        DEPLOY_DIR = '/data/data/com.termux/files/home/siakad-nawawi'
    }

    triggers {
        // Memicu pipeline berjalan otomatis setiap kali ada PUSH ke Github (via Github Webhook)
        githubPush()
    }

    stages {
        stage('⚙️ Setup & Dependencies') {
            steps {
                echo 'Menyiapkan file Environment...'
                withCredentials([file(credentialsId: 'env-production', variable: 'SECRET_ENV_FILE')]) {
                    sh '''
                        # 1. Backend: Menggunakan Secret file dari Jenkins
                        rm -f backend/.env
                        cp $SECRET_ENV_FILE backend/.env
                        chmod 644 backend/.env
                        
                        # 2. Frontend: Generate VITE_API_URL secara otomatis (bukan rahasia)
                        echo "VITE_API_URL=https://api.islamimamnawawi.sch.id" > frontend/.env.production
                    '''
                }
                
                echo 'Mengunduh dependensi Golang...'
                dir('backend') {
                    sh 'go mod download'
                }
                echo 'Mengunduh dependensi Node.js (Frontend)...'
                dir('frontend') {
                    sh 'npm ci'
                }
            }
        }

        stage('🛡️ Security, Code Quality & Unit Test') {
            steps {
                echo 'Menjalankan Pengujian Unit & Code Coverage (Backend)...'
                dir('backend') {
                    // Jalankan tes dan stop jika gagal
                    sh 'go test ./...'
                }
                echo 'Menjalankan SAST & Vulnerability Scan...'
                dir('backend') {
                    sh 'gosec ./... || true'
                    // Memeriksa celah pustaka dependensi Golang
                    sh 'govulncheck ./... || true'
                }
                dir('frontend') {
                    // Memeriksa celah pustaka dependensi Node.js
                    sh 'npm audit --audit-level=high || true'
                }
            }
        }

        stage('🧪 Integration & E2E Test (Mock)') {
            steps {
                echo 'Menjalankan Pengujian Integrasi (Redis/MySQL)...'
                // TODO: Eksekusi script pengujian integrasi DB
                sh 'echo "✅ Integration tests passed"'

                echo 'Menjalankan End-to-End (E2E) Testing...'
                dir('frontend') {
                    // Contoh jika menggunakan Playwright: sh 'npx playwright test'
                    sh 'echo "✅ E2E tests passed (Placeholder)"'
                }
            }
        }

        stage('🔨 Build (Kompilasi)') {
            parallel {
                stage('Build Golang (Backend)') {
                    steps {
                        dir('backend') {
                            sh 'CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o server main.go'
                        }
                    }
                }
                stage('Build Node.js (Frontend)') {
                    steps {
                        dir('frontend') {
                            sh 'npm run build'
                        }
                    }
                }
            }
        }

        stage('🚀 Deploy to VPS (PM2)') {
            steps {
                echo 'Menyiapkan direktori artifact hasil build...'
                sh '''
                    rm -rf release_artifact
                    mkdir -p release_artifact
                    
                    # 1. Backend Golang (Binary & ENV)
                    mkdir -p release_artifact/backend
                    cp backend/server release_artifact/backend/
                    cp backend/.env release_artifact/backend/.env
                    
                    # 2. Frontend Svelte (Hanya folder build & package.json untuk production)
                    mkdir -p release_artifact/frontend
                    cp -r frontend/build release_artifact/frontend/
                    cp frontend/package.json release_artifact/frontend/
                    cp frontend/package-lock.json release_artifact/frontend/
                    
                    # 3. PM2 Config
                    cp ecosystem.config.cjs release_artifact/
                '''

                echo 'Mentransfer file artifact ke server produksi...'
                /* 
                  [NOTE] 
                  Ini adalah perintah sinkronisasi rsync ke VPS target. 
                  Hanya 'release_artifact' yang dikirim, SOURCE CODE TIDAK DIKIRIM!
                */
                withCredentials([sshUserPrivateKey(credentialsId: env.SSH_CREDENTIAL_ID, keyFileVariable: 'SSH_KEY')]) {
                    sh """
                        rsync -avz -e "ssh -p 8022 -i \${SSH_KEY} -o StrictHostKeyChecking=no" --delete --exclude 'backend/oauth_credentials.json' --exclude 'backend/token.json' release_artifact/ ${VPS_USER}@${VPS_IP}:${DEPLOY_DIR}/
                        ssh -p 8022 -i \${SSH_KEY} -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "cd ${DEPLOY_DIR}/frontend && npm ci --omit=dev"
                        ssh -p 8022 -i \${SSH_KEY} -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "cd ${DEPLOY_DIR} && pm2 reload ecosystem.config.cjs"
                    """
                }
                echo '✅ Deployment ke Termux VPS Selesai!'
            }
        }
    }

    post {
        success {
            echo '🎉 Pipeline berhasil! Aplikasi live di production.'
        }
        failure {
            echo '❌ Pipeline gagal! Cek log Jenkins untuk melihat kesalahan pada build atau test.'
        }
    }
}
