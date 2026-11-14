<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';

  let { sekolahId } = $props();

  let errorMessage = $state('');
  let successMessage = $state('');
  let loading = $state(false);

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  let abortController = new AbortController();

  /** @type {any[]} */
  let kelasData = $state([]);
  let showModalCreate = $state(false);
  let showModalEdit = $state(false);
  let showModalDelete = $state(false);
  /** @type {any} */
  let currentKelas = $state(null);
  let saving = $state(false);

  let form = $state({
    id: 0,
    tingkat: '10',
    tingkat_level: 1,
    nama_kelas: ''
  });

  async function loadData() {
    loading = true;
    errorMessage = '';
    try {
      const res = await fetch(`${apiUrl}/api/sekolah/${sekolahId}/kelas`, {
        credentials: 'include',
        signal: abortController.signal
      });
      if (res.ok) {
        kelasData = (await res.json()) || [];
      } else {
        const body = await res.json();
        errorMessage = body.message || 'Gagal mengambil data kelas.';
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        errorMessage = `Koneksi gagal. Detail: ${err.message}. ID: ${sekolahId}`;
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadData();
  });

  onDestroy(() => {
    abortController.abort();
  });

  function clearMessages() {
    errorMessage = '';
    successMessage = '';
  }

  function setTimeoutMessage(msg, isError = false) {
    if (isError) errorMessage = msg;
    else successMessage = msg;
    setTimeout(() => clearMessages(), 3000);
  }

  function resetForm() {
    form = { id: 0, tingkat: '10', tingkat_level: 1, nama_kelas: '' };
  }

  function openCreate() {
    resetForm();
    showModalCreate = true;
  }

  function openEdit(k) {
    form = { ...k };
    showModalEdit = true;
  }

  function openDelete(k) {
    currentKelas = k;
    showModalDelete = true;
  }

  async function handleSave() {
    saving = true;
    try {
      const payload = {
        ...form,
        tingkat_level: parseInt(form.tingkat_level) || 1
      };
      const res = await fetch(`${apiUrl}/api/sekolah/${sekolahId}/kelas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (res.ok) {
        showModalCreate = false;
        setTimeoutMessage('Kelas berhasil ditambahkan.');
        await loadData();
      } else {
        const body = await res.json();
        errorMessage = body.message || 'Gagal menyimpan kelas.';
      }
    } catch (err) {
      errorMessage = `Error Save: ${err.message}`;
    } finally {
      saving = false;
    }
  }

  async function handleUpdate() {
    saving = true;
    try {
      const payload = {
        ...form,
        tingkat_level: parseInt(form.tingkat_level) || 1
      };
      const res = await fetch(`${apiUrl}/api/kelas/${form.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-Sekolah-ID': sekolahId.toString()
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (res.ok) {
        showModalEdit = false;
        setTimeoutMessage('Kelas berhasil diperbarui.');
        await loadData();
      } else {
        const body = await res.json();
        errorMessage = body.message || 'Gagal memperbarui kelas.';
      }
    } catch (err) {
      errorMessage = `Error Update: ${err.message}`;
    } finally {
      saving = false;
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`${apiUrl}/api/kelas/${currentKelas.id}`, {
        method: 'DELETE',
        headers: { 'X-Sekolah-ID': sekolahId.toString() },
        credentials: 'include'
      });
      if (res.ok) {
        showModalDelete = false;
        setTimeoutMessage('Kelas berhasil dihapus.');
        await loadData();
      } else {
        const body = await res.json();
        errorMessage = body.message || 'Gagal menghapus kelas.';
      }
    } catch (err) {
      errorMessage = `Error Delete: ${err.message}`;
    }
  }
</script>

<div class="master-container">
  <!-- Tombol Kembali -->
  <button class="btn-back" onclick={() => goto('/akademik')}>
    <Icon name="arrowLeft" size={16} /> Kembali ke Data Sekolah
  </button>

  <div class="header-action">
    <div>
      <h2 class="page-title">Manajemen Kelas</h2>
      <p class="page-subtitle">Daftar kelas untuk sekolah terpilih.</p>
    </div>
    <button class="btn-primary" onclick={openCreate}>
      <Icon name="plus" size={16} /> Tambah Kelas
    </button>
  </div>

  {#if errorMessage}
    <div class="alert-banner error">{errorMessage}</div>
  {/if}
  {#if successMessage}
    <div class="alert-banner success">{successMessage}</div>
  {/if}
  {#if loading}
    <div class="alert-banner">Memuat data dari backend...</div>
  {/if}

  <div class="table-wrapper">
    <table class="data-table">
      <thead>
        <tr>
          <th>Tingkat</th>
          <th>Level</th>
          <th>Nama Kelas</th>
          <th style="text-align: right;">Aksi</th>
        </tr>
      </thead>
      <tbody>
        {#each kelasData as k (k.id)}
          <tr>
            <td><span class="badge badge-tingkat">{k.tingkat}</span></td>
            <td>Lvl {k.tingkat_level}</td>
            <td class="font-medium">{k.nama_kelas}</td>
            <td style="text-align: right;">
              <div class="actions">
                <button class="btn-icon text-blue" onclick={() => openEdit(k)} title="Edit">
                  <Icon name="edit" size={16} /> Edit
                </button>
                <button class="btn-icon text-red" onclick={() => openDelete(k)} title="Hapus">
                  <Icon name="trash" size={16} /> Hapus
                </button>
              </div>
            </td>
          </tr>
        {/each}
        {#if kelasData.length === 0}
          <tr>
            <td colspan="3" class="text-center"
              >Belum ada data kelas terdaftar untuk sekolah ini.</td
            >
          </tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

<!-- ================= MODALS KELAS ================= -->
{#if showModalCreate || showModalEdit}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) {
        showModalCreate = false;
        showModalEdit = false;
      }
    }}
  >
    <div class="modal-content modal-sm">
      <div class="modal-header">
        <h3>{showModalCreate ? 'Tambah' : 'Edit'} Kelas</h3>
        <button
          class="btn-close"
          onclick={() => {
            showModalCreate = false;
            showModalEdit = false;
          }}
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label>Tingkat (Teks) *</label>
          <input
            type="text"
            class="form-input"
            bind:value={form.tingkat}
            required
            maxlength="10"
            placeholder="Cth: 10, 11, VII, TK A"
          />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label>Tingkat Level (Angka) *</label>
          <input
            type="number"
            class="form-input"
            bind:value={form.tingkat_level}
            required
            min="1"
            max="12"
            placeholder="Cth: 1 (Untuk TK A, Kelas 1, Kelas 7, Kelas 10)"
          />
        </div>
        <div class="form-group">
          <label>Nama Kelas *</label>
          <input
            type="text"
            class="form-input"
            bind:value={form.nama_kelas}
            required
            maxlength="50"
            placeholder="Cth: X IPA 1"
          />
        </div>
      </div>
      <div class="modal-footer">
        <button
          class="btn-secondary"
          onclick={() => {
            showModalCreate = false;
            showModalEdit = false;
          }}>Batal</button
        >
        <button
          class="btn-primary"
          disabled={saving}
          onclick={showModalCreate ? handleSave : handleUpdate}
        >
          {saving ? 'Menyimpan...' : showModalCreate ? 'Simpan' : 'Perbarui'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showModalDelete && currentKelas}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) showModalDelete = false;
    }}
  >
    <div class="modal-content modal-sm">
      <div class="modal-header">
        <h3>Konfirmasi Hapus</h3>
        <button class="btn-close" onclick={() => (showModalDelete = false)}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="modal-body">
        <p>Yakin ingin menghapus kelas <strong>{currentKelas.nama_kelas}</strong>?</p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => (showModalDelete = false)}>Batal</button>
        <button class="btn-danger" onclick={handleDelete}>Ya, Hapus</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .master-container {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    font-family: inherit;
  }
  .btn-back {
    background: none;
    border: none;
    color: #64748b;
    font-weight: 500;
    cursor: pointer;
    padding: 0;
    margin-bottom: 1.5rem;
    transition: color 0.2s;
  }
  .btn-back:hover {
    color: #1e293b;
  }

  .header-action {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }
  .page-title {
    margin: 0 0 0.25rem 0;
    color: #1e293b;
    font-size: 1.5rem;
  }
  .page-subtitle {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
  }

  .alert-banner {
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-weight: 500;
  }
  .alert-banner.error {
    background-color: #fee2e2;
    color: #b91c1c;
  }
  .alert-banner.success {
    background-color: #dcfce7;
    color: #15803d;
  }

  .table-wrapper {
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }
  .data-table th,
  .data-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }
  .data-table th {
    background-color: #f8fafc;
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
    text-transform: uppercase;
  }

  .font-medium {
    font-weight: 500;
  }
  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .badge-tingkat {
    background-color: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .btn-primary {
    background-color: #2563eb;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .btn-primary:hover {
    background-color: #1d4ed8;
  }
  .btn-secondary {
    background-color: #e2e8f0;
    color: #475569;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-secondary:hover {
    background-color: #cbd5e1;
  }
  .btn-danger {
    background-color: #ef4444;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-danger:hover {
    background-color: #dc2626;
  }
  .btn-icon {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-weight: 500;
  }
  .btn-icon:hover {
    background-color: #f1f5f9;
  }
  .text-blue {
    color: #3b82f6;
  }
  .text-red {
    color: #ef4444;
  }

  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(15, 23, 42, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }
  .modal-content {
    background: white;
    border-radius: 16px;
    width: 100%;
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }
  .modal-sm {
    max-width: 400px;
  }
  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-header h3 {
    margin: 0;
    color: #1e293b;
  }
  .btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 1.25rem;
  }
  .btn-close:hover {
    color: #334155;
  }
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }
  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
    margin-bottom: 0.5rem;
  }
  .form-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.95rem;
    box-sizing: border-box;
    background-color: white;
  }
  .form-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
  .text-center {
    text-align: center;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
