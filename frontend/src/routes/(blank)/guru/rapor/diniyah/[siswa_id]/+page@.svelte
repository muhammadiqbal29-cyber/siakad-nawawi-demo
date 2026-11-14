<script>
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let siswaId = $derived($page.params.siswa_id);
  let sekolahId = $derived($page.url.searchParams.get('sekolah_id') || '');
  let paramTaId = $derived($page.url.searchParams.get('tahun_ajaran_id') || '');
  let paramSemId = $derived($page.url.searchParams.get('semester_id') || '');

  let loading = $state(true);
  let error = $state('');
  let rapor = $state(null);
  let catatanRapor = $state('');

  // Dynamic Print Settings
  let customTanggalRapor = $state('');
  let customKoordinator = $state('AJI SYAFAAT');
  let customKepalaSekolah = $state('');

  // Dynamic Kop & Logo
  let customLogoUrl = $state('');
  let logoX = $state(600);
  let logoY = $state(20);
  let logoSize = $state(80);
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

  onMount(async () => {
    try {
      const params = new URLSearchParams();
      if (sekolahId) params.set('sekolah_id', sekolahId);
      if (paramTaId) params.set('tahun_ajaran_id', paramTaId);
      if (paramSemId) params.set('semester_id', paramSemId);

      const res = await fetch(`${apiUrl}/api/guru/siswa/${siswaId}/rapor-diniyah?${params.toString()}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal memuat rapor diniyah.');
      rapor = await res.json();

      params.set('jenis_rapor', 'diniyah');
      const resCatatan = await fetch(
        `${apiUrl}/api/guru/siswa/${siswaId}/catatan-rapor?${params.toString()}`,
        {
          credentials: 'include'
        }
      );
      if (resCatatan.ok) {
        const catBody = await resCatatan.json();
        catatanRapor = catBody.catatan || '';
      }

      // Initialize dynamic print settings after data loads
      customTanggalRapor = formatTanggal();
      
      // Load local storage ttd
      ttdKepala = localStorage.getItem('ttdKepala_global') || '';
      ttdMusyrif = localStorage.getItem('ttdMusyrif_global') || '';
      
      const kSize = localStorage.getItem('ttdKepalaSize_global');
      if (kSize) ttdKepalaSize = parseInt(kSize) || 100;
      
      const mSize = localStorage.getItem('ttdMusyrifSize_global');
      if (mSize) ttdMusyrifSize = parseInt(mSize) || 100;

      if (rapor.sekolah?.kepala_sekolah) {
        customKepalaSekolah = rapor.sekolah.kepala_sekolah;
      }
      if (rapor.sekolah) {
        if (rapor.sekolah.logo_base64) customLogoUrl = rapor.sekolah.logo_base64;
        logoX = rapor.sekolah.logo_x || 600;
        logoY = rapor.sekolah.logo_y || 20;
        logoSize = rapor.sekolah.logo_size || 80;
        dividerThickness = rapor.sekolah.divider_thickness || 3;

        if (rapor.sekolah.kop_surat) {
          try {
            const parsed = JSON.parse(rapor.sekolah.kop_surat);
            if (Array.isArray(parsed) && parsed.length > 0) {
              kopLines = parsed;
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  // Convert number to Indonesian words
  function angkaTerbilang(n) {
    if (n === 0) return 'Nol';
    const satuan = [
      '',
      'Satu',
      'Dua',
      'Tiga',
      'Empat',
      'Lima',
      'Enam',
      'Tujuh',
      'Delapan',
      'Sembilan'
    ];
    const belasan = [
      'Sepuluh',
      'Sebelas',
      'Dua Belas',
      'Tiga Belas',
      'Empat Belas',
      'Lima Belas',
      'Enam Belas',
      'Tujuh Belas',
      'Delapan Belas',
      'Sembilan Belas'
    ];
    const puluhan = [
      '',
      '',
      'Dua Puluh',
      'Tiga Puluh',
      'Empat Puluh',
      'Lima Puluh',
      'Enam Puluh',
      'Tujuh Puluh',
      'Delapan Puluh',
      'Sembilan Puluh'
    ];
    const num = Math.round(n);
    if (num < 0) return 'Nol';
    if (num < 10) return satuan[num];
    if (num < 20) return belasan[num - 10];
    if (num < 100)
      return puluhan[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + satuan[num % 10] : '');
    return String(num);
  }

  // Convert number to Arabic words (Lafzu)
  function angkaTerbilangArab(n) {
    if (n === 0) return 'صفر';

    // Sesuai kaidah grammar untuk mu'annath (misal: darajah/nilai) atau request user
    // Satuan tanpa ta marbutoh
    const satuan = ['', 'واحد', 'اثنان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع'];
    const puluhan = [
      '',
      '',
      'عشرون',
      'ثلاثون',
      'أربعون',
      'خمسون',
      'ستون',
      'سبعون',
      'ثمانون',
      'تسعون'
    ];

    const num = Math.round(n);
    if (num < 0) return 'صفر';
    if (num < 10) return satuan[num];

    if (num === 10) return 'عشرة';
    if (num < 20) {
      if (num === 11) return 'إحدى عشرة';
      if (num === 12) return 'اثنتا عشرة';
      return satuan[num - 10] + ' عشرة';
    }

    if (num < 100) {
      const p = Math.floor(num / 10);
      const s = num % 10;
      if (s === 0) {
        return puluhan[p];
      } else {
        // Misal 95: خمس وتسعون (satuan di depan, tanpa ta marbutoh, wa puluhan)
        return satuan[s] + ' و' + puluhan[p];
      }
    }

    if (num === 100) return 'مائة';

    return String(num);
  }

  // Convert number to Arabic numerals
  function toArabicNumeral(n) {
    const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(Math.round(n))
      .split('')
      .map((d) => arabicDigits[parseInt(d)] || d)
      .join('');
  }

  function semesterLabel(sem) {
    if (!sem) return '';
    const tipe = sem.tipe_semester || '';
    if (tipe.toLowerCase().includes('ganjil') || tipe === '1') return '1 (Satu)';
    if (tipe.toLowerCase().includes('genap') || tipe === '2') return '2 (Dua)';
    return tipe;
  }

  function kelasRomawi(kelas) {
    if (!kelas) return '';
    const tingkat = kelas.tingkat || '';
    const map = { '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII' };
    return map[tingkat] || tingkat;
  }

  function kelasTerbilang(kelas) {
    if (!kelas) return '';
    const tingkat = kelas.tingkat || '';
    const map = {
      '7': 'Tujuh',
      '8': 'Delapan',
      '9': 'Sembilan',
      '10': 'Sepuluh',
      '11': 'Sebelas',
      '12': 'Dua Belas'
    };
    return map[tingkat] || tingkat;
  }

  let kopLines = $state([
    { text: 'YAYASAN IMAM NAWAWI PALANGKA RAYA', color: '#558b2f', size: 18, bold: true },
    { text: 'SMP ISLAM IMAM NAWAWI', color: '#1565c0', size: 16, bold: true },
    {
      text: 'Jl. Tjilik Riwut KM 8 (Jl. Gajah Mada) Kel. Bukit Tunggal Kec. Jekan Raya Kota Palangka Raya',
      color: '#000000',
      size: 12,
      bold: false
    },
    {
      text: 'Email: smpislamnawawi@gmail.com Telp. 0898 1567 898',
      color: '#000000',
      size: 12,
      bold: false
    }
  ]);

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

  // Group mapel by kategori
  function groupedMapel(mapelNilai) {
    if (!mapelNilai) return { tes_tulis: [], tes_lisan: [] };
    const groups = { tes_tulis: [], tes_lisan: [] };
    for (const mn of mapelNilai) {
      const cat = mn.mapel?.kategori || 'tes_tulis';
      if (groups[cat]) {
        groups[cat].push(mn);
      } else {
        groups.tes_tulis.push(mn);
      }
    }
    return groups;
  }
</script>

<svelte:head>
  <title>Rapor Diniyah - {rapor?.siswa?.nama_lengkap || 'Siswa'} - SIAKAD</title>
</svelte:head>

<div class="page-wrapper">
  {#if loading}
    <div class="loading-box">Memuat rapor diniyah...</div>
  {:else if error}
    <div class="error-box">{error}</div>
  {:else if rapor}
    {@const groups = groupedMapel(rapor.mapel_nilai)}

    <div class="print-actions no-print">
      <button class="btn-back" onclick={() => goto('/guru/rapor/diniyah')}>
        <Icon name="chevronLeft" size={16} /> Kembali
      </button>
      <button class="btn-print" onclick={() => window.print()}> 🖨️ Cetak Rapor (Print) </button>
    </div>

    <!-- Edit Settings -->
    <div class="settings-box no-print">
      <h4 style="margin-top: 0;">Pengaturan Cetak (Tidak ikut terprint)</h4>
      <div class="settings-grid">
        <label>
          Tanggal Rapor:
          <input type="text" class="form-input" bind:value={customTanggalRapor} />
        </label>
      </div>

      <div class="settings-grid" style="margin-top:16px;">
        <label>
          Koordinator Diniyah:
          <input type="text" class="form-input" bind:value={customKoordinator} />
        </label>
        <label>
          Kepala Sekolah:
          <input type="text" class="form-input" bind:value={customKepalaSekolah} />
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
          Ttd Koordinator (Kiri):
          <input type="file" class="form-input" accept="image/*" onchange={handleTtdMusyrif} />
        </label>
        <label>
          Ukuran Ttd Koordinator ({ttdMusyrifSize}%):
          <input type="range" min="10" max="300" class="form-input" bind:value={ttdMusyrifSize} />
        </label>
      </div>
    </div>

    <!-- A4 Paper Container -->
    <div class="a4-container">
      <!-- Header -->
      <div class="header-section">
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

      <div
        style="border-top: {dividerThickness}px double black; border-bottom: none; height: 0; margin-bottom: 24px;"
      ></div>

      <!-- Title -->
      <div class="title-section">
        <h3 class="title-main">LAPORAN HASIL PEMBELAJARAN</h3>
        <h4 class="title-sub">MATA PELAJARAN DINIYYAH</h4>
      </div>

      <!-- Student Info -->
      <div class="student-info">
        <div class="info-left">
          <table class="info-table">
            <tbody>
              <tr>
                <td class="info-label">NAMA</td>
                <td class="info-sep">:</td>
                <td>{rapor.siswa?.nama_lengkap || '-'}</td>
              </tr>
              <tr>
                <td class="info-label">NISN</td>
                <td class="info-sep">:</td>
                <td>{rapor.siswa?.nisn || '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="info-right">
          <table class="info-table">
            <tbody>
              <tr>
                <td class="info-label">KELAS</td>
                <td class="info-sep">:</td>
                <td>{rapor.kelas?.nama_kelas || '-'}</td>
              </tr>
              <tr>
                <td class="info-label">SEMESTER</td>
                <td class="info-sep">:</td>
                <td>{semesterLabel(rapor.semester)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Main Table -->
      <div class="table-container">
        <table class="rapor-table">
          <thead>
            <tr>
              <th rowspan="2" class="col-no-r">NO</th>
              <th rowspan="2" class="col-mapel">MATA PELAJARAN</th>
              <th colspan="2">HASIL UJIAN</th>
              <th colspan="2" class="arabic">نتائج التمرينات</th>
              <th rowspan="2" class="arabic col-mapel-arab">فنون</th>
              <th rowspan="2" class="arabic col-no-arab">رقم</th>
            </tr>
            <tr>
              <th class="col-angka">ANGKA</th>
              <th class="col-tulisan">TULISAN</th>
              <th class="arabic col-tulisan-arab">اللفظ</th>
              <th class="arabic col-angka-arab">الرقم</th>
            </tr>
          </thead>
          <tbody>
            <!-- Group A: TES TULIS -->
            {#if groups.tes_tulis.length > 0}
              <tr class="group-header">
                <td class="text-center">A</td>
                <td>TES TULIS</td>
                <td></td><td></td><td></td><td></td>
                <td class="arabic text-right" dir="rtl">الكتابة</td>
                <td class="arabic text-center">أ</td>
              </tr>
              {#each groups.tes_tulis as mn, i (i)}
                {@const nilai = mn.nilai ? Math.round(mn.nilai.nilai_rapor) : 0}
                <tr>
                  <td class="text-center">{i + 1}</td>
                  <td>{mn.mapel?.nama_mapel || '-'}</td>
                  <td class="text-center">{nilai || '-'}</td>
                  <td>{nilai > 0 ? angkaTerbilang(nilai) : '-'}</td>
                  <td class="arabic text-right" dir="rtl"
                    >{nilai > 0 ? angkaTerbilangArab(nilai) : '-'}</td
                  >
                  <td class="arabic text-center">{nilai > 0 ? toArabicNumeral(nilai) : '-'}</td>
                  <td class="arabic text-right" dir="rtl">{mn.mapel?.nama_mapel_arab || '-'}</td>
                  <td class="arabic text-center">{toArabicNumeral(i + 1)}</td>
                </tr>
              {/each}
            {/if}

            <!-- Group B: TES LISAN -->
            {#if groups.tes_lisan.length > 0}
              <tr class="group-header">
                <td class="text-center">B</td>
                <td>TES LISAN</td>
                <td></td><td></td><td></td><td></td>
                <td class="arabic text-right" dir="rtl">الشفوية</td>
                <td class="arabic text-center">ب</td>
              </tr>
              {#each groups.tes_lisan as mn, i (i)}
                {@const nilai = mn.nilai ? Math.round(mn.nilai.nilai_rapor) : 0}
                <tr>
                  <td class="text-center">{i + 1}</td>
                  <td>{mn.mapel?.nama_mapel || '-'}</td>
                  <td class="text-center">{nilai || '-'}</td>
                  <td>{nilai > 0 ? angkaTerbilang(nilai) : '-'}</td>
                  <td class="arabic text-right" dir="rtl"
                    >{nilai > 0 ? angkaTerbilangArab(nilai) : '-'}</td
                  >
                  <td class="arabic text-center">{nilai > 0 ? toArabicNumeral(nilai) : '-'}</td>
                  <td class="arabic text-right" dir="rtl">{mn.mapel?.nama_mapel_arab || '-'}</td>
                  <td class="arabic text-center">{toArabicNumeral(i + 1)}</td>
                </tr>
              {/each}
            {/if}

            <!-- Fill remaining empty rows up to 8 -->
            {#each Array(Math.max(0, 8 - (groups.tes_tulis.length + groups.tes_lisan.length + (groups.tes_tulis.length > 0 ? 1 : 0) + (groups.tes_lisan.length > 0 ? 1 : 0)))) as _, i (i)}
              <tr>
                <td class="text-center"
                  >{groups.tes_tulis.length + groups.tes_lisan.length + i + 1}</td
                >
                <td></td><td></td><td></td><td></td><td></td><td></td>
                <td class="arabic text-center"
                  >{toArabicNumeral(groups.tes_tulis.length + groups.tes_lisan.length + i + 1)}</td
                >
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Catatan -->
      <div class="catatan-box">
        <p class="catatan-label">CATATAN:</p>
        <p class="catatan-content">{catatanRapor || '-'}</p>
      </div>

      <!-- Signatures -->
      <div class="signature-section">
        <div class="sig-col">
          <p class="sig-invisible">{customTanggalRapor}</p>
          <p>Koordinator Diniyah</p>
          <div class="sig-space" style="display: flex; justify-content: center; align-items: center;">
            {#if ttdMusyrif}
              <img src={ttdMusyrif} alt="Ttd Musyrif" style="max-height: 100%; max-width: 100%; object-fit: contain; transform: scale({ttdMusyrifSize / 100}); transform-origin: center;" />
            {/if}
          </div>
          <p class="sig-name">{customKoordinator || '____________________'}</p>
        </div>
        <div class="sig-col">
          <p>{customTanggalRapor}</p>
          <p>Kepala Sekolah</p>
          <div class="sig-space" style="display: flex; justify-content: center; align-items: center;">
            {#if ttdKepala}
              <img src={ttdKepala} alt="Ttd Kepala" style="max-height: 100%; max-width: 100%; object-fit: contain; transform: scale({ttdKepalaSize / 100}); transform-origin: center;" />
            {/if}
          </div>
          <p class="sig-name">{customKepalaSekolah || '____________________'}</p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');

  :global(html),
    :global(body) {
    background-color: #f3f4f6;
  }

  .arabic {
    font-family: 'Amiri', 'Traditional Arabic', serif;
    font-size: 16px !important;
    line-height: 1.2 !important;
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
    position: relative;
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
    padding: 2px 4px;
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
  .col-no-arab {
    width: 32px;
  }

  .text-center {
    text-align: center;
  }
  .text-right {
    text-align: right;
  }

  .group-header {
    font-weight: 700;
    background: #f9fafb;
  }
  @media print {
    .group-header {
      background: transparent;
    }
  }

  .catatan-box {
    margin-top: 16px;
    border: 1px solid black;
    padding: 8px;
    min-height: 64px;
  }
  .catatan-label {
    font-weight: 700;
    font-size: 14px;
    margin: 0 0 4px 0;
  }
  .catatan-content {
    margin: 0;
    font-size: 13px;
    white-space: pre-wrap;
    line-height: 1.4;
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

  .loading-box {
    padding: 3rem;
    text-align: center;
    color: #64748b;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
    background: #f8fafc;
    max-width: 400px;
    margin: 100px auto;
  }
  .error-box {
    padding: 1.5rem;
    text-align: center;
    color: #dc2626;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    max-width: 400px;
    margin: 100px auto;
  }

</style>
