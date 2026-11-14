<script>
  import { toastStore } from '$lib/toast.svelte.js';
  import { modalStore } from '$lib/modal.svelte.js';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  let guruList = $state([]);
  let sekolahList = $state([]);
  let loading = $state(true);
  let error = $state('');

  onMount(async () => {
    await Promise.all([loadGuru(), loadSekolah()]);
  });

  async function loadSekolah() {
    try {
      const res = await fetch(`${apiUrl}/api/sekolah?limit=100`, { credentials: 'include' });
      if (res.ok) {
        const body = await res.json();
        sekolahList = body.data || [];
      }
    } catch (e) {
      console.error('Gagal memuat data sekolah:', e);
    }
  }

  async function loadGuru() {
    try {
      const res = await fetch(`${apiUrl}/api/guru`, { credentials: 'include' });
      if (res.ok) {
        guruList = (await res.json()) || [];
      } else {
        error = 'Gagal memuat data guru';
      }
    } catch (e) {
      error = e.message || 'Terjadi kesalahan jaringan';
    } finally {
      loading = false;
    }
  }

  function getJenjangList(aksesSekolahStr) {
    if (!aksesSekolahStr || aksesSekolahStr === '[]') return [];
    try {
      const aksesMap = JSON.parse(aksesSekolahStr);
      // aksesMap is usually { "1": ["fitur1", "fitur2"], "2": [] }
      const sekolahIds = Object.keys(aksesMap).map(id => parseInt(id, 10));
      const jenjangSet = new Set();
      
      for (const sId of sekolahIds) {
        const sekolah = sekolahList.find(s => s.id === sId);
        if (sekolah && sekolah.jenjang) {
          jenjangSet.add(sekolah.jenjang);
        }
      }
      return Array.from(jenjangSet);
    } catch (e) {
      return [];
    }
  }

  async function deleteGuru(id) {
    if (
      !(await modalStore.show({
        message:
          'Apakah Anda yakin ingin menghapus data guru ini? Semua data terkait mungkin akan ikut terhapus atau bermasalah.'
      }))
    )
      return;
    try {
      const res = await fetch(`${apiUrl}/api/guru/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toastStore.show('Berhasil dihapus', 'info');
        loadGuru();
      } else {
        const body = await res.json().catch(() => ({}));
        toastStore.show('Gagal: ' + (body.message || res.statusText), 'info');
      }
    } catch {
      toastStore.show('Terjadi kesalahan jaringan', 'info');
    }
  }

  function downloadTemplate() {
    window.location.href = `${apiUrl}/api/guru/template-import`;
  }

  let fileInput;
  let isImporting = $state(false);

  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      toastStore.show('Hanya mendukung file Excel (.xlsx)', 'info');
      return;
    }

    isImporting = true;
    error = '';
    const formData = new FormData();
    formData.append('excel_file', file);

    try {
      const res = await fetch(`${apiUrl}/api/guru/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        let msg = `Import Selesai!\nBerhasil: ${data.data.berhasil}\nDilewati: ${data.data.dilewati}\nGagal: ${data.data.gagal}`;
        if (data.data.errors && data.data.errors.length > 0) {
          msg += `\n\nDetail Error:\n${data.data.errors.join('\n')}`;
        }
        toastStore.show(msg, 'info');
        loadGuru();
      } else {
        error = data.message || 'Gagal melakukan import';
      }
    } catch (err) {
      error = 'Terjadi kesalahan saat mengunggah file';
    } finally {
      isImporting = false;
      if (fileInput) fileInput.value = '';
    }
  }
</script>

<div class="page-container">
  <div class="header">
    <div class="title-group">
      <div class="icon-wrapper">
        <Icon name="users" size={28} />
      </div>
      <div>
        <h1>Manajemen Guru</h1>
        <p>Kelola data guru, jadwal masuk, dan hak akses fitur sistem.</p>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-outline" onclick={downloadTemplate}>
        <Icon name="download" size={18} /> Template
      </button>
      <button class="btn-secondary" onclick={() => fileInput.click()} disabled={isImporting}>
        <Icon name="import" size={18} />
        {isImporting ? 'Mengimport...' : 'Import Excel'}
      </button>
      <input
        type="file"
        accept=".xlsx"
        style="display: none;"
        bind:this={fileInput}
        onchange={handleImport}
      />
      <a href="/admin/guru/tambah" class="btn-primary">
        <Icon name="plus" size={18} /> Tambah Guru
      </a>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error">{error}</div>
  {/if}

  <div class="card">
    {#if loading}
      <div class="loading">Memuat data guru...</div>
    {:else if guruList.length === 0}
      <div class="empty-state">Belum ada data guru yang terdaftar.</div>
    {:else}
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Lengkap</th>
              <th>Email</th>
              <th>Jenjang yang Diakses</th>
              <th>Jam Kerja</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each guruList as guru, index (guru.id || index)}
              <tr>
                <td>{index + 1}</td>
                <td class="font-bold">{guru.nama_lengkap}</td>
                <td>{guru.user?.email || '-'}</td>
                <td>
                  <div class="jenjang-badges">
                    {#each getJenjangList(guru.akses_sekolah) as jenjang}
                      <span class="badge badge-jenjang">{jenjang}</span>
                    {:else}
                      <span class="text-muted">-</span>
                    {/each}
                  </div>
                </td>
                <td>
                  <span class="badge badge-gray"
                    >{guru.jam_masuk || '-'} - {guru.jam_pulang || '-'}</span
                  >
                </td>
                <td>
                  {#if guru.status_aktif}
                    <span class="badge badge-success">Aktif</span>
                  {:else}
                    <span class="badge badge-error">Nonaktif</span>
                  {/if}
                </td>
                <td>
                  <div class="action-buttons">
                    <a href={`/admin/guru/${guru.id}`} class="btn-icon btn-edit" title="Edit">
                      <Icon name="edit" size={16} />
                    </a>
                    <button
                      class="btn-icon btn-delete"
                      title="Hapus"
                      onclick={() => deleteGuru(guru.id)}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
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
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: #4f46e5;
    color: white;
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    text-decoration: none;
    transition: background 0.2s;
  }
  .btn-primary:hover {
    background: #4338ca;
  }

  .btn-outline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: transparent;
    color: #4f46e5;
    padding: 0.75rem 1.25rem;
    border: 1px solid #4f46e5;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-outline:hover {
    background: #e0e7ff;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: #f8fafc;
    color: #475569;
    padding: 0.75rem 1.25rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-secondary:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
  .btn-secondary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .card {
    background: white;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }
  .table-container {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }
  th,
  td {
    padding: 1rem;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.9rem;
  }
  th {
    background: #f8fafc;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }
  .font-bold {
    font-weight: 600;
    color: #1e293b;
  }

  .badge {
    padding: 0.25rem 0.5rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .badge-false {
    background-color: var(--color-danger, #ef4444);
    color: white;
  }

  .header-actions {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }
  .badge-gray {
    background: #f1f5f9;
    color: #475569;
  }
  .badge-success {
    background: #dcfce3;
    color: #166534;
  }
  .badge-error {
    background: #fee2e2;
    color: #991b1b;
  }
  .badge-jenjang {
    background: #eef2ff;
    color: #4f46e5;
    border: 1px solid #c7d2fe;
  }
  .jenjang-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }
  .text-muted {
    color: #94a3b8;
    font-size: 0.85rem;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }
  .btn-icon {
    display: inline-flex;
    padding: 0.5rem;
    border-radius: 0.375rem;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-edit {
    background: #f1f5f9;
    color: #3b82f6;
    text-decoration: none;
  }
  .btn-edit:hover {
    background: #e0f2fe;
  }
  .btn-delete {
    background: #fef2f2;
    color: #ef4444;
  }
  .btn-delete:hover {
    background: #fee2e2;
  }

  .loading,
  .empty-state {
    padding: 3rem;
    text-align: center;
    color: #64748b;
  }
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }
  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
</style>
