<script>
  import { onMount } from 'svelte';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  let sekolahId = $derived($page.url.searchParams.get('sekolah_id') || '1');
  let paramTaId = $derived($page.url.searchParams.get('tahun_ajaran_id') || '');
  let paramSemId = $derived($page.url.searchParams.get('semester_id') || '');


  let siswaId = $derived($page.params.siswaId);
  let nama = $derived($page.url.searchParams.get('nama') || 'Siswa Tidak Ditemukan');
  let nisn = $derived($page.url.searchParams.get('nisn') || '-');
  let kelas = $derived($page.url.searchParams.get('kelas') || '-');
  let selectedKelasId = $derived($page.url.searchParams.get('selectedKelasId') || '');
  let customKota = $state('Jakarta');
  let customTanggalCetak = $state(
    new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  );
  let customGuruPembimbing = $state('Ust. Muhammad Rasyid, S.Pd.I');

  let sekolah = $state(null);
  let nilaiHeader = $state(null);
  let details = $state([]);
  let kriteriaPenilaian = $state([]);
  let materiList = $state([]);
  let pembagi = $state(1);
  let loading = $state(true);
  let error = $state('');

  let currentCatatan = $state('');
  
  async function loadCatatanRapor() {
    const params = new URLSearchParams({
      jenis_rapor: 'kelulusan'
    });
    if (sekolahId) params.append('sekolah_id', sekolahId);
    if (paramTaId) params.append('tahun_ajaran_id', paramTaId);
    if (paramSemId) params.append('semester_id', paramSemId);

    try {
      const res = await fetch(`${apiUrl}/api/guru/siswa/${siswaId}/catatan-rapor?${params.toString()}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const body = await res.json();
        if (body && body.catatan) {
          currentCatatan = body.catatan;
        }
      }
    } catch {}
  }

  // Dynamic Kop & Logo
  let customLogoUrl = $state('');
  let logoX = $state(600);
  let logoY = $state(20);
  let logoSize = $state(80);
  let dividerThickness = $state(3);
  let kopLines = $state([
    { text: 'SMP ISLAM IMAM NAWAWI', color: '#000000', size: 18, bold: true },
    { text: 'Alamat Sekolah', color: '#000000', size: 12, bold: false }
  ]);

  // Local Signature Settings
  let ttdMusyrif = $state('');
  let ttdMusyrifSize = $state(100);

  $effect(() => {
    if (ttdMusyrifSize !== undefined)
      localStorage.setItem('ttdMusyrifSize_global', ttdMusyrifSize.toString());
  });

  function handleTtdMusyrif(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      ttdMusyrif = event.target.result;
      localStorage.setItem('ttdMusyrif_global', ttdMusyrif);
    };
    reader.readAsDataURL(file);
  }

  onMount(async () => {
    ttdMusyrif = localStorage.getItem('ttdMusyrif_global') || '';
    const mSize = localStorage.getItem('ttdMusyrifSize_global');
    if (mSize) ttdMusyrifSize = parseInt(mSize) || 100;

    await Promise.all([
      loadSekolah(),
      loadMateriTahfiz(),
      loadNilaiTahfiz(),
      loadKonfigurasiTahfiz(),
      loadCatatanRapor()
    ]);

    // Set fallback if independent catatan is empty but nilaiHeader has catatan
    if (!currentCatatan && nilaiHeader && nilaiHeader.catatan) {
      currentCatatan = nilaiHeader.catatan;
    }

    // Merge materi with details
    details = materiList.map((materi) => {
      const exist = details.find(
        (d) => d.materi_id === materi.id || d.nama_materi === materi.nama_materi
      );
      if (exist) {
        return exist;
      }
      return {
        materi_id: materi.id,
        nama_materi: materi.nama_materi,
        skor_kelancaran: 0,
        skor_tajwid: 0,
        skor_makharijul_huruf: 0,
        total_poin: 0
      };
    });

    // Fallback: if no v2 data, check if v1 has data and redirect
    if (!nilaiHeader) {
      try {
        const params = new URLSearchParams({ jenis_penilaian: 'kelulusan', mata_pelajaran: 'Tahfiz' });
        if (paramTaId) params.set('tahun_ajaran_id', paramTaId);
        if (paramSemId) params.set('semester_id', paramSemId);
        const v1Res = await fetch(`${apiUrl}/api/guru/siswa/${siswaId}/nilai-tahfiz?${params.toString()}`, { credentials: 'include' });
        if (v1Res.ok) {
          const v1Body = await v1Res.json();
          if (v1Body.nilai || (v1Body.details && v1Body.details.length > 0)) {
            const newPath = $page.url.pathname.replace('/rapor/kelulusan-v2/', '/rapor/kelulusan/');
            goto(`${newPath}?${$page.url.searchParams.toString()}`, { replaceState: true });
            return;
          }
        }
      } catch {}
    }

    loading = false;
  });

  async function loadKonfigurasiTahfiz() {
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${sekolahId}/konfigurasi-nilai-tahfiz`, {
        credentials: 'include'
      });
      if (res.ok) {
        const body = await res.json();
        kriteriaPenilaian = body.kriteria_penilaian || [];
        pembagi = body.pembagi || 1;
      }
    } catch {
      // Use fallback if fails
    }
  }

  async function loadMateriTahfiz() {
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${sekolahId}/materi-tahfiz?jenis_penilaian=kelulusan`, {
        credentials: 'include'
      });
      if (res.ok) {
        materiList = (await res.json()) || [];
      }
    } catch {
      // ignore
    }
  }

  async function loadSekolah() {
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${sekolahId}`, {
        credentials: 'include'
      });
      if (res.ok) {
        sekolah = await res.json();
        // Parse kop & logo from sekolah
        if (sekolah.logo_base64) customLogoUrl = sekolah.logo_base64;
        logoX = sekolah.logo_x || 600;
        logoY = sekolah.logo_y || 20;
        logoSize = sekolah.logo_size || 80;
        dividerThickness = sekolah.divider_thickness || 3;
        if (sekolah.kop_surat) {
          try {
            const parsed = JSON.parse(sekolah.kop_surat);
            if (Array.isArray(parsed) && parsed.length > 0) {
              kopLines = parsed;
            }
          } catch (e) {}
        }
      }
    } catch {
      // Fallback: kop tetap tampil tanpa data
    }
  }

  async function loadNilaiTahfiz() {
    try {
      const params = new URLSearchParams({
        jenis_penilaian: 'kelulusan',
        mata_pelajaran: 'Tahfiz'
      });
      if (paramTaId) params.set('tahun_ajaran_id', paramTaId);
      if (paramSemId) params.set('semester_id', paramSemId);
      const res = await fetch(
        `${apiUrl}/api/guru/siswa/${siswaId}/nilai-tahfiz-v2?${params.toString()}`,
        { credentials: 'include' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal memuat data nilai tahfiz.');
      }
      const body = await res.json();
      nilaiHeader = body.nilai || null;
      details = body.details || [];
    } catch (err) {
      error = err.message || 'Gagal memuat data nilai tahfiz.';
    }
  }

  let totalPoin = $derived(details.reduce((sum, d) => sum + (d.total_poin || 0), 0));

  let maxPoin = $derived(details.length * 300);

  let averageScore = $derived(
    nilaiHeader?.nilai_akhir != null
      ? Math.round(nilaiHeader.nilai_akhir)
      : details.length > 0
        ? Math.round(totalPoin / 3.0 / pembagi)
        : 0
  );

  function getPredicate(score) {
    if (!kriteriaPenilaian || kriteriaPenilaian.length === 0) {
      // Fallback
      if (score >= 90) return 'مُمْتَاز';
      if (score >= 80) return 'جَيِّد جِدًّا';
      if (score >= 70) return 'جَيِّد';
      if (score >= 60) return 'مَقْبُول';
      return 'رَاسِب';
    }

    // Cari kriteria yang sesuai
    for (const k of kriteriaPenilaian) {
      if (score >= k.min && score <= k.max) {
        return k.arab;
      }
    }
    return '';
  }

  function goBack() {
    const params = new SvelteURLSearchParams();
    if (selectedKelasId) params.set('selectedKelasId', selectedKelasId);
    goto(`/guru/rapor/kelulusan-v2?${params.toString()}`);
  }
</script>
<svelte:head>
  <meta name="viewport" content="width=850, user-scalable=yes">
</svelte:head>


<div class="no-print controls">
  <button class="btn-secondary" onclick={goBack}>
    <Icon name="arrowLeft" size={16} /> Kembali ke Daftar Siswa
  </button>
  <button class="btn-primary" onclick={() => window.print()}>
    <Icon name="printer" size={16} /> Cetak Rapor
  </button>
</div>

<div
  class="settings-box no-print"
  style="max-width: 210mm; margin: 0 auto 1.5rem; background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;"
>
  <h4 style="margin-top: 0;">Pengaturan Cetak (Tidak ikut terprint)</h4>
  <div
    style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;"
  >
    <label
      style="display: flex; flex-direction: column; font-size: 0.85rem; font-weight: 600; color: #475569; gap: 0.25rem;"
    >
      Kota:
      <input type="text" class="form-input" bind:value={customKota} />
    </label>
    <label
      style="display: flex; flex-direction: column; font-size: 0.85rem; font-weight: 600; color: #475569; gap: 0.25rem;"
    >
      Tanggal Cetak:
      <input type="text" class="form-input" bind:value={customTanggalCetak} />
    </label>
    <label
      style="display: flex; flex-direction: column; font-size: 0.85rem; font-weight: 600; color: #475569; gap: 0.25rem;"
    >
      Guru Pembimbing Tahfiz:
      <input type="text" class="form-input" bind:value={customGuruPembimbing} />
    </label>
    <label
      style="display: flex; flex-direction: column; font-size: 0.85rem; font-weight: 600; color: #475569; gap: 0.25rem;"
    >
      Ttd Guru Pembimbing:
      <input type="file" class="form-input" accept="image/*" onchange={handleTtdMusyrif} />
    </label>
    <label
      style="display: flex; flex-direction: column; font-size: 0.85rem; font-weight: 600; color: #475569; gap: 0.25rem;"
    >
      Ukuran Ttd Guru Pembimbing ({ttdMusyrifSize}%):
      <input type="range" min="10" max="300" class="form-input" bind:value={ttdMusyrifSize} />
    </label>
  </div>
</div>

<div class="page">
  <div>
    <div class="report-header">
      <!-- Dynamic Header from Konfigurasi -->
      <div
        class="header-section"
        style="text-align: center; position: relative; padding-bottom: 0.75rem;"
      >
        {#if customLogoUrl}
          <img
            src={customLogoUrl}
            alt="Logo"
            style="position: absolute; left: {logoX}px; top: {logoY}px; width: {logoSize}px; z-index: 50;"
          />
        {/if}
        {#each kopLines as line}
          <div
            style="color: {line.color}; font-size: {line.size}px; font-weight: {line.bold
              ? 'bold'
              : 'normal'}; margin: {line.bold ? '4px 0' : '0'}; letter-spacing: 1px;"
          >
            {line.text}
          </div>
        {/each}
      </div>
      <!-- Double Border Line -->
      <div
        style="border-top: {dividerThickness}px double black; border-bottom: none; height: 0; margin-bottom: 24px;"
      ></div>
      <div class="report-title">
        <h2>RAPOR HAFALAN AL-QUR'AN</h2>
        <h3>Evaluasi Ujian Kelulusan Tahfiz</h3>
      </div>
    </div>

    {#if error}
      <div class="alert-error">{error}</div>
    {/if}

    {#if loading}
      <div class="loading-state">Memuat data rapor...</div>
    {:else}
      <div class="student-summary">
        <table id="student-info-table">
          <tbody>
            <tr>
              <td class="label">Nama Siswa</td>
              <td>:</td>
              <td id="student-name" class="value">{nama}</td>
            </tr>
            <tr>
              <td class="label">NIS / NISN</td>
              <td>:</td>
              <td id="student-nis" class="value">{nisn}</td>
            </tr>
            <tr>
              <td class="label">Kelas</td>
              <td>:</td>
              <td id="student-class" class="value">{kelas}</td>
            </tr>
          </tbody>
        </table>

        <div class="predicate-box">
          <div class="predicate-label">PREDIKAT</div>
          <div id="predicate-arabic" class="arabic">{getPredicate(averageScore)}</div>
        </div>
      </div>

      {#if details.length > 0}
        <table id="tahfiz-table">
          <thead>
            <tr>
              <th rowspan="2">No</th>
              <th rowspan="2" class="text-left">Nama Surah</th>
              <th colspan="3">Kategori Penilaian</th>
              <th rowspan="2">Total Poin</th>
            </tr>
            <tr>
              <th class="col-kategori">Kelancaran</th>
              <th class="col-kategori">Tajwid</th>
              <th class="col-kategori">Makharij</th>
            </tr>
          </thead>
          <tbody>
            {#each details as row, index (index)}
              <tr>
                <td>{index + 1}</td>
                <td class="text-left">{row.nama_materi}</td>
                <td>{row.skor_kelancaran || 0}</td>
                <td>{row.skor_tajwid || 0}</td>
                <td>{row.skor_makharijul_huruf || 0}</td>
                <td>{row.total_poin || 0}</td>
              </tr>
            {/each}
            <tr class="tfoot-row">
              <td colspan="5" class="tfoot-label">Total Poin Diperoleh</td>
              <td class="tfoot-value">{totalPoin} / {maxPoin}</td>
            </tr>
            <tr class="tfoot-row">
              <td colspan="5" class="tfoot-label">Rata-rata Nilai (Skala 100)</td>
              <td class="tfoot-value">{averageScore}</td>
            </tr>
          </tbody>
        </table>
      {:else}
        <div class="empty-state-message">
          <p>Belum ada data nilai tahfiz untuk siswa ini.</p>
        </div>
      {/if}

      <!-- Catatan -->
      <div class="catatan-box">
        <p style="font-weight: 700; margin-bottom: 4px;">CATATAN:</p>
        <p style="white-space: pre-wrap;">{currentCatatan || '-'}</p>
      </div>

      <div class="report-footer">
        <div class="note-box">
          <p class="note-title">Kriteria Penilaian Rapor:</p>
          <table>
            <tbody>
              {#if kriteriaPenilaian && kriteriaPenilaian.length > 0}
                {#each kriteriaPenilaian as k, index (index)}
                  <tr>
                    <td>{k.min === 0 ? `< ${k.max + 1}` : `${k.min} - ${k.max}`}</td>
                    <td>: {k.arab} ({k.indo})</td>
                  </tr>
                {/each}
              {:else}
                <tr><td>90 - 100</td><td>: مُمْتَاز (Istimewa)</td></tr>
                <tr><td>80 - 89</td><td>: جَيِّد جِدًّا (Sangat Baik)</td></tr>
                <tr><td>70 - 79</td><td>: جَيِّد (Baik)</td></tr>
                <tr><td>60 - 69</td><td>: مَقْبُول (Cukup)</td></tr>
                <tr><td>&lt; 60</td><td>: رَاسِب (Mengulang)</td></tr>
              {/if}
            </tbody>
          </table>
        </div>
        <div class="signatures">
          <div>
            <p class="signature-label">Mengetahui,</p>
            <p class="signature-title">Orang Tua / Wali Siswa</p>
            <div class="signature-line">( ____________________ )</div>
          </div>
          <div>
            <p id="print-date">{customKota}, {customTanggalCetak}</p>
            <p class="signature-title">Guru Pembimbing Tahfiz</p>
            {#if ttdMusyrif}
              <div
                style="height: 3rem; margin-top: 0.5rem; display: flex; justify-content: center; align-items: center;"
              >
                <img
                  src={ttdMusyrif}
                  alt="Ttd Musyrif"
                  style="max-height: 100%; max-width: 100%; object-fit: contain; transform: scale({ttdMusyrifSize /
                    100}); transform-origin: center;"
                />
              </div>
              <div class="signature-line" style="margin-top: 0.5rem;">
                ( {customGuruPembimbing} )
              </div>
            {:else}
              <div class="signature-line">( {customGuruPembimbing} )</div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Aref+Ruqaa&family=Cinzel:wght@600&family=Inter:wght@400;600;700&display=swap');

  .form-input {
    padding: 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-family: inherit;
  }

  @page {
    size: A4;
    margin: 1cm;
  }

  :root {
    --print-width: 210mm;
    --print-height: 297mm;
  }

  :global(html) {
    background-color: #f3f4f6;
  }

  :global(body) {
    background-color: #f3f4f6;
    font-family: 'Inter', sans-serif;
    color: #000;
    margin: 0;
    padding: 0;
  }

  .controls {
    position: fixed;
    top: 1rem;
    right: 1rem;
    display: flex;
    gap: 0.5rem;
    z-index: 50;
  }

  .btn-primary,
  .btn-secondary {
    border: none;
    border-radius: 0.5rem;
    padding: 0.625rem 1.25rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  }

  .btn-primary {
    background: #111827;
    color: #fff;
  }

  .btn-secondary {
    background: #f8fafc;
    color: #111827;
    border: 1px solid #d1d5db;
  }

  .loading-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #64748b;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .alert-error {
    margin: 0.75rem 0;
    padding: 1rem 1.2rem;
    border-radius: 0.5rem;
    color: #b91c1c;
    background: #fee2e2;
    border: 1px solid #fecaca;
    font-size: 0.875rem;
  }

  .empty-state-message {
    text-align: center;
    padding: 2rem;
    border: 1px dashed #cbd5e1;
    border-radius: 0.5rem;
    color: #64748b;
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
  }

  .empty-state-message p {
    margin: 0;
  }

  .page {
    width: var(--print-width);
    min-height: var(--print-height);
    padding: 1cm !important;
    margin: 20px auto;
    background: white;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    box-sizing: border-box;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .report-header {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .kop-divider {
    border-top: 3px double black;
    border-bottom: none;
    height: 0;
    margin-bottom: 24px;
  }

  .report-title {
    margin-bottom: 0.25rem;
  }

  .report-title h2 {
    margin: 0;
    font-size: 1.15rem;
    letter-spacing: 0.08em;
    font-weight: 700;
    text-transform: uppercase;
    color: #000;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  .report-title h3 {
    margin: 0.25rem 0 0;
    font-size: 0.95rem;
    font-weight: 600;
    color: #404040;
  }

  .student-summary {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  #student-info-table {
    width: 55%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  #student-info-table td {
    border: none;
    padding: 4px 0;
    vertical-align: top;
  }

  .label {
    width: 35%;
    font-weight: 600;
    color: #525252;
  }

  .value {
    font-weight: 700;
    color: #111827;
    border-bottom: 1px solid #d1d5db;
  }

  .separator {
    width: 100%;
    border-top: 1px solid #e5e7eb;
    margin: 4px 0 0;
  }

  .total-score {
    font-size: 1rem;
  }

  .predicate-box {
    width: 16rem;
    padding: 0;
    margin-top: 4px;
    text-align: center;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
  }

  .predicate-label {
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    width: 100%;
    padding-bottom: 0.25rem;
  }

  .arabic {
    font-family: 'Aref Ruqaa', serif;
    font-size: 3.5rem;
    font-weight: 700;
    line-height: 1.3;
    padding-top: 0;
    margin-top: -0.5rem;
  }

  #tahfiz-table {
    width: 99.8%;
    border-collapse: collapse;
    font-size: 9.5pt;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  #tahfiz-table th,
  #tahfiz-table td {
    border: 1px solid #000;
    padding: 4px 6px;
    text-align: center;
    color: #000;
  }

  #tahfiz-table th {
    background: #f9fafb;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-size: 8.5pt;
  }

  #tahfiz-table th.col-kategori {
    width: 12%;
    font-size: 7.5pt;
  }

  .tfoot-row td {
    border: 1px solid #000;
    padding: 5px 8px;
    font-weight: 700;
    background: #f9fafb;
  }

  .tfoot-label {
    text-align: right;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .tfoot-value {
    text-align: center;
    font-size: 10pt;
    font-weight: 800;
    color: #111827;
  }

  .tfoot-predicate {
    font-family: 'Aref Ruqaa', serif;
    font-size: 14pt;
    line-height: 1.4;
  }

  .text-left {
    text-align: left !important;
  }

  .report-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .note-box {
    width: 41.666667%;
    border: 1px solid #000;
    padding: 0.625rem;
    font-size: 8pt;
  }

  .catatan-box {
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    border: 1px solid #000;
    padding: 0.5rem;
    min-height: 80px;
    font-size: 9pt;
  }
  .catatan-box p {
    margin: 0;
  }

  .note-title {
    margin: 0 0 0.5rem;
    font-weight: 800;
  }

  .note-box table {
    width: 100%;
    border-collapse: collapse;
    font-size: 7.5pt;
  }

  .note-box td {
    border: none;
    padding: 1px;
    text-align: left;
  }

  .signatures {
    width: 58.333333%;
    display: flex;
    justify-content: space-between;
    padding-left: 2rem;
    font-size: 0.75rem;
    text-align: center;
  }

  .signatures > div {
    width: 50%;
  }

  .signature-label,
  .signature-title {
    margin: 0;
  }

  .signature-title {
    font-weight: 600;
    margin-top: 0;
    color: #000;
  }

  .signature-line {
    display: inline-block;
    margin-top: 3rem;
    border-bottom: 1px solid #000;
    width: 10rem;
    padding-bottom: 0.25rem;
    font-weight: 500;
    color: #000;
  }

  .signatures > div:last-child .signature-line {
    width: 11rem;
    font-weight: 700;
  }

  @media print {
    :global(html),
    :global(body) {
      background: white;
      margin: 0;
      padding: 0;
    }
    .page {
      margin: 0;
      padding: 0 !important;
      box-shadow: none;
      width: 100%;
      min-height: auto !important;
      height: auto !important;
    }
    .no-print {
      display: none !important;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
    }
  }

  
</style>
