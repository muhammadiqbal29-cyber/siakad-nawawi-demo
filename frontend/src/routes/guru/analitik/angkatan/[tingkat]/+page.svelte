<script>
  import { page } from '$app/stores';
  import { goto, replaceState } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { guruState } from '$lib/guruState.svelte.js';
  import { onMount, untrack } from 'svelte';
  import BarChart from '$lib/components/charts/BarChart.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let tingkat = $derived($page.params.tingkat);
  
  let dataDiniyah = $state([]);
  let loadingData = $state(false);
  let error = $state('');

  // AI Meso
  let aiHtmlMeso = $state('');
  let loadingAiMeso = $state(false);
  let errorAiMeso = $state('');

  // AI Mikro
  let selectedSiswa = $state(null);
  let aiHtmlSiswa = $state('');
  let loadingAiSiswa = $state(false);
  let errorAiSiswa = $state('');

  // Filters
  let selectedMapel = $state('');
  let selectedRombel = $state('all');
  let mapelList = $state([]);
  let rombelList = $state([]);

  // Drilldown
  let drilledCategory = $state('');
  let drilledStudents = $state([]);
  let searchQuery = $state('');

  let filteredDrilledStudents = $derived.by(() => {
    if (!searchQuery) return drilledStudents;
    return drilledStudents.filter(s => s.nama.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  $effect(() => {
    const sekolahId = guruState.activeSekolahId;
    const taId = guruState.activeTahunId;
    const semId = guruState.activeSemesterId;
    const currentTingkat = tingkat; // MUHAMMAD IQBAL: Lacak perubahan tingkat dari URL
    
    if (sekolahId && taId && semId && currentTingkat) {
      untrack(() => loadData(taId, semId));
    }
  });

  async function loadData(taId, semId) {
    loadingData = true;
    error = '';
    
    try {
      const params = new URLSearchParams();
      if (taId) params.append('tahun_ajaran_id', taId);
      if (semId) params.append('semester_id', semId);

      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${guruState.activeSekolahId}/dashboard/diniyah?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Gagal memuat data diniyah');
      
      const allData = await res.json() || [];
      
      // Hanya ambil yang sesuai Tingkat (Angkatan) ini
      dataDiniyah = allData.filter(d => (d.tingkat || 'Belum ada Kelas') === tingkat);

      // Extract unique Mapels & Rombels
      mapelList = [...new Set(dataDiniyah.map(d => d.mapel || 'Tanpa Mapel'))].sort();
      rombelList = [...new Set(dataDiniyah.map(d => d.rombel || '-'))].sort();
      
      if (mapelList.length > 0) {
        // Pulihkan State dari URL jika ada
        const urlParams = new URLSearchParams(window.location.search);
        const mapelParam = urlParams.get('mapel');
        const rombelParam = urlParams.get('rombel');
        const kategoriParam = urlParams.get('kategori');
        const siswaIdParam = urlParams.get('siswa_id');

        if (mapelParam && mapelList.includes(mapelParam)) {
            selectedMapel = mapelParam;
        } else {
            selectedMapel = mapelList[0];
        }

        if (rombelParam && rombelList.includes(rombelParam)) {
            selectedRombel = rombelParam;
        }

        // Tunggu derived data (activeData) berhitung, lalu pulihkan kategori/siswa
        setTimeout(() => {
            if (kategoriParam) {
                handleDrilldown(kategoriParam);
            }
            if (siswaIdParam) {
                const sId = parseInt(siswaIdParam);
                // Cari di array yang aktif
                const s = dataDiniyah.find(x => x.id === sId);
                if (s) {
                    selectedMapel = s.mapel || mapelList[0];
                    handleSiswaClick(s, false); // false = jangan update url lagi
                }
            }
        }, 100);
      }

    } catch (err) {
      error = err.message;
    } finally {
      loadingData = false;
    }
  }

  // Derived filtered data for KPI & Chart
  let activeData = $derived.by(() => {
    return dataDiniyah.filter(d => 
      (d.mapel || 'Tanpa Mapel') === selectedMapel &&
      (selectedRombel === 'all' || (d.rombel || '-') === selectedRombel)
    );
  });

  // KPI
  let kpiAvg = $derived.by(() => {
    const d = activeData;
    if (d.length === 0) return 0;
    return d.reduce((acc, curr) => acc + curr.nilai, 0) / d.length;
  });

  let kpiTuntas = $derived.by(() => {
    const d = activeData;
    if (d.length === 0) return 0;
    const count = d.filter(x => x.nilai >= 70).length;
    return (count / d.length) * 100;
  });

  let kpiRisiko = $derived.by(() => {
    return activeData.filter(x => x.nilai >= 60 && x.nilai < 70).length;
  });

  let kpiRemedial = $derived.by(() => {
    return activeData.filter(x => x.nilai < 60).length;
  });

  // Histogram
  function getColor(val) {
    if (val >= 90) return '#4ade80';
    if (val >= 80) return '#a3e635';
    if (val >= 70) return '#facc15';
    if (val >= 60) return '#fb923c';
    return '#ef4444';
  }

  let histogramData = $derived.by(() => {
    const d = activeData;
    let bins = [
      { label: 'Sangat Baik (90-100)', min: 90, max: 100, value: 0, color: '#4ade80' },
      { label: 'Baik (80-89)', min: 80, max: 89.99, value: 0, color: '#a3e635' },
      { label: 'Cukup (70-79)', min: 70, max: 79.99, value: 0, color: '#facc15' },
      { label: 'Risiko (60-69)', min: 60, max: 69.99, value: 0, color: '#fb923c' },
      { label: 'Remedial (<60)', min: 0, max: 59.99, value: 0, color: '#ef4444' }
    ];

    d.forEach(student => {
      const n = student.nilai;
      if (n >= 90) bins[0].value++;
      else if (n >= 80) bins[1].value++;
      else if (n >= 70) bins[2].value++;
      else if (n >= 60) bins[3].value++;
      else bins[4].value++;
    });

    return bins;
  });

  let maxHistogramValue = $derived.by(() => {
    return Math.max(1, ...histogramData.map(b => b.value)) * 1.2;
  });

  function handleBarClick(item) {
    const categoryMap = {
      'Sangat Baik (90-100)': 'Sangat Baik',
      'Baik (80-89)': 'Baik',
      'Cukup (70-79)': 'Cukup',
      'Risiko (60-69)': 'Risiko',
      'Remedial (<60)': 'Remedial'
    };
    handleDrilldown(categoryMap[item.label] || item.label);
  }

  function handleDrilldown(kategori, updateUrl = true) {
    drilledCategory = kategori;
    searchQuery = '';
    
    // Filter activeData based on category limits
    drilledStudents = activeData.filter(s => {
      if (kategori === 'Sangat Baik') return s.nilai >= 90;
      if (kategori === 'Baik') return s.nilai >= 80 && s.nilai < 90;
      if (kategori === 'Cukup') return s.nilai >= 70 && s.nilai < 80;
      if (kategori === 'Risiko') return s.nilai >= 60 && s.nilai < 70;
      if (kategori === 'Remedial') return s.nilai < 60;
      return true;
    });

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('kategori', kategori);
      if (selectedMapel) url.searchParams.set('mapel', selectedMapel);
      if (selectedRombel !== 'all') url.searchParams.set('rombel', selectedRombel);
      replaceState(url, {});
    }

    setTimeout(() => {
      document.getElementById('drilledSection')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  function handleSiswaClick(siswa, updateUrl = true) {
    selectedSiswa = siswa;

    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('siswa_id', siswa.id);
      if (selectedMapel) url.searchParams.set('mapel', selectedMapel);
      if (selectedRombel !== 'all') url.searchParams.set('rombel', selectedRombel);
      if (drilledCategory) url.searchParams.set('kategori', drilledCategory);
      replaceState(url, {});
    }

    runAiSiswa(siswa.id);
    setTimeout(() => {
      document.getElementById('studentProfile')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }

  // AI Functions
  async function runAiMeso(force = false) {
    if(activeData.length === 0) return;

    loadingAiMeso = true;
    errorAiMeso = '';
    aiHtmlMeso = '';

    const payload = {
      filter_judul: `Tingkat ${tingkat} - ${selectedMapel} (${selectedRombel === 'all' ? 'Semua Rombel' : 'Rombel ' + selectedRombel})`,
      total_siswa: activeData.length,
      sangat_baik: histogramData[0].value,
      baik: histogramData[1].value,
      cukup: histogramData[2].value,
      risiko: histogramData[3].value,
      remedial: histogramData[4].value
    };

    try {
      const sekolahId = guruState.activeSekolahId;
      let url = `${apiUrl}/api/guru/sekolah/${sekolahId}/analitik-meso-diniyah`;
      if (force) url += '?force=true';

      const res = await fetch(url, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        credentials: 'include' 
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Gagal memuat AI');
      aiHtmlMeso = data.ai_html;
    } catch (err) {
      errorAiMeso = err.message;
    } finally {
      loadingAiMeso = false;
    }
  }

  async function runAiSiswa(siswaId, force = false) {
    loadingAiSiswa = true;
    errorAiSiswa = '';
    aiHtmlSiswa = '';
    
    try {
      const sekolahId = guruState.activeSekolahId;
      const taId = guruState.activeTahunId;
      const semId = guruState.activeSemesterId;
      let url = `${apiUrl}/api/guru/sekolah/${sekolahId}/siswa/${siswaId}/analitik-diniyah?tahun_ajaran_id=${taId}&semester_id=${semId}`;
      if (force) url += '&force=true';

      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Gagal memuat AI');
      aiHtmlSiswa = data.ai_html;
    } catch (err) {
      errorAiSiswa = err.message;
    } finally {
      loadingAiSiswa = false;
    }
  }
</script>

<svelte:head>
  <title>Rincian Analitik - SIAKAD</title>
</svelte:head>

<div class="page-container" style="display: {selectedSiswa ? 'none' : 'block'}">
  <button class="back-button" onclick={() => goto('/guru/analitik')}>
    <Icon name="arrowLeft" size={18} /> Kembali ke Dashboard Utama
  </button>

  <div class="header">
    <div>
      <h1 class="page-title">Rincian Analitik: Kelas {tingkat}</h1>
      <p class="page-subtitle">Bedah tuntas ketuntasan belajar per mata pelajaran hingga individu siswa.</p>
    </div>
    <div class="filters">
      <div class="select-input">{guruState.activeTahunName}</div>
    </div>
  </div>

  {#if loadingData}
    <div class="loading-state">
      <Icon name="refreshCw" size={24} class="spin" />
      <p>Memuat rincian...</p>
    </div>
  {:else if error}
    <div class="alert-error">{error}</div>
  {:else}
    <div class="section-divider">
      <h2>Analisis Rinci per Mata Pelajaran</h2>
      <div class="line"></div>
      <select class="select-input highlight" bind:value={selectedMapel}>
        {#each mapelList as m}
          <option value={m}>Pilih Mapel: {m}</option>
        {/each}
      </select>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-title">Rata-Rata ({selectedRombel === 'all' ? 'Semua Rombel' : selectedRombel}) <Icon name="info" size={16}/></div>
        <div class="kpi-value" style="color: {getColor(kpiAvg)}">{kpiAvg.toFixed(2)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Siswa Tuntas (>70) <Icon name="checkCircle" size={16}/></div>
        <div class="kpi-value" style="color: #4ade80">{Math.round(kpiTuntas)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Siswa Risiko (60-69) <Icon name="alertTriangle" size={16}/></div>
        <div class="kpi-value" style="color: #fb923c">{kpiRisiko} Siswa</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-title">Siswa Remedial (&lt;60) <Icon name="alertTriangle" size={16}/></div>
        <div class="kpi-value" style="color: #ef4444">{kpiRemedial} Siswa</div>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-header">
        <div>
          <h2 class="chart-title">Distribusi Nilai Siswa</h2>
          <p class="chart-subtitle">Lihat sebaran nilai akhir. <b>Klik pada batang grafik untuk melihat daftar siswa.</b></p>
        </div>
        <select class="select-input" bind:value={selectedRombel}>
          <option value="all">Semua Rombel</option>
          {#each rombelList as r}
            <option value={r}>Rombel {r}</option>
          {/each}
        </select>
      </div>

      <!-- AI MESO -->
      <div class="ai-insight-box">
        <div class="ai-header-flex">
          <div class="ai-title"><Icon name="pieChart" size={20} /> Evaluasi Mengajar Kelas (AI)</div>
          <button class="btn-ai" onclick={() => runAiMeso()} disabled={loadingAiMeso}>
            <Icon name="refreshCw" size={16} /> Evaluasi Kelas Ini
          </button>
        </div>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 1rem;">
          Gunakan kecerdasan buatan Gemini untuk menganalisis bentuk distribusi nilai seisi kelas dan mengevaluasi efektivitas metode mengajar guru.
        </p>
        
        {#if loadingAiMeso}
          <div class="ai-skeleton">
            <div class="skel-line w-100"></div>
            <div class="skel-line w-100"></div>
            <div class="skel-line w-80"></div>
          </div>
        {:else if errorAiMeso}
          <div class="alert-error">
            <Icon name="alertTriangle" size={20} /> {errorAiMeso}
          </div>
        {:else if aiHtmlMeso}
          <div class="ai-result">
            <ul style="padding-left:1.2rem; margin:0;">
              {@html aiHtmlMeso}
            </ul>
          </div>
        {/if}
      </div>

      <div style="margin-top: 1.5rem; min-height: 350px;">
        <BarChart
          data={histogramData}
          max={maxHistogramValue}
          labelFormat={(v) => v + ' Siswa'}
          onBarClick={handleBarClick}
        />
      </div>

      {#if drilledCategory}
        <div id="drilledSection" class="drilled-students-container">
          <div style="display:flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="font-size: 1rem; color: var(--color-text-main); margin:0;">Daftar Siswa Kategori: <span>{drilledCategory}</span></h3>
              <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-top:0.25rem;">Klik kartu siswa untuk membuka Halaman Profil Rinci.</p>
            </div>
            <div class="autocomplete-container" style="margin: 0; width: 250px;">
              <Icon name="eye" size={16} class="search-icon" />
              <input type="text" bind:value={searchQuery} class="student-search-input" placeholder="Cari Siswa..." />
            </div>
          </div>
          
          <div class="drilled-students-grid">
            {#each filteredDrilledStudents as siswa}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div class="student-mini-card" onclick={() => handleSiswaClick(siswa)}>
                <div>
                  <div class="smc-name">{siswa.nama}</div>
                  <div style="font-size: 0.8rem; color: #64748b;">Rombel {siswa.rombel || '-'}</div>
                </div>
                <div class="smc-score" style="color: {getColor(siswa.nilai)}">{siswa.nilai}</div>
              </div>
            {/each}
            {#if filteredDrilledStudents.length === 0}
              <div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: #94a3b8; border: 1px dashed #cbd5e1; border-radius: 8px;">
                Tidak ada siswa yang ditemukan.
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<!-- ========================================== -->
<!-- HALAMAN PROFIL SISWA (MUNCUL JIKA DIKLIK) -->
<!-- ========================================== -->
{#if selectedSiswa}
  <div id="studentProfile" class="page-container">
    <button class="back-button" onclick={() => { 
        selectedSiswa = null; 
        const url = new URL(window.location.href);
        url.searchParams.delete('siswa_id');
        replaceState(url, {});
    }}>
      <Icon name="arrowLeft" size={18} /> Kembali ke Rincian Kelas
    </button>

    <div class="header">
      <div>
        <h1 class="page-title">{selectedSiswa.nama}</h1>
        <p class="page-subtitle">Rombel: {selectedSiswa.rombel || '-'} | Mapel Terpilih: {selectedMapel}</p>
      </div>
    </div>

    <div class="chart-card" style="margin-top: 1.5rem;">
      <div class="chart-header">
        <div>
          <h2 class="chart-title">Rincian Komponen Nilai (Mikro)</h2>
          <p class="chart-subtitle">Lihat nilai detail yang menyumbang nilai akhir {selectedMapel}.</p>
        </div>
      </div>
      
      <div style="padding: 2rem; display: flex; flex-direction: column; align-items: center; gap: 1rem; border: 1px dashed #cbd5e1; border-radius: 8px; margin-top: 1.5rem; background: #f8fafc;">
        <div style="font-size: 3rem; font-weight: 800; color: {getColor(selectedSiswa.nilai)}">{selectedSiswa.nilai}</div>
        <p style="color: #64748b; margin:0;">Nilai Akhir Rapor untuk {selectedMapel}</p>
      </div>

      <!-- AI MIKRO -->
      <div class="ai-insight-box">
        <div class="ai-header-flex">
          <div class="ai-title"><Icon name="pieChart" size={20} /> Evaluasi Progres Historis & Mikro (AI)</div>
          <button class="btn-ai" onclick={() => runAiSiswa(selectedSiswa.id, true)} disabled={loadingAiSiswa}>
            <Icon name="refreshCw" size={16} /> Analisis Pertumbuhan Siswa
          </button>
        </div>
        <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 1rem;">
          Gunakan Gemini AI untuk membandingkan data historis, mendeteksi anomali pertumbuhan, dan mengevaluasi efektivitas proses belajar.
        </p>
        
        {#if loadingAiSiswa}
          <div class="ai-skeleton">
            <div class="skel-line w-100"></div>
            <div class="skel-line w-100"></div>
            <div class="skel-line w-80"></div>
          </div>
        {:else if errorAiSiswa}
          <div class="alert-error">
            <Icon name="alertTriangle" size={20} /> {errorAiSiswa}
          </div>
        {:else if aiHtmlSiswa}
          <div class="ai-result">
            <ul style="padding-left:1.2rem; margin:0;">
              {@html aiHtmlSiswa}
            </ul>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .page-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding-bottom: 4rem;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--color-border, #e2e8f0);
  }
  .page-title {
    margin: 0;
    font-size: 1.5rem;
    color: var(--color-text-main, #1e293b);
    font-weight: 700;
  }
  .page-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted, #64748b);
  }
  .filters {
    display: flex;
    gap: 1rem;
  }
  .select-input {
    padding: 0.6rem 1rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.5rem;
    background: var(--color-surface, #ffffff);
    font-weight: 500;
    color: var(--color-text-main, #1e293b);
  }
  .select-input.highlight {
    background: #f8fafc;
    border-color: #94a3b8;
    font-weight: 700;
  }
  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--color-surface, #fff);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.5rem;
    font-weight: 600;
    color: var(--color-text-main, #1e293b);
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 1.5rem;
    align-self: flex-start;
  }
  .back-button:hover {
    background: var(--color-bg-body, #f8fafc);
    border-color: var(--color-primary, #22c55e);
    color: var(--color-primary, #22c55e);
  }

  .section-divider {
    display: flex;
    align-items: center;
    margin: 0 0 1.5rem 0;
    gap: 1rem;
  }
  .section-divider h2 {
    font-size: 1.2rem;
    font-weight: 700;
    white-space: nowrap;
    margin: 0;
  }
  .section-divider .line {
    height: 1px;
    background: var(--color-border, #e2e8f0);
    flex: 1;
  }

  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  .kpi-card {
    background: var(--color-surface, #fff);
    padding: 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid var(--color-border, #e2e8f0);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .kpi-title {
    font-size: 0.85rem;
    color: var(--color-text-muted, #64748b);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
  }
  .kpi-value {
    font-size: 1.8rem;
    font-weight: 800;
  }

  .chart-card {
    background: var(--color-surface, #ffffff);
    padding: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid var(--color-border, #e2e8f0);
    margin-bottom: 2rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }
  .chart-header {
    padding-bottom: 1rem;
    border-bottom: 1px dashed var(--color-border, #e2e8f0);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .chart-title {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-main, #1e293b);
  }
  .chart-subtitle {
    font-size: 0.9rem;
    color: var(--color-text-muted, #64748b);
    margin: 0.25rem 0 0 0;
  }

  .ai-insight-box {
    margin-top: 1.5rem;
    border: 1px solid #e0c8ff;
    background: linear-gradient(to right, #fbf7ff, #ffffff);
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: 0 4px 15px -3px rgba(139, 92, 246, 0.1);
  }
  .ai-header-flex {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .ai-title {
    font-weight: 700;
    color: #7c3aed;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
  }
  .btn-ai {
    background: linear-gradient(135deg, #8b5cf6, #d946ef);
    color: white;
    border: none;
    padding: 0.5rem 1.25rem;
    border-radius: 2rem;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .btn-ai:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
  }
  .btn-ai:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .ai-skeleton {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: 1rem;
  }
  .skel-line {
    height: 12px;
    background: #e2e8f0;
    border-radius: 4px;
    animation: pulse 1.5s infinite ease-in-out;
  }
  .skel-line.w-100 { width: 100%; }
  .skel-line.w-80 { width: 80%; }
  @keyframes pulse {
    0% { opacity: 0.5; }
    50% { opacity: 1; }
    100% { opacity: 0.5; }
  }
  .ai-result {
    margin-top: 1rem;
    font-size: 0.95rem;
    line-height: 1.6;
    color: var(--color-text-main, #1e293b);
  }
  .alert-error {
    margin-top: 1rem;
    padding: 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.5rem;
    color: #dc2626;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .drilled-students-container {
    margin-top: 2rem;
    border-top: 1px dashed var(--color-border, #e2e8f0);
    padding-top: 2rem;
  }
  .autocomplete-container {
    position: relative;
    width: 100%;
  }
  .search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--color-text-muted, #64748b);
  }
  .student-search-input {
    width: 100%;
    padding: 0.6rem 1rem 0.6rem 2.5rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.5rem;
    background: var(--color-bg-body, #f8fafc);
    font-size: 0.9rem;
    outline: none;
  }
  .student-search-input:focus {
    border-color: var(--color-primary, #22c55e);
  }
  .drilled-students-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
  .student-mini-card {
    background: var(--color-bg-body, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.5rem;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
  }
  .student-mini-card:hover {
    border-color: var(--color-primary, #22c55e);
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  }
  .smc-name {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--color-text-main, #1e293b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 120px;
  }
  .smc-score {
    font-size: 1.2rem;
    font-weight: 800;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    gap: 1rem;
    color: #64748b;
  }

  @media (max-width: 768px) {
    .header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
    .filters { width: 100%; flex-wrap: wrap; }
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
    .chart-header { flex-direction: column; gap: 1rem; }
    .section-divider { flex-wrap: wrap; }
    .section-divider .select-input { width: 100%; }
    .drilled-students-grid { grid-template-columns: 1fr; }
  }
</style>
