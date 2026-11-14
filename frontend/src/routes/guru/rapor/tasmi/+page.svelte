<script>
  import Icon from '$lib/components/ui/Icon.svelte';
  import { guruState } from '$lib/guruState.svelte.js';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  
        
  let kelasList = $state([]);
  let selectedKelas = $state(null);
  let siswaList = $state([]);
  let riwayatTasmiMap = $state({});
  let searchQuery = $state('');
  let filteredSiswa = $derived(
    siswaList.filter((s) => (s.nama_lengkap || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );
  let loadingKelas = $state(false);
  let loadingSiswa = $state(false);
  let error = $state('');

  $effect(() => {
    // Read values synchronously for Svelte 5 reactivity tracking
    const sekolahId = guruState.activeSekolahId;
    const taId = guruState.activeTahunId;
    const semId = guruState.activeSemesterId;
    if (sekolahId && taId && semId) {
      loadKelas().then(() => {
        if (typeof window !== 'undefined') {
          const saved = sessionStorage.getItem('rapor_tasmi_kelas');
          if (saved) {
            try {
              const k = JSON.parse(saved);
              if (k) pilihKelas(k);
            } catch (e) {
              console.error('Gagal restore:', e);
            }
          }
        }
      });
    }
  });

  
  

  async function loadKelas() {
    if (!guruState.activeSekolahId) return;
    loadingKelas = true;
    try {
      let url = `${apiUrl}/api/guru/sekolah/${guruState.activeSekolahId}/kelas`;
    if (guruState.activeTahunId) url += `?tahun_ajaran_id=${guruState.activeTahunId}`;
    if (guruState.activeSemesterId) url += `&semester_id=${guruState.activeSemesterId}`;
    const res = await fetch(url, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal memuat data kelas.');
      kelasList = await res.json();
    } catch (err) {
      error = err.message;
    } finally {
      loadingKelas = false;
    }
  }

  async function pilihKelas(kelas) {
    selectedKelas = kelas;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('rapor_tasmi_kelas', JSON.stringify(kelas));
    }
    loadingSiswa = true;
    try {
      const params = new URLSearchParams({ rombel: kelas.rombel || '__kosong__' });
      if (guruState.activeTahunId) params.set('tahun_ajaran_id', guruState.activeTahunId);
      if (guruState.activeSemesterId) params.set('semester_id', guruState.activeSemesterId);
      const res = await fetch(`${apiUrl}/api/guru/kelas/${kelas.id}/siswa?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal memuat daftar siswa.');
      const data = await res.json();
      siswaList = data.data || data || [];

      // Fetch riwayat tasmi
      const resRekap = await fetch(`${apiUrl}/api/guru/kelas/${kelas.id}/rekap-tasmi?rombel=${kelas.rombel || '__kosong__'}&sekolah_id=${guruState.activeSekolahId}`, {
        credentials: 'include'
      });
      if (resRekap.ok) {
        const rekapData = await resRekap.json();
        const rekapList = rekapData.rekap || [];
        const map = {};
        for (const r of rekapList) {
          if (!map[r.siswa_id] || r.id > map[r.siswa_id].id) {
             map[r.siswa_id] = r;
          }
        }
        riwayatTasmiMap = map;
      }
    } catch (err) {
      error = err.message;
    } finally {
      loadingSiswa = false;
    }
  }

  function resetKelas() {
    selectedKelas = null;
    siswaList = [];
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('rapor_tasmi_kelas');
    }
  }

  function kelasLabel(kelas) {
    return `${kelas.tingkat || ''} - ${kelas.nama_kelas || ''}`.trim();
  }
  function rombelLabel(rombel) {
    return !rombel || rombel === '__kosong__' ? 'Tanpa Rombel' : `Rombel ${rombel}`;
  }
</script>

<svelte:head>
  <title>Rapor Ujian Tasmi' - SIAKAD</title>
</svelte:head>

<div class="page-container">
  <div class="page-header">
    <div>
      <p class="eyebrow">Rapor</p>
      <h1>Rapor Ujian Tasmi'</h1>
      <p class="subtitle">Pilih kelas lalu pilih siswa untuk melihat rapor ujian tasmi'.</p>
    </div>
  </div>

  
  

  {#if error}
    <div class="alert-error">{error}</div>
  {/if}

  {#if !guruState.activeSekolahId}
    <div class="empty-state">
      <Icon name="grid" size={48} />
      <h3>Pilih Jenjang Sekolah</h3>
      <p>Silakan klik tombol Pilih Jenjang terlebih dahulu.</p>
    </div>
  {:else if !selectedKelas}
    <!-- Pilih Kelas -->
    {#if loadingKelas}
      <div class="loading-box">Memuat kelas...</div>
    {:else if kelasList.length === 0}
      <div class="empty-state">
        <Icon name="info" size={48} />
        <h3>Belum ada kelas</h3>
      </div>
    {:else}
      <div class="kelas-grid">
        {#each kelasList as kelas (kelas.id + kelas.rombel)}
          <button class="kelas-card" onclick={() => pilihKelas(kelas)}>
            <div class="kelas-icon"><Icon name="book" size={20} /></div>
            <div class="kelas-card-text">
              <span class="kelas-name">{kelasLabel(kelas)}</span>
              <span class="kelas-rombel">{rombelLabel(kelas.rombel)}</span>
              <span class="kelas-count">{kelas.jumlah_siswa || 0} siswa</span>
            </div>
            <Icon name="chevronRight" size={18} />
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <!-- Pilih Siswa -->
    <div class="selected-header">
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <button class="btn-back" onclick={resetKelas}>
          <Icon name="chevronLeft" size={16} /> Ganti Kelas
        </button>
        <div class="selected-kelas">
          <Icon name="book" size={16} />
          <strong>{kelasLabel(selectedKelas)}</strong>
          <span class="badge">{rombelLabel(selectedKelas.rombel)}</span>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <a
          href={`/guru/rapor/tasmi/kelas/${selectedKelas.id}/catatan-masal?rombel=${selectedKelas.rombel || '__kosong__'}&sekolah_id=${guruState.activeSekolahId}&tahun_ajaran_id=${guruState.activeTahunId}&semester_id=${guruState.activeSemesterId}&kelas=${encodeURIComponent(kelasLabel(selectedKelas))}`}
          class="btn-catatan-masal"
        >
          <Icon name="edit" size={16} /> Isi Catatan Masal
        </a>
      </div>
    </div>
    
    <div class="search-container" style="margin-bottom: 1.5rem;">
      <div class="search-bar">
        <Icon name="search" size={16} class="search-icon" />
        <input type="text" bind:value={searchQuery} placeholder="Cari nama siswa..." class="search-input" />
      </div>
    </div>

    {#if loadingSiswa}
      <div class="loading-box">Memuat siswa...</div>
    {:else if siswaList.length === 0}
      <div class="empty-state">
        <Icon name="users" size={48} />
        <h3>Belum ada siswa</h3>
      </div>
    {:else}
      <div class="siswa-grid">
        {#each filteredSiswa as siswa (siswa.id)}
          <a
            class="siswa-card"
            href={`/guru/rapor/tasmi/${siswa.id}?sekolah_id=${guruState.activeSekolahId}&tahun_ajaran_id=${guruState.activeTahunId}&semester_id=${guruState.activeSemesterId}&nama=${encodeURIComponent(siswa.nama_lengkap)}&nisn=${encodeURIComponent(siswa.nisn)}&kelas=${encodeURIComponent(kelasLabel(selectedKelas) + ' - ' + rombelLabel(selectedKelas.rombel))}&selectedKelasId=${selectedKelas.id}`}
          >
            <div class="siswa-info">
              <span class="siswa-nama">{siswa.nama_lengkap}</span>
              <span class="siswa-nisn">NISN: {siswa.nisn}</span>
            </div>
            <Icon name="chevronRight" size={16} />
          </a>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .page-container {
    max-width: 1100px;
  }
  .page-header {
    margin-bottom: 2rem;
  }

  .eyebrow {
    margin: 0 0 0.5rem;
    color: #d97706;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 0.75rem;
  }

  .page-header h1 {
    margin: 0;
    font-size: 2rem;
    color: #0f172a;
  }
  .subtitle {
    margin: 0.5rem 0 0;
    color: #475569;
    line-height: 1.6;
  }

  .kelas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
  }

  .kelas-card {
    display: grid;
    grid-template-columns: 40px 1fr 18px;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: all 0.2s;
    color: inherit;
    font-size: 1rem;
  }
  .kelas-card:hover {
    border-color: #fbbf24;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.1);
  }

  .kelas-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fef3c7;
    color: #d97706;
  }

  .kelas-card-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .kelas-name {
    font-weight: 800;
    color: #1e293b;
    font-size: 0.95rem;
  }
  .kelas-rombel {
    color: #d97706;
    font-weight: 700;
    font-size: 0.85rem;
  }
  .kelas-count {
    font-size: 0.8rem;
    color: #64748b;
    font-weight: 600;
  }

  .search-bar {
    display: inline-flex;
    align-items: center;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 0.5rem 0.85rem;
    gap: 0.5rem;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .search-icon {
    color: #94a3b8;
  }
  .search-input {
    border: none;
    background: transparent;
    font-size: 0.95rem;
    font-family: inherit;
    color: #1e293b;
    width: 100%;
    outline: none;
  }

  .selected-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    background: white;
    padding: 1rem 1.2rem;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }
  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: none;
    border: none;
    color: #6366f1;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
    font-family: inherit;
    padding: 0;
  }
  .btn-back:hover {
    color: #4338ca;
  }
  .btn-catatan-masal {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background: #10b981;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.9rem;
    text-decoration: none;
    transition: all 0.2s;
  }
  .btn-catatan-masal:hover {
    background: #059669;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);
  }
  .selected-kelas {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.95rem;
    color: #334155;
  }
  .badge {
    display: inline-block;
    padding: 0.15rem 0.6rem;
    border-radius: 6px;
    background: #fef3c7;
    color: #92400e;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .siswa-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .siswa-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.85rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s;
  }
  .siswa-card:hover {
    border-color: #fbbf24;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.1);
  }
  .siswa-info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .siswa-nama {
    font-weight: 700;
    color: #1e293b;
  }
  .siswa-nisn {
    font-size: 0.82rem;
    color: #64748b;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4rem 2rem;
    gap: 1rem;
    color: #64748b;
    background: #fff;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
  }
  .empty-state h3 {
    margin: 0;
    color: #0f172a;
  }

  .loading-box {
    padding: 2rem;
    text-align: center;
    color: #64748b;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    background: #f8fafc;
  }

  .alert-error {
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 700;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .siswa-badge-container {
    margin-left: auto;
  }
  .badge-riwayat {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
  }
  .badge-riwayat.success {
    background: #dcfce7;
    color: #166534;
  }
  .badge-riwayat.neutral {
    background: #f1f5f9;
    color: #64748b;
  }

  
  
  
  


  /* --- Mobile Card Layout Injected --- */
  @media (max-width: 768px) {
    .table-container {
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
      padding: 0 !important;
    }
    .data-table, .data-table tbody, .data-table tr, .data-table td {
      display: block;
      width: 100%;
    }
    .data-table thead {
      display: none;
    }
    .data-table tr {
      margin-bottom: 1.25rem;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }
    .data-table td {
      padding: 1rem;
      border-bottom: 1px solid #f1f5f9;
      text-align: left !important;
    }
    .data-table td:last-child {
      border-bottom: none;
      background-color: #f8fafc;
    }
    .siswa-nama {
      font-size: 1.1rem;
      color: #0f172a;
    }
    .page-header-actions {
      flex-direction: column;
      align-items: stretch;
    }
    .action-buttons {
      width: 100%;
      flex-direction: column;
      margin-top: 1rem;
    }
    .btn-action-primary, .btn-action-secondary {
      width: 100%;
      justify-content: center;
    }
    .search-bar {
      width: 100%;
    }
    textarea, input[type="number"], .form-input {
      width: 100% !important;
      min-width: 0 !important;
    }
    .student-row {
      flex-direction: column;
      align-items: stretch;
    }
    .student-info-group {
      margin-bottom: 0.5rem;
    }
    
    .selected-header {
      flex-direction: column;
      align-items: stretch !important;
      gap: 1rem;
      padding: 1rem !important;
    }
    .selected-header > div {
      flex-direction: column;
      align-items: stretch !important;
      gap: 0.75rem !important;
      width: 100%;
    }
    .selected-kelas {
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn-back, .btn-catatan-masal, .btn-print-masal {
      width: 100%;
      justify-content: center;
    }
  }
</style>

