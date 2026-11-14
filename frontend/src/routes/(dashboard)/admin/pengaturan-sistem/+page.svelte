<script>
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');
  let successMsg = $state('');

  let maintenanceMode = $state(false);
  let maintenanceMessage = $state('Sistem sedang dalam perbaikan rutin. Silakan kembali dalam beberapa saat.');
  let maintenanceAllowedGurus = $state('');

  async function fetchConfig() {
    try {
      loading = true;
      const res = await fetch(`${apiUrl}/api/system/config`, {
        credentials: 'include'
      });
      if (res.ok) {
        const body = await res.json();
        maintenanceMode = body.maintenance_mode === true || body.maintenance_mode === 'true';
        if (body.maintenance_message) {
          maintenanceMessage = body.maintenance_message;
        }
        if (body.maintenance_allowed_gurus) {
          maintenanceAllowedGurus = body.maintenance_allowed_gurus;
        }
      } else {
        errorMsg = 'Gagal memuat konfigurasi sistem';
      }
    } catch (err) {
      errorMsg = 'Koneksi terputus: ' + err.message;
    } finally {
      loading = false;
    }
  }

  async function saveConfig() {
    try {
      saving = true;
      errorMsg = '';
      successMsg = '';

      const res = await fetch(`${apiUrl}/api/system/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          maintenance_mode: maintenanceMode,
          maintenance_message: maintenanceMessage,
          maintenance_allowed_gurus: maintenanceAllowedGurus
        })
      });

      if (res.ok) {
        successMsg = 'Konfigurasi berhasil disimpan.';
        setTimeout(() => successMsg = '', 3000);
      } else {
        const err = await res.json();
        errorMsg = err.message || 'Gagal menyimpan konfigurasi';
      }
    } catch (err) {
      errorMsg = 'Koneksi terputus: ' + err.message;
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    fetchConfig();
  });
</script>

<div class="page-container">
  <div class="header">
    <h1>Pengaturan Sistem</h1>
    <p>Atur konfigurasi global untuk aplikasi Siakad Nawawi.</p>
  </div>

  {#if errorMsg}
    <div class="alert alert-error">
      <Icon name="alertTriangle" size={20} />
      <span>{errorMsg}</span>
    </div>
  {/if}

  {#if successMsg}
    <div class="alert alert-success">
      <Icon name="checkCircle" size={20} />
      <span>{successMsg}</span>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Memuat pengaturan...</div>
  {:else}
    <div class="card">
      <div class="card-header">
        <div class="card-icon"><Icon name="settings" size={24} /></div>
        <div class="card-title">
          <h2>Mode Maintenance</h2>
          <p>Blokir akses publik saat aplikasi sedang diupdate.</p>
        </div>
      </div>
      <div class="card-body">
        <label class="toggle-container">
          <input type="checkbox" bind:checked={maintenanceMode} class="toggle-input" />
          <div class="toggle-slider"></div>
          <span class="toggle-label">Aktifkan Mode Maintenance</span>
        </label>

        <div class="input-group">
          <label for="maintenanceMsg">Pesan Pemberitahuan</label>
          <textarea 
            id="maintenanceMsg" 
            bind:value={maintenanceMessage} 
            rows="3" 
            class="input-field"
            placeholder="Tulis pesan yang akan dilihat pengguna..."
          ></textarea>
          <span class="help-text">Pesan ini akan ditampilkan di halaman depan selama mode maintenance aktif.</span>
        </div>

        <div class="input-group" style="margin-top: 1.5rem;">
          <label for="allowedGurus">Daftar Guru Tester (Whitelist)</label>
          <input 
            type="text" 
            id="allowedGurus" 
            bind:value={maintenanceAllowedGurus} 
            class="input-field"
            placeholder="guru1@sekolah.com, 19900220202..."
          />
          <span class="help-text">Masukkan username/NIP/email guru yang dipisahkan dengan koma. Guru ini akan bisa login dan menguji sistem selama maintenance.</span>
        </div>
      </div>
      <div class="card-footer">
        <button class="btn btn-primary" onclick={saveConfig} disabled={saving}>
          {#if saving}
            <span class="spinner"></span> Menyimpan...
          {:else}
            Simpan Pengaturan
          {/if}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .page-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
  }
  .header h1 {
    font-size: 1.75rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }
  .header p {
    color: #64748b;
    margin: 0 0 2rem 0;
  }
  
  .alert {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }
  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
  .alert-success {
    background: #dcfce3;
    color: #166534;
    border: 1px solid #bbf7d0;
  }
  
  .card {
    background: white;
    border-radius: 0.75rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    overflow: hidden;
  }
  .card-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .card-icon {
    width: 48px;
    height: 48px;
    background: #eef2ff;
    color: #4f46e5;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card-title h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #1e293b;
  }
  .card-title p {
    margin: 0.25rem 0 0 0;
    color: #64748b;
    font-size: 0.9rem;
  }
  
  .card-body {
    padding: 1.5rem;
  }
  
  .toggle-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    cursor: pointer;
    margin-bottom: 1.5rem;
  }
  .toggle-input {
    display: none;
  }
  .toggle-slider {
    position: relative;
    width: 50px;
    height: 26px;
    background-color: #cbd5e1;
    border-radius: 999px;
    transition: 0.3s;
  }
  .toggle-slider::before {
    content: "";
    position: absolute;
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    border-radius: 50%;
    transition: 0.3s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }
  .toggle-input:checked + .toggle-slider {
    background-color: #4f46e5;
  }
  .toggle-input:checked + .toggle-slider::before {
    transform: translateX(24px);
  }
  .toggle-label {
    font-weight: 500;
    color: #1e293b;
  }
  
  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .input-group label {
    font-weight: 500;
    color: #475569;
  }
  .input-field {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.375rem;
    font-family: inherit;
    font-size: 0.95rem;
    resize: vertical;
    transition: border-color 0.2s;
  }
  .input-field:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
  }
  .help-text {
    font-size: 0.85rem;
    color: #64748b;
  }
  
  .card-footer {
    padding: 1.25rem 1.5rem;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
  }
  
  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 0.375rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .btn-primary {
    background: #4f46e5;
    color: white;
  }
  .btn-primary:hover:not(:disabled) {
    background: #4338ca;
  }
  
  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .loading {
    padding: 3rem;
    text-align: center;
    color: #64748b;
  }
</style>
