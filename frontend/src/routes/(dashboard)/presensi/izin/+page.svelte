<script>
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte.js';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let izinList = $state([]);
  let loading = $state(true);
  let errorMsg = $state('');
  let filterStatus = $state('Pending'); // Pending, Disetujui, Ditolak, Semua

  let selectedIzin = $state(null);
  let reviewCatatan = $state('');
  let showModal = $state(false);
  let actionType = $state(''); // 'Disetujui' atau 'Ditolak'

  async function loadData() {
    loading = true;
    errorMsg = '';
    try {
      const url = filterStatus === 'Semua' 
        ? `${apiUrl}/api/presensi/izin` 
        : `${apiUrl}/api/presensi/izin?status=${filterStatus}`;
        
      const res = await fetch(url, {
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Gagal memuat data');
      izinList = await res.json();
    } catch (err) {
      errorMsg = err.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();
  });

  function openReviewModal(izin, type) {
    selectedIzin = izin;
    actionType = type;
    reviewCatatan = '';
    showModal = true;
  }

  async function submitReview() {
    if (!selectedIzin) return;
    try {
      const res = await fetch(`${apiUrl}/api/presensi/izin/${selectedIzin.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: actionType,
          admin_catatan: reviewCatatan
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal mereview');
      }

      showModal = false;
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function getStatusColor(status) {
    if (status === 'Pending') return 'var(--color-warning, #f59e0b)';
    if (status === 'Disetujui') return 'var(--color-success, #10b981)';
    return 'var(--color-error, #ef4444)';
  }
</script>

<div class="page-container">
  <div class="header">
    <div>
      <h1 class="page-title">Persetujuan Izin & Sakit</h1>
      <p class="page-subtitle">Kelola pengajuan ketidakhadiran dari para guru</p>
    </div>
  </div>

  {#if errorMsg}
    <div class="alert alert-error">{errorMsg}</div>
  {/if}

  <div class="filter-section card">
    <div class="form-group" style="max-width: 200px;">
      <label for="status">Filter Status</label>
      <select id="status" class="form-input" bind:value={filterStatus} onchange={loadData}>
        <option value="Pending">Menunggu Persetujuan</option>
        <option value="Disetujui">Disetujui</option>
        <option value="Ditolak">Ditolak</option>
        <option value="Semua">Semua</option>
      </select>
    </div>
  </div>

  <div class="card">
    {#if loading}
      <div class="loading-state">Memuat data...</div>
    {:else if izinList.length === 0}
      <div class="empty-state">
        <Icon name="checkCircle" size={48} class="empty-icon" />
        <p>Tidak ada pengajuan izin ditemukan.</p>
      </div>
    {:else}
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal Mengajukan</th>
              <th>Nama Guru</th>
              <th>Tanggal Izin</th>
              <th>Jenis</th>
              <th>Alasan</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each izinList as item (item.id)}
              <tr>
                <td>{new Date(item.created_at).toLocaleDateString('id-ID')}</td>
                <td><strong>{item.guru?.nama_lengkap || 'Tidak diketahui'}</strong></td>
                <td>
                  {item.tanggal_mulai} 
                  {#if item.tanggal_mulai !== item.tanggal_selesai}
                    s/d {item.tanggal_selesai}
                  {/if}
                </td>
                <td>
                  <span class="badge" style="background-color: {item.jenis === 'Sakit' ? '#fee2e2' : '#fef3c7'}; color: {item.jenis === 'Sakit' ? '#991b1b' : '#92400e'}">
                    {item.jenis}
                  </span>
                </td>
                <td style="max-width: 250px;">
                  <div class="alasan-text">{item.alasan}</div>
                  {#if item.lampiran}
                    <a href={`${apiUrl}/${item.lampiran}`} target="_blank" class="link-lampiran">
                      <Icon name="image" size={14} /> Lihat Lampiran
                    </a>
                  {/if}
                </td>
                <td>
                  <span class="badge" style="background-color: {getStatusColor(item.status)}20; color: {getStatusColor(item.status)}; border: 1px solid {getStatusColor(item.status)}">
                    {item.status}
                  </span>
                </td>
                <td>
                  {#if item.status === 'Pending'}
                    <div class="action-buttons">
                      <button class="btn btn-icon btn-approve" onclick={() => openReviewModal(item, 'Disetujui')} title="Setujui">
                        <Icon name="check" size={16} />
                      </button>
                      <button class="btn btn-icon btn-reject" onclick={() => openReviewModal(item, 'Ditolak')} title="Tolak">
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  {:else}
                    <span style="font-size: 0.85rem; color: #64748b;">Ditinjau</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

{#if showModal}
  <div class="modal-backdrop">
    <div class="modal card">
      <h3>{actionType === 'Disetujui' ? 'Setujui Pengajuan' : 'Tolak Pengajuan'}</h3>
      <p style="margin-bottom: 1rem; color: var(--color-text-muted);">
        Anda akan me-{actionType.toLowerCase()} pengajuan <strong>{selectedIzin.jenis}</strong> dari <strong>{selectedIzin.guru.nama_lengkap}</strong>.
      </p>
      
      {#if actionType === 'Disetujui'}
        <div class="alert alert-warning" style="margin-bottom: 1rem;">
          Persetujuan akan otomatis menyuntikkan data presensi "{selectedIzin.jenis}" ke absen harian guru ini.
        </div>
      {/if}

      <div class="form-group" style="margin-bottom: 1.5rem;">
        <label for="catatan">Catatan Admin (Opsional)</label>
        <textarea id="catatan" class="form-input" rows="3" bind:value={reviewCatatan} placeholder="Berikan alasan jika ditolak..."></textarea>
      </div>

      <div class="modal-actions" style="display: flex; gap: 1rem; justify-content: flex-end;">
        <button class="btn btn-outline" onclick={() => showModal = false}>Batal</button>
        <button class="btn {actionType === 'Disetujui' ? 'btn-primary' : 'btn-danger'}" onclick={submitReview}>
          Konfirmasi {actionType}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  
  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text, #0f172a);
    margin: 0 0 0.25rem 0;
  }
  
  .page-subtitle {
    color: var(--color-text-muted, #64748b);
    margin: 0;
  }

  .card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    border: 1px solid var(--color-border, #e2e8f0);
  }

  .filter-section {
    padding: 1rem 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text-muted);
  }

  .form-input {
    padding: 0.75rem 1rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.95rem;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }

  .data-table th, .data-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    text-align: left;
  }

  .data-table th {
    font-weight: 600;
    color: var(--color-text-muted);
    background: var(--color-surface-hover, #f8fafc);
  }

  .badge {
    padding: 0.25rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-block;
  }

  .alasan-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .link-lampiran {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 4px;
    font-size: 0.8rem;
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
  }
  
  .link-lampiran:hover {
    text-decoration: underline;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: var(--color-primary, #22c55e);
    color: white;
  }
  
  .btn-danger {
    background: var(--color-error, #ef4444);
    color: white;
  }

  .btn-outline {
    background: transparent;
    border: 1px solid var(--color-border, #e2e8f0);
    color: var(--color-text, #0f172a);
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-approve {
    background: #dcfce7;
    color: #166534;
  }
  .btn-approve:hover { background: #bbf7d0; }

  .btn-reject {
    background: #fee2e2;
    color: #991b1b;
  }
  .btn-reject:hover { background: #fecaca; }

  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    width: 100%;
    max-width: 500px;
    background: white;
  }

  .alert {
    padding: 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
  }
  .alert-warning {
    background: #fffbeb;
    color: #92400e;
    border-left: 4px solid #f59e0b;
  }
  .alert-error {
    background: #fef2f2;
    color: #b91c1c;
    border-left: 4px solid #ef4444;
  }

  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
    color: var(--color-text-muted);
  }
  .empty-icon {
    color: #cbd5e1;
    margin-bottom: 1rem;
  }
</style>
