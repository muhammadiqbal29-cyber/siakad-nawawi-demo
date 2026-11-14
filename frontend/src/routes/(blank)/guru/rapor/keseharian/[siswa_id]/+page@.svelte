<script>
  import { page } from '$app/stores';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let siswaId = $derived($page.params.siswa_id);
  let sekolahId = $derived($page.url.searchParams.get('sekolah_id') || '');
  let paramTaId = $derived($page.url.searchParams.get('tahun_ajaran_id') || '');
  let paramSemId = $derived($page.url.searchParams.get('semester_id') || '');

  /** @type {any} */
  let raporData = $state(null);
  let loading = $state(true);
  let error = $state('');

  let totalPelanggaran = $derived(
    raporData ? (raporData.pelanggaran || []).reduce((acc, p) => acc + (p.poin || 0), 0) : 0
  );
  let totalIqob = $derived(
    raporData ? (raporData.iqob || []).reduce((acc, p) => acc + (p.poin || 0), 0) : 0
  );
  let sisaPelanggaran = $derived(totalPelanggaran > totalIqob ? totalPelanggaran - totalIqob : 0);
  let nilaiKedisiplinanAkhir = $derived(100 - sisaPelanggaran);

  let currentDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  // Dynamic Print Settings
  let customTanggalRapor = $state(currentDate);
  let customKepalaAsrama = $state('AJI SYAFAAT');
  let customMusyrif = $state('');

  let logoX = $state(600);
  let logoY = $state(20);
  let logoSize = $state(80);
  let customLogoUrl = $state('');
  let kopLines = $state([]);
  let dividerThickness = $state(3);

  // Local Signature Settings
  let ttdKepala = $state('');
  let ttdMusyrif = $state('');
  let ttdKepalaSize = $state(100);
  let ttdMusyrifSize = $state(100);

  import { onMount } from 'svelte';
  onMount(() => {
    ttdKepala = localStorage.getItem('ttdKepala_global') || '';
    ttdMusyrif = localStorage.getItem('ttdMusyrif_global') || '';
    ttdKepalaSize = parseInt(localStorage.getItem('ttdKepalaSize_global')) || 100;
    ttdMusyrifSize = parseInt(localStorage.getItem('ttdMusyrifSize_global')) || 100;
  });

  $effect(() => {
    if (ttdKepalaSize !== undefined) localStorage.setItem('ttdKepalaSize_global', ttdKepalaSize.toString());
    if (ttdMusyrifSize !== undefined) localStorage.setItem('ttdMusyrifSize_global', ttdMusyrifSize.toString());
  });

  function handleTtdKepala(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      ttdKepala = event.target.result;
      localStorage.setItem('ttdKepala_global', ttdKepala);
    };
    reader.readAsDataURL(file);
  }

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

  $effect(() => {
    if (raporData?.sekolah) {
      customLogoUrl = raporData.sekolah.logo_base64 || '';
      logoX = raporData.sekolah.logo_x || 600;
      logoY = raporData.sekolah.logo_y || 20;
      logoSize = raporData.sekolah.logo_size || 80;
      dividerThickness = raporData.sekolah.divider_thickness || 3;
      let localKop = [];
      if (raporData.sekolah.kop_surat) {
        try {
          const parsed = JSON.parse(raporData.sekolah.kop_surat);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localKop = parsed;
          }
        } catch (e) {}
      }
      if (localKop.length === 0) {
        localKop = [
          {
            text: raporData.sekolah.nama_sekolah || 'SMP ISLAM IMAM NAWAWI',
            color: '#000000',
            size: 18,
            bold: true
          },
          {
            text: raporData.sekolah.alamat || 'Jl. Tjilik Riwut KM 8',
            color: '#000000',
            size: 12,
            bold: false
          }
        ];
      }
      kopLines = localKop;
    }
  });

  $effect(() => {
    if (siswaId) {
      fetchData();
    }
  });

  async function fetchData() {
    loading = true;
    error = '';
    try {
      const params = new URLSearchParams();
      if (sekolahId) params.set('sekolah_id', sekolahId);
      if (paramTaId) params.set('tahun_ajaran_id', paramTaId);
      if (paramSemId) params.set('semester_id', paramSemId);

      const res = await fetch(`${apiUrl}/api/guru/keseharian/rapor/${siswaId}?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok)
        throw new Error(
          'Gagal memuat rapor siswa (HTTP ' + res.status + '): ' + (await res.text())
        );
      const json = await res.json();
      raporData = json.data;

      const paramsCatatan = new URLSearchParams();
      paramsCatatan.set('jenis_rapor', 'keseharian');
      if (sekolahId) paramsCatatan.set('sekolah_id', sekolahId);
      if (paramTaId) paramsCatatan.set('tahun_ajaran_id', paramTaId);
      if (paramSemId) paramsCatatan.set('semester_id', paramSemId);

      const resCatatan = await fetch(
        `${apiUrl}/api/guru/siswa/${siswaId}/catatan-rapor?${paramsCatatan.toString()}`,
        {
          credentials: 'include'
        }
      );
      if (resCatatan.ok) {
        const catBody = await resCatatan.json();
        raporData.catatan = catBody.catatan || '';
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function getNilaiForIndikator(indId) {
    if (!raporData || !raporData.rekaps) return 100;
    const rekap = raporData.rekaps.find((r) => r.indikator_id === indId);
    return rekap ? rekap.poin_akhir : 100;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function getRiwayatGabungan(rd) {
    if (!rd) return [];
    const p = (rd.pelanggaran || []).map((x) => ({ ...x, tipe: 'Pelanggaran' }));
    const iq = (rd.iqob || []).map((x) => ({ ...x, tipe: 'Iqob' }));
    return [...p, ...iq].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  }

  function getRiwayatSideBySide(rd) {
    if (!rd) return [];
    const p = rd.pelanggaran || [];
    const iq = rd.iqob || [];
    const maxLen = Math.max(p.length, iq.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      result.push({
        pelanggaran: p[i] || null,
        iqob: iq[i] || null
      });
    }
    return result;
  }
</script>

<svelte:head>
  <title>Rapor Keseharian & Poin</title>
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center p-20">
    <p class="text-gray-500">Memuat rapor...</p>
  </div>
{:else if error}
  <div
    class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative m-8"
    role="alert"
  >
    <strong class="font-bold">Error!</strong>
    <span class="block sm:inline">{error}</span>
  </div>
{:else if raporData}
  <div class="print-wrapper bg-gray-100 py-8 font-sans text-sm text-black min-h-screen">
    <div class="print-actions no-print">
      <button class="btn-back" onclick={() => history.back()}>
        <Icon name="chevronLeft" size={18} />
        Kembali
      </button>
      <button class="btn-print" onclick={() => window.print()}>
        <Icon name="printer" size={18} />
        Cetak Rapor
      </button>
    </div>

    <!-- Edit Settings -->
    <div class="settings-box no-print">
      <h4 class="font-bold mb-2">Pengaturan Cetak (Tidak ikut terprint)</h4>
      <div class="settings-grid">
        <label>
          Tanggal Rapor:
          <input type="text" class="form-input" bind:value={customTanggalRapor} />
        </label>
        <label>
          Kepala Asrama:
          <input type="text" class="form-input" bind:value={customKepalaAsrama} />
        </label>
        <label>
          Musyrif/Musyrifah:
          <input
            type="text"
            class="form-input"
            bind:value={customMusyrif}
            placeholder="Nama Musyrif"
          />
        </label>
        <label>
          Ttd Kepala (Kanan):
          <input type="file" class="form-input" accept="image/*" onchange={handleTtdKepala} />
        </label>
        <label>
          Ukuran Ttd Kepala ({ttdKepalaSize}%):
          <input type="range" min="10" max="300" class="form-input" bind:value={ttdKepalaSize} />
        </label>
        <label>
          Ttd Musyrif (Kiri):
          <input type="file" class="form-input" accept="image/*" onchange={handleTtdMusyrif} />
        </label>
        <label>
          Ukuran Ttd Musyrif ({ttdMusyrifSize}%):
          <input type="range" min="10" max="300" class="form-input" bind:value={ttdMusyrifSize} />
        </label>
      </div>
    </div>

    <div class="a4-container" style="position:relative;">
      <!-- Header -->
      <div class="header-section" style="text-align: center; margin-bottom: 16px;">
        {#if customLogoUrl}
          <img
            src={customLogoUrl}
            alt="Logo"
            style="position:absolute; left: {logoX}px; top: {logoY}px; width: {logoSize}px; z-index: 50;"
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

      <!-- Title -->
      <div class="title-section">
        <h3 class="title-main">RAPOR KESEHARIAN & POIN SANTRI</h3>
      </div>

      <!-- Student Info -->
      <div class="student-info" style="display: flex; justify-content: space-between;">
        <table class="info-table" style="width: auto;">
          <tbody>
            <tr>
              <td class="info-label" style="width: 100px;">NAMA SISWA</td>
              <td class="info-sep">:</td>
              <td>{raporData.siswa?.nama_lengkap || '-'}</td>
            </tr>
            <tr>
              <td class="info-label">KELAS</td>
              <td class="info-sep">:</td>
              <td>{raporData.riwayat?.rombel?.kelas?.nama || '-'} {raporData.riwayat?.rombel?.nama || ''}</td>
            </tr>
          </tbody>
        </table>

        <table class="info-table" style="width: auto;">
          <tbody>
            <tr>
              <td class="info-label" style="width: 140px;">KAMAR</td>
              <td class="info-sep">:</td>
              <td>{raporData.riwayat?.kamar || '-'}</td>
            </tr>
            <tr>
              <td class="info-label">{raporData.siswa?.jenis_kelamin === 'P' || raporData.siswa?.jenis_kelamin === 'Perempuan' ? 'MUSYRIFAH' : 'MUSYRIF'}</td>
              <td class="info-sep">:</td>
              <td>{customMusyrif || '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Bagian A: RAPOR KESEHARIAN -->
      <div class="mb-2">
        <h4 class="font-bold text-base mb-2">A. RAPOR KESEHARIAN</h4>
        <table class="rapor-table">
          <thead>
            <tr>
              <th class="w-12 text-center">NO</th>
              <th>KEGIATAN</th>
              <th class="w-24 text-center">NILAI</th>
            </tr>
          </thead>
          <tbody>
            {#each raporData.indikators || [] as ind, i (ind.id)}
              <tr>
                <td class="text-center">{i + 1}</td>
                <td>{ind.nama}</td>
                <td class="text-center">{getNilaiForIndikator(ind.id)}</td>
              </tr>
            {/each}
            <!-- Rata-rata -->
            <tr class="font-bold bg-gray-50 print:bg-transparent">
              <td colspan="2" class="text-right pr-4">NILAI RATA-RATA</td>
              <td class="text-center">
                {raporData.indikators && raporData.indikators.length > 0
                  ? (
                      raporData.indikators.reduce(
                        (acc, ind) => acc + getNilaiForIndikator(ind.id),
                        0
                      ) / raporData.indikators.length
                    ).toFixed(1)
                  : 100}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Bagian B: RAPOR PELANGGARAN & IQOB -->
      <div class="section-pelanggaran mb-2 mt-8">
        <h4 class="font-bold text-base mb-2">B. RAPOR PELANGGARAN & IQOB</h4>
        <table class="rapor-table">
          <thead>
            <tr>
              <th class="w-10 text-center">NO</th>
              <th class="w-24 text-center">TANGGAL</th>
              <th>KETERANGAN PELANGGARAN</th>
              <th class="w-20 text-center">POIN PELANGGARAN</th>
              <th>KETERANGAN IQOB</th>
              <th class="w-20 text-center">POIN IQOB</th>
            </tr>
          </thead>
          <tbody>
            {#if true}
              {@const riwayat = getRiwayatSideBySide(raporData)}
              {@const tPlg = (raporData.pelanggaran || []).reduce(
                (acc, p) => acc + (p.poin || 0),
                0
              )}
              {@const tIqob = (raporData.iqob || []).reduce((acc, p) => acc + (p.poin || 0), 0)}
              {@const tSisa = tPlg > tIqob ? tPlg - tIqob : 0}
              {#if riwayat.length > 0}
                {#each riwayat as r, i (i)}
                  <tr style="color: black;">
                    <td class="text-center">{i + 1}</td>
                    <td class="text-center">
                      {r.pelanggaran ? formatDate(r.pelanggaran.tanggal) : ''}
                    </td>
                    <td>{r.pelanggaran ? r.pelanggaran.pelanggaran : ''}</td>
                    <td class="text-center">{r.pelanggaran ? r.pelanggaran.poin : ''}</td>
                    <td>
                      {#if r.iqob}
                        {r.iqob.nama_iqob}
                      {/if}
                    </td>
                    <td class="text-center">{r.iqob ? r.iqob.poin : ''}</td>
                  </tr>
                {/each}
              {:else}
                <tr>
                  <td colspan="6" class="text-center py-4 text-gray-500 italic">
                    Tidak ada catatan pelanggaran atau iqob.
                  </td>
                </tr>
              {/if}
              <!-- Ringkasan Poin Akhir -->
              <tr class="font-bold border-t-2 border-black" style="color: black;">
                <td colspan="3" class="text-right">TOTAL POIN PELANGGARAN</td>
                <td class="text-center">{tPlg}</td>
                <td class="text-right">TOTAL PENGURANGAN IQOB</td>
                <td class="text-center">{tIqob}</td>
              </tr>
              <tr class="font-bold" style="color: black;">
                <td colspan="5" class="text-right">SISA POIN PELANGGARAN</td>
                <td class="text-center">{tSisa}</td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>

      <!-- Catatan Keseharian -->
      <div class="catatan-box mt-4 border border-black p-2" style="min-height: 80px;">
        <p class="font-bold text-sm m-0 mb-1">CATATAN:</p>
        <p class="text-sm m-0 whitespace-pre-wrap">{raporData.catatan || '-'}</p>
      </div>

      <!-- Signatures -->
      <div class="signature-section">
        <div class="sig-col">
          <p class="sig-invisible">Palangka Raya, {customTanggalRapor}</p>
          <p>&nbsp;</p>
          <p>Kepala Asrama</p>
          <div class="sig-space" style="display: flex; justify-content: center; align-items: center;">
            {#if ttdKepala}
              <img src={ttdKepala} alt="Ttd Kepala" style="max-height: 100%; max-width: 100%; object-fit: contain; transform: scale({ttdKepalaSize / 100}); transform-origin: center;" />
            {/if}
          </div>
          <p class="sig-name">{customKepalaAsrama || '_________________________'}</p>
        </div>
        <div class="sig-col">
          <p>Palangka Raya, {customTanggalRapor}</p>
          <p>{raporData.siswa?.jenis_kelamin === 'P' || raporData.siswa?.jenis_kelamin === 'Perempuan' ? 'Musyrifah Asrama' : 'Musyrif Asrama'}</p>
          <div class="sig-space" style="display: flex; justify-content: center; align-items: center;">
            {#if ttdMusyrif}
              <img src={ttdMusyrif} alt="Ttd Musyrif" style="max-height: 100%; max-width: 100%; object-fit: contain; transform: scale({ttdMusyrifSize / 100}); transform-origin: center;" />
            {/if}
          </div>
          <!-- Space for signature -->
          <p class="sig-name">{customMusyrif || '_________________________'}</p>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');

  :global(html),
    :global(body) {
    background-color: #f3f4f6;
  }

  .arabic {
    font-family: 'Amiri', 'Traditional Arabic', serif;
    font-size: 18px !important;
    line-height: 1.4 !important;
  }

  @media print {
    :global(html),
    :global(body) {
      background-color: white !important;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      display: none !important;
    }
    .page-wrapper {
      padding: 0 !important;
      margin: 0 !important;
    }
    .print-wrapper {
      padding: 0 !important;
      background: white !important;
    }
    .table-container {
      overflow: visible !important;
      overflow-x: visible !important;
    }
    .a4-container {
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: none !important;
    }
    .section-pelanggaran {
      page-break-before: always;
      padding-top: 1cm;
    }
  }

  @page {
    size: A4;
    margin: 1cm;
  }


  .page-wrapper {
    padding: 2rem 0;
  }

  .print-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    align-items: center;
    max-width: 210mm;
    margin: 0 auto 1.5rem;
  }

  .settings-box {
    max-width: 210mm;
    margin: 0 auto 1.5rem;
    background: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    border: 1px solid #e2e8f0;
  }
  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }
  .settings-grid label {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
    gap: 0.25rem;
  }
  .form-input {
    padding: 0.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-family: inherit;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: #4b5563;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1.5rem;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s;
  }
  .btn-back:hover {
    background: #374151;
  }

  .btn-print {
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1.5rem;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    transition: all 0.2s;
  }
  .btn-print:hover {
    background: #1d4ed8;
  }

  .a4-container {
    background: white;
    width: 100%;
    max-width: 210mm;
    min-height: auto !important;
    height: auto !important;
    margin: 0 auto;
    padding: 1cm !important;
    box-sizing: border-box;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14px;
    color: black;
  }

  .header-section {
    position: relative;
    text-align: center;
    margin-bottom: 16px;
  }

  .header-line {
    border-top: 3px double black;
    margin-bottom: 24px;
  }

  .title-section {
    text-align: center;
    margin-bottom: 24px;
  }
  .title-main {
    font-weight: 700;
    font-size: 16px;
    text-decoration: underline;
    text-underline-offset: 4px;
    margin: 0;
  }
  .title-sub {
    font-weight: 700;
    font-size: 16px;
    margin-top: 4px;
    margin-bottom: 0;
  }

  .student-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 600;
  }

  .info-table {
    border: none;
    width: auto;
  }
  .info-table td {
    border: none;
    padding: 4px 0;
    vertical-align: top;
  }
  .info-label {
    width: 80px;
  }
  .info-sep {
    padding: 4px 8px;
  }

  .table-container {
  }

  .rapor-table {
    width: 99.8%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .rapor-table th,
  .rapor-table td {
    border: 1px solid black;
    padding: 4px 8px;
    vertical-align: middle;
  }

  .rapor-table th {
    font-weight: 700;
    text-align: center;
  }

  .col-no-r {
    width: 32px;
  }
  .col-mapel {
    width: 200px;
  }
  .col-angka {
    width: 60px;
  }
  .col-tulisan {
    width: 185px;
  }
  .col-tulisan-arab {
    width: 110px;
  }
  .col-angka-arab {
    width: 50px;
  }
  .col-mapel-arab {
    width: 135px;
  }

  .text-center {
    text-align: center;
  }
  .text-right {
    text-align: right;
  }

  @media print {
  }

  .catatan-box {
    margin-top: 16px;
    border: 1px solid black;
    padding: 8px;
    min-height: 64px;
  }

  .signature-section {
    display: flex;
    justify-content: space-between;
    margin-top: 32px;
    text-align: center;
    font-size: 14px;
    padding: 0 32px;
  }

  .sig-col {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .sig-invisible {
    visibility: hidden;
  }
  .sig-space {
    height: 80px;
  }
  .sig-name {
    font-weight: 700;
    text-decoration: underline;
    margin: 0;
  }

</style>
