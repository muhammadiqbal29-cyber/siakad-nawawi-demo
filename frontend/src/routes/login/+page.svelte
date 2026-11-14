<script>
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { getApiUrl } from '$lib/config.js';

  let email = $state('');
  let password = $state('');
  let errorMessage = $state('');
  let isLoading = $state(false);
  let showPassword = $state(false);

  onMount(() => {
    const errorParam = $page.url.searchParams.get('error');
    if (errorParam === 'unregistered') {
      errorMessage = 'Email Google Anda belum terdaftar sebagai pengguna sistem.';
    } else if (errorParam === 'auth_failed' || errorParam === 'invalid_state') {
      errorMessage = 'Gagal melakukan autentikasi dengan Google.';
    } else if (errorParam === 'token_failed') {
      errorMessage = 'Gagal membuat sesi setelah login Google.';
    }
  });

  async function handleLogin() {
    isLoading = true;
    errorMessage = '';

    try {
      const response = await fetch(`${getApiUrl()}/api/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Gagal login');
      }

      auth.loggedInUser = data.role;
      auth.role = data.role;
      if (typeof window !== 'undefined') {
        localStorage.setItem('siakad_role', data.role);
        if (data.token) localStorage.setItem('siakad_token', data.token);
      }
      if (data.role === 'admin') {
        goto('/');
      } else {
        goto('/guru/input-nilai');
      }
    } catch (error) {
      console.warn('Login API fallback:', error);
      const finalRole = email.includes('admin') ? 'admin' : 'guru';
      auth.loggedInUser = finalRole;
      auth.role = finalRole;
      if (typeof window !== 'undefined') {
        localStorage.setItem('siakad_role', finalRole);
      }
      if (finalRole === 'admin') {
        goto('/');
      } else {
        goto('/guru/input-nilai');
      }
    } finally {
      isLoading = false;
    }
  }

  async function quickLogin(roleOrEmail) {
    isLoading = true;
    errorMessage = '';

    try {
      const payload = roleOrEmail.includes('@') ? { email: roleOrEmail } : { role: roleOrEmail };
      const response = await fetch(`${getApiUrl()}/api/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Gagal login demo');
      }

      auth.loggedInUser = data.role;
      auth.role = data.role;
      if (typeof window !== 'undefined') {
        localStorage.setItem('siakad_role', data.role);
        if (data.token) localStorage.setItem('siakad_token', data.token);
      }
      if (data.role === 'admin') {
        goto('/');
      } else {
        goto('/guru/input-nilai');
      }
    } catch (error) {
      console.warn('Quick login fallback:', error);
      const isGuru = roleOrEmail !== 'admin' && !roleOrEmail.includes('admin');
      const finalRole = isGuru ? 'guru' : 'admin';
      auth.loggedInUser = finalRole;
      auth.role = finalRole;
      if (typeof window !== 'undefined') {
        localStorage.setItem('siakad_role', finalRole);
        localStorage.setItem('siakad_token', `demo-token-${roleOrEmail}`);
      }
      if (finalRole === 'admin') {
        goto('/');
      } else {
        goto('/guru/input-nilai');
      }
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="app-container">
  <!-- LEFT/TOP PANEL: Brand Section -->
  <div class="brand-panel">
    <div class="welcome-text">Selamat Datang di</div>

    <div class="logo-container">
      <div class="logo-circle">
        <img src="/logo.webp" alt="Logo Yayasan Imam Nawawi" class="logo-image" />
      </div>
    </div>

    <div class="brand-desc">
      Sistem Informasi Yayasan Terpadu. Portal untuk manajemen akademik, keuangan, presensi, dan
      e-rapor.
    </div>

    <div class="brand-footer">
      <span class="footer-text"
        >Powered by <br class="mobile-break" /><strong>Yayasan Imam Nawawi Palangka Raya</strong
        ></span
      >
    </div>

    <div class="cloud-divider"></div>
  </div>

  <!-- RIGHT/BOTTOM PANEL: Form Section -->
  <div class="form-panel">
    <h2 class="form-title">Masuk ke Sistem SIAKAD</h2>

    {#if errorMessage}
      <div class="error-alert">{errorMessage}</div>
    {/if}

    <!-- 1-KLIK LOGIN DEMO (TANPA PASSWORD) -->
    <div class="demo-section">
      <div class="demo-header">
        <span class="demo-badge">🚀 Mode Demo</span>
        <span class="demo-desc">Klik untuk masuk langsung tanpa password:</span>
      </div>
      <div class="demo-grid">
        <button type="button" class="demo-card demo-admin" onclick={() => quickLogin('admin')} disabled={isLoading}>
          <div class="demo-card-icon">🛡️</div>
          <div class="demo-card-text">
            <strong>Admin Utama</strong>
            <small>Semua Fitur</small>
          </div>
        </button>

        <button type="button" class="demo-card demo-tahfiz" onclick={() => quickLogin('guru_tahfiz')} disabled={isLoading}>
          <div class="demo-card-icon">📖</div>
          <div class="demo-card-text">
            <strong>Guru Tahfiz</strong>
            <small>Ust. Abdullah</small>
          </div>
        </button>

        <button type="button" class="demo-card demo-diniyah" onclick={() => quickLogin('guru_diniyah')} disabled={isLoading}>
          <div class="demo-card-icon">📚</div>
          <div class="demo-card-text">
            <strong>Guru Diniyah</strong>
            <small>Ust. Fauzi</small>
          </div>
        </button>

        <button type="button" class="demo-card demo-lengkap" onclick={() => quickLogin('guru_lengkap')} disabled={isLoading}>
          <div class="demo-card-icon">⭐</div>
          <div class="demo-card-text">
            <strong>Guru Lengkap</strong>
            <small>Multi-Peran</small>
          </div>
        </button>
      </div>
    </div>

    <div class="divider-text">
      <span>atau login manual</span>
    </div>

    <form
      onsubmit={(e) => {
        e.preventDefault();
        handleLogin();
      }}
    >
      <div class="form-group">
        <label class="form-label" for="email">Alamat Email</label>
        <div class="input-wrapper">
          <input
            type="email"
            id="email"
            class="form-input"
            bind:value={email}
            placeholder="contoh: ustadz.tahfiz@demo.com"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div class="form-group">
        <label class="form-label" for="password">Kata Sandi (Opsional)</label>
        <div class="input-wrapper">
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            class="form-input"
            bind:value={password}
            placeholder="Kosongkan untuk login demo"
            disabled={isLoading}
          />
          <button
            type="button"
            class="toggle-password-btn"
            onclick={() => (showPassword = !showPassword)}
            disabled={isLoading}
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {#if showPassword}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path
                  d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
                ></path><line x1="1" y1="1" x2="23" y2="23"></line></svg
              >
            {:else}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle
                  cx="12"
                  cy="12"
                  r="3"
                ></circle></svg
              >
            {/if}
          </button>
        </div>
      </div>

      <div class="terms-group">
        <input type="checkbox" id="rememberMe" class="custom-checkbox" />
        <label for="rememberMe" class="terms-text"> Ingat saya di perangkat ini </label>
      </div>

      <div class="button-group">
        <button type="submit" class="btn btn-primary" disabled={isLoading}>
          {#if isLoading}
            Memproses...
          {:else}
            Sign In
          {/if}
        </button>
      </div>
      
      <div class="divider">
        <span>Atau</span>
      </div>

      <div class="button-group">
        <a href="{getApiUrl()}/api/auth/google/login" class="btn btn-google">
          <svg class="google-icon" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Login with Google
        </a>
      </div>
    </form>
  </div>
</div>

<style>
  /* --- Main Container --- */
  .app-container {
    background: #ffffff;
    border-radius: 20px;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    display: flex;
    width: 100%;
    max-width: 900px;
    position: relative;
  }

  /* --- Left Panel (Brand Section) --- */
  .brand-panel {
    background: white;
    color: #333;
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    position: relative;
    z-index: 4; /* Diubah agar awan berada di atas form-panel */
    width: 45%;
  }

  .welcome-text {
    font-size: 1.2rem;
    font-weight: 400;
    margin-top: 20px;
    color: #666;
  }

  .logo-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 40px 0;
  }

  .logo-circle {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 25px;
  }

  .logo-image {
    width: 240px;
    height: 240px;
    object-fit: contain;
  }

  .brand-name {
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: 1px;
    color: #1e293b;
  }

  .brand-desc {
    font-size: 0.85rem;
    text-align: center;
    line-height: 1.6;
    color: #64748b;
    max-width: 280px;
    margin-bottom: 40px;
  }

  .brand-footer {
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #94a3b8;
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .footer-text {
    text-align: center;
    line-height: 1.6;
  }

  .mobile-break {
    display: none;
  }

  .brand-footer strong {
    color: #22c55e;
    font-weight: 600;
  }

  .cloud-divider {
    position: absolute;
    z-index: 2;
    pointer-events: none;
  }

  /* --- Right Panel (Form Section) --- */
  .form-panel {
    background: #22c55e;
    color: white;
    padding: 50px;
    width: 55%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    position: relative;
    z-index: 3;
  }

  .form-title {
    color: white;
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 20px;
    text-align: left;
  }

  /* Demo Login Section */
  .demo-section {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 14px;
    padding: 14px;
    margin-bottom: 20px;
    backdrop-filter: blur(8px);
  }
  .demo-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .demo-badge {
    background: #ffffff;
    color: #15803d;
    font-weight: 800;
    font-size: 0.72rem;
    padding: 2px 8px;
    border-radius: 20px;
    letter-spacing: 0.5px;
  }
  .demo-desc {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.95);
  }
  .demo-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .demo-card {
    display: flex;
    align-items: center;
    gap: 10px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 10px;
    padding: 10px 12px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    color: #0f172a;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  }
  .demo-card:hover {
    transform: translateY(-2px);
    background: #ffffff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  .demo-card-icon {
    font-size: 1.3rem;
  }
  .demo-card-text {
    display: flex;
    flex-direction: column;
  }
  .demo-card-text strong {
    font-size: 0.8rem;
    font-weight: 700;
    color: #1e293b;
    line-height: 1.2;
  }
  .demo-card-text small {
    font-size: 0.68rem;
    color: #64748b;
    margin-top: 2px;
  }
  .divider-text {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 16px 0 20px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.72rem;
  }
  .divider-text::before,
  .divider-text::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid rgba(255, 255, 255, 0.25);
  }
  .divider-text span {
    padding: 0 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .error-alert {
    background-color: #fee2e2;
    color: #ef4444;
    border: 1px solid #fecaca;
    padding: 10px 15px;
    border-radius: 8px;
    font-size: 0.85rem;
    margin-bottom: 20px;
    border-left: 4px solid #fecdd3;
    backdrop-filter: blur(5px);
  }

  .form-group {
    margin-bottom: 25px;
    position: relative;
  }

  .form-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 5px;
    letter-spacing: 0.5px;
  }

  .input-wrapper {
    position: relative;
  }

  .form-input {
    width: 100%;
    border: none;
    border-radius: 8px;
    padding: 12px 15px;
    padding-right: 45px;
    font-size: 0.9rem;
    color: #333;
    background: white;
    outline: none;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    transition: box-shadow 0.3s;
  }

  .form-input:focus {
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  }

  .form-input::placeholder {
    color: #94a3b8;
  }

  .form-input:disabled {
    opacity: 0.7;
    background: #f8fafc;
    cursor: not-allowed;
  }

  .toggle-password-btn {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
    outline: none;
  }

  .toggle-password-btn:hover {
    color: #64748b;
  }

  .toggle-password-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .check-icon {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.9rem;
    color: #22c55e !important;
  }

  /* --- Checkbox --- */
  .terms-group {
    display: flex;
    align-items: center;
    margin-top: 10px;
    margin-bottom: 30px;
  }

  .custom-checkbox {
    appearance: none;
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.5);
    border-radius: 4px;
    margin-right: 10px;
    cursor: pointer;
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: all 0.2s;
  }

  .custom-checkbox:checked {
    background: white;
    border-color: white;
  }

  .custom-checkbox::after {
    content: '✓';
    color: #22c55e;
    font-size: 12px;
    font-weight: bold;
    display: none;
  }

  .custom-checkbox:checked::after {
    display: block;
  }

  .terms-text {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.8);
  }

  /* --- Buttons --- */
  .button-group {
    display: flex;
    gap: 15px;
  }

  .btn {
    padding: 12px 35px;
    border-radius: 30px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.3s;
    outline: none;
    width: 100%;
  }

  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
  }

  .btn-primary {
    background: white;
    color: #22c55e;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  }
  .btn-primary:hover:not(:disabled) {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }

  .btn:active {
    transform: translateY(0);
  }

  .divider {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 1.5rem 0;
    color: #64748b;
    font-size: 0.875rem;
  }
  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid #e2e8f0;
  }
  .divider span {
    padding: 0 1rem;
  }

  .btn-google {
    background: #ffffff;
    color: #334155;
    border: 1px solid #cbd5e1;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    font-weight: 500;
    text-decoration: none;
  }
  .btn-google:hover {
    background: #f8fafc;
    border-color: #94a3b8;
  }
  .google-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  /* --- Desktop Layout Specifics --- */
  @media (min-width: 769px) {
    .app-container {
      flex-direction: row;
      width: 100vw;
      height: 100vh;
      max-width: none;
      border-radius: 0;
      box-shadow: none;
    }

    .brand-panel {
      width: 45%;
      justify-content: center;
    }

    .form-panel {
      width: 55%;
      padding: 50px 10%;
    }

    .logo-container {
      margin: 60px 0;
    }

    .cloud-divider {
      top: 0;
      bottom: 0;
      right: -80px;
      width: 150px;
      height: 100%;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 500' preserveAspectRatio='none'%3E%3Cpath fill='%23ffffff' opacity='0.2' d='M50,0 C20,50 40,100 10,150 C-20,200 30,250 0,300 C-30,350 20,400 0,450 C-20,500 50,500 50,500 L0,500 L0,0 Z'/%3E%3Cpath fill='%23ffffff' opacity='0.5' d='M60,0 C40,60 70,120 30,180 C-10,240 50,300 10,360 C-30,420 40,480 60,500 L0,500 L0,0 Z'/%3E%3Cpath fill='%23ffffff' d='M80,0 C60,80 90,160 40,240 C-10,320 80,400 30,480 C0,500 80,500 80,500 L0,500 L0,0 Z'/%3E%3C/svg%3E");
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }
  }

  /* --- Mobile & Tablet Layout Specifics --- */
  @media (max-width: 1024px) {
    .mobile-break {
      display: block;
    }
  }

  /* --- Mobile Layout Specifics --- */
  @media (max-width: 768px) {
    .app-container {
      flex-direction: column;
      max-width: none;
      width: 100vw;
      height: 100vh;
      border-radius: 0;
      box-shadow: none;
    }

    .brand-panel {
      width: 100%;
      padding: 15px 15px 40px 15px;
      border-radius: 0;
      flex: 0 0 auto;
    }

    .logo-image {
      width: 140px;
      height: 140px;
    }

    .logo-container {
      margin: 10px 0;
    }

    .welcome-text {
      font-size: 0.95rem;
      margin-top: 5px;
    }

    .brand-name {
      font-size: 1.8rem;
    }

    .brand-desc {
      display: none;
    }

    .brand-footer {
      position: absolute;
      bottom: 15px;
      left: 50%;
      transform: translateX(-50%);
      width: 100%;
      justify-content: center;
    }

    .cloud-divider {
      top: auto;
      bottom: -60px;
      left: 0;
      right: 0;
      width: 100%;
      height: 65px; /* Overlap 5px ke atas untuk menutupi garis rambut rendering */
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 500 100' preserveAspectRatio='none'%3E%3Cpath fill='%23ffffff' opacity='0.2' d='M0,50 C50,20 100,40 150,10 C200,-20 250,30 300,0 C350,-30 400,20 450,0 C500,-20 500,50 500,50 L500,0 L0,0 Z'/%3E%3Cpath fill='%23ffffff' opacity='0.5' d='M0,60 C60,40 120,70 180,30 C240,-10 300,50 360,10 C420,-30 480,40 500,60 L500,0 L0,0 Z'/%3E%3Cpath fill='%23ffffff' d='M0,80 C80,60 160,90 240,40 C320,-10 400,80 480,30 C500,0 500,80 500,80 L500,0 L0,0 Z'/%3E%3C/svg%3E");
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }

    .form-panel {
      width: 100%;
      padding: 40px 20px 20px 20px;
      border-radius: 0;
      flex: 1;
      justify-content: flex-start;
    }

    .form-title {
      text-align: center;
      font-size: 1.1rem;
      margin-bottom: 15px;
    }

    .form-group {
      margin-bottom: 10px;
    }

    .form-label {
      margin-bottom: 3px;
      font-size: 0.7rem;
    }

    .form-input {
      padding: 8px 12px;
      font-size: 0.85rem;
    }

    .btn {
      padding: 10px 20px;
      font-size: 0.85rem;
    }

    .divider {
      margin: 1rem 0;
    }

    .button-group {
      justify-content: center;
    }
  }
</style>
