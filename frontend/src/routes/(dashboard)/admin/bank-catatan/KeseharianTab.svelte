<script>
  import { onMount } from 'svelte';
  import { toastStore } from '$lib/toast.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let catatanList = $state([]);
  let loading = $state(true);
  let error = $state('');

  let showModal = $state(false);
  let isEditing = $state(false);
  let editId = $state(null);
  let saving = $state(false);

  let formData = $state({
    predikat: 'Sangat Baik',
    teks_catatan: ''
  });

  const kriteriaOptions = [
    'Sangat Baik',
    'Baik',
    'Cukup',
    'Kurang'
  ];

  onMount(() => {
    loadData();
  });

  async function loadData() {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${apiUrl}/api/bank-catatan-keseharian`, {
        credentials: 'include'
      });
      if (res.ok) {
        catatanList = await res.json() || [];
      } else {
        const body = await res.json();
        throw new Error(body.error || 'Gagal memuat data bank catatan keseharian');
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function openCreateModal() {
    isEditing = false;
    editId = null;
    formData = {
      predikat: 'Sangat Baik',
      teks_catatan: ''
    };
    showModal = true;
  }

  function openEditModal(catatan) {
    isEditing = true;
    editId = catatan.id;
    formData = {
      predikat: catatan.predikat,
      teks_catatan: catatan.teks_catatan
    };
    showModal = true;
  }

  function closeModal() {
    showModal = false;
  }

  async function handleSubmit() {
    saving = true;
    try {
      const url = isEditing 
        ? `${apiUrl}/api/bank-catatan-keseharian/${editId}` 
        : `${apiUrl}/api/bank-catatan-keseharian`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal menyimpan bank catatan keseharian');
      }

      toastStore.show(isEditing ? 'Catatan berhasil diperbarui' : 'Catatan berhasil ditambahkan', 'success');
      closeModal();
      loadData();
    } catch (err) {
      toastStore.show(err.message, 'error');
    } finally {
      saving = false;
    }
  }

  async function deleteCatatan(id) {
    if (!confirm('Apakah Anda yakin ingin menghapus catatan ini?')) return;
    try {
      const res = await fetch(`${apiUrl}/api/bank-catatan-keseharian/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Gagal menghapus catatan keseharian');
      }
      toastStore.show('Catatan berhasil dihapus', 'success');
      loadData();
    } catch (err) {
      toastStore.show(err.message, 'error');
    }
  }
</script>

<div class="page-container">
  <div class="page-header">
    <div>
      <h1 class="page-title">Bank Catatan Keseharian</h1>
      <p class="page-subtitle">Kelola teks catatan otomatis berdasarkan predikat nilai keseharian.</p>
    </div>
    <button class="btn-primary" onclick={openCreateModal}>
      <Icon name="plus" size={18} /> Tambah Catatan
    </button>
  </div>

  {#if error}
    <div class="alert-error">{error}</div>
  {/if}

  {#if loading}
    <div class="loading-state">Memuat data...</div>
  {:else}
    <div class="card table-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 5%;">No</th>
              <th style="width: 25%;">Predikat (Keseharian)</th>
              <th style="width: 60%;">Teks Catatan</th>
              <th style="width: 10%;" class="text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#if catatanList.length === 0}
              <tr>
                <td colspan="4" class="text-center py-4">Belum ada data bank catatan.</td>
              </tr>
            {:else}
              {#each catatanList as c, i}
                <tr>
                  <td>{i + 1}</td>
                  <td><span class="badge badge-primary">{c.predikat}</span></td>
                  <td class="text-catatan">{c.teks_catatan}</td>
                  <td>
                    <div class="action-buttons justify-center">
                      <button class="btn-icon" title="Edit" onclick={() => openEditModal(c)}>
                        <Icon name="edit2" size={16} />
                      </button>
                      <button class="btn-icon text-error" title="Hapus" onclick={() => deleteCatatan(c.id)}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

{#if showModal}
  <div class="modal-backdrop" onclick={closeModal}>
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{isEditing ? 'Edit' : 'Tambah'} Catatan Keseharian</h2>
        <button class="close-btn" onclick={closeModal}>
          <Icon name="x" size={20} />
        </button>
      </div>

      <div class="modal-body">
        <form id="catatanForm" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

          <div class="form-group">
            <label for="predikat">Predikat Rata-Rata Keseharian</label>
            <select id="predikat" class="form-input" bind:value={formData.predikat}>
              {#each kriteriaOptions as option}
                <option value={option}>{option}</option>
              {/each}
            </select>
          </div>

          <div class="form-group">
            <label for="teks_catatan">Teks Catatan <span class="required">*</span></label>
            <textarea
              id="teks_catatan"
              class="form-input"
              bind:value={formData.teks_catatan}
              rows="4"
              placeholder="Masukkan teks catatan rapor yang akan digenerate"
              required
            ></textarea>
          </div>
        </form>
      </div>

      <div class="modal-footer">
        <button class="btn-outline" onclick={closeModal} type="button">Batal</button>
        <button class="btn-primary" type="submit" form="catatanForm" disabled={saving}>
          {#if saving}
            <span class="spinner-small"></span> Menyimpan...
          {:else}
            Simpan
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Styles sama seperti DiniyahTab */
  .page-container { padding: 1rem 0; width: 100%; }
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
  .page-title { font-size: 1.5rem; font-weight: 700; color: var(--color-text, #1e293b); margin: 0 0 0.5rem 0; }
  .page-subtitle { color: var(--color-text-muted, #64748b); margin: 0; }
  .card { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
  .table-responsive { overflow-x: auto; }
  .data-table { width: 100%; border-collapse: collapse; }
  .data-table th, .data-table td { padding: 1rem; border-bottom: 1px solid var(--color-border, #e2e8f0); text-align: left; }
  .data-table th { background: var(--color-surface-hover, #f8fafc); font-weight: 600; color: var(--color-text-muted, #64748b); font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .text-center { text-align: center !important; }
  .action-buttons { display: flex; gap: 0.5rem; }
  .justify-center { justify-content: center; }
  .btn-icon { background: none; border: none; padding: 0.5rem; border-radius: 6px; cursor: pointer; color: var(--color-text-muted, #64748b); transition: all 0.2s; display: flex; align-items: center; justify-content: center; }
  .btn-icon:hover { background: var(--color-surface-hover, #f1f5f9); color: var(--color-primary, #22c55e); }
  .text-error { color: var(--color-error, #ef4444); }
  .text-error:hover { color: var(--color-error, #ef4444); background: #fef2f2; }
  .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  .badge-primary { background: #dcfce7; color: #166534; }
  .text-catatan { font-size: 0.875rem; line-height: 1.5; color: var(--color-text, #334155); }
  .modal-backdrop { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .modal-content { background: white; width: 100%; max-width: 500px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; max-height: 90vh; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-border, #e2e8f0); }
  .modal-header h2 { margin: 0; font-size: 1.25rem; color: var(--color-text, #1e293b); }
  .close-btn { background: none; border: none; cursor: pointer; color: var(--color-text-muted, #64748b); padding: 0.25rem; border-radius: 4px; }
  .close-btn:hover { background: var(--color-surface-hover, #f1f5f9); }
  .modal-body { padding: 1.5rem; overflow-y: auto; }
  .modal-footer { padding: 1.25rem 1.5rem; border-top: 1px solid var(--color-border, #e2e8f0); display: flex; justify-content: flex-end; gap: 1rem; }
  .form-group { margin-bottom: 1.25rem; }
  .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--color-text, #1e293b); }
  .required { color: var(--color-error, #ef4444); }
  .form-input { width: 100%; padding: 0.625rem; border: 1px solid var(--color-border, #cbd5e1); border-radius: 6px; font-family: inherit; font-size: 0.875rem; }
  .form-input:focus { outline: none; border-color: var(--color-primary, #22c55e); box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2); }
  textarea.form-input { resize: vertical; }
  .btn-primary { background: var(--color-primary, #22c55e); color: white; border: none; padding: 0.625rem 1.25rem; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s; }
  .btn-primary:hover:not(:disabled) { background: var(--color-primary-hover, #16a34a); }
  .btn-primary:disabled { opacity: 0.7; cursor: not-allowed; }
  .btn-outline { background: white; color: var(--color-text, #334155); border: 1px solid var(--color-border, #cbd5e1); padding: 0.625rem 1.25rem; border-radius: 6px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
  .btn-outline:hover { background: var(--color-surface-hover, #f8fafc); }
  .alert-error { background: #fef2f2; color: #991b1b; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; border: 1px solid #fecaca; }
  .loading-state { text-align: center; color: var(--color-text-muted, #64748b); padding: 2rem; }
</style>
