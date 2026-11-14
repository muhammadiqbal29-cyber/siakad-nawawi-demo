<script>
  import { onMount } from 'svelte';
  import { toastStore } from '$lib/toast.svelte.js';
  import { modalStore } from '$lib/modal.svelte.js';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  // State Tabs: 'siswa' or 'guru'
  let activeTab = $state('siswa');

  // Untuk Filter Sekolah (Siswa butuh X-Sekolah-ID)
  /** @type {any[]} */
  let sekolahList = $state([]);
  let selectedSekolahId = $state('');

  // Data table
  /** @type {any[]} */
  let trashData = $state([]);
  let loading = $state(false);
  let errorMessage = $state('');

  // Bulk action state
  let selectedItems = $state([]);
  let isAllSelected = $derived(trashData.length > 0 && selectedItems.length === trashData.length);

  onMount(async () => {
    await fetchSekolah();
  });

  async function fetchSekolah() {
    try {
      const res = await fetch(`${apiUrl}/api/sekolah`, { credentials: 'include' });
      if (res.ok) {
        const body = await res.json();
        sekolahList = body.data || [];
        if (sekolahList.length > 0) {
          selectedSekolahId = sekolahList[0].id.toString();
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data sekolah', err);
    }
  }

  $effect(() => {
    // Reload data if activeTab or selectedSekolahId changes
    if (activeTab === 'siswa' && !selectedSekolahId) return;
    loadData();
  });

  async function loadData() {
    loading = true;
    errorMessage = '';
    selectedItems = [];
    try {
      let url = `${apiUrl}/api/trash/${activeTab}`;
      let headers = {};
      
      if (activeTab === 'siswa') {
        headers['X-Sekolah-ID'] = selectedSekolahId;
      }

      const res = await fetch(url, { headers, credentials: 'include' });
      if (res.ok) {
        const body = await res.json();
        trashData = body.data || [];
      } else {
        errorMessage = `Gagal memuat data bak sampah ${activeTab}.`;
      }
    } catch (err) {
      errorMessage = `Koneksi error: ${err.message}`;
    } finally {
      loading = false;
    }
  }

  function toggleSelectAll(e) {
    if (e.target.checked) {
      selectedItems = trashData.map(item => item.id);
    } else {
      selectedItems = [];
    }
  }

  async function bulkRestore() {
    if (selectedItems.length === 0) return;
    if (!(await modalStore.show({ message: `Pulihkan ${selectedItems.length} data terpilih?` }))) return;

    try {
      let headers = { 'Content-Type': 'application/json' };
      if (activeTab === 'siswa') {
        headers['X-Sekolah-ID'] = selectedSekolahId;
      }

      const res = await fetch(`${apiUrl}/api/trash/${activeTab}/restore`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids: selectedItems }),
        credentials: 'include'
      });

      if (res.ok) {
        toastStore.show(`${activeTab} terpilih berhasil dipulihkan`, 'info');
        loadData();
      } else {
        const body = await res.json();
        toastStore.show(body.message || 'Gagal memulihkan data', 'info');
      }
    } catch (err) {
      toastStore.show(`Error: ${err.message}`, 'info');
    }
  }

  async function bulkHardDelete() {
    if (selectedItems.length === 0) return;
    if (!(await modalStore.show({ message: `PERINGATAN: Hapus permanen ${selectedItems.length} data terpilih? Data tidak bisa dikembalikan lagi.` }))) return;

    try {
      let headers = { 'Content-Type': 'application/json' };
      if (activeTab === 'siswa') {
        headers['X-Sekolah-ID'] = selectedSekolahId;
      }

      const res = await fetch(`${apiUrl}/api/trash/${activeTab}/bulk`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ ids: selectedItems }),
        credentials: 'include'
      });

      if (res.ok) {
        toastStore.show(`Data ${activeTab} terpilih berhasil dihapus permanen`, 'info');
        loadData();
      } else {
        const body = await res.json();
        toastStore.show(body.message || 'Gagal menghapus data', 'info');
      }
    } catch (err) {
      toastStore.show(`Error: ${err.message}`, 'info');
    }
  }

  async function restoreItem(id, nama) {
    if (!(await modalStore.show({ message: `Pulihkan data "${nama}"?` }))) return;
    
    try {
      let headers = { 'Content-Type': 'application/json' };
      if (activeTab === 'siswa') headers['X-Sekolah-ID'] = selectedSekolahId;

      const res = await fetch(`${apiUrl}/api/trash/${activeTab}/restore`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids: [id] }),
        credentials: 'include'
      });

      if (res.ok) {
        toastStore.show(`Data "${nama}" berhasil dipulihkan`, 'info');
        loadData();
      } else {
        const body = await res.json();
        toastStore.show(body.message || 'Gagal memulihkan data', 'info');
      }
    } catch (err) {
      toastStore.show(`Error: ${err.message}`, 'info');
    }
  }

  async function hardDeleteItem(id, nama) {
    if (!(await modalStore.show({ message: `PERINGATAN: Hapus permanen "${nama}"? Data tidak bisa dikembalikan lagi.` }))) return;

    try {
      let headers = { 'Content-Type': 'application/json' };
      if (activeTab === 'siswa') headers['X-Sekolah-ID'] = selectedSekolahId;

      const res = await fetch(`${apiUrl}/api/trash/${activeTab}/bulk`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ ids: [id] }),
        credentials: 'include'
      });

      if (res.ok) {
        toastStore.show(`Data "${nama}" berhasil dihapus permanen`, 'info');
        loadData();
      } else {
        const body = await res.json();
        toastStore.show(body.message || 'Gagal menghapus data', 'info');
      }
    } catch (err) {
      toastStore.show(`Error: ${err.message}`, 'info');
    }
  }

</script>

<div class="page-container">
  <div class="header-action">
    <div>
      <h2 class="page-title">Bak Sampah (Trash Bin)</h2>
      <p class="page-subtitle">Kelola data siswa dan guru yang telah dihapus (soft-delete).</p>
    </div>
  </div>

  <!-- Tabs Navigation -->
  <div class="tabs">
    <button 
      class="tab-btn {activeTab === 'siswa' ? 'active' : ''}" 
      onclick={() => { activeTab = 'siswa'; }}>
      Siswa
    </button>
    <button 
      class="tab-btn {activeTab === 'guru' ? 'active' : ''}" 
      onclick={() => { activeTab = 'guru'; }}>
      Guru
    </button>
  </div>

  <div class="content-wrapper">
    <!-- Filter Bar -->
    <div class="filter-bar">
      {#if activeTab === 'siswa'}
        <select class="form-input" style="width: 250px;" bind:value={selectedSekolahId}>
          {#each sekolahList as sek}
            <option value={sek.id.toString()}>{sek.nama_sekolah}</option>
          {/each}
        </select>
      {/if}

      <div style="flex: 1;"></div> <!-- spacer -->

      {#if selectedItems.length > 0}
        <button class="btn-primary" onclick={bulkRestore}>
          <Icon name="refreshCw" size={16} /> Restore {selectedItems.length}
        </button>
        <button class="btn-danger" onclick={bulkHardDelete}>
          <Icon name="trash" size={16} /> Hapus Permanen {selectedItems.length}
        </button>
      {/if}
    </div>

    <!-- Table Data -->
    {#if loading}
      <div class="loading-state">Memuat data bak sampah...</div>
    {:else if errorMessage}
      <div class="error-message">{errorMessage}</div>
    {:else}
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">
                <input type="checkbox" checked={isAllSelected} onchange={toggleSelectAll} style="cursor: pointer;" />
              </th>
              {#if activeTab === 'siswa'}
                <th>NISN</th>
                <th>Nama Lengkap</th>
                <th>L/P</th>
                <th>Tanggal Dihapus</th>
              {:else}
                <th>NUPTK / NIK</th>
                <th>Nama Lengkap</th>
                <th>Email Akun</th>
                <th>Tanggal Dihapus</th>
              {/if}
              <th style="width: 150px; text-align: center;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each trashData as item (item.id)}
              <tr>
                <td style="text-align: center;">
                  <input type="checkbox" value={item.id} bind:group={selectedItems} style="cursor: pointer;" />
                </td>
                {#if activeTab === 'siswa'}
                  <td><strong>{item.nisn || '-'}</strong></td>
                  <td>{item.nama_lengkap}</td>
                  <td>{item.jenis_kelamin}</td>
                  <td style="color: #ef4444;">{item.deleted_at ? new Date(item.deleted_at).toLocaleString('id-ID') : '-'}</td>
                {:else}
                  <td><strong>{item.nik || '-'}</strong></td>
                  <td>{item.nama_lengkap}</td>
                  <td>{item.user ? item.user.email : '-'}</td>
                  <td style="color: #ef4444;">{item.deleted_at ? new Date(item.deleted_at).toLocaleString('id-ID') : '-'}</td>
                {/if}
                <td>
                  <div class="action-col">
                    <button
                      class="btn-icon text-green"
                      title="Restore"
                      onclick={() => restoreItem(item.id, item.nama_lengkap)}
                    >
                      <Icon name="refreshCw" size={16} /> Restore
                    </button>
                    <button
                      class="btn-icon text-red"
                      title="Hapus Permanen"
                      onclick={() => hardDeleteItem(item.id, item.nama_lengkap)}
                    >
                      <Icon name="trash" size={16} /> Hapus
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
            {#if trashData.length === 0}
              <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">
                  Bak sampah {activeTab} kosong.
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</div>

<style>
  .page-container {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .header-action {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 1.5rem;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-main, #1e293b);
    margin: 0 0 0.25rem 0;
  }
  .page-subtitle {
    color: var(--color-text-muted, #64748b);
    margin: 0;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid var(--color-border, #e2e8f0);
  }
  .tab-btn {
    background: none;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text-muted, #64748b);
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
    margin-bottom: -2px; /* overlap border */
  }
  .tab-btn:hover {
    color: var(--color-primary, #22c55e);
  }
  .tab-btn.active {
    color: var(--color-primary, #22c55e);
    border-bottom-color: var(--color-primary, #22c55e);
  }

  .content-wrapper {
    background: white;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    padding: 1.5rem;
  }
  .filter-bar {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    align-items: center;
  }
  .form-input {
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.5rem;
    font-size: 0.875rem;
  }

  .loading-state,
  .error-message {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-muted, #64748b);
  }
  .error-message {
    color: var(--color-error, #ef4444);
  }

  .table-wrapper {
    overflow-x: auto;
  }
  .table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }
  .table th {
    background-color: var(--color-surface-hover, #f8fafc);
    color: var(--color-text-muted, #64748b);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }
  .table td {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    color: var(--color-text-main, #1e293b);
    font-size: 0.9rem;
  }
  .table tr:hover {
    background-color: var(--color-surface-hover, #f8fafc);
  }

  /* Buttons */
  .btn-primary {
    background-color: var(--color-primary, #22c55e);
    color: white;
    border: none;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .btn-primary:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: 0.9;
  }
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .btn-danger {
    background-color: var(--color-error, #ef4444);
    color: white;
    border: none;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .btn-danger:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: 0.9;
  }
  .btn-danger:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.375rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .btn-icon:hover {
    background-color: var(--color-surface-hover, #e2e8f0);
  }
  .text-green {
    color: #16a34a;
  }
  .text-red {
    color: #ef4444;
  }
  
  .action-col {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    align-items: center;
  }
</style>
