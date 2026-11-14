<script>
  import Icon from '$lib/components/ui/Icon.svelte';
  import { goto } from '$app/navigation';
  import { guruState } from '$lib/guruState.svelte.js';
  import { untrack } from 'svelte';
  import BarChart from '$lib/components/charts/BarChart.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let allData = $state([]);
  let loadingData = $state(false);
  let error = $state('');



  $effect(() => {
    const sekolahId = guruState.activeSekolahId;
    const taId = guruState.activeTahunId;
    const semId = guruState.activeSemesterId;
    if (sekolahId && taId && semId) {
      untrack(() => loadData(taId, semId));
    }
  });

  async function loadData(taId = guruState.activeTahunId, semId = guruState.activeSemesterId) {
    if (typeof window !== 'undefined' && guruState.activeSekolahId) {
      const cacheKey = `siakad_offline_diniyah_dashboard_${guruState.activeSekolahId}_${taId}_${semId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) {
            allData = parsed;
            loadingData = false;
          }
        } catch (e) {}
      }
    }

    if (allData.length === 0) {
      loadingData = true;
    }
    error = '';
    try {
      let url = `${apiUrl}/api/guru/sekolah/${guruState.activeSekolahId}/dashboard/diniyah`;
      const params = new URLSearchParams();
      if (taId) params.append('tahun_ajaran_id', taId);
      if (semId) params.append('semester_id', semId);
      if (params.toString()) {
        url += '?' + params.toString();
      }
      const res = await fetch(url, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal memuat data analitik.');
      const data = await res.json();
      allData = Array.isArray(data) ? data : [];
      
      if (typeof window !== 'undefined' && allData.length > 0 && guruState.activeSekolahId) {
        const cacheKey = `siakad_offline_diniyah_dashboard_${guruState.activeSekolahId}_${taId}_${semId}`;
        localStorage.setItem(cacheKey, JSON.stringify(allData));
      }
    } catch (err) {
      if (allData.length === 0) {
        error = err.message || 'Gagal memuat data analitik.';
      }
    } finally {
      loadingData = false;
    }
  }

  function getColor(val) {
    if (val >= 90) return '#4ade80';
    if (val >= 80) return '#a3e635';
    if (val >= 70) return '#facc15';
    if (val >= 60) return '#fb923c';
    return '#ef4444';
  }

  let angkatanCharts = $derived.by(() => {
    if (!allData || allData.length === 0) return [];
    
    const groupedByTingkat = {};
    for (const d of allData) {
      const t = d.tingkat || 'Belum ada Kelas';
      if (!groupedByTingkat[t]) groupedByTingkat[t] = [];
      groupedByTingkat[t].push(d);
    }
    
    const result = [];
    for (const tingkat of Object.keys(groupedByTingkat).sort()) {
      const siswaData = groupedByTingkat[tingkat];
      
      const mapelSums = {};
      const mapelCounts = {};
      for(const s of siswaData) {
        const m = s.mapel || 'Tanpa Mapel';
        if (!mapelSums[m]) {
           mapelSums[m] = 0;
           mapelCounts[m] = 0;
        }
        mapelSums[m] += s.nilai || 0;
        mapelCounts[m]++;
      }
      
      const chartData = [];
      for(const m of Object.keys(mapelSums).sort()) {
        const avg = mapelSums[m] / mapelCounts[m];
        chartData.push({
          label: m,
          value: parseFloat(avg.toFixed(2)),
          color: getColor(avg)
        });
      }
      
      result.push({
        tingkat: tingkat,
        chartData: chartData
      });
    }
    return result;
  });
</script>

<svelte:head>
  <title>Analitik AI - SIAKAD</title>
</svelte:head>

{#if !guruState.activeSekolahId}
  <div class="empty-state">
    <Icon name="grid" size={48} />
    <h3>Pilih Jenjang Sekolah</h3>
    <p>Silakan klik tombol Pilih Jenjang terlebih dahulu.</p>
  </div>

{:else}
  {#key guruState.activeSekolahId}
    <div class="page-container">
      
      <div class="header">
        <div>
          <h1 class="page-title">Analitik Global Diniyah</h1>
          <p class="page-subtitle">Komparasi kesulitan seluruh mata pelajaran di setiap angkatan kelas.</p>
        </div>
        <div class="filters">
          <div class="select-input">{guruState.activeTahunName}</div>
        </div>
      </div>

      {#if error}
        <div class="alert-error">{error}</div>
      {/if}

      <div class="color-legend">
        <div class="legend-item"><div class="legend-box" style="background: #4ade80"></div> 90-100 (Sangat Baik)</div>
        <div class="legend-item"><div class="legend-box" style="background: #a3e635"></div> 80-89 (Baik)</div>
        <div class="legend-item"><div class="legend-box" style="background: #facc15"></div> 70-79 (Cukup)</div>
        <div class="legend-item"><div class="legend-box" style="background: #fb923c"></div> 60-69 (Kurang)</div>
        <div class="legend-item"><div class="legend-box" style="background: #ef4444"></div> &lt;60 (Sangat Kurang)</div>
      </div>

      {#if loadingData && angkatanCharts.length === 0}
        <div class="kelas-loading">Memuat data analitik...</div>
      {:else if angkatanCharts.length > 0}
        {#each angkatanCharts as angkatan (angkatan.tingkat)}
          <div class="chart-card">
            <div class="chart-header">
              <div>
                <h2 class="chart-title">Rata-Rata Nilai Akhir Seluruh Mata Pelajaran</h2>
                <p class="chart-subtitle">Angkatan: <b>Kelas {angkatan.tingkat}</b></p>
              </div>
              <button class="btn-detail" onclick={() => goto(`/guru/analitik/angkatan/${angkatan.tingkat}`)}>
                Masuk Rincian Kelas {angkatan.tingkat} <Icon name="arrowRight" size={16} />
              </button>
            </div>
            <div style="margin-top: 1.5rem; min-height: 350px;">
              <BarChart
                data={angkatan.chartData}
                max={100}
              />
            </div>
          </div>
        {/each}
      {:else}
        <div class="empty-state">
          <Icon name="inbox" size={48} />
          <h3>Belum Ada Data</h3>
          <p>Belum ada data nilai diniyah di jenjang ini.</p>
        </div>
      {/if}
    </div>
  {/key}
{/if}

<style>
  .page-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding-bottom: 2rem;
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
    font-size: 1.8rem;
    color: var(--color-text-main, #1e293b);
    font-weight: 700;
  }
  
  .page-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.95rem;
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

  .color-legend {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
    font-size: 0.85rem;
    color: var(--color-text-muted, #64748b);
    flex-wrap: wrap;
    justify-content: flex-end;
  }
  
  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .legend-box {
    width: 12px;
    height: 12px;
    border-radius: 2px;
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
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px dashed var(--color-border, #e2e8f0);
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  .chart-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--color-text-main, #1e293b);
    margin: 0;
  }
  
  .chart-subtitle {
    font-size: 0.85rem;
    color: var(--color-text-muted, #64748b);
    margin-top: 0.25rem;
  }
  
  .btn-detail {
    background: var(--color-bg-body, #f8fafc);
    border: 1px solid var(--color-border, #e2e8f0);
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.85rem;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-main, #1e293b);
  }
  
  .btn-detail:hover {
    border-color: var(--color-primary, #22c55e);
    color: var(--color-primary, #22c55e);
  }

  .kelas-loading {
    color: #64748b;
    font-size: 0.9rem;
    font-weight: 700;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    padding: 2rem 1rem;
    background: #f8fafc;
    text-align: center;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    gap: 1rem;
    color: #64748b;
    background: white;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
    text-align: center;
  }
  
  .empty-state h3 {
    margin: 0;
    color: #0f172a;
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

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
      padding-bottom: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .page-title { font-size: 1.5rem; }
    
    .filters { width: 100%; flex-wrap: wrap; gap: 0.5rem; }
    .select-input { width: 100%; padding: 0.5rem; font-size: 0.9rem; }
    
    .color-legend { justify-content: flex-start; }
    
    .chart-card { padding: 1rem; margin-bottom: 1.5rem; }
    .chart-header { flex-direction: column; gap: 0.75rem; }
    .btn-detail { width: 100%; justify-content: center; }
  }
</style>
