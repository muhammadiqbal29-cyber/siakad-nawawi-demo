<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { goto } from '$app/navigation';
  import { toastStore } from '$lib/toast.svelte.js';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let kelasId = $derived($page.params.kelas_id);
  let kelasLabel = $derived($page.url.searchParams.get('kelas') || `Kelas #${kelasId}`);
  let rombel = $derived($page.url.searchParams.get('rombel') || '__kosong__');
  let rombelText = $derived(rombel === '__kosong__' ? 'Tanpa Rombel' : `Rombel ${rombel}`);
  let sekolahId = $derived($page.url.searchParams.get('sekolah_id') || '1');
  let paramTaId = $derived($page.url.searchParams.get('tahun_ajaran_id') || '');
  let paramSemId = $derived($page.url.searchParams.get('semester_id') || '');


  let loading = $state(false);
  let saving = $state(false);
  let error = $state('');

  // data = [{ siswa, mapel_nilai, rata_rata, catatan }]
  let siswaData = $state([]);
  let searchQuery = $state('');
  let filteredSiswa = $derived(
    siswaData.filter((s) => (s.nama || '').toLowerCase().includes(searchQuery.toLowerCase()))
  );
  let catatanMap = $state({});

  onMount(loadData);

  async function loadData() {
    loading = true;
    error = '';
    try {
      // 1. Ambil data rapor tahfiz v2 masal
      const params = new URLSearchParams({ rombel });
      if (paramTaId) params.set('tahun_ajaran_id', paramTaId);
      if (paramSemId) params.set('semester_id', paramSemId);
      const resRapor = await fetch(`${apiUrl}/api/guru/kelas/${kelasId}/tahfiz-v2-masal?${params.toString()}`, {
        credentials: 'include'
      });
      if (!resRapor.ok) throw new Error('Gagal memuat data rapor tahfiz v2');
      const raporData = await resRapor.json();

      // 2. Ambil catatan rapor yang sudah ada
      const paramsCatatan = new URLSearchParams({
        jenis_rapor: 'tahfiz_v2',
        sekolah_id: sekolahId,
        rombel
      });
      if (paramTaId) paramsCatatan.set('tahun_ajaran_id', paramTaId);
      if (paramSemId) paramsCatatan.set('semester_id', paramSemId);
      const resCatatan = await fetch(`${apiUrl}/api/guru/kelas/${kelasId}/catatan-rapor?${paramsCatatan.toString()}`, {
        credentials: 'include'
      });
      let existingCatatan = [];
      if (resCatatan.ok) {
        const body = await resCatatan.json();
        existingCatatan = body.catatan || [];
      }

      // Map catatan
      const map = {};
      existingCatatan.forEach(c => {
        map[c.siswa_id] = c.catatan;
      });
      catatanMap = map;

      // Process data siswa
      siswaData = (raporData || []).map(item => {
        const details = item.details || [];
        let sumKelancaran = 0, sumTajwid = 0, sumMakharij = 0;
        let count = 0;
        
        details.forEach(d => {
          sumKelancaran += (d.skor_kelancaran || 0);
          sumTajwid += (d.skor_tajwid || 0);
          sumMakharij += (d.skor_makharijul_huruf || 0);
          count++;
        });

        return {
          siswa_id: item.siswa.id,
          nama: item.siswa.nama_lengkap,
          nisn: item.siswa.nisn,
          avgKelancaran: count > 0 ? Math.round(sumKelancaran / count) : 0,
          avgTajwid: count > 0 ? Math.round(sumTajwid / count) : 0,
          avgMakharij: count > 0 ? Math.round(sumMakharij / count) : 0,
          catatan: map[item.siswa.id] || ''
        };
      }).sort((a, b) => a.nama.localeCompare(b.nama));

    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function scoreToPredicate(score) {
    const rounded = Math.round(score);
    if (rounded >= 5) return 'Mumtaz';
    if (rounded === 4) return 'Jayyid Jiddan';
    if (rounded === 3) return 'Jayyid';
    if (rounded === 2) return 'Maqbul';
    if (rounded <= 1) return "Dha'if";
    return 'Semua Kriteria';
  }

  async function generateAutoCatatan() {
    try {
      const res = await fetch(`${apiUrl}/api/guru/bank-catatan-tahfiz-v2?sekolah_id=${sekolahId}`, {
        credentials: 'include'
      });
      let bankRules = [];
      if (res.ok) {
        bankRules = await res.json() || [];
      } else {
        throw new Error('Gagal memuat bank catatan');
      }

      siswaData = siswaData.map(s => {
        const pKelancaran = scoreToPredicate(s.avgKelancaran);
        const pTajwid = scoreToPredicate(s.avgTajwid);
        const pMakharij = scoreToPredicate(s.avgMakharij);

        // Cari rule yang paling cocok (skor exact match > skor Semua Kriteria)
        let bestMatch = null;
        let bestScore = -1;

        for (const rule of bankRules) {
          let matchScore = 0;
          let isValid = true;

          // Cek Kelancaran
          if (rule.kelancaran === pKelancaran) matchScore += 1;
          else if (rule.kelancaran !== 'Semua Kriteria') isValid = false;

          // Cek Tajwid
          if (rule.tajwid === pTajwid) matchScore += 1;
          else if (rule.tajwid !== 'Semua Kriteria') isValid = false;

          // Cek Makharij
          if (rule.makharij === pMakharij) matchScore += 1;
          else if (rule.makharij !== 'Semua Kriteria') isValid = false;

          if (isValid && matchScore > bestScore) {
            bestScore = matchScore;
            bestMatch = rule;
          }
        }

        const newCatatan = bestMatch 
          ? bestMatch.teks_catatan 
          : 'Pencapaian dalam hafalan Al-Qur\'an cukup baik. Terus semangat dan jaga murajaahnya.';

        return { 
          ...s, 
          catatan: newCatatan 
        };
      });
      toastStore.show('Catatan otomatis berhasil di-generate', 'success');
    } catch (err) {
      toastStore.show(err.message, 'error');
    }
  }

  async function simpanSemua() {
    saving = true;
    try {
      const payload = {
        tahun_ajaran_id: parseInt(paramTaId) || 0,
        semester_id: parseInt(paramSemId) || 0,
        sekolah_id: Number(sekolahId),
        jenis_rapor: 'tahfiz_v2',
        data: siswaData.map(s => ({
          siswa_id: s.siswa_id,
          catatan: s.catatan || ''
        }))
      };

      const res = await fetch(`${apiUrl}/api/guru/catatan-rapor`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal menyimpan catatan masal');
      }

      toastStore.show('Catatan masal berhasil disimpan', 'success');
      setTimeout(() => {
        goto('/guru/rapor/ujian-tahfiz-v2');
      }, 1000);
    } catch (err) {
      toastStore.show(err.message, 'error');
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>Catatan Masal Tahfiz  - {kelasLabel}</title>
</svelte:head>

<div class="page-container">
  <div class="page-header-actions">
    <div>
      <button 
        class="back-link" 
        onclick={() => goto('/guru/rapor/ujian-tahfiz-v2')}
      >
        <Icon name="arrowLeft" size={16} /> Kembali
      </button>
      <h1 class="page-title">Catatan Masal Ujian Tahfiz </h1>
      <p class="page-subtitle">{kelasLabel} · {rombelText} · {siswaData.length} siswa</p>
    </div>
    
    <div class="action-buttons">
      <div class="search-bar">
        <Icon name="search" size={16} class="search-icon" />
        <input type="text" bind:value={searchQuery} placeholder="Cari nama siswa..." class="search-input" />
      </div>
      <button class="btn-action-secondary" onclick={generateAutoCatatan} disabled={loading || siswaData.length === 0}>
        <Icon name="zap" size={16} /> Generate Otomatis
      </button>
      <button class="btn-action-primary" onclick={simpanSemua} disabled={saving || loading || siswaData.length === 0}>
        <Icon name="save" size={16} /> {saving ? 'Menyimpan...' : 'Simpan Semua'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="alert-error">{error}</div>
  {/if}

  {#if loading}
    <div class="loading-state">Memuat data...</div>
  {:else if siswaData.length === 0}
    <div class="empty-state-feature">
      <Icon name="users" size={48} />
      <h3>Tidak Ada Siswa</h3>
      <p>Belum ada siswa atau data rapor di kelas ini.</p>
    </div>
  {:else}
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 5%;">No</th>
            <th style="width: 25%;">Nama Siswa</th>
            <th style="width: 70%;">Catatan Rapor</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredSiswa as siswa, index (siswa.siswa_id)}
            <tr>
              <td class="text-center">{index + 1}</td>
              <td>
                <div class="siswa-nama">{siswa.nama}</div>
                <div class="siswa-nisn">NISN: {siswa.nisn}</div>
              </td>
              <td>
                <textarea 
                  class="form-input" 
                  style="width: 100%; resize: vertical; min-height: 60px;" 
                  rows="2" 
                  placeholder="Ketik catatan di sini..."
                  bind:value={siswa.catatan}
                ></textarea>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
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
    align-items: flex-end;
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
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
  }

  .back-link:hover {
    color: var(--color-primary, #4f46e5);
  }

  .search-bar {
    display: inline-flex;
    align-items: center;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 0.5rem 0.85rem;
    gap: 0.5rem;
    width: 250px;
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
  
  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .btn-action-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    border: none;
    font-weight: 800;
    font-size: 0.9rem;
    font-family: inherit;
    cursor: pointer;
    background: var(--color-primary, #4f46e5);
    color: #fff;
    transition: all 0.2s;
  }
  
  .btn-action-primary:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
  
  .btn-action-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.25rem;
    border-radius: 8px;
    border: 1px solid var(--color-primary, #4f46e5);
    font-weight: 800;
    font-size: 0.9rem;
    font-family: inherit;
    cursor: pointer;
    background: #fff;
    color: var(--color-primary, #4f46e5);
    transition: all 0.2s;
  }
  
  .btn-action-secondary:disabled {
    border-color: #cbd5e1;
    color: #94a3b8;
    cursor: not-allowed;
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

  .table-container {
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow-x: auto;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  .data-table th,
  .data-table td {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .data-table th {
    background: #f8fafc;
    font-weight: 800;
    color: #475569;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .data-table tbody tr:hover {
    background: #f8fafc;
  }

  .siswa-nama {
    font-weight: 800;
    color: #1e293b;
    font-size: 0.95rem;
    margin-bottom: 0.2rem;
  }

  .siswa-nisn {
    font-size: 0.8rem;
    color: #64748b;
    font-weight: 600;
  }

  .text-center {
    text-align: center;
  }
  
  .badge {
    display: inline-block;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.85rem;
    font-weight: 800;
  }
  
  .badge-success {
    background-color: #dcfce7;
    color: #166534;
  }
  
  .badge-warning {
    background-color: #fef9c3;
    color: #854d0e;
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
    .page-header-actions {
      flex-direction: column;
      align-items: stretch;
    }
    
    .action-buttons {
      width: 100%;
      flex-direction: column;
    }
    
    .btn-action-primary, .btn-action-secondary {
      width: 100%;
      justify-content: center;
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

