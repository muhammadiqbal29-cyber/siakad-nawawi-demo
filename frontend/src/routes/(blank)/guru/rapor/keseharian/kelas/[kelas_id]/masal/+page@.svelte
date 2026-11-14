<script>
  import { toastStore } from '$lib/toast.svelte.js';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let kelasId = $derived($page.params.kelas_id);
  let rombel = $derived($page.url.searchParams.get('rombel') || '');
  let sekolahId = $derived($page.url.searchParams.get('sekolah_id') || '');
  let paramTaId = $derived($page.url.searchParams.get('tahun_ajaran_id') || '');
  let paramSemId = $derived($page.url.searchParams.get('semester_id') || '');

  let loading = $state(true);
  let error = $state('');
  let raporList = $state([]);

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
    if (raporList.length > 0 && raporList[0].sekolah) {
      const sekolah = raporList[0].sekolah;
      customLogoUrl = sekolah.logo_base64 || '';
      logoX = sekolah.logo_x || 600;
      logoY = sekolah.logo_y || 20;
      logoSize = sekolah.logo_size || 80;
      dividerThickness = sekolah.divider_thickness || 3;
      let localKop = [];
      if (sekolah.kop_surat) {
        try {
          const parsed = JSON.parse(sekolah.kop_surat);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localKop = parsed;
          }
        } catch (e) {}
      }
      if (localKop.length === 0) {
        localKop = [
          {
            text: sekolah.nama_sekolah || 'SMP ISLAM IMAM NAWAWI',
            color: '#000000',
            size: 18,
            bold: true
          },
          {
            text: sekolah.alamat || 'Jl. Tjilik Riwut KM 8',
            color: '#000000',
            size: 12,
            bold: false
          }
        ];
      }
      kopLines = localKop;
    }
  });

  onMount(async () => {
    try {
      const params = new URLSearchParams();
      if (sekolahId) params.append('sekolah_id', sekolahId);
      if (rombel && rombel !== '__kosong__') params.append('rombel', rombel);
      if (paramTaId) params.append('tahun_ajaran_id', paramTaId);
      if (paramSemId) params.append('semester_id', paramSemId);

      const res = await fetch(
        `${apiUrl}/api/guru/kelas/${kelasId}/keseharian-masal?${params.toString()}`,
        {
          credentials: 'include'
        }
      );
      if (!res.ok) throw new Error('Gagal memuat rapor keseharian masal.');
      const data = await res.json();
      const sortedData = (data || []).sort((a, b) => {
        const nameA = a.siswa?.nama_lengkap || '';
        const nameB = b.siswa?.nama_lengkap || '';
        return nameA.localeCompare(nameB);
      });
      raporList = sortedData;
      
      // Load local storage ttd on mount
      ttdKepala = localStorage.getItem('ttdKepala_global') || '';
      ttdMusyrif = localStorage.getItem('ttdMusyrif_global') || '';
      
      const kSize = localStorage.getItem('ttdKepalaSize_global');
      if (kSize) ttdKepalaSize = parseInt(kSize) || 100;
      
      const mSize = localStorage.getItem('ttdMusyrifSize_global');
      if (mSize) ttdMusyrifSize = parseInt(mSize) || 100;

      const paramsCatatan = new URLSearchParams();
      paramsCatatan.append('jenis_rapor', 'keseharian');
      if (sekolahId) paramsCatatan.append('sekolah_id', sekolahId);
      if (rombel && rombel !== '__kosong__') paramsCatatan.append('rombel', rombel);
      if (paramTaId) paramsCatatan.append('tahun_ajaran_id', paramTaId);
      if (paramSemId) paramsCatatan.append('semester_id', paramSemId);

      const resCatatan = await fetch(
        `${apiUrl}/api/guru/kelas/${kelasId}/catatan-rapor?${paramsCatatan.toString()}`,
        {
          credentials: 'include'
        }
      );
      if (resCatatan.ok) {
        const catBody = await resCatatan.json();
        const catList = catBody.catatan || [];
        const catMap = {};
        catList.forEach((c) => {
          catMap[c.siswa_id] = c.catatan;
        });
        raporList = raporList.map((r) => ({
          ...r,
          catatan: catMap[r.siswa.id] || ''
        }));
      }

      customTanggalRapor = formatTanggal();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  function formatTanggal() {
    const months = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember'
    ];
    const now = new Date();
    return `Palangka Raya, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }

  function getNilaiForIndikator(raporData, indId) {
    if (!raporData || !raporData.rekaps) return 100;
    const rekap = raporData.rekaps.find((r) => r.indikator_id === indId);
    return rekap ? rekap.poin_akhir : 100;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  let isDownloading = $state(false);
  let dlProgress = $state(0);
  let dlTotal = $state(0);
  let dlCurrentName = $state('');
  let dlStage = $state('');

  async function downloadSemuaPDF() {
    isDownloading = true;
    dlProgress = 0;
    dlTotal = raporList.length;
    dlCurrentName = '';
    dlStage = 'pdf';
    try {
      let activeTaName = 'TA';
      try {
        const taRes = await fetch(`${apiUrl}/api/guru/tahun-ajaran`, {credentials: 'include'});
        if (taRes.ok) {
          const resData = await taRes.json();
          const tas = resData.data || resData;
          const ta = tas.find(t => paramTaId ? t.id == paramTaId : t.status === 'Active');
          if (ta && ta.nama_tahun) activeTaName = ta.nama_tahun.replace(/\//g, '-');
        }
      } catch(e) {}

      const html2pdf = (await import('html2pdf.js')).default;
      const JSZip = (await import('jszip')).default;
      const { saveAs } = await import('file-saver');
      
      const zip = new JSZip();
      let semCleanGlobal = 'Sem';

      const noPrintEls = document.querySelectorAll('.no-print');
      noPrintEls.forEach(el => { if (!el.classList.contains('dl-overlay')) el.style.display = 'none'; });

      for (let idx = 0; idx < raporList.length; idx++) {
        const rapor = raporList[idx];
        dlProgress = idx + 1;
        dlCurrentName = rapor.siswa.nama_lengkap;
        const elId = `rapor-container-${rapor.siswa.id}`;
        const element = document.getElementById(elId);
        if (element) {
          const taClean = rapor.tahun_ajaran ? (rapor.tahun_ajaran.nama_tahun || '').replace(/\//g, '-') : activeTaName;
          const semClean = rapor.semester ? (rapor.semester.tipe_semester || 'Sem') : 'Sem';
          semCleanGlobal = semClean;
          const namaClean = rapor.siswa.nama_lengkap.replace(/\s+/g, '_');

          const origStyles = {
            padding: element.style.padding,
            margin: element.style.margin,
            boxShadow: element.style.boxShadow,
            width: element.style.width,
            maxWidth: element.style.maxWidth,
            minHeight: element.style.minHeight,
            height: element.style.height,
          };
          element.style.padding = '0';
          element.style.margin = '0';
          element.style.boxShadow = 'none';
          element.style.width = '210mm';
          element.style.maxWidth = 'none';
          element.style.minHeight = 'auto';
          element.style.height = 'auto';

          const opt = {
            margin: 0,
            filename: `${namaClean}_${semClean}_${taClean}.pdf`,
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2, useCORS: true, width: 794, windowWidth: 794 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };

          const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
          zip.file(opt.filename, pdfBlob);

          Object.assign(element.style, origStyles);
        }
      }

      noPrintEls.forEach(el => el.style.display = '');

      dlStage = 'zip';
      dlCurrentName = 'Membuat file ZIP...';
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFilename = `Rapor_Masal_Keseharian_Kelas_${kelasId}_${semCleanGlobal}_${activeTaName}.zip`;
      saveAs(zipBlob, zipFilename);

      dlStage = 'done';
      dlCurrentName = zipFilename;
      await new Promise(r => setTimeout(r, 2000));

      toastStore.show('Berhasil menyimpan semua file PDF dalam satu file ZIP!', 'info');
    } catch (err) {
      console.error(err);
      toastStore.show('Terjadi kesalahan saat membuat ZIP PDF: ' + err.message, 'info');
    } finally {
      isDownloading = false;
      dlStage = '';
      document.querySelectorAll('.no-print').forEach(el => el.style.display = '');
    }
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
  <title>Cetak Rapor Keseharian Masal - SIAKAD</title>
</svelte:head>

<div class="page-wrapper">
  {#if loading}
    <div class="loading-box">Memuat rapor keseharian...</div>
  {:else if error}
    <div class="error-box">{error}</div>
  {:else if raporList.length > 0}
    <div class="print-actions no-print">
      <button class="btn-back" onclick={() => goto('/guru/rapor/keseharian')}>
        <Icon name="chevronLeft" size={16} /> Kembali
      </button>
      <button class="btn-print" onclick={() => window.print()}> 🖨️ Cetak Rapor (Print) </button>
      <button class="btn-download" onclick={downloadSemuaPDF} disabled={isDownloading}>
        {isDownloading ? '⏳ Memproses PDF...' : '📦 Download Semua PDF (.zip)'}
      </button>
    </div>

    <!-- Edit Settings -->
    <div class="settings-box no-print">
      <h4 style="margin-top: 0;">Pengaturan Cetak (Tidak ikut terprint)</h4>
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

    <!-- Render all students -->
    {#each raporList as raporData}
      <!-- A4 Paper Container -->
      <div
        class="a4-container"
        id="rapor-container-{raporData.siswa.id}"
        style="position:relative;"
      >
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
        <div style="margin-bottom: 0.5rem;">
          <h4 style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">
            A. RAPOR KESEHARIAN
          </h4>
          <table class="rapor-table">
            <thead>
              <tr>
                <th style="width: 3rem; text-align: center;">NO</th>
                <th>KEGIATAN</th>
                <th style="width: 6rem; text-align: center;">NILAI</th>
              </tr>
            </thead>
            <tbody>
              {#each raporData.indikators || [] as ind, i (ind.id)}
                <tr>
                  <td class="text-center">{i + 1}</td>
                  <td>{ind.nama}</td>
                  <td class="text-center">{getNilaiForIndikator(raporData, ind.id)}</td>
                </tr>
              {/each}
              <!-- Rata-rata -->
              <tr class="group-header">
                <td colspan="2" class="text-right" style="padding-right: 1rem;">NILAI RATA-RATA</td>
                <td class="text-center">
                  {raporData.indikators && raporData.indikators.length > 0
                    ? (
                        raporData.indikators.reduce(
                          (acc, ind) => acc + getNilaiForIndikator(raporData, ind.id),
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
            <p class="sig-name">{customMusyrif || '_________________________'}</p>
          </div>
        </div>
      </div>

      <div class="page-break" style="page-break-after: always;"></div>
    {/each}
  {:else}
    <div class="error-box">Data rapor masal kosong.</div>
  {/if}
</div>

<!-- Download Progress Overlay -->
{#if isDownloading}
  <div class="dl-overlay no-print">
    <div class="dl-modal">
      <div class="dl-icon">
        {#if dlStage === 'done'}
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        {:else}
          <div class="dl-spinner"></div>
        {/if}
      </div>
      <h3 class="dl-title">
        {#if dlStage === 'done'}
          Download Selesai! ✅
        {:else if dlStage === 'zip'}
          Membuat file ZIP...
        {:else}
          Menyiapkan PDF...
        {/if}
      </h3>
      <p class="dl-subtitle">
        {#if dlStage === 'pdf'}
          Memproses rapor <strong>{dlCurrentName}</strong>
        {:else if dlStage === 'zip'}
          Menggabungkan {dlTotal} file PDF menjadi satu file ZIP
        {:else if dlStage === 'done'}
          File <strong>{dlCurrentName}</strong> berhasil diunduh
        {/if}
      </p>
      {#if dlStage === 'pdf'}
        <div class="dl-progress-wrap">
          <div class="dl-progress-bar" style="width: {(dlProgress / dlTotal) * 100}%"></div>
        </div>
        <p class="dl-progress-text">{dlProgress} / {dlTotal} siswa ({Math.round((dlProgress / dlTotal) * 100)}%)</p>
      {:else if dlStage === 'zip'}
        <div class="dl-progress-wrap">
          <div class="dl-progress-bar dl-progress-indeterminate"></div>
        </div>
      {/if}
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

  .btn-download {
    background: #10b981;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 0.6rem 1.5rem;
    font-weight: 700;
    font-size: 0.95rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    transition: all 0.2s;
  }
  .btn-download:hover:not(:disabled) {
    background: #059669;
  }
  .btn-download:disabled {
    background: #94a3b8;
    cursor: not-allowed;
    box-shadow: none;
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
    font-family: sans-serif;
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
    width: 120px;
  }
  .info-sep {
    padding: 4px 8px;
  }

  .rapor-table {
    width: 99.8%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .rapor-table th,
  .rapor-table td {
    border: none;
    border-bottom: 1px solid black;
    border-right: 1px solid black;
    padding: 4px 8px;
    vertical-align: middle;
  }

  .rapor-table th {
    font-weight: 700;
    text-align: center;
  }

  .text-center {
    text-align: center;
  }
  .text-right {
    text-align: right;
  }

  @media print {
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
  /* Download Progress Overlay */
  .dl-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(6px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .dl-modal {
    background: white;
    border-radius: 20px;
    padding: 2.5rem 3rem;
    max-width: 420px;
    width: 90%;
    text-align: center;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
    animation: dlSlideUp 0.3s ease-out;
  }
  @keyframes dlSlideUp {
    from { opacity: 0; transform: translateY(30px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .dl-icon {
    margin-bottom: 1.25rem;
    display: flex;
    justify-content: center;
  }
  .dl-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid #e2e8f0;
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: dlSpin 0.8s linear infinite;
  }
  @keyframes dlSpin {
    to { transform: rotate(360deg); }
  }
  .dl-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.5rem;
  }
  .dl-subtitle {
    font-size: 0.9rem;
    color: #64748b;
    margin: 0 0 1.25rem;
    line-height: 1.5;
  }
  .dl-subtitle strong {
    color: #334155;
  }
  .dl-progress-wrap {
    width: 100%;
    height: 10px;
    background: #e2e8f0;
    border-radius: 999px;
    overflow: hidden;
  }
  .dl-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 999px;
    transition: width 0.4s ease;
  }
  .dl-progress-indeterminate {
    width: 40% !important;
    animation: dlIndeterminate 1.5s ease-in-out infinite;
  }
  @keyframes dlIndeterminate {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(350%); }
  }
  .dl-progress-text {
    font-size: 0.8rem;
    color: #94a3b8;
    margin: 0.75rem 0 0;
    font-weight: 600;
  }

</style>
