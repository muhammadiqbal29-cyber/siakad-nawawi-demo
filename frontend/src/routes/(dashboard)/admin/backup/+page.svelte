<script>
  import { modalStore } from '$lib/modal.svelte.js';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { toastStore } from '$lib/toast.svelte.js';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  let isTriggering = $state(false);
  let isDownloading = $state(false);
  let isRestoring = $state(false);
  let triggerMessage = $state('');
  let triggerError = $state('');

  let restoreMessage = $state('');
  let restoreError = $state('');

  let fileInput;

  async function handleTriggerBackup() {
    if (
      !(await modalStore.show({
        message:
          'Apakah Anda yakin ingin memicu backup sekarang? Proses ini mungkin membutuhkan waktu beberapa detik.'
      }))
    ) {
      return;
    }

    isTriggering = true;
    triggerMessage = '';
    triggerError = '';

    try {
      const res = await fetch(`${apiUrl}/api/backup/trigger`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        triggerMessage = data.message || 'Backup berhasil dilakukan dan diupload.';
        toastStore.show('Backup sukses diunggah ke Google Drive', 'success');
      } else {
        triggerError = data.message || 'Terjadi kesalahan saat mem-backup.';
      }
    } catch (e) {
      triggerError = 'Kesalahan jaringan atau server tidak merespon.';
    } finally {
      isTriggering = false;
    }
  }

  async function handleDownloadBackup() {
    isDownloading = true;
    triggerMessage = '';
    triggerError = '';

    try {
      const res = await fetch(`${apiUrl}/api/backup/download`, {
        method: 'GET',
        credentials: 'include'
      });

      if (res.ok) {
        const blob = await res.blob();
        const contentDisposition = res.headers.get('Content-Disposition');
        let filename = 'siakad_backup.enc';
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
          if (filenameMatch && filenameMatch.length === 2) {
            filename = filenameMatch[1];
          }
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        triggerMessage = 'File backup berhasil disiapkan dan mulai diunduh.';
        toastStore.show('Download file backup dimulai...', 'success');
      } else {
        const data = await res.json().catch(() => ({}));
        triggerError = data.message || 'Terjadi kesalahan saat meracik backup.';
      }
    } catch (e) {
      triggerError = 'Kesalahan jaringan atau server tidak merespon.';
    } finally {
      isDownloading = false;
    }
  }

  async function handleRestore(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.enc')) {
      restoreError = 'Hanya menerima file backup terenkripsi (.enc)';
      return;
    }

    if (
      !(await modalStore.show({
        message:
          'PERINGATAN BAHAYA: Merestore database akan MENIMPA semua data yang ada di sistem saat ini dengan data dari file backup. Pastikan ini adalah tindakan yang benar. Lanjutkan?'
      }))
    ) {
      fileInput.value = '';
      return;
    }

    isRestoring = true;
    restoreMessage = '';
    restoreError = '';
    
    // Tampilkan Toast Melayang (60 detik)
    toastStore.show('Memulihkan database di background. Mohon tunggu...', 'info', 60000);

    const formData = new FormData();
    formData.append('backup_file', file);

    try {
      const res = await fetch(`${apiUrl}/api/backup/restore`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        restoreError = data.message || 'Gagal merestore database.';
        isRestoring = false;
        if (fileInput) fileInput.value = '';
        return;
      }

      // Mulai polling status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${apiUrl}/api/backup/status`, {
            credentials: 'include'
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (!statusData.is_restoring) {
              clearInterval(pollInterval);
              isRestoring = false;
              if (fileInput) fileInput.value = '';
              
              if (statusData.error) {
                restoreError = `Gagal merestore database: ${statusData.error}`;
              } else {
                restoreMessage = 'Proses Restore Selesai! Database telah dipulihkan. Halaman akan dimuat ulang...';
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              }
            }
          }
        } catch (e) {
          // Abaikan error polling sementara
        }
      }, 3000);

    } catch (err) {
      restoreError = 'Terjadi kesalahan jaringan atau server terputus saat mengunggah.';
      isRestoring = false;
      if (fileInput) fileInput.value = '';
    }
  }
</script>

<div class="page-container">
  <div class="header">
    <div class="title-group">
      <div class="icon-wrapper">
        <Icon name="database" size={28} />
      </div>
      <div>
        <h1>Sistem Backup & Keamanan</h1>
        <p>Kelola data cadangan sistem secara terenkripsi dan pulihkan kapan saja.</p>
      </div>
    </div>
  </div>

  <div class="grid">
    <!-- Backup Section -->
    <div class="card backup-card">
      <div class="card-header">
        <div class="icon-circle primary">
          <Icon name="save" size={24} />
        </div>
        <h2>Backup Manual</h2>
      </div>
      <div class="card-body">
        <p>
          Sistem secara otomatis melakukan backup ke Google Drive setiap 3 jam. Namun Anda dapat
          memaksa sistem untuk melakukan backup seketika melalui tombol di bawah.
        </p>

        {#if triggerMessage}
          <div class="alert alert-success">{triggerMessage}</div>
        {/if}
        {#if triggerError}
          <div class="alert alert-error">{triggerError}</div>
        {/if}

        <div class="button-group">
          <button
            class="btn-primary"
            onclick={handleTriggerBackup}
            disabled={isTriggering || isDownloading}
          >
            {#if isTriggering}
              <Icon name="loader" size={18} class="spin" />
              Mengeksekusi...
            {:else}
              <Icon name="cloudLightning" size={18} />
              Upload GDrive
            {/if}
          </button>
          <button
            class="btn-secondary"
            onclick={handleDownloadBackup}
            disabled={isTriggering || isDownloading}
          >
            {#if isDownloading}
              <Icon name="loader" size={18} class="spin" />
              Menyiapkan...
            {:else}
              <Icon name="download" size={18} />
              Unduh ke PC
            {/if}
          </button>
        </div>
      </div>
    </div>

    <!-- Restore Section -->
    <div class="card restore-card">
      <div class="card-header">
        <div class="icon-circle danger">
          <Icon name="refreshCw" size={24} />
        </div>
        <h2>Restore Database</h2>
      </div>
      <div class="card-body">
        <p class="warning-text">
          <Icon name="alertTriangle" size={16} />
          <span
            ><strong>PERINGATAN:</strong> Merestore akan menimpa seluruh data yang ada saat ini. Tindakan
            ini tidak bisa dibatalkan.</span
          >
        </p>

        <p>
          Unggah file backup berekstensi <code>.enc</code> (File Terenkripsi AES-256) yang didapat dari
          Google Drive.
        </p>

        {#if restoreMessage}
          <div class="alert alert-success">{restoreMessage}</div>
        {/if}
        {#if restoreError}
          <div class="alert alert-error">{restoreError}</div>
        {/if}

        <div
          class="upload-area"
          onclick={() => !isRestoring && fileInput.click()}
          class:disabled={isRestoring}
          role="button"
          tabindex="0"
          onkeypress={(e) => e.key === 'Enter' && !isRestoring && fileInput.click()}
        >
          <Icon name="uploadCloud" size={32} class="upload-icon" />
          <span class="upload-title">Klik untuk Mengunggah File Backup</span>
          <span class="upload-subtitle">Hanya ekstensi .enc didukung</span>
        </div>
        <input
          type="file"
          accept=".enc"
          style="display: none;"
          bind:this={fileInput}
          onchange={handleRestore}
          disabled={isRestoring}
        />

        {#if isRestoring}
          <div class="progress-info">
            <Icon name="loader" size={18} class="spin" />
            Sedang memulihkan database. Mohon tunggu, proses ini dapat memakan waktu...
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .page-container {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
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
  .header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
  }
  .header p {
    margin: 0.25rem 0 0;
    color: #64748b;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  @media (min-width: 768px) {
    .grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .card {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 1.25rem;
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow:
      0 10px 25px -5px rgba(0, 0, 0, 0.05),
      0 8px 10px -6px rgba(0, 0, 0, 0.01);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition:
      transform 0.3s ease,
      box-shadow 0.3s ease;
  }
  .card:hover {
    transform: translateY(-4px);
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 8px 10px -6px rgba(0, 0, 0, 0.05);
  }

  .card-header {
    padding: 1.5rem;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    gap: 1rem;
    background: linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(248, 250, 252, 0.5));
  }
  .card-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #0f172a;
    font-weight: 600;
  }

  .icon-circle {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .icon-circle.primary {
    background: #e0e7ff;
    color: #4338ca;
  }
  .icon-circle.danger {
    background: #fee2e2;
    color: #b91c1c;
  }

  .card-body {
    padding: 1.5rem;
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .card-body p {
    margin: 0;
    color: #475569;
    line-height: 1.6;
  }

  .warning-text {
    display: flex;
    gap: 0.5rem;
    align-items: flex-start;
    padding: 1rem;
    background: #fef2f2;
    border-left: 4px solid #ef4444;
    border-radius: 0.5rem;
    color: #991b1b !important;
  }

  .button-group {
    display: flex;
    gap: 1rem;
    margin-top: auto;
  }

  .btn-primary,
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.875rem 1rem;
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
    transition: all 0.2s;
    flex: 1;
  }

  .btn-primary {
    background: #4f46e5;
    color: white;
    border: none;
  }
  .btn-primary:hover:not(:disabled) {
    background: #4338ca;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
  }
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #f8fafc;
    color: #475569;
    border: 1px solid #cbd5e1;
  }
  .btn-secondary:hover:not(:disabled) {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #94a3b8;
  }
  .btn-secondary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .upload-area {
    border: 2px dashed #cbd5e1;
    border-radius: 1rem;
    padding: 2rem;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    margin-top: auto;
  }
  .upload-area:hover:not(.disabled) {
    border-color: #ef4444;
    background: #fef2f2;
  }
  .upload-area.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .upload-icon {
    color: #94a3b8;
    margin-bottom: 0.5rem;
    transition: color 0.2s;
  }
  .upload-area:hover:not(.disabled) .upload-icon {
    color: #ef4444;
  }
  .upload-title {
    font-weight: 600;
    color: #334155;
  }
  .upload-subtitle {
    font-size: 0.875rem;
    color: #64748b;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
  }
  .alert-success {
    background: #dcfce3;
    color: #166534;
    border: 1px solid #bbf7d0;
  }
  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .progress-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #b91c1c;
    font-weight: 500;
    margin-top: 1rem;
  }

  :global(.spin) {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
