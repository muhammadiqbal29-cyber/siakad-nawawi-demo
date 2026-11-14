<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import '$lib/components/guru/AlquranMobileUI.css';
  import { auth } from '$lib/auth.svelte.js';
  import { guruState } from '$lib/guruState.svelte.js';
  import { toastStore } from '$lib/toast.svelte.js';
  import { syncManager } from '$lib/syncManager.svelte.js';
  import { modalStore } from '$lib/modal.svelte.js';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let kelasId = $derived($page.params.id);
  let sekolahIdUrl = $derived($page.url.searchParams.get('sekolah_id'));
  let sekolahId = $derived(sekolahIdUrl || guruState.activeSekolahId);
  let namaKelas = $derived($page.url.searchParams.get('kelas') || 'Kelas');
  let rombel = $derived($page.url.searchParams.get('rombel') || '');
  let displayKelasName = $derived(
    rombel && rombel !== '__kosong__' ? `${namaKelas} - Rombel ${rombel}` : namaKelas
  );
  let urlTahunId = $derived($page.url.searchParams.get('tahun_ajaran_id'));
  let urlSemesterId = $derived($page.url.searchParams.get('semester_id'));
  let activeTahun = $derived(urlTahunId || guruState.activeTahunId);
  let activeSemester = $derived(urlSemesterId || guruState.activeSemesterId);

  // ===== TAB STATE =====
  let activeTab = $state('keseharian');

  // ===== MOBILE ACCORDION STATE =====
  let expandedKeseharianSiswaId = $state(null);
  function toggleKeseharian(id) {
    expandedKeseharianSiswaId = expandedKeseharianSiswaId === id ? null : id;
  }

  $effect(() => {
    // Read the tab from URL when component mounts or URL changes
    const t = $page.url.searchParams.get('tab');
    if (t && (t === 'keseharian' || t === 'pelanggaran_iqob')) {
      // Only update if it is different, to avoid infinite loops
      if (activeTab !== t) {
        activeTab = t;
      }
    }
  });

  // ===== KESEHARIAN POIN STATE =====
  let indikatorList = $state([]);
  let selectedIndikator = $state('');
  let siswaData = $state([]);
  let searchQuery = $state('');
  let filteredSiswaData = $derived(
    siswaData.filter((s) =>
      (s.nama_lengkap || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );
  let rekapData = $state({});
  let loading = $state(false);
  let error = $state('');
  let saveStatus = $state('');

  // ===== PELANGGARAN STATE =====
  let jenisPelanggaranList = $state([]);
  let pelanggaranSiswaList = $state([]);
  let filteredPelanggaranSiswaList = $derived(
    pelanggaranSiswaList.filter((s) =>
      (s.nama_lengkap || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );
  let pelanggaranCatatanMap = $state({});
  let loadingPelanggaran = $state(false);
  let errorPelanggaran = $state('');

  // ===== IQOB STATE =====
  let jenisIqobList = $state([]);
  let iqobSiswaList = $state([]);
  let iqobCatatanMap = $state({});
  let loadingIqob = $state(false);
  let errorIqob = $state('');

  import { untrack } from 'svelte';

  $effect(() => {
    if (sekolahId) {
      untrack(() => loadIndikator());
    }
  });

  $effect(() => {
    if (sekolahId && kelasId && selectedIndikator) {
      untrack(() => fetchRekap());
    }
  });

  // ===== KESEHARIAN OFFLINE BRANKAS =====
  $effect(() => {
    if (typeof window !== 'undefined' && siswaData.length > 0 && selectedIndikator) {
       const cacheKey = `siakad_offline_keseharian_rekap_${kelasId}_${selectedIndikator}_${activeTahun}_${activeSemester}_${rombel}`;
       localStorage.setItem(cacheKey, JSON.stringify({ siswaData, rekapData }));
    }
  });
  
  $effect(() => {
    if (typeof window !== 'undefined' && pelanggaranSiswaList.length > 0) {
       const cacheKey = `siakad_offline_pelanggaran_kelas_${kelasId}_${activeTahun}_${activeSemester}_${rombel}`;
       localStorage.setItem(cacheKey, JSON.stringify({ pelanggaranSiswaList, pelanggaranCatatanMap }));
    }
  });
  
  $effect(() => {
    if (typeof window !== 'undefined' && iqobSiswaList.length > 0) {
       const cacheKey = `siakad_offline_iqob_kelas_${kelasId}_${activeTahun}_${activeSemester}_${rombel}`;
       localStorage.setItem(cacheKey, JSON.stringify({ iqobSiswaList, iqobCatatanMap }));
    }
  });

  // ===== KESEHARIAN FUNCTIONS =====
  async function loadIndikator() {
    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    if (typeof window !== 'undefined') {
       const cached = localStorage.getItem(`siakad_offline_keseharian_indikator_${sekolahId}`);
       if (cached) {
         try {
           indikatorList = JSON.parse(cached);
           if (indikatorList.length > 0 && !selectedIndikator) {
             selectedIndikator = indikatorList[0].id;
           }
         } catch(e) {}
       }
    }

    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${sekolahId}/keseharian/indikator`, {
        credentials: 'include'
      });
      if (res.ok) {
        const body = await res.json();
        indikatorList = body.data || [];
        if (typeof window !== 'undefined') {
           localStorage.setItem(`siakad_offline_keseharian_indikator_${sekolahId}`, JSON.stringify(indikatorList));
        }
        if (indikatorList.length > 0 && !selectedIndikator) {
          selectedIndikator = indikatorList[0].id;
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchRekap() {
    if (!kelasId || !selectedIndikator) return;

    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    if (typeof window !== 'undefined') {
       const cacheKey = `siakad_offline_keseharian_rekap_${kelasId}_${selectedIndikator}_${activeTahun}_${activeSemester}_${rombel}`;
       const cached = localStorage.getItem(cacheKey);
       if (cached) {
         try {
           const data = JSON.parse(cached);
           if (data.siswaData && data.siswaData.length > 0) {
             siswaData = data.siswaData;
             rekapData = data.rekapData || {};
             loading = false;
           }
         } catch(e) {}
       }
    }

    if (siswaData.length === 0) loading = true;
    error = '';
    saveStatus = '';

    try {
      const url = new URL(`${apiUrl}/api/guru/kelas/${kelasId}/keseharian/rekap`);
      url.searchParams.append('sekolah_id', sekolahId);
      url.searchParams.append('indikator_id', selectedIndikator);
      if (activeTahun) url.searchParams.append('tahun_ajaran_id', activeTahun);
      if (activeSemester) url.searchParams.append('semester_id', activeSemester);
      if (rombel && rombel !== '__kosong__') url.searchParams.append('rombel', rombel);
      else if (rombel === '__kosong__') url.searchParams.append('rombel', '__kosong__');

      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error('Gagal memuat rekap keseharian.');

      const body = await res.json();
      

      
      siswaData = body.data?.siswa || [];
      const rekaps = body.data?.rekap || [];

      const map = {};
      for (const r of rekaps) {
        map[r.siswa_id] = {
          id: r.id,
          total_sesi: r.total_sesi,
          hadir_sesi: r.hadir_sesi,
          poin_murni: r.poin_murni,
          poin_penyesuaian: r.poin_penyesuaian,
          poin_akhir: r.poin_akhir,
          saving: false
        };
      }
      rekapData = map;
    } catch (err) {
      if (siswaData.length === 0) {
        error = err.message;
      }
    } finally {
      loading = false;
    }
  }

  async function handleSavePoin(siswaId, newPoin) {
    const poinVal = Number(newPoin);
    if (isNaN(poinVal)) return;

    const r = rekapData[siswaId];
    if (r) r.saving = true;

    try {
      const payload = {
        siswa_id: siswaId,
        indikator_id: Number(selectedIndikator),
        poin_akhir: poinVal
      };

      syncManager.enqueue(`${apiUrl}/api/guru/sekolah/${sekolahId}/keseharian/poin`, payload, { method: 'POST' });

      // Optimistic update
      const currentMurni = r?.poin_murni || 0;
      rekapData[siswaId] = {
        ...(rekapData[siswaId] || {}),
        poin_akhir: poinVal,
        poin_penyesuaian: poinVal - currentMurni,
        saving: false
      };

      saveStatus = 'Tersimpan (Otomatis)';
      setTimeout(() => (saveStatus = ''), 2000);
    } catch (err) {
      toastStore.show(err.message, 'info');
    } finally {
      setTimeout(() => { if (rekapData[siswaId]) rekapData[siswaId].saving = false; }, 500);
    }
  }
  // ===== PELANGGARAN FUNCTIONS =====
  async function loadPelanggaranKelas() {
    if (!kelasId) return;
    
    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    if (typeof window !== 'undefined') {
       const cacheKey = `siakad_offline_pelanggaran_kelas_${kelasId}_${activeTahun}_${activeSemester}_${rombel}`;
       const cached = localStorage.getItem(cacheKey);
       if (cached) {
         try {
           const data = JSON.parse(cached);
           if (data.pelanggaranSiswaList && data.pelanggaranSiswaList.length > 0) {
             pelanggaranSiswaList = data.pelanggaranSiswaList;
             pelanggaranCatatanMap = data.pelanggaranCatatanMap || {};
             loadingPelanggaran = false;
           }
         } catch(e) {}
       }
    }

    if (pelanggaranSiswaList.length === 0) loadingPelanggaran = true;
    errorPelanggaran = '';

    try {
      const url = new URL(`${apiUrl}/api/guru/kelas/${kelasId}/pelanggaran`);
      url.searchParams.append('sekolah_id', sekolahId);
      if (activeTahun) url.searchParams.append('tahun_ajaran_id', activeTahun);
      if (activeSemester) url.searchParams.append('semester_id', activeSemester);
      if (rombel && rombel !== '__kosong__') url.searchParams.append('rombel', rombel);
      else if (rombel === '__kosong__') url.searchParams.append('rombel', '__kosong__');

      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error('Gagal memuat pelanggaran kelas');

      const body = await res.json();
      

      
      pelanggaranSiswaList = body.data?.siswa || [];
      pelanggaranCatatanMap = body.data?.catatan || {};
    } catch (err) {
      if (pelanggaranSiswaList.length === 0) {
        errorPelanggaran = err.message;
      }
    } finally {
      loadingPelanggaran = false;
    }
  }

  $effect(() => {
    if (activeTab === 'pelanggaran_iqob' && sekolahId && kelasId) {
      untrack(() => {
        loadPelanggaranKelas();
        loadIqobKelas();
      });
    }
  });

  // ===== IQOB FUNCTIONS =====
  async function loadIqobKelas() {
    if (!kelasId) return;
    
    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    if (typeof window !== 'undefined') {
       const cacheKey = `siakad_offline_iqob_kelas_${kelasId}_${activeTahun}_${activeSemester}_${rombel}`;
       const cached = localStorage.getItem(cacheKey);
       if (cached) {
         try {
           const data = JSON.parse(cached);
           if (data.iqobSiswaList && data.iqobSiswaList.length > 0) {
             iqobSiswaList = data.iqobSiswaList;
             iqobCatatanMap = data.iqobCatatanMap || {};
             loadingIqob = false;
           }
         } catch(e) {}
       }
    }
    
    if (iqobSiswaList.length === 0) loadingIqob = true;
    errorIqob = '';

    try {
      const url = new URL(`${apiUrl}/api/guru/kelas/${kelasId}/iqob`);
      url.searchParams.append('sekolah_id', sekolahId);
      if (activeTahun) url.searchParams.append('tahun_ajaran_id', activeTahun);
      if (activeSemester) url.searchParams.append('semester_id', activeSemester);
      if (rombel && rombel !== '__kosong__') url.searchParams.append('rombel', rombel);
      else if (rombel === '__kosong__') url.searchParams.append('rombel', '__kosong__');

      const res = await fetch(url.toString(), { credentials: 'include' });
      if (!res.ok) throw new Error('Gagal memuat iqob kelas');

      const body = await res.json();
      

      
      iqobSiswaList = body.data?.siswa || [];
      iqobCatatanMap = body.data?.catatan || {};
    } catch (err) {
      if (iqobSiswaList.length === 0) {
        errorIqob = err.message;
      }
    } finally {
      loadingIqob = false;
    }
  }

  function getTotalPoinPelanggaran(siswaId) {
    const list = pelanggaranCatatanMap[siswaId] || [];
    return list.reduce((acc, c) => acc + (c.poin || 0), 0);
  }

  function getTotalPoinIqob(siswaId) {
    const list = iqobCatatanMap[siswaId] || [];
    return list.reduce((acc, c) => acc + (c.poin || 0), 0);
  }

  function getPoinAkhir(siswaId) {
    return getTotalPoinPelanggaran(siswaId) - getTotalPoinIqob(siswaId);
  }
  function gotoPelanggaran(student) {
    const params = new URLSearchParams({
      sekolah_id: sekolahId,
      nama: student.nama_lengkap,
      kelas_label: displayKelasName
    });
    goto(`/guru/input-nilai/keseharian/kelas/${kelasId}/pelanggaran/${student.siswa_id}?${params.toString()}`);
  }
</script>

<svelte:head>
  <title>Input Keseharian - SIAKAD</title>
</svelte:head>

<main class="sheet-page">
  <div class="desktop-only">
    <div class="back-button-wrapper">
      <button type="button" class="back-button" onclick={() => goto('/guru/input-nilai/keseharian')}>
        <Icon name="arrowLeft" size={16} /> Kembali
      </button>
    </div>

    <section class="sheet-header">
      <div>
        <h1>
          {#if activeTab === 'keseharian'}
            Input Keseharian
          {:else}
            Pelanggaran & Iqob
          {/if}
        </h1>
        <p>Kelas {displayKelasName}</p>
      </div>
      <div class="meta-box">
        <span>Keseharian</span>
        <strong>{siswaData.length} Siswa</strong>
        <small>{saveStatus || (loading ? 'Memuat...' : 'Autosave aktif')}</small>
      </div>
    </section>
  </div>

  <!-- Mobile Header -->
  <div class="mobile-app-ui mobile-app-header mobile-only">
     <div class="app-header-top">
         <a class="back-btn" href={`/guru/input-nilai/keseharian`}>
             <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                 <path d="M8 2L3.5 6.5L8 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
             </svg>
             Kembali
         </a>
         <div class="page-title">
            {#if activeTab === 'keseharian'}
              Input Keseharian
            {:else}
              Pelanggaran & Iqob
            {/if}
         </div>
     </div>
     <div class="student-row">
         <div class="student-avatar" style="background: linear-gradient(135deg, #10b981, #047857);">{displayKelasName.charAt(0)}</div>
         <div class="student-sub"><b>Kelas {displayKelasName}</b></div>
     </div>
     <div class="stat-card">
         <div class="stat-item" style="flex: 1 1 100%; border-right: none; padding-bottom: 0;">
             <div class="stat-label">Pencarian</div>
             <input type="text" bind:value={searchQuery} placeholder="Cari nama siswa..." class="input" style="width: 100%; margin-top: 0.25rem; font-size: 0.85rem;" />
         </div>
         {#if activeTab === 'keseharian'}
         <div class="stat-item" style="flex: 1 1 100%;">
             <div class="stat-label">Indikator</div>
             <select class="input" bind:value={selectedIndikator} style="width: 100%; margin-top: 0.25rem; font-size: 0.85rem;">
                {#each indikatorList as ind}
                  <option value={ind.id}>{ind.nama}</option>
                {/each}
             </select>
         </div>
         {/if}
     </div>
  </div>

  <div class="toolbar desktop-only">
    <div class="toolbar-left">
      {#if activeTab === 'keseharian'}
        <label for="indikator" class="toolbar-label">Indikator:</label>
        <select id="indikator" class="select-filter" bind:value={selectedIndikator}>
          {#each indikatorList as ind}
            <option value={ind.id}>{ind.nama}</option>
          {/each}
        </select>
      {/if}
    </div>
    <div class="toolbar-right">
      <div class="search-bar">
        <Icon name="search" size={14} class="search-icon" />
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Cari nama siswa..."
          class="search-input"
        />
      </div>
    </div>
  </div>

  <!-- Tab Navigation Removed (Match Tahfiz behavior) -->

  <!-- ===== TAB: POIN KESEHARIAN ===== -->
  {#if activeTab === 'keseharian'}
    {#if loading}
      <div class="loading-state">Memuat data rekap...</div>
    {:else if error}
      <div class="alert alert-error">{error}</div>
    {:else if siswaData.length > 0}
      <div class="desktop-only">
        <div class="table-container">
          {#if saveStatus}
            <div class="toast-save">{saveStatus}</div>
          {/if}
          <table class="data-table">
            <thead>
              <tr>
                <th width="5%">No</th>
                <th width="35%">Nama Siswa</th>
                <th width="20%">Poin (Input Langsung)</th>
                <th width="15%">Nilai Akhir (Rapor)</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredSiswaData as s, i}
                {@const r = rekapData[s.siswa_id]}
                <tr>
                  <td>{i + 1}</td>
                  <td class="font-medium"
                    >{s.nama_lengkap}
                    <div class="text-sm text-gray-500">{s.nisn}</div>
                  </td>
                  <td>
                    <input
                      type="number"
                      class="input input-sm"
                      min="0"
                      max="100"
                      value={r ? r.poin_akhir : ''}
                      onchange={(e) => handleSavePoin(s.siswa_id, e.target.value)}
                      disabled={r?.saving}
                      placeholder="0 - 100"
                    />
                  </td>
                  <td>
                    {#if r}
                      <div class="final-score" class:saving={r.saving}>
                        {Number(r.poin_akhir).toFixed(0)}
                      </div>
                    {:else}
                      <span class="badge-gray">-</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="mobile-only mobile-student-list">
        {#if saveStatus}
          <div class="toast-save" style="margin-bottom:1rem;">{saveStatus}</div>
        {/if}
        {#each filteredSiswaData as s, i (s.siswa_id)}
          {@const r = rekapData[s.siswa_id]}
          {@const isExpanded = expandedKeseharianSiswaId === s.siswa_id}

          <div class="m-card" class:saving={r?.saving}>
            <div
              class="m-card-header"
              onclick={() => toggleKeseharian(s.siswa_id)}
              role="button"
              tabindex="0"
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  toggleKeseharian(s.siswa_id);
                  e.preventDefault();
                }
              }}
            >
              <div class="m-avatar">{s.nama_lengkap.charAt(0)}</div>
              <div class="m-info">
                <h3>{s.nama_lengkap}</h3>
                <p>NISN: {s.nisn}</p>
              </div>
              <div class="m-nr">
                <span class="m-nr-val"
                  >{r && r.poin_akhir !== null ? Number(r.poin_akhir).toFixed(0) : '-'}</span
                >
                <span class="m-nr-lbl">Poin</span>
              </div>
              <div class="m-chevron">
                <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size={20} color="#94a3b8" />
              </div>
            </div>

            {#if isExpanded}
              <div class="m-card-body">
                <div class="m-section">
                  <div class="m-sec-header">
                    <h4>Poin Keseharian</h4>
                  </div>
                  <div class="m-grid-inputs">
                    <div class="m-input-box">
                      <label>Input Poin</label>
                      <input
                        type="number"
                        class="input-cell"
                        min="0"
                        max="100"
                        value={r ? r.poin_akhir : ''}
                        onchange={(e) => handleSavePoin(s.siswa_id, e.target.value)}
                        disabled={r?.saving}
                        placeholder="0 - 100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {:else if selectedIndikator}
      <div class="empty-state">Tidak ada data siswa ditemukan untuk kombinasi ini.</div>
    {/if}
  {/if}

  {#if activeTab === 'pelanggaran_iqob'}
    <!-- TAB PELANGGARAN & IQOB (INDEX) -->
    <div class="card slide-up" style="margin-top: 1rem;">


      {#if errorPelanggaran || errorIqob}
        <div class="alert alert-error">{errorPelanggaran || errorIqob}</div>
      {/if}

      {#if loadingPelanggaran || loadingIqob}
        <div class="loading-state">Memuat data kelas...</div>
      {:else if pelanggaranSiswaList.length > 0}
        <div class="desktop-only">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th width="5%">No</th>
                  <th width="35%">Nama Siswa</th>
                  <th width="15%" style="text-align: center;">Poin Pelanggaran</th>
                  <th width="15%" style="text-align: center;">Poin Iqob</th>
                  <th width="15%" style="text-align: center;">Total Poin Akhir</th>
                  <th width="15%" style="text-align: center;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredPelanggaranSiswaList as s, i}
                  {@const plg = getTotalPoinPelanggaran(s.siswa_id)}
                  {@const iqob = getTotalPoinIqob(s.siswa_id)}
                  {@const akhir = getPoinAkhir(s.siswa_id)}
                  <tr>
                    <td>{i + 1}</td>
                    <td class="font-medium"
                      >{s.nama_lengkap}<br /><span style="font-size: 0.8em; color: #64748b;"
                        >{s.nisn}</span
                      ></td
                    >
                    <td style="text-align: center;">
                      {#if plg > 0}
                        <span class="badge-red" style="font-size: 1rem; padding: 4px 10px;"
                          >{plg}</span
                        >
                      {:else}
                        <span class="text-muted">0</span>
                      {/if}
                    </td>
                    <td style="text-align: center;">
                      {#if iqob > 0}
                        <span class="badge-green" style="font-size: 1rem; padding: 4px 10px;"
                          >-{iqob}</span
                        >
                      {:else}
                        <span class="text-muted">0</span>
                      {/if}
                    </td>
                    <td style="text-align: center; font-weight: bold;">
                      {#if akhir > 0}
                        <span style="color: #dc2626;">{akhir}</span>
                      {:else if akhir < 0}
                        <span style="color: #16a34a;">{akhir}</span>
                      {:else}
                        0
                      {/if}
                    </td>
                    <td style="text-align: center;">
                      <button
                        class="btn-primary"
                        style="padding: 0.4rem 0.8rem; font-size: 0.85rem;"
                        onclick={() => gotoPelanggaran(s)}
                      >
                        Detail & Input
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

        <div class="mobile-only mobile-student-list">
          {#each filteredPelanggaranSiswaList as s, i}
            {@const plg = getTotalPoinPelanggaran(s.siswa_id)}
            {@const iqob = getTotalPoinIqob(s.siswa_id)}
            {@const akhir = getPoinAkhir(s.siswa_id)}
            <div class="m-card">
              <div
                class="m-card-header"
                onclick={() => gotoPelanggaran(s)}
                role="button"
                tabindex="0"
                onkeydown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    gotoPelanggaran(s);
                    e.preventDefault();
                  }
                }}
              >
                <div class="m-avatar">{s.nama_lengkap.charAt(0)}</div>
                <div class="m-info">
                  <h3>{s.nama_lengkap}</h3>
                  <p>NISN: {s.nisn}</p>
                </div>
                <div class="m-nr">
                  <span class="m-nr-val">
                    {#if akhir > 0}
                      <span style="color: #dc2626;">{akhir}</span>
                    {:else if akhir < 0}
                      <span style="color: #16a34a;">{akhir}</span>
                    {:else}
                      <span style="color: #94a3b8;">0</span>
                    {/if}
                  </span>
                  <span class="m-nr-lbl">Total Akhir</span>
                </div>
                <div class="m-chevron">
                  <Icon name="chevronRight" size={20} color="#94a3b8" />
                </div>
              </div>
              <div class="m-card-body" style="padding-top: 0; padding-bottom: 1rem;">
                <div
                  style="display:flex; justify-content:space-around; align-items:center; background:#f8fafc; padding:0.75rem; border-radius:8px; border: 1px dashed #cbd5e1;"
                >
                  <div style="text-align:center;">
                    <div
                      style="font-size:0.7rem; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom: 0.25rem;"
                    >
                      Pelanggaran
                    </div>
                    {#if plg > 0}
                      <div style="color: #dc2626; font-weight: 800; font-size: 1.1rem;">{plg}</div>
                    {:else}
                      <div style="color: #94a3b8; font-weight: 700;">0</div>
                    {/if}
                  </div>
                  <div style="width: 1px; height: 2rem; background: #e2e8f0;"></div>
                  <div style="text-align:center;">
                    <div
                      style="font-size:0.7rem; font-weight:700; color:#64748b; text-transform:uppercase; margin-bottom: 0.25rem;"
                    >
                      Iqob
                    </div>
                    {#if iqob > 0}
                      <div style="color: #16a34a; font-weight: 800; font-size: 1.1rem;">
                        -{iqob}
                      </div>
                    {:else}
                      <div style="color: #94a3b8; font-weight: 700;">0</div>
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-state">Belum ada data siswa.</div>
      {/if}
    </div>
  {/if}
</main>


<style>
  .sheet-page {
    min-height: 100vh;
    padding: 24px;
    color: #111827;
    font-family: Arial, Helvetica, sans-serif;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    max-width: 1320px;
    width: 100%;
    margin: 0 auto 12px;
    box-sizing: border-box;
  }

  .back-button-wrapper {
    max-width: 1320px;
    width: 100%;
    margin: 0 auto;
    display: flex;
    justify-content: flex-start;
    box-sizing: border-box;
  }

  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 16px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #475569;
    padding: 8px 16px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
  }

  .back-button:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #0f172a;
  }

  .sheet-header h1 {
    margin: 0;
    font-size: 22px;
    line-height: 1.2;
  }

  .sheet-header p {
    margin: 4px 0 0;
    color: #4b5563;
    font-size: 13px;
  }

  .meta-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 160px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    padding: 12px 16px;
    text-align: right;
    font-size: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .meta-box span {
    color: #4b5563;
  }

  .meta-box small {
    color: #16a34a;
    font-size: 11px;
    font-weight: 700;
  }

  .search-bar {
    display: inline-flex;
    align-items: center;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 0.4rem 0.75rem;
    gap: 0.5rem;
  }
  .search-icon {
    color: #94a3b8;
  }
  .search-input {
    border: none;
    background: transparent;
    font-size: 0.9rem;
    font-family: inherit;
    color: #1e293b;
    width: 200px;
    outline: none;
  }

  /* --- Page Header (Match Diniyah) --- */
  .page-header {
    margin-bottom: 1.5rem;
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
    margin-bottom: 0.75rem;
    padding: 0;
  }
  .btn-back:hover {
    color: #4338ca;
  }
  .page-title {
    margin: 0 0 0.25rem 0;
    font-size: 1.5rem;
    color: #1e293b;
    font-weight: 800;
  }
  .page-subtitle {
    margin: 0;
    font-size: 0.9rem;
    color: #64748b;
  }

  /* --- Toolbar (Match Diniyah) --- */
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    padding: 1rem 1.25rem;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    max-width: 1320px;
    width: 100%;
    margin: 0 auto 1.5rem auto;
    box-sizing: border-box;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    gap: 1rem;
    flex-wrap: wrap;
  }
  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .toolbar-label {
    font-weight: 700;
    font-size: 0.9rem;
    color: #334155;
    white-space: nowrap;
  }
  .select-filter {
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.9rem;
    color: #0f172a;
    background: #fff;
    outline: none;
    transition: all 0.2s;
    min-width: 200px;
    max-width: 100%;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  .select-filter:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .history-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .history-info {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .history-date {
    font-size: 0.85rem;
    color: #64748b;
    min-width: 80px;
  }
  .text-red {
    color: #ef4444 !important;
  }

  .page-container {
    padding: 24px;
    max-width: 1320px;
    margin: 0 auto;
    min-height: 100vh;
    background: transparent; /* Match body */
  }
  @media (max-width: 768px) {
    .page-container {
      padding: 12px;
    }
  }
  .header-action {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }
  .header-action h2 {
    margin: 0;
    color: #1e293b;
    font-size: 1.5rem;
  }
  .subtitle {
    margin: 0.25rem 0 0;
    color: #64748b;
    font-size: 0.9rem;
  }

  .tabs-header {
    display: flex;
    gap: 0.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
  }
  .tabs-header::-webkit-scrollbar {
    display: none;
  }
  .tab-btn {
    padding: 0.6rem 1.25rem;
    font-size: 0.9rem;
    font-weight: 600;
    border: none;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    border-radius: 9999px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .tab-btn.active {
    color: #059669;
    background: #ecfdf5;
    border-color: #10b981;
  }

  .filter-card {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    display: flex;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  .form-group {
    flex: 1;
    max-width: 300px;
  }
  .form-group label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 0.5rem;
  }
  .input {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #f8fafc;
    font-family: inherit;
    font-size: 0.9rem;
    color: #1e293b;
  }
  .input:focus {
    outline: none;
    border-color: #6366f1;
    background: white;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
  }
  .input-sm {
    padding: 0.4rem 0.5rem;
    font-size: 0.85rem;
    border-radius: 6px;
  }

  .table-container {
    background: white;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    overflow: hidden;
    position: relative;
    max-width: 1320px;
    width: 100%;
    margin: 0 auto;
    box-sizing: border-box;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }
  .data-table th {
    background: #f8fafc;
    text-align: left;
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
    border-bottom: 1px solid #e2e8f0;
  }
  .data-table td {
    padding: 0.75rem 1rem;
    font-size: 0.9rem;
    color: #1e293b;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }

  .font-medium {
    font-weight: 500;
  }
  .text-sm {
    font-size: 0.8rem;
  }
  .text-gray-500 {
    color: #64748b;
  }
  .text-muted {
    color: #94a3b8;
    font-style: italic;
    font-size: 0.85rem;
  }

  .badge-gray {
    background: #f1f5f9;
    color: #94a3b8;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  .badge-red {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 700;
  }
  .badge-green {
    background: #f0fdf4;
    color: #16a34a;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .final-score {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: #10b981;
    color: white;
    font-weight: 700;
    border-radius: 50%;
    font-size: 0.9rem;
    transition: opacity 0.2s;
  }
  .final-score.saving {
    opacity: 0.5;
  }

  .toast-save {
    position: absolute;
    top: -40px;
    right: 0;
    background: #10b981;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    animation:
      fadein 0.3s,
      fadeout 0.3s 1.7s;
  }

  @keyframes fadein {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @keyframes fadeout {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    background: white;
    border: 1px solid #e2e8f0;
    color: #475569;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-back:hover {
    background: #f8fafc;
    color: #1e293b;
    border-color: #cbd5e1;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .materi-count {
    font-size: 0.9rem;
    color: #64748b;
  }
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 1.2rem;
    border: none;
    border-radius: 8px;
    background: #4f46e5;
    color: white;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-primary:hover:not(:disabled) {
    background: #4338ca;
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.6rem 1.2rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: white;
    color: #475569;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-secondary:hover {
    background: #f8fafc;
  }

  .form-card {
    background: white;
    padding: 1.5rem;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    margin-bottom: 1.5rem;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .form-grid-plg {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  .form-grid-plg .form-group {
    max-width: none;
  }
  .form-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .alert-error {
    background: #fef2f2;
    color: #dc2626;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid #fecaca;
    font-size: 0.9rem;
  }

  .catatan-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .catatan-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    background: #fef2f2;
    padding: 0.3rem 0.5rem;
    border-radius: 4px;
  }
  .catatan-date {
    color: #64748b;
    font-size: 0.75rem;
    min-width: 70px;
  }
  .catatan-poin {
    color: #dc2626;
    font-weight: 700;
    min-width: 30px;
  }
  .catatan-iqob {
    color: #475569;
    flex: 1;
  }

  .btn-icon-mini {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    background: transparent;
    color: #dc2626;
    cursor: pointer;
    border-radius: 4px;
    opacity: 0.6;
    transition: all 0.15s;
  }
  .btn-icon-mini:hover {
    opacity: 1;
    background: #fecaca;
  }

  .loading-state,
  .empty-state {
    padding: 3rem;
    text-align: center;
    color: #64748b;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    background: #f8fafc;
  }

  .mobile-only {
    display: none;
  }
  .desktop-only {
    display: block;
  }

  @media (max-width: 768px) {
    .mobile-only {
      display: block;
    }
    .desktop-only {
      display: none;
    }

    .toolbar {
      flex-direction: column;
      align-items: stretch;
      border: none;
      padding: 0;
      background: transparent;
      box-shadow: none;
    }
    .toolbar-left,
    .toolbar-right {
      width: 100%;
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }
    .select-filter {
      width: 100%;
      max-width: 100%;
    }
    .search-bar {
      width: 100%;
      background: #fff;
    }
    .search-input {
      width: 100%;
    }

    /* .m-card CSS (Copied from Diniyah) */
    .mobile-student-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding-top: 0.5rem;
    }

    .m-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1.25rem;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      transition: opacity 0.2s;
    }
    .m-card.saving {
      opacity: 0.6;
    }

    .m-card-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid #f1f5f9;
      background: #f8fafc;
      cursor: pointer;
      user-select: none;
    }

    .m-chevron {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: -0.25rem;
    }

    .m-avatar {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(155deg, #12a150, #0b7c3d);
      color: white;
      font-weight: 800;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .m-info {
      flex: 1;
      min-width: 0;
    }
    .m-info h3 {
      margin: 0 0 0.2rem 0;
      font-size: 1rem;
      font-weight: 800;
      color: #1e293b;
      line-height: 1.3;
      word-break: break-word;
    }
    .m-info p {
      margin: 0;
      font-size: 0.8rem;
      color: #64748b;
    }

    .m-nr {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .m-nr-val {
      font-size: 1.25rem;
      font-weight: 800;
      color: #0b7c3d;
    }
    .m-nr-lbl {
      font-size: 0.65rem;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .m-card-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .m-section {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.85rem;
      padding: 1rem;
    }

    .m-sec-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px dashed #cbd5e1;
    }
    .m-sec-header h4 {
      margin: 0;
      font-size: 0.85rem;
      color: #334155;
      font-weight: 700;
    }

    .m-grid-inputs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .m-input-box {
      flex: 1;
      min-width: 60px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
    }
    .m-input-box label {
      font-size: 0.7rem;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
    }
    .m-input-box .input-cell {
      width: 100%;
      max-width: none;
      height: 38px;
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      text-align: center;
    }
    .m-input-box .input-cell:focus {
      outline: none;
      border-color: #12a150;
      box-shadow: 0 0 0 3px rgba(18, 161, 80, 0.15);
    }
  }
</style>
