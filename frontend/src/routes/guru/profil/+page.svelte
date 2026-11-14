<script>
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { toastStore } from '$lib/toast.svelte.js';
  import '$lib/components/guru/AlquranMobileUI.css';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  let profilData = $state(null);
  let loading = $state(true);
  let error = $state('');

  // State untuk form ganti password
  let passwordLama = $state('');
  let passwordBaru = $state('');
  let passwordKonfirmasi = $state('');
  let passwordLoading = $state(false);
  let passwordError = $state('');
  let passwordSuccess = $state('');

  onMount(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/guru/me/profil`, { credentials: 'include' });
      if (res.ok) {
        profilData = await res.json();
      } else {
        error = 'Gagal memuat profil.';
      }
    } catch {
      error = 'Terjadi kesalahan jaringan.';
    } finally {
      loading = false;
    }
  });

  function getFiturNames(jsonStr) {
    if (!jsonStr) return [];
    try {
      const arr = JSON.parse(jsonStr);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  const fiturLabels = {
    presensi_mandiri: 'Presensi Mandiri',
    input_tahfiz: 'Input Nilai Tahfiz',
    cetak_rapor: 'Cetak Rapor'
  };

  async function updatePassword() {
    passwordError = '';
    passwordSuccess = '';
    
    if (!passwordLama || !passwordBaru || !passwordKonfirmasi) {
      passwordError = 'Semua kolom password harus diisi.';
      return;
    }
    if (passwordBaru !== passwordKonfirmasi) {
      passwordError = 'Konfirmasi password baru tidak cocok.';
      return;
    }
    if (passwordBaru.length < 6) {
      passwordError = 'Password baru minimal 6 karakter.';
      return;
    }

    passwordLoading = true;
    try {
      const res = await fetch(`${apiUrl}/api/guru/me/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          password_lama: passwordLama,
          password_baru: passwordBaru
        })
      });

      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(errorData || 'Gagal mengubah password');
      }

      passwordSuccess = 'Password berhasil diubah!';
      passwordLama = '';
      passwordBaru = '';
      passwordKonfirmasi = '';
      toastStore.show('Password berhasil diubah', 'success');
    } catch (err) {
      passwordError = err.message;
      toastStore.show(err.message, 'error');
    } finally {
      passwordLoading = false;
    }
  }
</script>

<div class="page-container desktop-only">
  <div class="header">
    <div class="title-group">
      <div class="icon-wrapper">
        <Icon name="user" size={28} />
      </div>
      <div>
        <h1>Profil Saya</h1>
        <p>Lihat informasi akun dan hak akses Anda.</p>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="card loading">
      <Icon name="loader" size={24} class="spin" />
      Memuat data...
    </div>
  {:else if error}
    <div class="alert alert-error">{error}</div>
  {:else if profilData}
    <div class="profil-grid">
      <div class="card detail-card">
        <h2>Informasi Pribadi</h2>
        <div class="info-list">
          <div class="info-item">
            <span class="label">Nama Lengkap</span>
            <span class="value">{profilData.nama_lengkap}</span>
          </div>
          <div class="info-item">
            <span class="label">NIK / NIP</span>
            <span class="value">{profilData.nik || '-'}</span>
          </div>
          <div class="info-item">
            <span class="label">Email</span>
            <span class="value">{profilData.user?.email || '-'}</span>
          </div>
          <div class="info-item">
            <span class="label">No HP</span>
            <span class="value">{profilData.no_hp || '-'}</span>
          </div>
        </div>
      </div>

      <div class="card detail-card" style="margin-top: 1.5rem;">
        <h2>Ganti Password</h2>
        <div class="form-wrapper">
          {#if passwordError}
            <div class="alert alert-error" style="margin-bottom: 1rem;">{passwordError}</div>
          {/if}
          {#if passwordSuccess}
            <div class="alert alert-success" style="margin-bottom: 1rem; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 1rem; border-radius: 0.5rem;">{passwordSuccess}</div>
          {/if}

          <div class="form-group" style="margin-bottom: 1rem;">
            <label for="pass_lama" style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #475569; font-weight: 500;">Password Lama</label>
            <input id="pass_lama" type="password" bind:value={passwordLama} class="input-modern" placeholder="Masukkan password saat ini" />
          </div>
          
          <div class="form-group" style="margin-bottom: 1rem;">
            <label for="pass_baru" style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #475569; font-weight: 500;">Password Baru</label>
            <input id="pass_baru" type="password" bind:value={passwordBaru} class="input-modern" placeholder="Minimal 6 karakter" />
          </div>

          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label for="pass_konf" style="display: block; margin-bottom: 0.5rem; font-size: 0.9rem; color: #475569; font-weight: 500;">Konfirmasi Password Baru</label>
            <input id="pass_konf" type="password" bind:value={passwordKonfirmasi} class="input-modern" placeholder="Ketik ulang password baru" />
          </div>

          <button class="btn-primary" onclick={updatePassword} disabled={passwordLoading} style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 0.5rem; padding: 0.75rem; border-radius: 0.5rem; background: #4f46e5; color: white; border: none; font-weight: 600; cursor: pointer; transition: all 0.2s;">
            {#if passwordLoading}
              <Icon name="loader" size={16} class="spin" /> Menyimpan...
            {:else}
              Simpan Password
            {/if}
          </button>
        </div>
      </div>

      <div class="side-panel">
        <div class="card bg-indigo">
          <h2>Jadwal Kerja</h2>
          <div class="time-box">
            <div class="time">
              <span class="t-label">Masuk</span>
              <span class="t-val">{profilData.jam_masuk || '-'}</span>
            </div>
            <div class="divider"></div>
            <div class="time">
              <span class="t-label">Pulang</span>
              <span class="t-val">{profilData.jam_pulang || '-'}</span>
            </div>
          </div>
        </div>

        <div class="card features-card">
          <h2>Hak Akses Anda</h2>
          <ul class="fitur-list">
            {#each getFiturNames(profilData.akses_fitur) as fitur (fitur)}
              <li>
                <Icon name="check" size={16} class="text-success" />
                {fiturLabels[fitur] || fitur}
              </li>
            {:else}
              <li class="empty-fitur">Belum ada hak akses khusus yang diberikan.</li>
            {/each}
          </ul>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- TAMPILAN MOBILE: PROFIL -->
<div class="mobile-app-ui sheet-page" style="padding-top: 0 !important; margin-bottom: 80px;">
  <div class="mobile-app-header">
    <h1 class="page-title">Profil Saya</h1>
  </div>

  {#if loading}
    <div class="empty-state" style="border: none;">Memuat data...</div>
  {:else if error}
    <div class="empty-state" style="border: none; color: red;">{error}</div>
  {:else if profilData}
    <div class="mobile-cards-view" style="padding-bottom: 0;">
      
      <!-- Info Card -->
      <div class="surah-card" style="margin-top: 0;">
        <div class="surah-top" style="border-bottom: 1px solid var(--border);">
          <div class="surah-no" style="background: #e0e7ff; color: #4f46e5;"><Icon name="user" size={14}/></div>
          <div class="surah-name">Informasi Pribadi</div>
        </div>
        <div style="padding: 12px 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--muted);">Nama</span>
            <span style="font-size: 14px; font-weight: 800; color: var(--text);">{profilData.nama_lengkap}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--muted);">NIK/NIP</span>
            <span style="font-size: 14px; font-weight: 800; color: var(--text);">{profilData.nik || '-'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--muted);">Email</span>
            <span style="font-size: 14px; font-weight: 800; color: var(--text);">{profilData.user?.email || '-'}</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--muted);">No HP</span>
            <span style="font-size: 14px; font-weight: 800; color: var(--text);">{profilData.no_hp || '-'}</span>
          </div>
        </div>
      </div>

      <!-- Jadwal Card -->
      <div class="surah-card">
        <div class="surah-top" style="border-bottom: 1px solid var(--border);">
          <div class="surah-no" style="background: #e0f2fe; color: #0284c7;"><Icon name="clock" size={14}/></div>
          <div class="surah-name">Jadwal Kerja</div>
        </div>
        <div style="padding: 12px 14px; display: flex; justify-content: space-around; text-align: center;">
          <div>
            <div style="font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 4px;">Masuk</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--text);">{profilData.jam_masuk || '-'}</div>
          </div>
          <div style="width: 1px; background: var(--border);"></div>
          <div>
            <div style="font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 4px;">Pulang</div>
            <div style="font-size: 16px; font-weight: 800; color: var(--text);">{profilData.jam_pulang || '-'}</div>
          </div>
        </div>
      </div>

      <!-- Fitur Card -->
      <div class="surah-card">
        <div class="surah-top" style="border-bottom: 1px solid var(--border);">
          <div class="surah-no" style="background: #dcfce7; color: #16a34a;"><Icon name="checkSquare" size={14}/></div>
          <div class="surah-name">Hak Akses Anda</div>
        </div>
        <div style="padding: 12px 14px;">
          {#each getFiturNames(profilData.akses_fitur) as fitur}
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <Icon name="check" size={14} color="#16a34a" />
              <span style="font-size: 13px; font-weight: 600; color: var(--text);">{fiturLabels[fitur] || fitur}</span>
            </div>
          {:else}
            <div style="font-size: 13px; color: var(--muted); text-align: center;">Belum ada hak akses khusus.</div>
          {/each}
        </div>
      </div>

      <!-- Ganti Password Card -->
      <div class="surah-card">
        <div class="surah-top" style="border-bottom: 1px solid var(--border);">
          <div class="surah-no" style="background: #fee2e2; color: #ef4444;"><Icon name="lock" size={14}/></div>
          <div class="surah-name">Ganti Password</div>
        </div>
        <div style="padding: 12px 14px;">
          {#if passwordError}
            <div style="font-size: 12px; color: #ef4444; margin-bottom: 8px;">{passwordError}</div>
          {/if}
          {#if passwordSuccess}
            <div style="font-size: 12px; color: #16a34a; margin-bottom: 8px;">{passwordSuccess}</div>
          {/if}

          <input type="password" bind:value={passwordLama} placeholder="Password Lama" style="width: 100%; border: 1.5px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 8px; font-size: 13px; outline: none; background: var(--bg);" />
          <input type="password" bind:value={passwordBaru} placeholder="Password Baru" style="width: 100%; border: 1.5px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 8px; font-size: 13px; outline: none; background: var(--bg);" />
          <input type="password" bind:value={passwordKonfirmasi} placeholder="Konfirmasi Password Baru" style="width: 100%; border: 1.5px solid var(--border); border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 13px; outline: none; background: var(--bg);" />
          
          <button onclick={updatePassword} disabled={passwordLoading} style="width: 100%; background: #4f46e5; color: white; border: none; border-radius: 8px; padding: 10px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
            {#if passwordLoading}
              <Icon name="loader" size={14} class="spin" /> Menyimpan...
            {:else}
              Simpan Password
            {/if}
          </button>
        </div>
      </div>

    </div>
  {/if}
</div>

<style>

  .desktop-only { display: block; }
  .mobile-only { display: none !important; }
  @media (max-width: 768px) {
    .desktop-only { display: none !important; }
    .mobile-only { display: block !important; }
  }

  .page-container {
    padding: 1.5rem;
    max-width: 1000px;
    margin: 0 auto;
  }
  .header {
    margin-bottom: 2rem;
  }
  .title-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .icon-wrapper {
    background: #e0e7ff;
    color: #4f46e5;
    padding: 1rem;
    border-radius: 1rem;
    display: flex;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
  }
  .title-group p {
    margin: 0.25rem 0 0;
    color: #64748b;
  }

  .profil-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 768px) {
    .profil-grid {
      grid-template-columns: 1fr 350px;
    }
  }

  .card {
    background: white;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  }
  .card h2 {
    margin: 0 0 1.5rem;
    font-size: 1.15rem;
    color: #1e293b;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 0.75rem;
  }

  .info-list {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .info-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .info-item .label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .info-item .value {
    font-size: 1.05rem;
    color: #0f172a;
    font-weight: 500;
  }

  .side-panel {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .bg-indigo {
    background: linear-gradient(135deg, #4f46e5, #3b82f6);
    color: white;
    border: none;
  }
  .bg-indigo h2 {
    color: white;
    border-color: rgba(255, 255, 255, 0.2);
  }
  .time-box {
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 0.5rem 0;
  }
  .time {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .t-label {
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    opacity: 0.8;
  }
  .t-val {
    font-size: 1.75rem;
    font-weight: 700;
  }
  .divider {
    width: 2px;
    height: 40px;
    background: rgba(255, 255, 255, 0.2);
  }

  .fitur-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .fitur-list li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.95rem;
    color: #334155;
    background: #f8fafc;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #f1f5f9;
  }
  .fitur-list li :global(.text-success) {
    color: #10b981;
  }
  .empty-fitur {
    color: #64748b;
    font-size: 0.9rem;
    font-style: italic;
    background: none !important;
    border: none !important;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem;
    color: #64748b;
  }
  .spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    100% {
      transform: rotate(360deg);
    }
  }
  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    padding: 1rem;
    border-radius: 0.5rem;
    border: 1px solid #fecaca;
  }

  .input-modern {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #cbd5e1;
    font-size: 0.95rem;
    outline: none;
    transition: all 0.2s;
    background: #f8fafc;
  }
  .input-modern:focus {
    border-color: #6366f1;
    background: #ffffff;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  .btn-primary:hover {
    background: #4338ca;
  }
  .btn-primary:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
</style>
