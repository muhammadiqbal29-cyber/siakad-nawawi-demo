<script>
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { syncManager } from '$lib/syncManager.svelte.js';
  import '$lib/components/guru/AlquranMobileUI.css';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  const mataPelajaran = 'Tahfiz';

  let siswaId = $derived($page.params.siswaId);
  let namaSiswa = $derived($page.url.searchParams.get('nama') || `Siswa #${siswaId}`);
  let kelas = $derived($page.url.searchParams.get('kelas') || '-');
  let sekolahId = $derived($page.url.searchParams.get('sekolah_id') || '1');
  let kelasId = $derived($page.url.searchParams.get('kelas_id') || '');
  let rombel = $derived($page.url.searchParams.get('rombel') || '__kosong__');
  let kelasLabel = $derived($page.url.searchParams.get('kelas_label') || '');
  let jenisPenilaian = $derived($page.url.searchParams.get('jenis_penilaian') || 'semester');
  let isKelulusan = $derived(jenisPenilaian === 'kelulusan');
  let tahunAjaranId = $derived($page.url.searchParams.get('tahun_ajaran_id'));
  let semesterId = $derived($page.url.searchParams.get('semester_id'));
  let pageTitle = $derived(isKelulusan ? 'Ujian Kelulusan' : 'Ujian Tahfiz');

  let backUrl = $derived(
    kelasId
      ? `/guru/input-nilai/tahfiz-v2/kelas/${kelasId}?kelas=${encodeURIComponent(kelasLabel)}&rombel=${encodeURIComponent(rombel)}&sekolah_id=${sekolahId}&jenis_penilaian=${encodeURIComponent(jenisPenilaian)}${tahunAjaranId ? `&tahun_ajaran_id=${tahunAjaranId}` : ''}${semesterId ? `&semester_id=${semesterId}` : ''}`
      : '/guru/input-nilai/tahfiz-v2'
  );

  let allRows = $state([]);
  let rows = $state([]);
  let materiTidakAda = $state(false);
  let filterHanyaBelumDinilai = $state(false);

  let showJuzSelection = $state(false);
  let availableJuz = $state([]);
  let selectedJuz = $state([]);
  let savingJuz = $state(false);
  let isJuzPanelOpen = $state(true);
  let juzWarningMessage = $state('');
  let warningTimer = null;
  let sambungAyatList = $state([]);
  let selectedJuzForSambung = $state('');

  let distinctJuzList = $derived(
    Array.from(new Set(rows.map((r) => r.juz).filter((j) => j > 0))).sort((a, b) => a - b)
  );
  let targetJuzLabel = $derived(
    distinctJuzList.length > 0
      ? distinctJuzList.length === 1
        ? `Juz ${distinctJuzList[0]}`
        : `Juz ${distinctJuzList[0]} s.d ${distinctJuzList[distinctJuzList.length - 1]}`
      : 'Semua Juz'
  );

  let displayedRowsWithIndex = $derived(
    rows
      .map((row, originalIndex) => ({ row, originalIndex }))
      .filter(({ row }) => (!filterHanyaBelumDinilai ? true : total(row) === ''))
  );

  let loading = $state(false);
  let loadError = $state('');
  let lastSavedSummary = $state(null);
  const saveTimers = new SvelteMap();

  onMount(init);

  $effect(() => {
    if (typeof window !== 'undefined' && allRows.length > 0) {
      const cacheKey = `siakad_offline_tahfiz_v2_detail_${siswaId}_${jenisPenilaian}`;
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          allRows,
          rows,
          selectedJuz,
          lastSavedSummary,
          showJuzSelection,
          sambungAyatList
        })
      );
    }
  });

  function clampScore(value) {
    if (value === '' || value === null || value === undefined) return '';
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) return '';
    return Math.min(100, Math.max(0, numberValue));
  }

  function total(row) {
    const fields = [row.kelancaran, row.tajwid, row.makharijulHuruf];
    if (fields.some((value) => value === '')) return '';
    return fields.reduce((sum, value) => sum + Number(value), 0);
  }

  function toInputValue(value) {
    if (value === null || value === undefined) return '';
    return Number(value);
  }

  function scoreNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  function syncRowToAllRows(rowIndex) {
    const row = rows[rowIndex];
    if (!row) return;
    const allIdx = allRows.findIndex((r) => r.namaMateri === row.namaMateri);
    if (allIdx !== -1 && allRows[allIdx] !== row) {
      allRows[allIdx] = { ...row };
    }
  }

  async function init() {
    loadError = '';

    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    // Tampilkan data brankas lokal seketika tanpa menunggu server!
    if (typeof window !== 'undefined') {
      const cacheKey = `siakad_offline_tahfiz_v2_detail_${siswaId}_${jenisPenilaian}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (data.allRows && data.allRows.length > 0) {
            allRows = data.allRows;
            availableJuz = Array.from(
              new Set(allRows.map((r) => r.juz).filter((j) => j > 0))
            ).sort((a, b) => a - b);
            lastSavedSummary = data.lastSavedSummary || null;
            if (Array.isArray(data.sambungAyatList)) {
              sambungAyatList = data.sambungAyatList;
            }
            if (isKelulusan) {
              rows = allRows;
              showJuzSelection = false;
            } else {
              selectedJuz = Array.isArray(data.selectedJuz) ? data.selectedJuz : [];
              rows = selectedJuz.length > 0 ? allRows.filter((r) => selectedJuz.includes(r.juz)) : [];
              showJuzSelection = data.showJuzSelection ?? (selectedJuz.length === 0);
            }
            materiTidakAda = false;
            loading = false; // Matikan loading seketika!
          }
        } catch (e) {}
      }
    }

    if (allRows.length === 0) {
      loading = true; // Hanya tampilkan loading jika brankas kosong
    }

    try {
      // 1. Fetch daftar materi aktif dari backend
      const endpoint = isKelulusan
        ? `${apiUrl}/api/guru/sekolah/${sekolahId}/materi-tahfiz?jenis_penilaian=kelulusan`
        : `${apiUrl}/api/guru/sekolah/${sekolahId}/materi-tahfiz`;
      const materiRes = await fetch(endpoint, {
        credentials: 'include'
      });
      if (!materiRes.ok) {
        const body = await materiRes.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal memuat daftar materi.');
      }
      const materiData = await materiRes.json();

      if (!materiData || materiData.length === 0) {
        materiTidakAda = true;
        return;
      }

      const juzSet = new SvelteSet();
      materiData.forEach((m) => {
        if (m.juz > 0) juzSet.add(m.juz);
      });
      availableJuz = Array.from(juzSet).sort((a, b) => a - b);

      // 2. Bangun allRows dari materi
      if (allRows.length > 0) {
        const existingMap = new Map(allRows.map((r) => [r.namaMateri, r]));
        allRows = materiData.map((m) => {
          const existing = existingMap.get(m.nama_materi);
          return existing
            ? { ...existing, juz: m.juz || 0, urutan: m.urutan }
            : {
                namaMateri: m.nama_materi,
                juz: m.juz || 0,
                urutan: m.urutan,
                kelancaran: '',
                tajwid: '',
                makharijulHuruf: '',
                saveStatus: ''
              };
        });
      } else {
        allRows = materiData.map((m) => ({
          namaMateri: m.nama_materi,
          juz: m.juz || 0,
          urutan: m.urutan,
          kelancaran: '',
          tajwid: '',
          makharijulHuruf: '',
          saveStatus: ''
        }));
      }

      // 3. Fetch nilai yang sudah ada
      await loadNilaiTahfiz();
    } catch (err) {
      if (allRows.length > 0) {
        loadError = '';
        materiTidakAda = false;
        return;
      }
      loadError = err.message || 'Gagal memuat halaman.';
    } finally {
      loading = false;
    }
  }

  async function loadNilaiTahfiz() {
    try {
      const params = new URLSearchParams({
        mata_pelajaran: mataPelajaran,
        jenis_penilaian: jenisPenilaian
      });
      if (tahunAjaranId) params.append('tahun_ajaran_id', tahunAjaranId);
      if (semesterId) params.append('semester_id', semesterId);
      const res = await fetch(
        `${apiUrl}/api/guru/siswa/${siswaId}/nilai-tahfiz-v2?${params.toString()}`,
        {
          credentials: 'include'
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal memuat nilai tahfiz v2.');
      }

      const body = await res.json();
      const detailMap = new Map((body.details || []).map((detail) => [detail.nama_materi, detail]));
      allRows = allRows.map((row) => {
        const detail = detailMap.get(row.namaMateri);
        if (!detail) return row;
        return {
          ...row,
          kelancaran: toInputValue(detail.skor_kelancaran),
          tajwid: toInputValue(detail.skor_tajwid),
          makharijulHuruf: toInputValue(detail.skor_makharijul_huruf),
          saveStatus: 'Tersimpan'
        };
      });
      lastSavedSummary = body.nilai || null;
      if (Array.isArray(body.sambung_ayat)) {
        sambungAyatList = body.sambung_ayat;
      } else if (Array.isArray(body.nilai?.sambung_ayat)) {
        sambungAyatList = body.nilai.sambung_ayat;
      }

      const pendingSambungItem = syncManager.queue.find(
        (item) =>
          item.url?.endsWith('/nilai-tahfiz-v2/sambung-ayat') &&
          Number(item.payload?.siswa_id) === Number(siswaId) &&
          (item.payload?.jenis_penilaian || 'semester') === jenisPenilaian
      );
      if (pendingSambungItem?.payload?.items) {
        sambungAyatList = pendingSambungItem.payload.items;
      }

      if (isKelulusan) {
        rows = allRows;
        showJuzSelection = false;
        return;
      }

      const pendingJuzItem = syncManager.queue.find(
        (item) =>
          item.url?.endsWith('/nilai-tahfiz-v2/juz') &&
          Number(item.payload?.siswa_id) === Number(siswaId) &&
          (item.payload?.jenis_penilaian || 'semester') === jenisPenilaian
      );

      if (pendingJuzItem?.payload?.juz_yang_diujikan) {
        selectedJuz = pendingJuzItem.payload.juz_yang_diujikan
          .split(',')
          .map((s) => parseInt(s.trim()))
          .filter((n) => !isNaN(n))
          .sort((a, b) => a - b);
        applyJuzFilter();
      } else if (lastSavedSummary && lastSavedSummary.juz_yang_diujikan) {
        selectedJuz = lastSavedSummary.juz_yang_diujikan
          .split(',')
          .map((s) => parseInt(s.trim()))
          .filter((n) => !isNaN(n))
          .sort((a, b) => a - b);
        applyJuzFilter();
      } else if ((body.details || []).length > 0) {
        // Kompatibilitas data lama sebelum fitur pilih Juz
        const legacyJuzSet = new SvelteSet();
        for (const d of body.details) {
          const matched = allRows.find((r) => r.namaMateri === d.nama_materi);
          if (d.juz > 0) legacyJuzSet.add(d.juz);
          else if (matched?.juz > 0) legacyJuzSet.add(matched.juz);
        }
        if (legacyJuzSet.size > 0) {
          selectedJuz = Array.from(legacyJuzSet).sort((a, b) => a - b);
          applyJuzFilter();
        } else {
          rows = allRows.filter((r) => detailMap.has(r.namaMateri));
          showJuzSelection = false;
        }
      } else {
        selectedJuz = [];
        rows = [];
      }
    } catch (err) {
      loadError = err.message || 'Gagal memuat nilai tahfiz.';
    }
  }

  function showJuzWarning(msg) {
    juzWarningMessage = msg;
    if (warningTimer) clearTimeout(warningTimer);
    warningTimer = setTimeout(() => {
      juzWarningMessage = '';
    }, 6000);
  }

  function getJuzScoredCount(juzNum) {
    let count = 0;
    for (const r of allRows) {
      if (r.juz === juzNum) {
        const k = r.kelancaran !== '' && r.kelancaran !== null && r.kelancaran !== undefined;
        const t = r.tajwid !== '' && r.tajwid !== null && r.tajwid !== undefined;
        const m = r.makharijulHuruf !== '' && r.makharijulHuruf !== null && r.makharijulHuruf !== undefined;
        if (k || t || m) {
          count++;
        }
      }
    }
    return count;
  }

  function isJuzLocked(juzNum) {
    return getJuzScoredCount(juzNum) > 0;
  }

  function applyJuzFilter() {
    if (selectedJuz.length > 0) {
      rows = allRows.filter((r) => selectedJuz.includes(r.juz));
    } else {
      rows = [];
    }
    showJuzSelection = false;
  }

  function toggleJuz(j) {
    juzWarningMessage = '';
    const isCurrentlySelected = selectedJuz.includes(j);

    if (isCurrentlySelected) {
      // Guru ingin MELEPAS Juz j
      const scoredCount = getJuzScoredCount(j);
      if (scoredCount > 0) {
        // Terkunci! Karena surah di Juz ini sudah ada nilainya
        showJuzWarning(`⚠️ Juz ${j} tidak dapat dilepas karena sudah memiliki ${scoredCount} surah yang dinilai. Kosongkan semua nilai surah di Juz ${j} terlebih dahulu jika ingin melepasnya.`);
        return;
      }
      // Belum ada nilai sama sekali -> boleh dilepas
      selectedJuz = selectedJuz.filter((x) => x !== j);
    } else {
      // Guru ingin MENAMBAH Juz j
      selectedJuz = [...selectedJuz, j].sort((a, b) => a - b);
    }

    applyJuzFilter();
    saveJuzSelectionQuietly();
  }

  async function saveJuzSelectionQuietly() {
    try {
      const sortedJuz = [...selectedJuz].sort((a, b) => a - b);
      const juzStr = sortedJuz.join(',');
      const payload = {
        siswa_id: Number(siswaId),
        mata_pelajaran: mataPelajaran,
        jenis_penilaian: jenisPenilaian,
        tahun_ajaran_id: tahunAjaranId ? Number(tahunAjaranId) : undefined,
        semester_id: semesterId ? Number(semesterId) : undefined,
        juz_yang_diujikan: juzStr
      };
      syncManager.enqueue(`${apiUrl}/api/guru/siswa/${siswaId}/nilai-tahfiz-v2/juz`, payload, {
        method: 'POST'
      });
      lastSavedSummary = {
        ...(lastSavedSummary || {}),
        juz_yang_diujikan: juzStr,
        nilai_akhir: lastSavedSummary?.nilai_akhir ?? null
      };
    } catch (err) {
      console.error('Gagal menyimpan pilihan juz:', err);
    }
  }

  async function saveJuzSelection() {
    await saveJuzSelectionQuietly();
  }

  function addSambungAyat(juzNum) {
    if (!juzNum || juzNum < 1 || juzNum > 30) return;
    if (sambungAyatList.some((s) => s.juz === juzNum)) return;
    sambungAyatList = [...sambungAyatList, { juz: juzNum, predikat: 'A', keterangan: '' }].sort(
      (a, b) => a.juz - b.juz
    );
    selectedJuzForSambung = '';
    saveSambungAyatQuietly();
  }

  function setSambungAyatPredikat(juzNum, pred) {
    sambungAyatList = sambungAyatList.map((item) =>
      item.juz === juzNum ? { ...item, predikat: pred } : item
    );
    saveSambungAyatQuietly();
  }

  function removeSambungAyat(juzNum) {
    sambungAyatList = sambungAyatList.filter((item) => item.juz !== juzNum);
    saveSambungAyatQuietly();
  }

  async function saveSambungAyatQuietly() {
    try {
      const payload = {
        siswa_id: Number(siswaId),
        mata_pelajaran: mataPelajaran,
        jenis_penilaian: jenisPenilaian,
        tahun_ajaran_id: tahunAjaranId ? Number(tahunAjaranId) : undefined,
        semester_id: semesterId ? Number(semesterId) : undefined,
        items: sambungAyatList.map((item) => ({
          juz: item.juz,
          predikat: item.predikat,
          keterangan: item.keterangan || ''
        }))
      };
      syncManager.enqueue(`${apiUrl}/api/guru/siswa/${siswaId}/nilai-tahfiz-v2/sambung-ayat`, payload, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Gagal menyimpan nilai sambung ayat:', err);
    }
  }

  function handleScoreInput(event, rowIndex, field) {
    let val = event.target.value;
    if (val.length > 1 && val.startsWith('0')) {
      val = Number(val).toString();
      event.target.value = val;
    }
    rows[rowIndex][field] = clampScore(val);
    syncRowToAllRows(rowIndex);
    scheduleAutosave(rowIndex);
  }

  function scheduleAutosave(rowIndex) {
    const existingTimer = saveTimers.get(rowIndex);
    if (existingTimer) clearTimeout(existingTimer);

    rows[rowIndex].saveStatus = 'Menunggu...';
    syncRowToAllRows(rowIndex);
    const timer = setTimeout(() => {
      saveTimers.delete(rowIndex);
      autosaveRow(rowIndex);
    }, 650);
    saveTimers.set(rowIndex, timer);
  }

  async function autosaveRow(rowIndex) {
    const row = rows[rowIndex];
    row.saveStatus = 'Menyimpan...';
    syncRowToAllRows(rowIndex);

    try {
      const payload = {
        siswa_id: Number(siswaId), // Important for syncManager deduplication
        mata_pelajaran: mataPelajaran,
        jenis_penilaian: jenisPenilaian,
        tahun_ajaran_id: tahunAjaranId ? Number(tahunAjaranId) : undefined,
        semester_id: semesterId ? Number(semesterId) : undefined,
        nama_materi: row.namaMateri,
        juz: row.juz,
        urutan: row.urutan || rowIndex + 1,
        skor_kelancaran: scoreNumber(row.kelancaran),
        skor_tajwid: scoreNumber(row.tajwid),
        skor_makharijul_huruf: scoreNumber(row.makharijulHuruf)
      };

      syncManager.enqueue(`${apiUrl}/api/guru/siswa/${siswaId}/nilai-tahfiz-v2/detail`, payload, { method: 'POST' });

      row.saveStatus = 'Tersimpan (Auto)';
      syncRowToAllRows(rowIndex);
    } catch (err) {
      row.saveStatus = err.message || 'Gagal';
      syncRowToAllRows(rowIndex);
    }
  }

  let submittedRows = $derived(rows.filter((row) => total(row) !== ''));
  let totalPoin = $derived(submittedRows.reduce((sum, row) => sum + total(row), 0));
  let pembagiPreview = $derived(
    isKelulusan || selectedJuz.length > 0 ? rows.length || 1 : submittedRows.length || 1
  );
  let rataRataPoin = $derived(
    submittedRows.length > 0 ? Number(((totalPoin / pembagiPreview) / 3).toFixed(2)) : ''
  );

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
  <title>{pageTitle} - {namaSiswa}</title>
</svelte:head>

<main class="sheet-page">
  <div class="desktop-only">
    <div class="back-button-wrapper">
      <button type="button" class="back-button" onclick={() => goto(backUrl)}>
        <Icon name="arrowLeft" size={16} /> Kembali
      </button>
    </div>

    <section class="sheet-header">
      <div>
        <h1>{pageTitle}</h1>
        <p>{namaSiswa} · {kelas}</p>
      </div>
      <div class="meta-box">
        <span>{isKelulusan ? targetJuzLabel : `Juz ${selectedJuz.length > 0 ? selectedJuz.join(', ') : '-'}`}</span>
        <strong>{submittedRows.length} Materi Disetor</strong>
        <small>{loading ? 'Memuat...' : 'Autosave aktif'}</small>
      </div>
    </section>
  </div>

  <!-- Mobile Header -->
  <div class="mobile-app-ui mobile-app-header">
     <div class="app-header-top">
         <a class="back-btn" href={backUrl}>
             <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                 <path d="M8 2L3.5 6.5L8 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
             </svg>
             Kembali
         </a>
         <div class="page-title">{pageTitle}</div>
     </div>
     <div class="student-row">
         <div class="student-avatar">{namaSiswa.charAt(0)}</div>
         <div class="student-sub"><b>{namaSiswa}</b> · {kelasLabel} - {rombel === '__kosong__' || !rombel ? 'Tanpa Rombel' : 'Rombel ' + rombel}</div>
     </div>
     <div class="stat-card">
         <div class="stat-item">
             <div class="stat-num">{isKelulusan ? targetJuzLabel : `Juz ${selectedJuz.length > 0 ? selectedJuz.join(', ') : '-'}`}</div>
             <div class="stat-label">Target juz</div>
         </div>
         <div class="stat-item">
             <div class="stat-num">{submittedRows.length}</div>
             <div class="stat-label">Materi disetor</div>
         </div>
         <div class="stat-item stat-live">
             <div class="live-dot" class:active={loading || rows.some(r => r.saveStatus === 'Menunggu...' || r.saveStatus === 'Menyimpan...')}></div>
             <div>
                 <div class="stat-live-label">Autosave</div>
                 <div class="stat-label" style="margin-top:0;">{loading ? 'proses' : 'aktif'}</div>
             </div>
         </div>
     </div>
  </div>

  {#if loadError}
    <div class="sheet-alert">{loadError}</div>
  {/if}

  {#if loading}
    <div class="sheet-loading">Memuat data...</div>
  {:else if materiTidakAda}
    <div class="sheet-empty">
      <div class="sheet-empty-icon">📋</div>
      <strong>Materi tahfiz belum dikonfigurasi</strong>
      <p>Hubungi admin untuk menambahkan daftar materi sebelum input nilai dapat dilakukan.</p>
    </div>
  {:else}
    {#if !isKelulusan}
      <!-- Panel Pemilihan Juz Interaktif (Selalu Tersedia & Anti Data Loss) -->
      <div class="juz-selector-card">
        <div class="juz-selector-header">
          <div class="juz-selector-title-wrap">
            <span class="juz-icon">📖</span>
            <div>
              <div class="juz-title-line">
                <strong>Pilih Juz yang Diujikan</strong>
                <span class="juz-badge-pill">
                  {selectedJuz.length > 0 ? `${selectedJuz.length} Juz (${rows.length} Surah)` : 'Belum Ada Juz Terpilih'}
                </span>
              </div>
              <div class="juz-subtitle">
                Klik tombol Juz untuk menambah ujian. Juz dengan ikon 🔒 terkunci otomatis karena sudah memiliki nilai.
              </div>
            </div>
          </div>
          <button
            type="button"
            class="btn-toggle-juz-panel"
            onclick={() => (isJuzPanelOpen = !isJuzPanelOpen)}
          >
            {isJuzPanelOpen ? 'Sembunyikan Pilihan Juz ▴' : 'Tampilkan Pilihan Juz ▾'}
          </button>
        </div>

        {#if juzWarningMessage}
          <div class="juz-warning-box">
            <span>{juzWarningMessage}</span>
            <button type="button" class="btn-close-warning" onclick={() => (juzWarningMessage = '')}>✕</button>
          </div>
        {/if}

        {#if isJuzPanelOpen}
          <div class="juz-chips-grid">
            {#each availableJuz as juz (juz)}
              {@const isSelected = selectedJuz.includes(juz)}
              {@const scoredCount = getJuzScoredCount(juz)}
              {@const isLocked = scoredCount > 0}
              <button
                type="button"
                class="juz-chip-btn"
                class:active={isSelected}
                class:locked={isLocked}
                onclick={() => toggleJuz(juz)}
                title={isLocked
                  ? `Juz ${juz}: Sudah ada ${scoredCount} surah dinilai (Terkunci)`
                  : isSelected
                    ? `Juz ${juz}: Terpilih (Klik untuk melepas)`
                    : `Klik untuk menambah Juz ${juz}`}
              >
                <span>Juz {juz}</span>
                {#if isLocked}
                  <span class="chip-badge-lock" title="Terkunci: memiliki nilai">🔒</span>
                {:else if isSelected}
                  <span class="chip-badge-check">✓</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Card Baru: Uji Sambung Ayat (Hafalan Sebelumnya) -->
      <div class="sambung-ayat-card">
        <div class="sambung-ayat-header">
          <div class="sambung-ayat-title-wrap">
            <span class="sambung-icon">🔗</span>
            <div>
              <div class="sambung-title-line">
                <strong>Uji Sambung Ayat (Hafalan Sebelumnya)</strong>
                <span class="sambung-badge-pill">
                  {sambungAyatList.length > 0 ? `${sambungAyatList.length} Juz Diuji` : 'Opsional'}
                </span>
              </div>
              <div class="sambung-subtitle">
                Pilih juz hafalan sebelumnya yang diuji, lalu pilih predikat A / B / C / D. Nilai tersimpan otomatis.
              </div>
            </div>
          </div>

          <div class="sambung-add-wrapper">
            <select
              class="sambung-select-juz"
              bind:value={selectedJuzForSambung}
              onchange={() => {
                if (selectedJuzForSambung) {
                  addSambungAyat(Number(selectedJuzForSambung));
                }
              }}
            >
              <option value="">+ Tambah Juz Sambung Ayat...</option>
              {#each availableJuz as j (j)}
                <option value={j} disabled={sambungAyatList.some((s) => s.juz === j)}>
                  Juz {j} {sambungAyatList.some((s) => s.juz === j) ? '(Sudah Ada)' : ''}
                </option>
              {/each}
            </select>
          </div>
        </div>

        {#if sambungAyatList.length === 0}
          <div class="sambung-empty-hint">
            <span>ℹ️ Belum ada juz sambung ayat yang diuji untuk siswa ini. Pilih juz pada menu di atas jika siswa diuji muroja'ah sambung ayat.</span>
          </div>
        {:else}
          <div class="sambung-list">
            {#each sambungAyatList as item (item.juz)}
              <div class="sambung-item-row">
                <div class="sambung-item-juz">
                  <span class="juz-tag">Juz {item.juz}</span>
                </div>
                <div class="sambung-predikat-group">
                  <span class="predikat-label">Predikat:</span>
                  <div class="predikat-buttons">
                    <button
                      type="button"
                      class="btn-predikat"
                      class:active-a={item.predikat === 'A'}
                      onclick={() => setSambungAyatPredikat(item.juz, 'A')}
                      title="A - Mumtaz (Istimewa)"
                    >
                      A <span>(Mumtaz)</span>
                    </button>
                    <button
                      type="button"
                      class="btn-predikat"
                      class:active-b={item.predikat === 'B'}
                      onclick={() => setSambungAyatPredikat(item.juz, 'B')}
                      title="B - Jayyid Jiddan (Sangat Baik)"
                    >
                      B <span>(Jayyid Jiddan)</span>
                    </button>
                    <button
                      type="button"
                      class="btn-predikat"
                      class:active-c={item.predikat === 'C'}
                      onclick={() => setSambungAyatPredikat(item.juz, 'C')}
                      title="C - Jayyid (Baik)"
                    >
                      C <span>(Jayyid)</span>
                    </button>
                    <button
                      type="button"
                      class="btn-predikat"
                      class:active-d={item.predikat === 'D'}
                      onclick={() => setSambungAyatPredikat(item.juz, 'D')}
                      title="D - Maqbul (Cukup)"
                    >
                      D <span>(Maqbul)</span>
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn-remove-sambung"
                  onclick={() => removeSambungAyat(item.juz)}
                  title="Hapus Juz ini dari Sambung Ayat"
                >
                  🗑️ Hapus
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if isKelulusan}
      <div class="kelulusan-banner-card">
        <div class="kelulusan-banner-top">
          <div class="kelulusan-banner-info">
            <span class="banner-pill">Standar Kelulusan</span>
            <span class="banner-title">{targetJuzLabel} ({rows.length} Surah)</span>
            <span class="banner-note">· Sesuai visi sekolah</span>
          </div>

          <button
            type="button"
            class="btn-filter-unscored"
            class:active={filterHanyaBelumDinilai}
            onclick={() => (filterHanyaBelumDinilai = !filterHanyaBelumDinilai)}
          >
            {#if filterHanyaBelumDinilai}
              Tampilkan Semua ({rows.length})
            {:else}
              Filter Belum Dinilai ({rows.length - submittedRows.length})
            {/if}
          </button>
        </div>

        <div class="progress-bar-container">
          <div
            class="progress-bar-fill"
            class:complete={submittedRows.length === rows.length && rows.length > 0}
            style="width: {rows.length > 0 ? (submittedRows.length / rows.length) * 100 : 0}%"
          ></div>
        </div>

        <div class="kelulusan-banner-bottom">
          <span class="progress-text">
            <strong>{submittedRows.length}</strong> / <strong>{rows.length}</strong> Surah Dinilai
            ({Math.round(rows.length > 0 ? (submittedRows.length / rows.length) * 100 : 0)}%)
          </span>
          {#if rows.length > 0 && submittedRows.length === rows.length}
            <span class="badge-status-ready">
              ✓ 100% Lengkap (Siap Cetak Rapor Kelulusan)
            </span>
          {:else}
            <span class="badge-status-pending">
              ⚠️ Belum Lengkap: {rows.length - submittedRows.length} surah belum dinilai
            </span>
          {/if}
        </div>
      </div>
    {/if}

    {#if !isKelulusan && rows.length === 0}
      <div class="empty-juz-prompt">
        <div class="prompt-icon">☝️</div>
        <h3>Belum Ada Juz yang Dipilih</h3>
        <p>Silakan klik salah satu atau beberapa tombol Juz di atas untuk menampilkan daftar surah dan memulai penilaian siswa ini.</p>
      </div>
    {:else}
      <section class="sheet-wrap desktop-only" aria-label="Tabel ujian tahfiz">
      <table class="excel-table">
        <thead>
          <tr>
            <th class="col-no">No</th>
            <th class="col-surah">Nama Surah</th>
            <th class="col-juz">Juz</th>
            <th>Kelancaran (1-100)</th>
            <th>Tajwid (1-100)</th>
            <th>Makharijul Huruf (1-100)</th>
            <th class="col-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {#each displayedRowsWithIndex as { row, originalIndex: index } (row.namaMateri)}
            <tr>
              <td class="locked text-center">{index + 1}</td>
              <td class="locked">{row.namaMateri}</td>
              <td class="locked text-center">{row.juz > 0 ? row.juz : '—'}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="100"
                  data-cell={`${index}-0`}
                  bind:value={row.kelancaran}
                  oninput={(e) => handleScoreInput(e, index, 'kelancaran')}
                  onkeydown={(event) => moveCell(event, index, 0)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="100"
                  data-cell={`${index}-1`}
                  bind:value={row.tajwid}
                  oninput={(e) => handleScoreInput(e, index, 'tajwid')}
                  onkeydown={(event) => moveCell(event, index, 1)}
                />
              </td>
              <td>
                <input
                  type="number"
                  min="0"
                  max="100"
                  data-cell={`${index}-2`}
                  bind:value={row.makharijulHuruf}
                  oninput={(e) => handleScoreInput(e, index, 'makharijulHuruf')}
                  onkeydown={(event) => moveCell(event, index, 2)}
                />
              </td>
              <td class="locked total-cell text-center">
                <strong>{total(row)}</strong>
                {#if row.saveStatus}
                  <span class="save-state">{row.saveStatus}</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="6" class="summary-label">Jumlah Materi Disetor</td>
            <td class="summary-value text-center">{submittedRows.length}</td>
          </tr>
          <tr>
            <td colspan="6" class="summary-label">Jumlah Poin</td>
            <td class="summary-value text-center">{totalPoin}</td>
          </tr>
          <tr>
            <td colspan="6" class="summary-label">Preview Rata-rata Poin</td>
            <td class="summary-value final-score text-center">
              {rataRataPoin !== '' ? rataRataPoin : (lastSavedSummary?.nilai_akhir ?? '')}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>

    <!-- Mobile Cards -->
    <section class="mobile-app-ui mobile-cards-view">
       {#each displayedRowsWithIndex as { row, originalIndex: index } (row.namaMateri)}
          <div class="surah-card">
              <div class="surah-top">
                <div class="surah-no">{index + 1}</div>
                <div class="surah-name">{row.namaMateri}</div>
                <div class="juz-badge">Juz {row.juz > 0 ? row.juz : '—'}</div>
              </div>
              <div class="score-grid">
                <div class="score-field">
                  <label>Kelancaran</label>
                  <input type="number" min="0" max="100" bind:value={row.kelancaran} oninput={(e) => handleScoreInput(e, index, 'kelancaran')} />
                </div>
                <div class="score-field">
                  <label>Tajwid</label>
                  <input type="number" min="0" max="100" bind:value={row.tajwid} oninput={(e) => handleScoreInput(e, index, 'tajwid')} />
                </div>
                <div class="score-field">
                  <label>Makharijul</label>
                  <input type="number" min="0" max="100" bind:value={row.makharijulHuruf} oninput={(e) => handleScoreInput(e, index, 'makharijulHuruf')} />
                </div>
              </div>
              <div class="surah-footer">
                <span class="footer-label">Total skor</span>
                <div class="footer-total">
                  <span class="total-num" data-total>{total(row) !== '' ? total(row) : 0}</span>
                  <span class="total-tag" style:opacity={row.saveStatus === 'Menunggu...' || row.saveStatus === 'Menyimpan...' ? '0.35' : '1'}>
                    {#if row.saveStatus === 'Tersimpan'}
                      <svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Tersimpan
                    {:else if row.saveStatus}
                      {row.saveStatus}
                    {/if}
                  </span>
                </div>
              </div>
          </div>
       {/each}
    </section>
    {/if}
  {/if}
</main>

<style>

  .desktop-only { display: block; }
  .mobile-only { display: none !important; }
  @media (max-width: 768px) {
    .desktop-only { display: none !important; }
    .mobile-only { display: block !important; }
  }

  :global(body) {
    background: #f3f4f6;
  }

  .sheet-loading {
    max-width: 1320px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
    border: 1px solid #e5e7eb;
    background: #fff;
  }

  .sheet-empty {
    max-width: 1320px;
    margin: 0 auto;
    padding: 3rem 2rem;
    text-align: center;
    background: #fff;
    border: 1px solid #e5e7eb;
    color: #374151;
  }

  .sheet-empty-icon {
    font-size: 2.5rem;
    margin-bottom: 0.75rem;
  }

  .sheet-empty strong {
    display: block;
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }

  .sheet-empty p {
    font-size: 13px;
    color: #6b7280;
    margin: 0;
  }

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
    margin: 0 auto 12px;
  }

  .back-button-wrapper {
    max-width: 1320px;
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

  .sheet-alert {
    max-width: 1320px;
    margin: 0 auto 12px;
    border: 1px solid #fca5a5;
    background: #fef2f2;
    color: #991b1b;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 700;
  }

  .sheet-wrap {
    max-width: 1320px;
    margin: 0 auto;
    overflow: auto;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }

  .excel-table {
    width: 100%;
    min-width: 1100px;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 13px;
  }

  .excel-table th,
  .excel-table td {
    border: 1px solid #cbd5e1;
    height: 36px;
    padding: 0;
  }

  .excel-table th {
    background: #d9ead3;
    color: #111827;
    font-weight: 700;
    text-align: center;
    padding: 6px;
  }

  .excel-table tbody tr:nth-child(even) .locked {
    background: #f8fafc;
  }

  .excel-table input {
    width: 100%;
    height: 32px;
    border: 0;
    padding: 0 8px;
    box-sizing: border-box;
    text-align: center;
    font: inherit;
    background: #fff;
    outline: none;
  }

  .excel-table input:focus {
    box-shadow: inset 0 0 0 2px #16a34a;
    background: #f0fdf4;
  }

  .locked {
    background: #eef2ff;
    color: #111827;
    font-weight: 600;
    padding: 0 8px;
  }

  .total-cell {
    background: #fef3c7;
    font-weight: 800;
  }

  .total-cell strong,
  .save-state {
    display: block;
  }

  .save-state {
    margin-top: 1px;
    color: #475569;
    font-size: 10px;
    font-weight: 700;
    line-height: 1.1;
  }

  .summary-label,
  .summary-value {
    background: #d9ead3;
    font-weight: 800;
    padding: 0 8px;
  }

  .summary-label {
    text-align: right;
  }

  .summary-value {
    background: #fef3c7;
  }

  .final-score {
    color: #14532d;
    font-size: 13px;
  }

  .text-center {
    text-align: center;
  }

  .col-no {
    width: 48px;
  }

  .col-surah {
    width: 190px;
  }

  .col-juz {
    width: 70px;
  }

  .col-total {
    width: 90px;
  }

  @media (max-width: 720px) {
    .sheet-page {
      padding: 12px;
    }

    .sheet-header {
      align-items: stretch;
      flex-direction: column;
    }

    .meta-box {
      text-align: left;
    }
  }

  /* Anti-Human-Error Kelulusan Banner & Progress */
  .kelulusan-banner-card {
    max-width: 1320px;
    margin: 0 auto 1rem;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }
  .kelulusan-banner-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }
  .kelulusan-banner-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .banner-pill {
    background: #16a34a;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    letter-spacing: 0.02em;
  }
  .banner-title {
    font-size: 0.95rem;
    font-weight: 800;
    color: #0f172a;
  }
  .banner-note {
    font-size: 0.8rem;
    color: #64748b;
  }
  .btn-filter-unscored {
    padding: 0.45rem 0.9rem;
    font-size: 0.82rem;
    font-weight: 700;
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-filter-unscored:hover {
    background: #e2e8f0;
  }
  .btn-filter-unscored.active {
    background: #fef3c7;
    border-color: #f59e0b;
    color: #92400e;
    box-shadow: 0 1px 3px rgba(245, 158, 11, 0.2);
  }
  .progress-bar-container {
    width: 100%;
    height: 10px;
    background: #e2e8f0;
    border-radius: 9999px;
    overflow: hidden;
    margin-bottom: 0.6rem;
  }
  .progress-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #f59e0b, #eab308);
    transition: width 0.3s ease;
    border-radius: 9999px;
  }
  .progress-bar-fill.complete {
    background: linear-gradient(90deg, #16a34a, #22c55e);
  }
  .kelulusan-banner-bottom {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.82rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .progress-text {
    color: #475569;
  }
  .badge-status-ready {
    color: #16a34a;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
  }
  .badge-status-pending {
    color: #b45309;
    font-weight: 600;
  }

  /* Panel Pemilihan Juz Interaktif (Always-accessible & Anti-accidental delete) */
  .juz-selector-card {
    max-width: 1320px;
    margin: 0 auto 1.25rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }
  .juz-selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .juz-selector-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .juz-icon {
    font-size: 1.5rem;
  }
  .juz-title-line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.05rem;
    color: #1e293b;
  }
  .juz-badge-pill {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    background: #e0e7ff;
    color: #3730a3;
  }
  .juz-subtitle {
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 0.15rem;
  }
  .btn-toggle-juz-panel {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    color: #475569;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-toggle-juz-panel:hover {
    background: #f1f5f9;
    color: #1e293b;
    border-color: #94a3b8;
  }
  .juz-warning-box {
    margin-top: 0.75rem;
    background: #fffbeb;
    border: 1px solid #fde68a;
    color: #92400e;
    padding: 0.65rem 0.9rem;
    border-radius: 8px;
    font-size: 0.85rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .btn-close-warning {
    background: transparent;
    border: none;
    color: #92400e;
    cursor: pointer;
    font-weight: bold;
    font-size: 0.9rem;
    padding: 0 4px;
  }
  .juz-chips-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 0.4rem;
    margin-top: 0.85rem;
    padding-top: 0.75rem;
    border-top: 1px dashed #e2e8f0;
  }
  .juz-chip-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.45rem 0.4rem;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.82rem;
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .juz-chip-btn:hover {
    border-color: #6366f1;
    background: #f5f3ff;
    color: #4f46e5;
  }
  .juz-chip-btn.active {
    background: #4f46e5;
    border-color: #4338ca;
    color: #ffffff;
  }
  .juz-chip-btn.active.locked {
    background: #059669;
    border-color: #047857;
    color: #ffffff;
  }
  .chip-badge-lock {
    font-size: 0.75rem;
  }
  .chip-badge-check {
    font-size: 0.75rem;
    font-weight: 800;
  }
  .empty-juz-prompt {
    max-width: 1320px;
    margin: 0 auto 2rem;
    background: #f8fafc;
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    padding: 3rem 1.5rem;
    text-align: center;
    color: #64748b;
  }
  .empty-juz-prompt .prompt-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }
  .empty-juz-prompt h3 {
    margin: 0 0 0.5rem 0;
    color: #1e293b;
    font-size: 1.15rem;
  }
  .empty-juz-prompt p {
    margin: 0;
    font-size: 0.9rem;
  }

  /* Card Uji Sambung Ayat */
  .sambung-ayat-card {
    max-width: 1320px;
    margin: 0 auto 1.25rem;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1rem 1.25rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  }
  .sambung-ayat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .sambung-ayat-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .sambung-icon {
    font-size: 1.5rem;
  }
  .sambung-title-line {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.05rem;
    color: #1e293b;
  }
  .sambung-badge-pill {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    background: #fef3c7;
    color: #92400e;
  }
  .sambung-subtitle {
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 0.15rem;
  }
  .sambung-select-juz {
    padding: 0.45rem 0.85rem;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    color: #1e293b;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    outline: none;
    transition: all 0.15s ease;
  }
  .sambung-select-juz:hover, .sambung-select-juz:focus {
    border-color: #4f46e5;
    background: #ffffff;
  }
  .sambung-empty-hint {
    margin-top: 0.85rem;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border-radius: 8px;
    color: #64748b;
    font-size: 0.85rem;
    border-left: 3px solid #cbd5e1;
  }
  .sambung-list {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-top: 0.85rem;
    padding-top: 0.75rem;
    border-top: 1px dashed #e2e8f0;
  }
  .sambung-item-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 0.6rem 0.9rem;
    flex-wrap: wrap;
  }
  .juz-tag {
    font-weight: 700;
    font-size: 0.95rem;
    color: #1e293b;
    background: #e2e8f0;
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
  }
  .sambung-predikat-group {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .predikat-label {
    font-size: 0.82rem;
    font-weight: 600;
    color: #475569;
  }
  .predikat-buttons {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .btn-predikat {
    padding: 0.35rem 0.65rem;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    font-size: 0.82rem;
    font-weight: 700;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-predikat span {
    font-weight: 400;
    font-size: 0.75rem;
    opacity: 0.85;
  }
  .btn-predikat:hover {
    border-color: #94a3b8;
    background: #f1f5f9;
  }
  .btn-predikat.active-a {
    background: #16a34a;
    border-color: #15803d;
    color: #ffffff;
  }
  .btn-predikat.active-b {
    background: #2563eb;
    border-color: #1d4ed8;
    color: #ffffff;
  }
  .btn-predikat.active-c {
    background: #d97706;
    border-color: #b45309;
    color: #ffffff;
  }
  .btn-predikat.active-d {
    background: #dc2626;
    border-color: #b91c1c;
    color: #ffffff;
  }
  .btn-remove-sambung {
    background: #fee2e2;
    border: 1px solid #fecaca;
    color: #b91c1c;
    border-radius: 6px;
    padding: 0.35rem 0.65rem;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-remove-sambung:hover {
    background: #fecaca;
    border-color: #f87171;
  }
</style>
