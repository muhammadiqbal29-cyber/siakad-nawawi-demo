<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { toastStore } from '$lib/toast.svelte.js';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let kelasId = $derived($page.params.kelasId);
  let kelasLabel = $derived($page.url.searchParams.get('kelas') || `Kelas #${kelasId}`);
  let rombel = $derived($page.url.searchParams.get('rombel') || '__kosong__');
  let rombelText = $derived(rombel === '__kosong__' ? 'Tanpa Rombel' : `Rombel ${rombel}`);
  let sekolahId = $derived($page.url.searchParams.get('sekolah_id') || '1');
  let jenisPenilaian = $derived($page.url.searchParams.get('jenis_penilaian') || 'semester');
  let tahunAjaranId = $derived($page.url.searchParams.get('tahun_ajaran_id'));
  let semesterId = $derived($page.url.searchParams.get('semester_id'));

  let siswaList = $state([]);
  let loading = $state(false);
  let error = $state('');
  let searchQuery = $state('');
  let nilaiMap = $state({});
  let currentMapel = 'Ujian Tasmi';

  let filteredSiswa = $derived(
    searchQuery
      ? siswaList.filter((s) => s.nama.toLowerCase().includes(searchQuery.toLowerCase()))
      : siswaList
  );

  onMount(loadSiswa);

  async function loadSiswa() {
    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    if (typeof window !== 'undefined') {
      const cacheKey = `siakad_offline_tasmi_kelas_${kelasId}_${jenisPenilaian}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (data.siswaList && data.siswaList.length > 0) {
            siswaList = data.siswaList;
            nilaiMap = data.nilaiMap || {};
            loading = false;
          }
        } catch (e) {}
      }
    }

    if (siswaList.length === 0) {
      loading = true;
    }
    
    error = '';
    try {
      const params = new URLSearchParams({
        mata_pelajaran: 'Ujian Tasmi',
        jenis_penilaian: jenisPenilaian,
        rombel
      });
      if (tahunAjaranId) params.append('tahun_ajaran_id', tahunAjaranId);
      if (semesterId) params.append('semester_id', semesterId);
      const res = await fetch(`${apiUrl}/api/guru/kelas/${kelasId}/nilai?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal memuat data siswa.');
      }
      const body = await res.json();
      nilaiMap = body.nilai_map || {};
      siswaList = (body.siswa || []).map((s) => ({
        id: s.siswa_id,
        nama: s.nama_lengkap || '-',
        nisn: s.nisn || '-'
      }));
      
      if (typeof window !== 'undefined') {
        const cacheKey = `siakad_offline_tasmi_kelas_${kelasId}_${jenisPenilaian}`;
        localStorage.setItem(cacheKey, JSON.stringify({ siswaList, nilaiMap }));
      }
    } catch (err) {
      if (siswaList.length === 0) {
        error = err.message || 'Gagal memuat data siswa.';
      }
    } finally {
      loading = false;
    }
  }

</script>

<div class="page-container">
  <div class="page-header-actions">
    <div>
      <a class="back-link" href="/guru/input-nilai/tasmi">
        <Icon name="arrowLeft" size={16} /> Kembali
      </a>
      <h1 class="page-title">{kelasLabel}</h1>
      <p class="page-subtitle">{rombelText} · {siswaList.length} siswa</p>
    </div>
    <input
      type="text"
      placeholder="Cari siswa..."
      class="form-input search-input"
      bind:value={searchQuery}
    />
  </div>

  {#if error}
    <div class="alert-error">{error}</div>
  {/if}

  {#if loading}
    <div class="loading-state">Memuat data siswa...</div>
  {:else}
    <div class="student-list">
      {#each filteredSiswa as siswa (siswa.id)}
        {@const key = `${siswa.id}_${currentMapel}`}
        <div class="student-row">
          <div class="student-info-group">
            <div class="avatar-circle">{siswa.nama.charAt(0)}</div>
            <div class="student-text">
              <h3>{siswa.nama}</h3>
              <p>{kelasLabel} · {rombelText} · NISN {siswa.nisn}</p>
              
              {#if nilaiMap[`${siswa.id}_Ujian Tasmi`] && nilaiMap[`${siswa.id}_Ujian Tasmi`].tahap_v1?.length > 0}
                <div style="font-size: 0.75rem; color: #10b981; font-weight: 700; margin-top: 4px;">
                  ✓ Sudah dinilai (Tahap {nilaiMap[`${siswa.id}_Ujian Tasmi`].tahap_v1.join(', ')})
                </div>
              {:else}
                <div style="font-size: 0.75rem; color: #f59e0b; font-weight: 700; margin-top: 4px;">
                  ⚠️ Belum ada nilai Tasmi
                </div>
              {/if}
            </div>
          </div>
          <div style="flex: 1;"></div>
          <a
            class="btn-action-primary"
            href={`/guru/input-nilai-tasmi/${siswa.id}?kelas=${encodeURIComponent(`${kelasLabel} - ${rombelText}`)}&nama=${encodeURIComponent(siswa.nama)}&sekolah_id=${sekolahId}&kelas_id=${kelasId}&rombel=${encodeURIComponent(rombel)}&kelas_label=${encodeURIComponent(kelasLabel)}&jenis_penilaian=${encodeURIComponent(jenisPenilaian)}${tahunAjaranId ? `&tahun_ajaran_id=${tahunAjaranId}` : ''}${semesterId ? `&semester_id=${semesterId}` : ''}`}
          >
            <Icon name="edit" size={14} /> Input Nilai
          </a>
        </div>
      {/each}

      {#if filteredSiswa.length === 0}
        <div class="empty-state-feature">
          <Icon name="users" size={48} />
          <h3>Tidak Ada Siswa</h3>
          <p>Belum ada siswa aktif di {rombelText} ini.</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding-bottom: 2rem;
  }

  .page-header-actions {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.75rem;
    color: #475569;
    font-size: 0.85rem;
    font-weight: 800;
    text-decoration: none;
  }

  .back-link:hover {
    color: var(--color-primary, #4f46e5);
  }

  .page-title {
    margin: 0;
    font-size: 1.5rem;
    color: var(--color-text, #1e293b);
    font-weight: 800;
  }

  .page-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted, #64748b);
    font-weight: 700;
  }

  .form-input {
    background-color: var(--color-background, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    color: var(--color-text, #1e293b);
    font-size: 0.9rem;
    border-radius: 8px;
    padding: 0.55rem 0.9rem;
    outline: none;
    transition: all 0.2s;
    font-family: inherit;
  }

  .form-input:focus {
    border-color: var(--color-primary, #4f46e5);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .search-input {
    min-width: 260px;
  }

  .student-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .student-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    background-color: var(--color-surface, #fff);
    padding: 1rem 1.25rem;
    border-radius: 12px;
    border: 1px solid var(--color-border, #e2e8f0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  }

  .student-info-group {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-width: 0;
  }

  .avatar-circle {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: linear-gradient(135deg, #eff6ff, #dbeafe);
    color: var(--color-primary, #4f46e5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    font-weight: 800;
    border: 1px solid #bfdbfe;
    flex: 0 0 auto;
  }

  .student-text h3 {
    margin: 0 0 0.15rem 0;
    font-size: 1rem;
    font-weight: 800;
    color: var(--color-text, #1e293b);
  }

  .student-text p {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-muted, #64748b);
    font-weight: 600;
  }

  .btn-action-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.85rem;
    border-radius: 8px;
    border: none;
    font-weight: 800;
    font-size: 0.8rem;
    font-family: inherit;
    cursor: pointer;
    text-decoration: none;
    background: var(--color-primary, #4f46e5);
    color: #fff;
    flex: 0 0 auto;
  }

  .loading-state,
  .empty-state-feature {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 260px;
    text-align: center;
    color: #64748b;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 2rem;
    font-weight: 700;
  }

  .empty-state-feature h3 {
    margin: 1rem 0 0.35rem;
    color: #1e293b;
  }

  .empty-state-feature p {
    margin: 0;
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

  @media (max-width: 720px) {
    .page-header-actions,
    .student-row {
      flex-direction: column;
      align-items: stretch;
    }

    .search-input {
      min-width: 0;
      width: 100%;
    }
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
  }
</style>

