<script>
  import { page } from '$app/stores';
  import { onMount, tick } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { goto } from '$app/navigation';
  import { guruState } from '$lib/guruState.svelte.js';
  import { syncManager } from '$lib/syncManager.svelte.js';
  import MapelCard from '$lib/components/diniyah/MapelCard.svelte';
  import KonfirmasiMapelModal from '$lib/components/diniyah/KonfirmasiMapelModal.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  // URL params
  let kelasId = $derived($page.params.id);
  let kelasLabel = $derived($page.url.searchParams.get('kelas') || '');
  let rombelParam = $derived($page.url.searchParams.get('rombel') || '__kosong__');
  let sekolahId = $derived($page.url.searchParams.get('sekolah_id') || '');
  let urlTahunId = $derived($page.url.searchParams.get('tahun_ajaran_id'));
  let urlSemesterId = $derived($page.url.searchParams.get('semester_id'));
  let activeTahun = $derived(urlTahunId || guruState.activeTahunId);
  let activeSemester = $derived(urlSemesterId || guruState.activeSemesterId);

  // State
  let mapelList = $state([]);
  let selectedMapel = $state(null);
  let siswaList = $state([]);
  let searchQuery = $state('');
  let filteredSiswa = $derived(
    siswaList.filter((s) =>
      (s.nama_lengkap || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );
  let nilaiMap = $state({});
  let loadingMapel = $state(false);
  let loadingNilai = $state(false);
  let error = $state('');
  let savingCell = $state('');
  let uhColumnCount = $state(4);
  let expandedSiswaId = $state(null);
  const KKM = 65;

  // State untuk klaim & modal
  let currentGuruId = $state(null);   // ID guru yang sedang login
  let isReadOnly = $state(false);     // Apakah guru hanya bisa melihat
  let currentGuruNama = $state('');   // Nama guru yang sedang login
  let showGrid = $state(true);        // true = tampilkan grid mapel, false = tampilkan tabel input
  let showKonfirmasi = $state(false); // true = tampilkan modal konfirmasi
  let mapelYangDipilih = $state(null); // mapel yang sedang menunggu konfirmasi

  // Filter mapel: hanya milikku atau semua
  let filterMilikku = $state(
    typeof window !== 'undefined'
      ? localStorage.getItem('siakad_diniyah_filter_milikku') === 'true'
      : false
  );
  let filteredMapel = $derived(
    filterMilikku && currentGuruId
      ? mapelList.filter((m) => m.guru_pengampu_id === currentGuruId)
      : mapelList
  );
  $effect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('siakad_diniyah_filter_milikku', String(filterMilikku));
    }
  });

  // Fetch profil guru untuk mendapatkan ID dan nama guru yang sedang login
  onMount(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/guru/me/profil`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        currentGuruId = data.id ?? null;
        currentGuruNama = data.nama_lengkap ?? '';
      }
    } catch (e) {
      // Abaikan error profil, fitur klaim hanya tidak bisa digunakan
    }
  });

  // OFFLINE-FIRST: Brankas Dinamis
  $effect(() => {
    if (typeof window !== 'undefined' && siswaList.length > 0 && selectedMapel) {
      const cacheKey = `siakad_offline_diniyah_data_${kelasId}_${selectedMapel.id}_${activeTahun}_${activeSemester}_${rombelParam}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        siswaList,
        nilaiMap
      }));
    }
  });

  import { untrack } from 'svelte';
  $effect(() => {
    if (activeTahun && activeSemester && rombelParam) {
      untrack(() => {
        if (mapelList.length === 0) {
          loadMapel();
        } else {
          loadNilai();
        }
      });
    }
  });
  async function loadMapel() {
    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    if (typeof window !== 'undefined') {
      const cachedMapel = localStorage.getItem(`siakad_offline_diniyah_mapel_kelas_${kelasId}_${rombelParam}`);
      if (cachedMapel) {
        try {
          const list = JSON.parse(cachedMapel);
          if (list && list.length > 0) {
            mapelList = list;
            loadingMapel = false;
          }
        } catch(e) {}
      }
    }
    
    if (mapelList.length === 0) {
      loadingMapel = true;
    }
    
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${sekolahId}/mapel-diniyah?kelas_id=${kelasId}&rombel=${rombelParam}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal memuat daftar mapel diniyah.');
      mapelList = await res.json();
      if (typeof window !== 'undefined') {
        localStorage.setItem(`siakad_offline_diniyah_mapel_kelas_${kelasId}_${rombelParam}`, JSON.stringify(mapelList));
      }
      // Tidak otomatis pilih mapel pertama — biarkan guru pilih dari card grid
    } catch (err) {
      if (mapelList.length === 0) {
        error = err.message;
      }
    } finally {
      loadingMapel = false;
    }
  }
  async function loadNilai() {
    if (!selectedMapel) return;
    
    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    if (typeof window !== 'undefined') {
      const cacheKey = `siakad_offline_diniyah_data_${kelasId}_${selectedMapel.id}_${activeTahun}_${activeSemester}_${rombelParam}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (data.siswaList && data.siswaList.length > 0) {
            siswaList = data.siswaList;
            nilaiMap = data.nilaiMap || nilaiMap;
            loadingNilai = false;
          }
        } catch (e) {}
      }
    }

    if (siswaList.length === 0) {
      loadingNilai = true;
    }
    
    error = '';
    try {
      const params = new URLSearchParams({
        mapel_diniyah_id: String(selectedMapel.id),
        rombel: rombelParam
      });
      if (activeTahun) params.append('tahun_ajaran_id', activeTahun);
      if (activeSemester) params.append('semester_id', activeSemester);
      const res = await fetch(
        `${apiUrl}/api/guru/kelas/${kelasId}/nilai-diniyah?${params.toString()}`,
        { credentials: 'include' }
      );
      const body = await res.json();
      
      siswaList = body.siswa || [];

      // Build nilaiMap: siswa_id -> nilaiData
      const map = {};
      for (const n of body.nilai || []) {
        map[n.siswa_id] = {
          id: n.id,
          uh_scores: n.uh_scores || [],
          rata_uh: n.rata_uh || 0,
          murni_pts: n.murni_pts || 0,
          remidi_pts: n.remidi_pts,
          na_pts: n.na_pts || 0,
          pas: n.pas || 0,
          nilai_rapor: n.nilai_rapor || 0
        };
      }
      nilaiMap = map;

      // Determine UH column count from existing data
      // Lock to 4 columns explicitly for ulangan harian
      uhColumnCount = 4;
    } catch (err) {
      if (siswaList.length === 0) {
        error = err.message;
      }
    } finally {
      loadingNilai = false;
    }
  }

  function getSiswaData(siswaId) {
    return (
      nilaiMap[siswaId] || {
        uh_scores: [],
        rata_uh: 0,
        murni_pts: 0,
        remidi_pts: null,
        na_pts: 0,
        pas: 0,
        nilai_rapor: 0
      }
    );
  }

  function getUhScore(siswaId, idx) {
    const data = getSiswaData(siswaId);
    return data.uh_scores[idx] ?? '';
  }

  function clamp(val) {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) return 0;
    if (n > 100) return 100;
    return n;
  }

  // Client-side calculation
  function recalculate(siswaId) {
    const data = getSiswaData(siswaId);
    const uhArr = data.uh_scores || [];

    // Rata-rata UH
    const filled = uhArr.filter((v) => v > 0);
    const rataUh = filled.length > 0 ? filled.reduce((a, b) => a + b, 0) / filled.length : 0;

    // NA PTS
    const m = data.murni_pts || 0;
    const r = data.remidi_pts;
    let naPts = m;
    if (m < KKM && r !== null && r !== undefined && r > 0) {
      naPts = KKM;
    }

    // NR
    const pas = data.pas || 0;
    const nr = rataUh * 0.4 + naPts * 0.3 + pas * 0.3;

    data.rata_uh = Math.round(rataUh * 100) / 100;
    data.na_pts = naPts;
    data.nilai_rapor = Math.round(nr * 100) / 100;

    nilaiMap[siswaId] = { ...data };
    nilaiMap = { ...nilaiMap };
  }

  function updateUh(siswaId, idx, value) {
    const data = getSiswaData(siswaId);
    if (!data.uh_scores) data.uh_scores = [];
    // Ensure array is long enough
    while (data.uh_scores.length <= idx) data.uh_scores.push(0);
    data.uh_scores[idx] = clamp(value);
    nilaiMap[siswaId] = { ...data };
    nilaiMap = { ...nilaiMap };
    recalculate(siswaId);
  }

  function updateField(siswaId, field, value) {
    const data = getSiswaData(siswaId);
    if (field === 'remidi_pts') {
      const v = value === '' || value === null ? null : clamp(value);
      data.remidi_pts = v;
    } else {
      data[field] = clamp(value);
    }
    nilaiMap[siswaId] = { ...data };
    nilaiMap = { ...nilaiMap };
    recalculate(siswaId);
  }

  async function saveNilai(siswaId, fields) {
    const data = getSiswaData(siswaId);
    savingCell = String(siswaId);
    try {
      const payload = {
        siswa_id: siswaId,
        sekolah_id: Number(sekolahId),
        kelas_id: Number(kelasId),
        rombel: rombelParam,
        mapel_diniyah_id: selectedMapel.id
      };

      const fieldList = Array.isArray(fields) ? fields : [fields];

      if (fieldList.includes('uh')) {
        payload.update_uh = true;
        payload.uh_scores = data.uh_scores || [];
      }
      if (fieldList.includes('murni_pts')) {
        payload.update_murni_pts = true;
        payload.murni_pts = data.murni_pts || 0;
      }
      if (fieldList.includes('remidi_pts')) {
        payload.update_remidi = true;
        payload.remidi_pts = data.remidi_pts;
      }
      if (fieldList.includes('pas')) {
        payload.update_pas = true;
        payload.pas = data.pas || 0;
      }

      if (activeTahun) payload.tahun_ajaran_id = Number(activeTahun);
      if (activeSemester) payload.semester_id = Number(activeSemester);
      
      syncManager.enqueue(`${apiUrl}/api/guru/nilai-diniyah`, payload, { method: 'POST' });
      
      // Update local state without waiting for backend to calculate
      recalculate(siswaId);
    } catch (err) {
      error = err.message;
    } finally {
      setTimeout(() => { savingCell = ''; }, 500); // Visual feedback
    }
  }

  function addUhColumn() {
    uhColumnCount += 1;
  }

  function removeUhColumn() {
    if (uhColumnCount <= 1) return;
    uhColumnCount -= 1;
    // Truncate all existing data
    for (const key in nilaiMap) {
      const data = nilaiMap[key];
      if (data.uh_scores && data.uh_scores.length > uhColumnCount) {
        data.uh_scores = data.uh_scores.slice(0, uhColumnCount);
      }
    }
    nilaiMap = { ...nilaiMap };
  }

  /**
   * Dipanggil saat guru klik card mapel.
   * - Jika mapel milik guru lain → tampilkan modal konfirmasi
   * - Jika mapel miliknya atau belum diklaim → langsung masuk tabel input
   */
  function handleSelectMapel(mapel) {
    const isOthers =
      mapel.guru_pengampu_id !== null &&
      mapel.guru_pengampu_id !== undefined &&
      mapel.guru_pengampu_id !== currentGuruId;

    if (isOthers) {
      mapelYangDipilih = mapel;
      showKonfirmasi = true;
    } else {
      masukKeMapel(mapel);
    }
  }

  function masukKeMapel(mapel) {
    selectedMapel = mapel;
    isReadOnly = mapel.guru_pengampu_id !== null && mapel.guru_pengampu_id !== undefined && mapel.guru_pengampu_id !== currentGuruId;
    showGrid = false;
    showKonfirmasi = false;
    mapelYangDipilih = null;
    loadNilai();
  }

  function handleBatalkanKonfirmasi() {
    showKonfirmasi = false;
    mapelYangDipilih = null;
  }

  function handleLanjutkanKonfirmasi() {
    if (mapelYangDipilih) masukKeMapel(mapelYangDipilih);
  }

  function kembaliKeGrid() {
    showGrid = true;
    selectedMapel = null;
    siswaList = [];
    nilaiMap = {};
    searchQuery = '';
  }

  /**
   * Klaim atau lepas klaim mapel ke backend.
   * Update mapelList secara lokal setelah berhasil.
   */
  async function handleKlaim(mapelId, aksi) {
    try {
      const res = await fetch(`${apiUrl}/api/guru/mapel-diniyah/${mapelId}/klaim`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi, kelas_id: Number(kelasId), rombel: rombelParam })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal mengubah klaim mapel');
      }
      const updated = await res.json();
      // Update mapelList secara reaktif
      mapelList = mapelList.map((m) =>
        m.id === mapelId
          ? {
              ...m,
              guru_pengampu_id: updated.guru_pengampu_id,
              guru_pengampu_nama: updated.guru_pengampu_nama || ''
            }
          : m
      );
      // Update cache offline
      if (typeof window !== 'undefined') {
        localStorage.setItem(`siakad_offline_diniyah_mapel_kelas_${kelasId}_${rombelParam}`, JSON.stringify(mapelList));
      }
    } catch (err) {
      error = err.message;
    }
  }

  function formatDecimal(val) {
    if (val === 0 || val === null || val === undefined) return '-';
    return Number(val).toFixed(2);
  }

  function downloadTemplate() {
    if (!selectedMapel) return;
    const params = new URLSearchParams({ rombel: rombelParam });
    if (activeTahun) params.append('tahun_ajaran_id', activeTahun);
    if (activeSemester) params.append('semester_id', activeSemester);
    window.location.href = `${apiUrl}/api/guru/kelas/${kelasId}/mapel-diniyah/${selectedMapel.id}/template?${params.toString()}`;
  }

  function handlePaste(e) {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    const target = e.target;
    if (!target.classList.contains('input-cell')) return;

    e.preventDefault();

    const rows = text
      .trim()
      .split('\n')
      .map((row) => row.split('\t'));
    const td = target.closest('td');
    const tr = target.closest('tr');
    const tbody = tr.closest('tbody');

    const startRowIdx = Array.from(tbody.children).indexOf(tr);
    const startColIdx = Array.from(tr.children).indexOf(td);

    let currentSiswaIdxToSave = new Map();

    for (let r = 0; r < rows.length; r++) {
      const targetTr = tbody.children[startRowIdx + r];
      if (!targetTr) break;

      const siswaIdStr = targetTr.getAttribute('data-siswa-id');
      if (!siswaIdStr) continue;
      const siswaId = parseInt(siswaIdStr, 10);

      for (let c = 0; c < rows[r].length; c++) {
        const valStr = rows[r][c].trim().replace(',', '.');
        const val = parseFloat(valStr);
        if (isNaN(val)) continue;

        const targetTd = targetTr.children[startColIdx + c];
        if (!targetTd) break;

        const input = targetTd.querySelector('input.input-cell');
        if (input) {
          const field = input.getAttribute('data-field');
          if (field === 'uh') {
            const idx = parseInt(input.getAttribute('data-idx'), 10);
            updateUh(siswaId, idx, val);
          } else if (field === 'murni_pts' || field === 'remidi_pts' || field === 'pas') {
            updateField(siswaId, field, val);
          }
          if (field) {
            if (!currentSiswaIdxToSave.has(siswaId)) currentSiswaIdxToSave.set(siswaId, new Set());
            currentSiswaIdxToSave.get(siswaId).add(field);
          }
        }
      }
    }

    (async () => {
      for (const [id, fields] of currentSiswaIdxToSave.entries()) {
        await saveNilai(id, Array.from(fields));
      }
    })();
  }

  function moveCell(event, rowIndex, colIndex) {
    const keys = {
      ArrowUp: [rowIndex - 1, colIndex],
      ArrowDown: [rowIndex + 1, colIndex],
      ArrowLeft: [rowIndex, colIndex - 1],
      ArrowRight: [rowIndex, colIndex + 1]
    };

    if (!keys[event.key]) return;

    const [nextRow, nextCol] = keys[event.key];
    const nextCell = document.querySelector(`[data-cell="${nextRow}-${nextCol}"]`);
    if (!nextCell) return;

    event.preventDefault();
    nextCell.focus();
    nextCell.select();
  }
</script>

<svelte:head>
  <title>Input Nilai Diniyah - {kelasLabel} - SIAKAD</title>
</svelte:head>

<div class="page-container">
  <div class="back-button-wrapper">
    <button type="button" class="back-button" onclick={() => goto('/guru/input-nilai/diniyah')}>
      <Icon name="arrowLeft" size={16} /> Kembali
    </button>
  </div>

  <section class="sheet-header">
    <div>
      <h1>Input Nilai Diniyah</h1>
      <p>Kelas {kelasLabel}</p>
    </div>
    <div class="meta-box">
      {#if !showGrid && selectedMapel}
        <span class="selected-mapel-badge">
          {selectedMapel.nama_mapel}
          {selectedMapel.nama_mapel_arab ? ` (${selectedMapel.nama_mapel_arab})` : ''}
        </span>
      {:else}
        <span>Diniyah</span>
      {/if}
      <strong>{filteredSiswa.length} Siswa</strong>
      <small>{loadingNilai ? 'Memuat...' : 'Autosave aktif'}</small>
    </div>
  </section>

  {#if error}
    <div class="alert-error">
      {error} <button class="btn-dismiss" onclick={() => (error = '')}>✕</button>
    </div>
  {/if}

  <!-- ===== GRID MAPEL ===== -->
  {#if showGrid}
    {#if loadingMapel}
      <div class="table-loading">Memuat daftar mapel...</div>
    {:else if mapelList.length === 0}
      <div class="table-loading">Belum ada mapel diniyah dikonfigurasi admin.</div>
    {:else}
      <div class="mapel-section">
        <div class="mapel-section-header">
          <div>
            <h2 class="mapel-section-title">Pilih Mata Pelajaran</h2>
            <p class="mapel-section-desc">
              Klik card mapel untuk mulai input nilai.
              Tombol <strong>Klaim</strong> untuk menandai mapelmu.
            </p>
          </div>
          <div class="mapel-header-right">
            <span class="mapel-count">{filteredMapel.length} mapel</span>
            <button
              type="button"
              id="btn-toggle-filter-milikku"
              class="btn-toggle-filter"
              class:active={filterMilikku}
              onclick={() => (filterMilikku = !filterMilikku)}
              title={filterMilikku ? 'Tampilkan semua mapel' : 'Tampilkan hanya mapel milikmu'}
            >
              {#if filterMilikku}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                Milikku
              {:else}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
                Semua
              {/if}
            </button>
          </div>
        </div>
        <div class="mapel-grid">
          {#each filteredMapel as m (m.id)}
            <MapelCard
              mapel={m}
              isSelected={selectedMapel?.id === m.id}
              {currentGuruId}
              {currentGuruNama}
              onSelect={handleSelectMapel}
              onKlaim={handleKlaim}
            />
          {:else}
            <div class="mapel-empty-filter">
              <p>Kamu belum menandai mapel apapun sebagai milikmu.</p>
              <button type="button" onclick={() => (filterMilikku = false)}>Tampilkan semua</button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

  <!-- ===== TABEL INPUT ===== -->
  {:else}
    <!-- Toolbar di atas tabel -->
    <div class="toolbar">
      <div class="toolbar-left">
        <button type="button" class="btn-back-grid" onclick={kembaliKeGrid}>
          <Icon name="arrowLeft" size={14} />
          Ganti Mapel
        </button>
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
        <button class="btn-sm btn-primary" onclick={downloadTemplate}>
          <Icon name="download" size={14} /> Template Excel
        </button>
        <span class="uh-info">{uhColumnCount} kolom UH</span>
      </div>
    </div>

  {#if isReadOnly}
    <div class="alert-readonly" style="background-color: #ffebee; color: #c62828; padding: 12px; margin-bottom: 16px; border-radius: 8px; border: 1px solid #ef9a9a; font-weight: 600;">
      <i class="ph ph-warning-circle" style="margin-right: 8px;"></i>
      Mapel ini sudah dikunci oleh guru lain. Anda hanya bisa melihat nilainya.
    </div>
  {/if}

  <!-- Tabel Input -->
  {#if loadingNilai}
    <div class="table-loading">Memuat data nilai...</div>
  {:else if selectedMapel && siswaList.length > 0}
    <div class="table-wrapper desktop-only">
      <table class="nilai-table">
        <thead>
          <tr>
            <th class="col-no" rowspan="2">No</th>
            <th class="col-nisn" rowspan="2">NISN</th>
            <th class="col-nama" rowspan="2">Nama Siswa</th>
            {#each Array(uhColumnCount) as _, i (i)}
              <th class="col-uh">UH {i + 1}</th>
            {/each}
            <th class="col-calc">Rata UH</th>
            <th class="col-pts" colspan="2">PTS</th>
            <th class="col-calc">NA PTS</th>
            <th class="col-input">PAS</th>
            <th class="col-calc col-nr">NR</th>
          </tr>
          <tr>
            {#each Array(uhColumnCount) as _, i (i)}
              <th class="col-uh-sub"></th>
            {/each}
            <th class="col-calc-sub"></th>
            <th class="col-pts-sub">M</th>
            <th class="col-pts-sub">R</th>
            <th class="col-calc-sub"></th>
            <th class="col-input-sub"></th>
            <th class="col-calc-sub col-nr"></th>
          </tr>
        </thead>
        <tbody onpaste={handlePaste}>
          {#each filteredSiswa as siswa, idx (siswa.siswa_id)}
            {@const data = getSiswaData(siswa.siswa_id)}
            <tr class:saving={savingCell === String(siswa.siswa_id)} data-siswa-id={siswa.siswa_id}>
              <td class="text-center">{idx + 1}</td>
              <td class="text-center text-mono">{siswa.nisn}</td>
              <td class="col-nama-cell">{siswa.nama_lengkap}</td>
              {#each Array(uhColumnCount) as _, i (i)}
                <td>
                  <input
                    type="number"
                    class="input-cell"
                    min="0"
                    max="100"
                    disabled={isReadOnly}
                    data-field="uh"
                    data-idx={i}
                    data-cell={`${idx}-${i}`}
                    value={getUhScore(siswa.siswa_id, i) || ''}
                    onblur={(e) => {
                      updateUh(siswa.siswa_id, i, e.target.value);
                      saveNilai(siswa.siswa_id, 'uh');
                    }}
                    onchange={(e) => updateUh(siswa.siswa_id, i, e.target.value)}
                    onkeydown={(e) => moveCell(e, idx, i)}
                  />
                </td>
              {/each}
              <td class="cell-calc">{formatDecimal(data.rata_uh)}</td>
              <td>
                <input
                  type="number"
                  class="input-cell"
                  min="0"
                  max="100"
                  disabled={isReadOnly}
                  data-field="murni_pts"
                  data-cell={`${idx}-${uhColumnCount}`}
                  value={data.murni_pts || ''}
                  onblur={(e) => {
                    updateField(siswa.siswa_id, 'murni_pts', e.target.value);
                    saveNilai(siswa.siswa_id, 'murni_pts');
                  }}
                  onchange={(e) => updateField(siswa.siswa_id, 'murni_pts', e.target.value)}
                  onkeydown={(e) => moveCell(e, idx, uhColumnCount)}
                />
              </td>
              <td>
                <input
                  type="number"
                  class="input-cell input-remidi"
                  min="0"
                  max="100"
                  disabled={isReadOnly}
                  data-field="remidi_pts"
                  data-cell={`${idx}-${uhColumnCount + 1}`}
                  value={data.remidi_pts ?? ''}
                  placeholder="-"
                  onblur={(e) => {
                    updateField(siswa.siswa_id, 'remidi_pts', e.target.value);
                    saveNilai(siswa.siswa_id, 'remidi_pts');
                  }}
                  onchange={(e) => updateField(siswa.siswa_id, 'remidi_pts', e.target.value)}
                  onkeydown={(e) => moveCell(e, idx, uhColumnCount + 1)}
                />
              </td>
              <td class="cell-calc">{data.na_pts || '-'}</td>
              <td>
                <input
                  type="number"
                  class="input-cell"
                  min="0"
                  max="100"
                  disabled={isReadOnly}
                  data-field="pas"
                  data-cell={`${idx}-${uhColumnCount + 2}`}
                  value={data.pas || ''}
                  onblur={(e) => {
                    updateField(siswa.siswa_id, 'pas', e.target.value);
                    saveNilai(siswa.siswa_id, 'pas');
                  }}
                  onchange={(e) => updateField(siswa.siswa_id, 'pas', e.target.value)}
                  onkeydown={(e) => moveCell(e, idx, uhColumnCount + 2)}
                />
              </td>
              <td class="cell-nr">{formatDecimal(data.nilai_rapor)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <!-- Mobile Card View -->
    <div class="mobile-only mobile-student-list">
      {#each filteredSiswa as siswa, idx (siswa.siswa_id)}
        {@const data = getSiswaData(siswa.siswa_id)}
        <div class="m-card" class:saving={savingCell === String(siswa.siswa_id)}>
          <div
            class="m-card-header"
            onclick={() =>
              (expandedSiswaId = expandedSiswaId === siswa.siswa_id ? null : siswa.siswa_id)}
            role="button"
            tabindex="0"
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                expandedSiswaId = expandedSiswaId === siswa.siswa_id ? null : siswa.siswa_id;
                e.preventDefault();
              }
            }}
          >
            <div class="m-avatar">{siswa.nama_lengkap.charAt(0)}</div>
            <div class="m-info">
              <h3>{siswa.nama_lengkap}</h3>
              <p>NISN: {siswa.nisn}</p>
            </div>
            <div class="m-nr">
              <span class="m-nr-val">{formatDecimal(data.nilai_rapor)}</span>
              <span class="m-nr-lbl">Nilai Rapor</span>
            </div>
            <div class="m-chevron">
              <Icon
                name={expandedSiswaId === siswa.siswa_id ? 'chevronUp' : 'chevronDown'}
                size={20}
                color="#94a3b8"
              />
            </div>
          </div>

          {#if expandedSiswaId === siswa.siswa_id}
            <div class="m-card-body">
              <!-- UH Inputs -->
              <div class="m-section">
                <div class="m-sec-header">
                  <h4>Ulangan Harian</h4>
                  <span class="m-calc-badge">Rata: {formatDecimal(data.rata_uh)}</span>
                </div>
                <div class="m-grid-inputs">
                  {#each Array(uhColumnCount) as _, i (i)}
                    <div class="m-input-box">
                      <label>UH {i + 1}</label>
                      <input
                        type="number"
                        class="input-cell"
                        min="0"
                        max="100"
                        disabled={isReadOnly}
                        data-field="uh"
                        data-idx={i}
                        value={getUhScore(siswa.siswa_id, i) || ''}
                        onblur={(e) => {
                          updateUh(siswa.siswa_id, i, e.target.value);
                          saveNilai(siswa.siswa_id, 'uh');
                        }}
                        onchange={(e) => updateUh(siswa.siswa_id, i, e.target.value)}
                      />
                    </div>
                  {/each}
                </div>
              </div>

              <!-- PTS Inputs -->
              <div class="m-section">
                <div class="m-sec-header">
                  <h4>Penilaian Tengah Semester</h4>
                  <span class="m-calc-badge">NA PTS: {data.na_pts || '-'}</span>
                </div>
                <div class="m-grid-inputs">
                  <div class="m-input-box">
                    <label>Murni</label>
                    <input
                      type="number"
                      class="input-cell"
                      min="0"
                      max="100"
                      disabled={isReadOnly}
                      data-field="murni_pts"
                      value={data.murni_pts || ''}
                      onblur={(e) => {
                        updateField(siswa.siswa_id, 'murni_pts', e.target.value);
                        saveNilai(siswa.siswa_id, 'murni_pts');
                      }}
                      onchange={(e) => updateField(siswa.siswa_id, 'murni_pts', e.target.value)}
                    />
                  </div>
                  <div class="m-input-box">
                    <label>Remidi</label>
                    <input
                      type="number"
                      class="input-cell input-remidi"
                      min="0"
                      max="100"
                      disabled={isReadOnly}
                      data-field="remidi_pts"
                      placeholder="-"
                      value={data.remidi_pts ?? ''}
                      onblur={(e) => {
                        updateField(siswa.siswa_id, 'remidi_pts', e.target.value);
                        saveNilai(siswa.siswa_id, 'remidi_pts');
                      }}
                      onchange={(e) => updateField(siswa.siswa_id, 'remidi_pts', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <!-- PAS Input -->
              <div class="m-section">
                <div class="m-sec-header">
                  <h4>Penilaian Akhir Semester</h4>
                </div>
                <div class="m-grid-inputs">
                  <div class="m-input-box">
                    <label>PAS</label>
                    <input
                      type="number"
                      class="input-cell"
                      min="0"
                      max="100"
                      disabled={isReadOnly}
                      data-field="pas"
                      value={data.pas || ''}
                      onblur={(e) => {
                        updateField(siswa.siswa_id, 'pas', e.target.value);
                        saveNilai(siswa.siswa_id, 'pas');
                      }}
                      onchange={(e) => updateField(siswa.siswa_id, 'pas', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="legend desktop-only">
      <p>
        <strong>Keterangan:</strong> UH = Ulangan Harian, M = Murni PTS, R = Remidi PTS, NA PTS = Nilai
        Akhir PTS, PAS = Penilaian Akhir Semester, NR = Nilai Rapor
      </p>
      <p>
        <strong>Rumus:</strong> NR = (Rata UH × 40%) + (NA PTS × 30%) + (PAS × 30%) | KKM = {KKM}
      </p>
      <p>
        <strong>Autosave:</strong> Nilai otomatis tersimpan saat kursor keluar dari kolom input.
      </p>
    </div>
    {:else if selectedMapel}
      <div class="table-loading">Belum ada siswa di kelas ini.</div>
    {/if}
  {/if}
</div>

<!-- Modal Konfirmasi Klaim (di luar page-container agar z-index tidak conflik) -->
<KonfirmasiMapelModal
  isOpen={showKonfirmasi}
  mapel={mapelYangDipilih}
  onLanjutkan={handleLanjutkanKonfirmasi}
  onBatalkan={handleBatalkanKonfirmasi}
/>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');

  /* ===== Mapel Card Grid ===== */
  .mapel-section {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }

  .mapel-section-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .mapel-section-title {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 800;
    color: #1e293b;
  }

  .mapel-section-desc {
    margin: 0;
    font-size: 0.82rem;
    color: #64748b;
  }

  .mapel-count {
    font-size: 0.85rem;
    font-weight: 700;
    color: #64748b;
    white-space: nowrap;
    padding-top: 2px;
  }

  .mapel-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 0.75rem;
  }

  /* Toolbar saat di tabel input */
  .btn-back-grid {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    border: 1px solid #e2e8f0;
    border-radius: 7px;
    background: #f8fafc;
    color: #475569;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.15s ease, border-color 0.15s ease;
    flex-shrink: 0;
  }
  .btn-back-grid:hover {
    background: #e2e8f0;
    border-color: #cbd5e1;
  }

  .toolbar-mapel-nama {
    font-size: 0.9rem;
    font-weight: 700;
    color: #1e293b;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-radius: 6px;
    padding: 4px 12px;
  }

  .selected-mapel-badge {
    font-size: 0.82rem;
    font-weight: 700;
    color: #4f46e5;
    background: #eef2ff;
    border-radius: 5px;
    padding: 2px 8px;
  }

  @media (max-width: 640px) {
    .mapel-grid {
      grid-template-columns: 1fr;
    }
    .mapel-section-header {
      flex-direction: column;
    }
  }

  .mapel-header-right {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-shrink: 0;
  }

  .btn-toggle-filter {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    border: 1.5px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .btn-toggle-filter:hover {
    border-color: #4f46e5;
    color: #4f46e5;
  }
  .btn-toggle-filter.active {
    background: #4f46e5;
    border-color: #4f46e5;
    color: #fff;
  }

  .mapel-empty-filter {
    grid-column: 1 / -1;
    text-align: center;
    padding: 2rem 1rem;
    color: #64748b;
    font-size: 0.9rem;
  }
  .mapel-empty-filter p {
    margin: 0 0 0.75rem;
  }
  .mapel-empty-filter button {
    padding: 6px 16px;
    border-radius: 8px;
    border: 1.5px solid #e2e8f0;
    background: #f8fafc;
    color: #475569;
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
  }
  .mapel-empty-filter button:hover {
    background: #e2e8f0;
  }

  .page-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding-top: 24px;
    padding-bottom: 2rem;
    max-width: 1320px;
    margin: 0 auto;
    padding-left: 24px;
    padding-right: 24px;
    box-sizing: border-box;
  }

  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    width: 100%;
    margin: 0 auto 12px;
  }

  .back-button-wrapper {
    width: 100%;
    margin: 0 auto;
    display: flex;
    justify-content: flex-start;
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
    color: #1e293b;
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

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    width: 100%;
    margin-bottom: 1rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 0.85rem 1rem;
    box-sizing: border-box;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .toolbar-label {
    font-weight: 700;
    font-size: 0.9rem;
    color: #334155;
    white-space: nowrap;
  }

  .select-mapel {
    padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.9rem;
    min-width: 220px;
    background: #f8fafc;
  }

  .toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .search-bar {
    display: inline-flex;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 0.35rem 0.6rem;
    gap: 0.4rem;
  }
  .search-icon {
    color: #94a3b8;
  }
  .search-input {
    border: none;
    background: transparent;
    font-size: 0.85rem;
    font-family: inherit;
    color: #1e293b;
    width: 160px;
    outline: none;
  }

  .btn-sm {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.4rem 0.7rem;
    font-size: 0.82rem;
    font-weight: 600;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    font-family: inherit;
    color: #475569;
    transition: all 0.15s;
  }
  .btn-sm:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
  }
  .btn-sm:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .btn-primary {
    background: #6366f1;
    color: white;
    border: 1px solid #4f46e5;
  }
  .btn-primary:hover {
    background: #4f46e5;
    color: white;
  }

  .uh-info {
    font-size: 0.82rem;
    color: #64748b;
    font-weight: 600;
  }

  .table-wrapper {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #fff;
    width: 100%;
    box-sizing: border-box;
  }

  .nilai-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  .nilai-table th,
  .nilai-table td {
    border: 1px solid #e2e8f0;
    padding: 0.4rem 0.5rem;
    text-align: center;
    vertical-align: middle;
  }

  .nilai-table thead th {
    background: #f1f5f9;
    font-weight: 700;
    color: #334155;
    position: sticky;
    top: 0;
    z-index: 1;
  }

  .col-no {
    width: 36px;
  }
  .col-nisn {
    width: 85px;
  }
  .col-nama {
    min-width: 160px;
    text-align: left;
  }
  .col-nama-cell {
    text-align: left;
    font-weight: 600;
    color: #1e293b;
    white-space: nowrap;
  }
  .col-uh,
  .col-uh-sub {
    width: 55px;
  }
  .col-calc,
  .col-calc-sub {
    width: 60px;
    background: #f8fafc;
  }
  .col-pts,
  .col-pts-sub {
    width: 55px;
  }
  .col-input,
  .col-input-sub {
    width: 55px;
  }
  .col-nr {
    background: #eff6ff !important;
  }

  .text-center {
    text-align: center;
  }
  .text-mono {
    font-family: monospace;
    font-size: 0.78rem;
  }
  .text-muted {
    color: #94a3b8;
  }

  .cell-calc {
    background: #f8fafc;
    color: #475569;
    font-weight: 700;
  }
  .cell-nr {
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 800;
    font-size: 0.88rem;
  }

  .input-cell {
    width: 100%;
    max-width: 55px;
    padding: 0.3rem 0.25rem;
    text-align: center;
    border: 1px solid transparent;
    border-radius: 4px;
    font-family: inherit;
    font-size: 0.82rem;
    background: transparent;
    transition: all 0.15s;
  }
  .input-cell:focus {
    outline: none;
    border-color: #6366f1;
    background: #fff;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
  }
  .input-cell:hover {
    background: #f8fafc;
  }

  .input-remidi {
    color: #d97706;
  }

  /* Mobile View Styles */
  .desktop-only {
    display: block;
  }
  .mobile-only {
    display: none;
  }

  @media (max-width: 768px) {
    .desktop-only {
      display: none !important;
    }
    .mobile-only {
      display: block !important;
    }

    .toolbar {
      flex-direction: column;
      align-items: stretch;
      border: none;
      padding: 0;
      background: transparent;
    }

    .toolbar-left,
    .toolbar-right {
      width: 100%;
    }

    .select-mapel {
      width: 100%;
    }

    .search-bar {
      width: 100%;
      background: #fff;
    }
    .search-input {
      width: 100%;
    }

    .uh-info {
      display: none;
    }

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
    .m-calc-badge {
      font-size: 0.75rem;
      font-weight: 800;
      background: #e0e7ff;
      color: #3730a3;
      padding: 0.2rem 0.5rem;
      border-radius: 99px;
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
      color: #1e293b;
    }
    .m-input-box .input-cell:focus {
      border-color: #12a150;
      box-shadow: 0 0 0 3px rgba(18, 161, 80, 0.15);
    }
  }

  tr.saving {
    background: #fefce8;
  }

  /* Remove number input arrows */
  .input-cell::-webkit-outer-spin-button,
  .input-cell::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .input-cell {
    -moz-appearance: textfield;
  }

  .table-loading {
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 700;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 2rem 1rem;
    background: #f8fafc;
    text-align: center;
  }

  .legend {
    margin-top: 1rem;
    padding: 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    font-size: 0.82rem;
    color: #475569;
    line-height: 1.7;
  }
  .legend p {
    margin: 0.25rem 0;
  }

  .alert-error {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 700;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }
  .btn-dismiss {
    background: none;
    border: none;
    color: #dc2626;
    cursor: pointer;
    font-size: 1rem;
  }

  @media (max-width: 720px) {
    .toolbar {
      flex-direction: column;
      align-items: stretch;
    }
    .toolbar-right {
      justify-content: flex-end;
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
    .data-table,
    .data-table tbody,
    .data-table tr,
    .data-table td {
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
    .btn-action-primary,
    .btn-action-secondary {
      width: 100%;
      justify-content: center;
    }
    .search-bar {
      width: 100%;
    }
    textarea,
    input[type='number'],
    .form-input {
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
