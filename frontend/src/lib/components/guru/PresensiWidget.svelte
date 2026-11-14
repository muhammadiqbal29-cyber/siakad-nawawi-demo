<script>
  import { onMount } from 'svelte';
  import { guruState } from '$lib/guruState.svelte.js';
  import Icon from '$lib/components/ui/Icon.svelte';
  
  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let loading = $state(true);
  let actionLoading = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  // Status Hari Ini
  let todayRecord = $state(null);
  let hasCheckedIn = $derived(todayRecord && todayRecord.waktu_masuk);
  let hasCheckedOut = $derived(todayRecord && todayRecord.waktu_pulang);

  let currentJam = $state('00:00:00');
  let currentTanggal = $state('');

  // Lokasi Presensi (Konfigurasi)
  let allowedLocations = $state([]);

  onMount(async () => {
    startClock();
    await fetchTodayStatus();
    await fetchKonfigurasi();
  });

  function startClock() {
    setInterval(() => {
      const now = new Date();
      currentJam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      currentTanggal = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }, 1000);
  }

  async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers
    });
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('siakad_role');
      window.location.href = '/login';
    }
    return res;
  }

  async function fetchTodayStatus() {
    loading = true;
    errorMsg = '';
    try {
      const res = await fetchWithAuth(`${apiUrl}/api/guru/me/presensi/hari-ini`);
      if (res.ok) {
        const data = await res.json();
        // Backend sekarang hanya mengembalikan 1 objek untuk hari ini (jika ada), atau null
        todayRecord = data;
      } else {
        todayRecord = null;
      }
    } catch (e) {
      errorMsg = "Gagal memuat status presensi.";
    } finally {
      loading = false;
    }
  }

  async function fetchKonfigurasi() {
    try {
      const res = await fetchWithAuth(`${apiUrl}/api/guru/me/presensi/konfigurasi`);
      if (res.ok) {
        const data = await res.json();
        allowedLocations = [data];
      }
    } catch (e) {
      console.warn("Gagal memuat lokasi", e);
    }
  }

  function getGeolocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Peramban Anda tidak mendukung GPS / Geolocation."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
  }

  async function handleAbsen(type) {
    errorMsg = '';
    successMsg = '';
    actionLoading = true;

    try {
      // 1. Minta Izin Lokasi
      const position = await getGeolocation();
      
      const payload = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        speed: position.coords.speed !== null ? position.coords.speed : undefined,
        heading: position.coords.heading !== null ? position.coords.heading : undefined,
        is_mocked: false // Di web sangat sulit deteksi mock dari JS, kita serahkan ke deteksi speed/accuracy backend
      };

      const endpoint = type === 'masuk' ? '/api/guru/me/presensi/masuk' : '/api/guru/me/presensi/pulang';
      const res = await fetchWithAuth(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch (errJson) {
        data = { message: text || 'Terjadi kesalahan pada server (Gagal mem-parsing JSON)' };
      }

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Gagal merekam presensi');
      }

      successMsg = data.message || "Presensi berhasil dicatat!";
      if (data.is_suspicious) {
        errorMsg = "Presensi dicatat, tetapi ditandai sebagai MENCURIGAKAN (Terlalu jauh/Fake GPS/Anomali). Admin akan mereview data Anda.";
        successMsg = ''; // Reset success if suspicious to show warning instead
      }

      await fetchTodayStatus();

    } catch (e) {
      if (e.code === 1) { // PERMISSION_DENIED
        errorMsg = "Akses GPS ditolak! Anda harus mengizinkan akses lokasi di browser untuk bisa absen.";
      } else if (e.code === 2) {
        errorMsg = "Sinyal GPS tidak stabil atau tidak tersedia.";
      } else if (e.code === 3) {
        errorMsg = "Waktu pencarian GPS habis (Timeout). Coba ke area terbuka.";
      } else {
        errorMsg = e.message;
      }
    } finally {
      actionLoading = false;
    }
  }
</script>



<div class="page-container">
  <div class="header" style="margin-bottom: 1rem;">
    <div>
      <h2 class="page-title" style="font-size: 1.25rem;">Presensi Kehadiran</h2>
      <p class="page-subtitle" style="font-size: 0.8rem;">Pastikan Anda berada di lingkungan sekolah sebelum absen.</p>
    </div>
  </div>

  <div class="clock-card">
    <div class="time">{currentJam}</div>
    <div class="date">{currentTanggal}</div>
  </div>

  {#if errorMsg}
    <div class="alert error">
      <Icon name="alertTriangle" size={20} />
      <span>{errorMsg}</span>
    </div>
  {/if}

  {#if successMsg}
    <div class="alert success">
      <Icon name="checkCircle" size={20} />
      <span>{successMsg}</span>
    </div>
  {/if}

  {#if loading}
    <div class="loading-state">
      <Icon name="refreshCw" size={24} class="spin" />
      <p>Memeriksa status presensi hari ini...</p>
    </div>
  {:else}
    <div class="attendance-card">
      <h2 class="section-title">Status Hari Ini</h2>
      
      <div class="status-grid">
        <div class="status-box">
          <div class="sb-label">Absen Masuk</div>
          <div class="sb-value {hasCheckedIn ? 'text-green' : 'text-gray'}">
            {#if hasCheckedIn}
              {todayRecord.waktu_masuk}
            {:else}
              --:--
            {/if}
          </div>
        </div>
        <div class="status-box">
          <div class="sb-label">Absen Pulang</div>
          <div class="sb-value {hasCheckedOut ? 'text-green' : 'text-gray'}">
            {#if hasCheckedOut}
              {todayRecord.waktu_pulang}
            {:else}
              --:--
            {/if}
          </div>
        </div>
      </div>

      <div class="action-buttons">
        {#if hasCheckedOut}
          <div class="finished-state">
            <Icon name="checkCircle" size={48} color="#22c55e" />
            <h3>Presensi Hari Ini Selesai</h3>
            <p>Terima kasih atas dedikasi Anda hari ini. Selamat beristirahat!</p>
          </div>
        {:else}
          <button 
            class="btn-absen {hasCheckedIn ? 'btn-pulang' : 'btn-masuk'}" 
            disabled={actionLoading}
            onclick={() => handleAbsen(hasCheckedIn ? 'pulang' : 'masuk')}
          >
            {#if actionLoading}
              <Icon name="refreshCw" size={24} class="spin" /> Memproses GPS...
            {:else}
              <Icon name={hasCheckedIn ? 'logOut' : 'logIn'} size={24} />
              {hasCheckedIn ? 'KLIK UNTUK ABSEN PULANG' : 'KLIK UNTUK ABSEN MASUK'}
            {/if}
          </button>
        {/if}
      </div>
    </div>
  {/if}

  {#if allowedLocations.length > 0}
    <div class="location-info">
      <h3 style="margin-top: 0; display:flex; align-items:center; gap:0.5rem;"><Icon name="mapPin" size={18} /> Lokasi yang Diizinkan</h3>
      <p style="margin-bottom: 0.25rem;">Anda harus berada dalam radius <strong>{allowedLocations[0].radius_meter} meter</strong> dari pusat sekolah:</p>
      <ul style="margin: 0; padding-left: 1.5rem; color: #64748b;">
        <li>Latitude: {allowedLocations[0].latitude}</li>
        <li>Longitude: {allowedLocations[0].longitude}</li>
      </ul>
    </div>
  {/if}
</div>

<style>
  .page-container {
    max-width: 100%;
    margin: 0 auto;
    padding-bottom: 1rem;
  }
  .header {
    text-align: center;
    margin-bottom: 2rem;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--color-text-main, #1e293b);
    margin: 0 0 0.25rem 0;
  }
  .page-subtitle {
    font-size: 0.9rem;
    color: var(--color-text-muted, #64748b);
    margin: 0;
  }

  .clock-card {
    background: linear-gradient(135deg, #0ea5e9, #2563eb);
    color: white;
    border-radius: 1rem;
    padding: 2rem;
    text-align: center;
    margin-bottom: 2rem;
    box-shadow: 0 4px 15px -3px rgba(14, 165, 233, 0.4);
  }
  .time {
    font-size: 3.5rem;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    letter-spacing: 2px;
  }
  .date {
    margin-top: 0.5rem;
    font-size: 1.1rem;
    opacity: 0.9;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-size: 0.95rem;
    line-height: 1.4;
  }
  .alert.error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
  }
  .alert.success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #15803d;
  }

  .attendance-card {
    background: var(--color-surface, #fff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    text-align: center;
  }
  .section-title {
    font-size: 1.1rem;
    font-weight: 700;
    margin: 0 0 1.5rem 0;
    color: var(--color-text-main, #1e293b);
  }

  .status-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .status-box {
    background: var(--color-bg-body, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.75rem;
    padding: 1rem;
  }
  .sb-label {
    font-size: 0.85rem;
    color: var(--color-text-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 0.5rem;
  }
  .sb-value {
    font-size: 1.8rem;
    font-weight: 800;
  }
  .text-green { color: #22c55e; }
  .text-gray { color: #cbd5e1; }

  .btn-absen {
    width: 100%;
    padding: 1.5rem;
    border: none;
    border-radius: 1rem;
    font-size: 1.25rem;
    font-weight: 800;
    color: white;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.2s;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  }
  .btn-absen:active:not(:disabled) {
    transform: scale(0.98);
  }
  .btn-absen:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background: #94a3b8 !important;
  }
  .btn-masuk {
    background: linear-gradient(135deg, #22c55e, #16a34a);
  }
  .btn-masuk:hover:not(:disabled) {
    box-shadow: 0 10px 15px -3px rgba(34, 197, 94, 0.4);
  }
  .btn-pulang {
    background: linear-gradient(135deg, #ef4444, #dc2626);
  }
  .btn-pulang:hover:not(:disabled) {
    box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.4);
  }

  .finished-state {
    padding: 2rem;
    background: #f0fdf4;
    border: 1px dashed #22c55e;
    border-radius: 1rem;
    color: #15803d;
  }
  .finished-state h3 {
    margin: 1rem 0 0.5rem 0;
    font-size: 1.2rem;
  }
  .finished-state p {
    margin: 0;
    font-size: 0.9rem;
    opacity: 0.9;
  }

  .location-info {
    margin-top: 2rem;
    padding: 1.5rem;
    background: var(--color-bg-body, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 1rem;
    font-size: 0.9rem;
  }

  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    100% { transform: rotate(360deg); }
  }
</style>
