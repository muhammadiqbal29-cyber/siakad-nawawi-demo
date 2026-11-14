<script>
  import { SvelteMap } from 'svelte/reactivity';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { syncManager } from '$lib/syncManager.svelte.js';
  import '$lib/components/guru/AlquranMobileUI.css';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  const mataPelajaran = 'Ujian Tasmi';

  let siswaId = $derived($page.params.siswaId);
  let namaSiswa = $derived($page.url.searchParams.get('nama') || `Siswa #${siswaId}`);
  let kelas = $derived($page.url.searchParams.get('kelas') || '-');
  let sekolahId = $derived($page.url.searchParams.get('sekolah_id') || '1');
  let kelasId = $derived($page.url.searchParams.get('kelas_id') || '');
  let rombel = $derived($page.url.searchParams.get('rombel') || '__kosong__');
  let kelasLabel = $derived($page.url.searchParams.get('kelas_label') || '');
	let jenisPenilaian = $derived($page.url.searchParams.get('jenis_penilaian') || 'semester');
  let tahunAjaranId = $derived($page.url.searchParams.get('tahun_ajaran_id'));
  let semesterId = $derived($page.url.searchParams.get('semester_id'));
	let pageTitle = $derived(jenisPenilaian === 'kelulusan' ? 'Ujian Kelulusan Tasmi' : 'Ujian Tasmi');
	
	let tahap = $state(1);

  let backUrl = $derived(
    kelasId
      ? `/guru/input-nilai/tasmi-v2/kelas/${kelasId}?kelas=${encodeURIComponent(kelasLabel)}&rombel=${encodeURIComponent(rombel)}&sekolah_id=${sekolahId}&jenis_penilaian=${encodeURIComponent(jenisPenilaian)}${tahunAjaranId ? `&tahun_ajaran_id=${tahunAjaranId}` : ''}${semesterId ? `&semester_id=${semesterId}` : ''}`
      : '/guru/input-nilai/tasmi-v2'
  );

  let allRows = $state([]);
  let rows = $state([]);
  let materiTidakAda = $state(false);

  let loading = $state(false);
  let loadError = $state('');
  let lastSavedSummary = $state(null);
  const saveTimers = new SvelteMap();
  
  let showJuzSelection = $state(false);
  let availableJuz = $state([]);
  let selectedJuz = $state([]);
  let savingJuz = $state(false);

  onMount(init);

  $effect(() => {
    if (typeof window !== 'undefined' && allRows.length > 0) {
      const cacheKey = `siakad_offline_tasmi_v2_detail_${siswaId}_${jenisPenilaian}`;
      localStorage.setItem(cacheKey, JSON.stringify({
        allRows,
        rows,
        selectedJuz,
        tahap,
        lastSavedSummary,
        showJuzSelection
      }));
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

  async function init() {
    loadError = '';

    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    if (typeof window !== 'undefined') {
      const cacheKey = `siakad_offline_tasmi_v2_detail_${siswaId}_${jenisPenilaian}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (data.allRows && data.allRows.length > 0) {
            allRows = data.allRows;
            rows = data.rows || [];
            selectedJuz = data.selectedJuz || [];
            tahap = data.tahap || 1;
            lastSavedSummary = data.lastSavedSummary || null;
            showJuzSelection = data.showJuzSelection ?? true;
            materiTidakAda = false;
            loading = false;
          }
        } catch (e) {}
      }
    }

    if (allRows.length === 0) {
      loading = true;
    }

    try {
      // 1. Fetch daftar materi aktif dari backend
      const materiRes = await fetch(`${apiUrl}/api/guru/sekolah/${sekolahId}/materi-tahfiz`, {
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

      // Collect available Juz
      const juzSet = new Set();
      materiData.forEach(m => {
        if (m.juz > 0) juzSet.add(m.juz);
      });
      availableJuz = Array.from(juzSet).sort((a, b) => a - b);

      // 2. Bangun rows dari materi
      if (allRows.length === 0) {
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

      
      // 3. Fetch riwayat to determine maxTahap
      try {
        const riwayatRes = await fetch(`${apiUrl}/api/guru/siswa/${siswaId}/riwayat-tasmi-v2?sekolah_id=${sekolahId}`, {
          credentials: 'include'
        });
        if (riwayatRes.ok) {
          const rData = await riwayatRes.json();
          const rList = rData.riwayat || [];
          if (rList.length > 0) {
            let maxTahap = 0;
            for (const r of rList) {
              if (r.tahap > maxTahap) maxTahap = r.tahap;
            }
            if (maxTahap < 5) {
                tahap = maxTahap + 1;
            } else {
                tahap = 5;
            }
          }
        }
      } catch (e) {
        console.error(e);
      }

      // 4. Fetch nilai yang sudah ada
      await loadNilaiTasmiV2();

    } catch (err) {
      loadError = err.message || 'Gagal memuat halaman.';
    } finally {
      loading = false;
    }
  }

  async function handleTahapChange() {
    // Reset state before loading new tahap
    allRows = allRows.map(r => ({ ...r, kelancaran: '', tajwid: '', makharijulHuruf: '', saveStatus: '' }));
    selectedJuz = [];
    showJuzSelection = true;
    lastSavedSummary = null;
    await loadNilaiTasmiV2();
  }

  async function loadNilaiTasmiV2() {
    try {
      const params = new URLSearchParams({
        mata_pelajaran: 'Ujian Tasmi',
        jenis_penilaian: jenisPenilaian,
        tahap: String(tahap)
      });
      if (tahunAjaranId) params.append('tahun_ajaran_id', tahunAjaranId);
      if (semesterId) params.append('semester_id', semesterId);
      const res = await fetch(
        `${apiUrl}/api/guru/siswa/${siswaId}/nilai-tasmi-v2?${params.toString()}`,
        {
          credentials: 'include'
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal memuat nilai tasmi v2.');
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

      if (lastSavedSummary && lastSavedSummary.juz_yang_diujikan) {
        selectedJuz = lastSavedSummary.juz_yang_diujikan.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        applyJuzFilter();
      } else {
        showJuzSelection = true;
      }
    } catch (err) {
      loadError = err.message || 'Gagal memuat nilai tasmi.';
    }
  }

  function applyJuzFilter() {
    if (selectedJuz.length > 0) {
      rows = allRows.filter(r => selectedJuz.includes(r.juz));
    } else {
      rows = [];
    }
    showJuzSelection = false;
  }
  
  function toggleJuz(j) {
    if (selectedJuz.includes(j)) {
      selectedJuz = selectedJuz.filter(x => x !== j);
    } else {
      selectedJuz = [...selectedJuz, j];
    }
  }

  async function saveJuzSelection() {
    if (selectedJuz.length === 0) {
      loadError = 'Pilih minimal 1 juz untuk ujian Tasmi.';
      return;
    }
    savingJuz = true;
    loadError = '';
    try {
      const payload = {
        mata_pelajaran: 'Ujian Tasmi',
        jenis_penilaian: jenisPenilaian,
        tahap: tahap,
        tahun_ajaran_id: tahunAjaranId ? Number(tahunAjaranId) : undefined,
        semester_id: semesterId ? Number(semesterId) : undefined,
        juz_yang_diujikan: selectedJuz.join(','),
        siswa_id: Number(siswaId) // For deduplication
      };
      syncManager.enqueue(`${apiUrl}/api/guru/siswa/${siswaId}/nilai-tasmi-v2/juz`, payload, { method: 'POST' });
      applyJuzFilter();
    } catch (err) {
      loadError = err.message || 'Gagal menyimpan Juz yang diujikan.';
    } finally {
      savingJuz = false;
    }
  }

  function handleScoreInput(event, rowIndex, field) {
    let val = event.target.value;
    if (val.length > 1 && val.startsWith('0')) {
      val = Number(val).toString();
      event.target.value = val;
    }
    rows[rowIndex][field] = clampScore(val);
    scheduleAutosave(rowIndex);
  }

  function scheduleAutosave(rowIndex) {
    const existingTimer = saveTimers.get(rowIndex);
    if (existingTimer) clearTimeout(existingTimer);

    rows[rowIndex].saveStatus = 'Menunggu...';
    const timer = setTimeout(() => {
      saveTimers.delete(rowIndex);
      autosaveRow(rowIndex);
    }, 650);
    saveTimers.set(rowIndex, timer);
  }

  async function autosaveRow(rowIndex) {
    const row = rows[rowIndex];
    row.saveStatus = 'Menyimpan...';

    try {
      const payload = {
          siswa_id: Number(siswaId), // Important for syncManager deduplication
          mata_pelajaran: 'Ujian Tasmi',
          jenis_penilaian: jenisPenilaian,
          tahap: tahap,
          tahun_ajaran_id: tahunAjaranId ? Number(tahunAjaranId) : undefined,
          semester_id: semesterId ? Number(semesterId) : undefined,
          nama_materi: row.namaMateri,
          juz: row.juz,
          urutan: row.urutan,
          skor_kelancaran: scoreNumber(row.kelancaran),
          skor_tajwid: scoreNumber(row.tajwid),
          skor_makharijul_huruf: scoreNumber(row.makharijulHuruf)
      };

      syncManager.enqueue(`${apiUrl}/api/guru/siswa/${siswaId}/nilai-tasmi-v2/detail`, payload, { method: 'POST' });

      row.saveStatus = 'Tersimpan (Auto)';
    } catch (err) {
      row.saveStatus = err.message || 'Gagal';
    }
  }

  let submittedRows = $derived(rows.filter((row) => total(row) !== ''));
  let totalPoin = $derived(submittedRows.reduce((sum, row) => sum + total(row), 0));
  let rataRataPoin = $derived(
    rows.length > 0 ? Number(((totalPoin / rows.length) / 3).toFixed(2)) : ''
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
      
      <div style="display: flex; gap: 1rem; align-items: center;">
        <label style="font-weight: 600; font-size: 0.9rem; color: #475569;">Tahap Ujian:</label>
        <select bind:value={tahap} onchange={handleTahapChange} class="form-input" style="width: auto; padding: 0.25rem 0.5rem;">
          <option value={1}>Tahap 1</option>
          <option value={2}>Tahap 2</option>
          <option value={3}>Tahap 3</option>
          <option value={4}>Tahap 4</option>
          <option value={5}>Tahap 5</option>
        </select>
      </div>
      <div class="meta-box">
        <span>Juz {selectedJuz.join(', ') || '-'}</span>
        <strong>{lastSavedSummary?.jumlah_materi ?? submittedRows.length} Materi Disetor</strong>
        <small>{loading ? 'Memuat...' : 'Autosave aktif'}</small>
      </div>
    </section>
  </div>

  <!-- Mobile Header -->
  <div class="mobile-app-ui mobile-app-header">
     <div class="app-header-top" style="flex-direction: row; justify-content: space-between; align-items: center; width: 100%;">
         <a class="back-btn" href={backUrl}>
             <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                 <path d="M8 2L3.5 6.5L8 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
             </svg>
             Kembali
         </a>
         <select bind:value={tahap} onchange={handleTahapChange} style="padding: 4px 8px; border-radius: 8px; border: 1px solid var(--border); font-weight: 700; font-size: 12px; background: var(--card); color: var(--text);">
           <option value={1}>Tahap 1</option>
           <option value={2}>Tahap 2</option>
           <option value={3}>Tahap 3</option>
           <option value={4}>Tahap 4</option>
           <option value={5}>Tahap 5</option>
         </select>
     </div>
     <div class="page-title" style="margin-top: 12px;">{pageTitle}</div>
     <div class="student-row">
         <div class="student-avatar">{namaSiswa.charAt(0)}</div>
         <div class="student-sub"><b>{namaSiswa}</b> · {kelasLabel} - {rombel === '__kosong__' || !rombel ? 'Tanpa Rombel' : 'Rombel ' + rombel}</div>
     </div>
     <div class="stat-card">
         <div class="stat-item">
             <div class="stat-num">Juz {selectedJuz.join(', ')}</div>
             <div class="stat-label">Target juz</div>
         </div>
         <div class="stat-item">
             <div class="stat-num">{lastSavedSummary?.jumlah_materi ?? submittedRows.length}</div>
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
      <strong>Materi tasmi belum dikonfigurasi</strong>
      <p>Hubungi admin untuk menambahkan daftar materi sebelum input nilai dapat dilakukan.</p>
    </div>
  {:else if showJuzSelection}
    <div class="juz-selection-card">
      <div class="juz-selection-header">
        <h2>Pilih Juz yang Diujikan</h2>
        <p>Pilih satu atau beberapa juz untuk ujian Tasmi siswa ini.</p>
      </div>
      <div class="juz-grid">
        {#each availableJuz as juz}
          <button 
            class="juz-btn {selectedJuz.includes(juz) ? 'active' : ''}" 
            onclick={() => toggleJuz(juz)}
          >
            Juz {juz}
          </button>
        {/each}
      </div>
      <div class="juz-actions">
        <button class="btn-save-juz" onclick={saveJuzSelection} disabled={savingJuz || selectedJuz.length === 0}>
          {savingJuz ? 'Menyimpan...' : 'Lanjutkan ke Penilaian'}
        </button>
      </div>
    </div>
  {:else}
    <section class="sheet-wrap desktop-only" aria-label="Tabel ujian tasmi">
      <div class="juz-edit-bar">
        <span>Juz yang diujikan: <strong>{selectedJuz.join(', ')}</strong></span>
        <button class="btn-edit-juz" onclick={() => showJuzSelection = true}>Ubah Juz</button>
      </div>
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
          {#each rows as row, index (row.namaMateri)}
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
              {lastSavedSummary?.nilai_akhir ?? rataRataPoin}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>

    <!-- Mobile Cards -->
    <section class="mobile-app-ui mobile-cards-view">
       <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
         <span style="font-size: 12px; color: var(--muted); font-weight: 600;">Juz yang diujikan: <strong>{selectedJuz.join(', ')}</strong></span>
         <button onclick={() => showJuzSelection = true} style="background: none; border: none; color: var(--blue); font-weight: 700; font-size: 12.5px; padding: 4px;">Ubah</button>
       </div>

       {#each rows as row, index (row.namaMateri)}
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
</main>

<style>
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
  
  .juz-selection-card {
    max-width: 600px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 24px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  }

  .juz-selection-header h2 {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
    color: #1e293b;
  }

  .juz-selection-header p {
    margin: 0 0 24px 0;
    font-size: 0.875rem;
    color: #64748b;
  }

  .juz-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }

  .juz-btn {
    padding: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .juz-btn:hover {
    border-color: #cbd5e1;
    background: #f1f5f9;
  }

  .juz-btn.active {
    background: #4f46e5;
    border-color: #4338ca;
    color: #fff;
  }

  .juz-actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn-save-juz {
    padding: 10px 20px;
    background: #16a34a;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
  }
  
  .btn-save-juz:hover:not(:disabled) {
    background: #15803d;
  }

  .btn-save-juz:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .juz-edit-bar {
    padding: 12px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #cbd5e1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 14px;
  }

  .btn-edit-juz {
    padding: 6px 12px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: #4f46e5;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-edit-juz:hover {
    background: #eff6ff;
    border-color: #bfdbfe;
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
</style>
