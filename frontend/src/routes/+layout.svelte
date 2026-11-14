<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth.svelte.js';
  import { getApiUrl } from '$lib/config.js';
  import ToastContainer from '$lib/components/ui/ToastContainer.svelte';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import PwaInstallButton from '$lib/components/ui/PwaInstallButton.svelte';
  import '../app.css';

  let { children } = $props();
  let checkingAuth = $state(true);

  onMount(async () => {
    // --- Global Fetch Interceptor untuk Anti-CSRF & Dynamic URL ---
    const originalFetch = window.fetch;
    window.fetch = async function () {
      let [resource, config] = arguments;
      if (config == null) {
        config = {};
      }

      // Jika berjalan di domain produksi (seperti Vercel) dan resource memanggil http://localhost:8080, otomatis alihkan ke same-origin relative
      if (
        typeof resource === 'string' &&
        resource.startsWith('http://localhost:8080') &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        resource = resource.replace('http://localhost:8080', '');
      }

      const method = (config.method || 'GET').toUpperCase();
      const apiUrl = getApiUrl();
      const isApiRequest = typeof resource === 'string' && (resource.startsWith('/api') || (apiUrl && resource.startsWith(apiUrl)));

      if (isApiRequest && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        if (config.headers == null) {
          config.headers = {};
        }
        if (config.headers instanceof Headers) {
          config.headers.append('X-Requested-With', 'XMLHttpRequest');
        } else {
          config.headers['X-Requested-With'] = 'XMLHttpRequest';
        }
      }
      const response = await originalFetch.apply(this, [resource, config]);
      
      // Jika request API mengembalikan 503 (Maintenance Mode), redirect ke /maintenance
      if (response.status === 503 && window.location.pathname !== '/maintenance') {
         window.location.href = '/maintenance';
      }
      
      return response;
    };
    // ------------------------------------------------

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const activeApi = getApiUrl();
    try {
      // 1. Cek status maintenance terlebih dahulu (kecuali jika sedang di halaman maintenance)
      if (window.location.pathname !== '/maintenance') {
        const sysRes = await fetch(`${activeApi}/api/system/status`);
        if (sysRes.ok) {
          const sysData = await sysRes.json();
          if (sysData.maintenance_mode === true || sysData.maintenance_mode === 'true') {
            // Biarkan admin lewat jika kita bisa cek role nanti, tapi untuk sekarang kita redirect
            const localRole = localStorage.getItem('siakad_role');
            const isBypass = localStorage.getItem('siakad_maintenance_bypass') === 'true';
            if (!isBypass && localRole !== 'admin' && localRole !== 'superadmin' && window.location.pathname !== '/login') {
               window.location.href = '/maintenance';
               return;
            }
          }
        }
      }

      // 2. Cek Auth
      const res = await fetch(`${activeApi}/api/me`, {
        credentials: 'include',
        signal: ctrl.signal
      });
      if (res.ok) {
        const data = await res.json();
        auth.loggedInUser = data.role;
        auth.role = data.role;
        if (typeof window !== 'undefined') {
          localStorage.setItem('siakad_role', data.role);
          if (data.maintenance_bypass) {
            localStorage.setItem('siakad_maintenance_bypass', 'true');
          } else {
            localStorage.removeItem('siakad_maintenance_bypass');
          }
          
          // Redirect ke maintenance jika bukan admin/bypass tapi maintenance aktif
          if (data.maintenance_bypass !== true && data.role !== 'admin' && data.role !== 'superadmin' && window.location.pathname !== '/maintenance') {
            const sysRes = await fetch(`${activeApi}/api/system/status`);
            if (sysRes.ok) {
              const sysData = await sysRes.json();
              if (sysData.maintenance_mode === true || sysData.maintenance_mode === 'true') {
                window.location.href = '/maintenance';
                return;
              }
            }
          }
        }
      } else if (res.status === 401 || res.status === 403) {
        // Clear local role if explicitly unauthorized
        if (typeof window !== 'undefined') {
          localStorage.removeItem('siakad_role');
        }
      } else if (res.status === 503) {
         if (window.location.pathname !== '/maintenance') {
            window.location.href = '/maintenance';
            return;
         }
      }
    } catch (e) {
      console.error('Network Error checking auth:', e);
      // OFFLINE FALLBACK: if network fails, check if we have a saved role
      if (typeof window !== 'undefined') {
        const savedRole = localStorage.getItem('siakad_role');
        if (savedRole) {
          auth.loggedInUser = savedRole;
          auth.role = savedRole;
        }
      }
    } finally {
      clearTimeout(timer);
      checkingAuth = false;
    }
  });

  $effect(() => {
    if (!checkingAuth) {
      if (!auth.loggedInUser && $page.url.pathname !== '/login') {
        goto('/login');
      } else if (auth.loggedInUser && $page.url.pathname === '/login') {
        goto('/');
      }
    }
  });
</script>

<svelte:head>
</svelte:head>

{#if checkingAuth}
  <div class="loading-screen">
    <div class="loading-spinner"></div>
    <p class="loading-text">Memverifikasi sesi...</p>
  </div>
{:else}
  <ToastContainer />
  <ConfirmModal />
  <PwaInstallButton />
  {@render children()}
{/if}

{#if import.meta.env.VITE_APP_ENV === 'staging'}
  <div class="staging-banner">
    ⚠️ MODE STAGING
  </div>
{/if}

<style>
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--color-bg-body, #f8fafc);
    gap: 1rem;
  }
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border, #e2e8f0);
    border-top-color: var(--color-primary, #22c55e);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  .loading-text {
    color: var(--color-text-muted, #64748b);
    font-size: 0.95rem;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .staging-banner {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    background: #ef4444;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: bold;
    letter-spacing: 0.05em;
    z-index: 9999;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    pointer-events: none;
    animation: pulse-staging 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse-staging {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
</style>
