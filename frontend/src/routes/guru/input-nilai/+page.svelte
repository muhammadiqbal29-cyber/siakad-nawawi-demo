<script>
  import { goto } from '$app/navigation';
  import { guruState } from '$lib/guruState.svelte.js';
  import Icon from '$lib/components/ui/Icon.svelte';

  let activeSekolah = $derived(
    guruState.sekolahList.find((s) => s.id == guruState.activeSekolahId) || null
  );

  let fiturGuru = $derived(
    guruState.activeSekolahId ? guruState.aksesMap[guruState.activeSekolahId] || [] : []
  );

  let hasTahfiz = $derived(
    fiturGuru.includes('paket_alquran') ||
      fiturGuru.includes('input_tahfiz') ||
      fiturGuru.includes('input_tahfiz_v2') ||
      fiturGuru.includes('input_tasmi') ||
      fiturGuru.includes('input_tasmi_v2')
  );

  let isV2 = $derived.by(() => {
    if (!activeSekolah || !activeSekolah.fitur) return false;
    try {
      const sf = JSON.parse(activeSekolah.fitur);
      return sf.includes('input_tahfiz_v2') || sf.includes('input_tasmi_v2');
    } catch {
      return false;
    }
  });

  let hasDiniyah = $derived(fiturGuru.includes('input_diniyah'));
  let hasKeseharian = $derived(fiturGuru.includes('rapor_keseharian'));

  function openTahfiz() {
    if (isV2) {
      goto('/guru/input-nilai/tahfiz-v2');
    } else {
      goto('/guru/input-nilai/tahfiz');
    }
  }

  function openDiniyah() {
    goto('/guru/input-nilai/diniyah');
  }

  function openKeseharian() {
    goto('/guru/input-nilai/keseharian');
  }
</script>

<svelte:head>
  <title>Pusat Penilaian Nilai - SIAKAD Nawawi</title>
</svelte:head>

<div class="hub-container">
  <div class="hub-header">
    <div class="header-badge">
      <span class="badge-dot"></span>
      {activeSekolah ? activeSekolah.nama_sekolah : 'Pilih Jenjang Terlebih Dahulu'}
    </div>
    <h1 class="hub-title">Pusat Penilaian Santri</h1>
    <p class="hub-subtitle">
      Silakan pilih kategori nilai yang ingin Anda isi. Data nilai akan otomatis disinkronkan ke buku rapor santri.
    </p>
  </div>

  <div class="cards-grid">
    <!-- KARTU 1: TAHFIZ & TASMI' -->
    <div class="module-card card-tahfiz" class:locked={!hasTahfiz}>
      <div class="card-inner">
        <div class="card-top">
          <div class="module-icon icon-tahfiz">📖</div>
          <span class="module-tag tag-tahfiz">Tahfiz Al-Qur'an</span>
        </div>

        <h2 class="module-name">Ujian Tahfiz & Tasmi'</h2>
        <p class="module-desc">
          Penilaian hafalan Al-Qur'an per juz, ujian surah, tes sambung ayat, tasmi' sekali duduk, serta standar kelulusan.
        </p>

        <ul class="feature-checklist">
          <li><span>✓</span> Setoran Hafalan Juz & Surah</li>
          <li><span>✓</span> Ujian Sambung Ayat & Tasmi'</li>
          <li><span>✓</span> Penilaian Skala 1–5 / 100</li>
        </ul>

        <div class="card-action">
          {#if hasTahfiz}
            <button type="button" class="btn-open btn-tahfiz" onclick={openTahfiz}>
              Buka Penilaian Tahfiz <span>→</span>
            </button>
          {:else}
            <div class="lock-notice">🔒 Tidak Ada Izin Akses Tahfiz</div>
          {/if}
        </div>
      </div>
    </div>

    <!-- KARTU 2: DINIYAH -->
    <div class="module-card card-diniyah" class:locked={!hasDiniyah}>
      <div class="card-inner">
        <div class="card-top">
          <div class="module-icon icon-diniyah">📚</div>
          <span class="module-tag tag-diniyah">Akademik Diniyah</span>
        </div>

        <h2 class="module-name">Mata Pelajaran Diniyah</h2>
        <p class="module-desc">
          Pengelolaan nilai murni Ulangan Harian (UH), Penilaian Tengah Semester (PTS), dan Ujian Akhir Semester (PAS).
        </p>

        <ul class="feature-checklist">
          <li><span>✓</span> Fiqih, Hadits, Aqidah, Bahasa Arab</li>
          <li><span>✓</span> Template Excel & Rapor Predikat</li>
          <li><span>✓</span> Evaluasi Longitudinal Gemini AI</li>
        </ul>

        <div class="card-action">
          {#if hasDiniyah}
            <button type="button" class="btn-open btn-diniyah" onclick={openDiniyah}>
              Buka Nilai Diniyah <span>→</span>
            </button>
          {:else}
            <div class="lock-notice">🔒 Tidak Ada Izin Akses Diniyah</div>
          {/if}
        </div>
      </div>
    </div>

    <!-- KARTU 3: KESEHARIAN & ASRAMA -->
    <div class="module-card card-keseharian" class:locked={!hasKeseharian}>
      <div class="card-inner">
        <div class="card-top">
          <div class="module-icon icon-keseharian">🌟</div>
          <span class="module-tag tag-keseharian">Karakter & Asrama</span>
        </div>

        <h2 class="module-name">Keseharian & Iqob</h2>
        <p class="module-desc">
          Pencatatan adab harian santri, kedisiplinan sholat berjamaah, catatan pelanggaran, dan pemutihan iqob edukatif.
        </p>

        <ul class="feature-checklist">
          <li><span>✓</span> Ceklis Sholat Jamaah & Asrama</li>
          <li><span>✓</span> Catatan Pelanggaran & Poin</li>
          <li><span>✓</span> Sistem Pemutihan Sanksi Santri</li>
        </ul>

        <div class="card-action">
          {#if hasKeseharian}
            <button type="button" class="btn-open btn-keseharian" onclick={openKeseharian}>
              Buka Jurnal Keseharian <span>→</span>
            </button>
          {:else}
            <div class="lock-notice">🔒 Tidak Ada Izin Akses Keseharian</div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .hub-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 1rem 0 3rem;
    font-family: inherit;
  }

  .hub-header {
    margin-bottom: 2rem;
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 9999px;
    margin-bottom: 0.75rem;
  }

  .badge-dot {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: #10b981;
  }

  .hub-title {
    font-size: 1.75rem;
    font-weight: 900;
    color: #0f172a;
    margin: 0 0 0.5rem;
    letter-spacing: -0.02em;
  }

  .hub-subtitle {
    font-size: 0.95rem;
    color: #64748b;
    margin: 0;
    max-width: 650px;
    line-height: 1.5;
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }

  .module-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 1.25rem;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }

  .module-card:hover:not(.locked) {
    transform: translateY(-4px);
    box-shadow: 0 14px 28px -6px rgba(0, 0, 0, 0.08);
  }

  .module-card.locked {
    opacity: 0.55;
    filter: grayscale(80%);
    background: #f8fafc;
  }

  .card-inner {
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
  }

  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  .module-icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
  }

  .icon-tahfiz {
    background: #10b981;
    color: white;
    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25);
  }

  .icon-diniyah {
    background: #6366f1;
    color: white;
    box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);
  }

  .icon-keseharian {
    background: #f59e0b;
    color: white;
    box-shadow: 0 4px 10px rgba(245, 158, 11, 0.25);
  }

  .module-tag {
    font-size: 0.75rem;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 9999px;
  }

  .tag-tahfiz {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  .tag-diniyah {
    background: #eef2ff;
    color: #4338ca;
    border: 1px solid #c7d2fe;
  }

  .tag-keseharian {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  .module-name {
    font-size: 1.2rem;
    font-weight: 800;
    color: #1e293b;
    margin: 0 0 0.5rem;
  }

  .module-desc {
    font-size: 0.825rem;
    color: #64748b;
    line-height: 1.5;
    margin: 0 0 1.25rem;
    flex-grow: 1;
  }

  .feature-checklist {
    list-style: none;
    padding: 1rem 0 0;
    margin: 0 0 1.5rem;
    border-top: 1px solid #f1f5f9;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .feature-checklist li {
    font-size: 0.775rem;
    color: #475569;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }

  .feature-checklist li span {
    color: #10b981;
    font-weight: bold;
  }

  .btn-open {
    width: 100%;
    padding: 12px 16px;
    border-radius: 12px;
    border: none;
    font-size: 0.875rem;
    font-weight: 700;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s ease;
  }

  .btn-open:hover {
    transform: translateY(-2px);
  }

  .btn-tahfiz {
    background: #10b981;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
  }

  .btn-tahfiz:hover {
    background: #059669;
  }

  .btn-diniyah {
    background: #6366f1;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
  }

  .btn-diniyah:hover {
    background: #4f46e5;
  }

  .btn-keseharian {
    background: #f59e0b;
    box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);
  }

  .btn-keseharian:hover {
    background: #d97706;
  }

  .lock-notice {
    width: 100%;
    text-align: center;
    padding: 10px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #64748b;
    background: #f1f5f9;
    border-radius: 10px;
    border: 1px dashed #cbd5e1;
  }

  @media (max-width: 900px) {
    .cards-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
