<script>
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte.js';
  import Icon from '$lib/components/ui/Icon.svelte';
  
  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let kalenderList = $state([]);
  let loading = $state(true);
  let errorMsg = $state('');

  let showModal = $state(false);
  let formTanggal = $state('');
  let formKeterangan = $state('');
  let isSubmitting = $state(false);

  async function loadData() {
    loading = true;
    errorMsg = '';
    try {
      const res = await fetch(`${apiUrl}/api/presensi/kalender`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal memuat kalender libur');
      kalenderList = await res.json();
    } catch (err) {
      errorMsg = err.message;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadData();
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!formTanggal || !formKeterangan) {
      alert('Mohon lengkapi form');
      return;
    }

    isSubmitting = true;
    try {
      const res = await fetch(`${apiUrl}/api/presensi/kalender`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tanggal: formTanggal,
          keterangan: formKeterangan
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal menyimpan');
      }

      showModal = false;
      formTanggal = '';
      formKeterangan = '';
      loadData();
    } catch (err) {
      alert(err.message);
    } finally {
      isSubmitting = false;
    }
  }

  async function hapusLibur(id) {
    if (!confirm('Hapus tanggal libur ini?')) return;
    
    try {
      const res = await fetch(`${apiUrl}/api/presensi/kalender/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!res.ok) throw new Error('Gagal menghapus');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }
</script>

<div class="page-container">
  <div class="header">
    <div>
      <h1 class="page-title">Kalender Libur Nasional / Sekolah</h1>
      <p class="page-subtitle">Atur tanggal merah agar sistem presensi tidak mencatat Alpa pada hari libur.</p>
    </div>
    <button class="btn btn-primary" onclick={() => showModal = true}>
      <Icon name="plus" size={18} /> Tambah Hari Libur
    </button>
  </div>

  {#if errorMsg}
    <div class="alert alert-error">{errorMsg}</div>
  {/if}

  <div class="card">
    {#if loading}
      <div class="loading-state">Memuat kalender...</div>
    {:else if kalenderList.length === 0}
      <div class="empty-state">
        <Icon name="calendar" size={48} class="empty-icon" />
        <p>Belum ada hari libur yang ditambahkan.</p>
      </div>
    {:else}
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Keterangan / Nama Libur</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each kalenderList as item (item.id)}
              <tr>
                <td style="font-weight: 600; color: var(--color-error, #ef4444);">
                  {new Date(item.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </td>
                <td>{item.keterangan}</td>
                <td>
                  <button class="btn-icon btn-reject" onclick={() => hapusLibur(item.id)} title="Hapus">
                    <Icon name="trash" size={16} />
                  </button>
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
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="margin: 0;">Tambah Hari Libur</h3>
        <button class="btn-icon" style="background: none; border: none; cursor: pointer;" onclick={() => showModal = false}>
          <Icon name="x" size={20} />
        </button>
      </div>
      
      <form onsubmit={handleSubmit}>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label for="tanggal">Tanggal Merah</label>
          <input type="date" id="tanggal" class="form-input" bind:value={formTanggal} required />
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label for="keterangan">Keterangan / Nama Libur</label>
          <input type="text" id="keterangan" class="form-input" bind:value={formKeterangan} placeholder="Contoh: Idul Fitri 1448 H" required />
        </div>

        <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 1rem;">
          <button type="button" class="btn btn-outline" onclick={() => showModal = false}>Batal</button>
          <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .page-container { display: flex; flex-direction: column; gap: 1.5rem; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.25rem 0; }
  .page-subtitle { color: #64748b; margin: 0; }
  .card { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
  .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
  .form-group label { font-size: 0.875rem; font-weight: 500; color: #64748b; }
  .form-input { padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; }
  .table-wrapper { overflow-x: auto; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
  .data-table th, .data-table td { padding: 1rem; border-bottom: 1px solid #e2e8f0; text-align: left; }
  .data-table th { font-weight: 600; color: #64748b; background: #f8fafc; }
  .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 500; cursor: pointer; border: none; transition: all 0.2s; }
  .btn-primary { background: #22c55e; color: white; }
  .btn-primary:hover { background: #16a34a; }
  .btn-outline { background: transparent; border: 1px solid #e2e8f0; }
  .btn-icon { width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; border: none; border-radius: 8px; cursor: pointer; }
  .btn-reject { background: #fee2e2; color: #991b1b; }
  .btn-reject:hover { background: #fecaca; }
  .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal { width: 100%; max-width: 450px; background: white; }
  .alert { padding: 1rem; border-radius: 8px; font-size: 0.9rem; }
  .alert-error { background: #fef2f2; color: #b91c1c; border-left: 4px solid #ef4444; }
  .empty-state { text-align: center; padding: 3rem 1rem; color: #64748b; }
  .empty-icon { color: #cbd5e1; margin-bottom: 1rem; }
</style>
