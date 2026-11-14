<script>
  import { goto } from '$app/navigation';
  import { guruState } from '$lib/guruState.svelte.js';
  import Icon from '$lib/components/ui/Icon.svelte';

  // 1. Data Konfigurasi Penilaian (IDCloudHost Configurator Pattern)
  let selectedKategori = $state('tahfiz'); // 'tahfiz' | 'diniyah' | 'keseharian' | 'tasmi'
  let selectedSekolahId = $state(guruState.activeSekolahId || 1);
  let selectedKelasId = $state(1);
  let selectedMateriId = $state('juz30');
  let selectedMetode = $state('tabel'); // 'tabel' | 'satuan' | 'excel' | 'rapor'

  // Update default jika guruState berubah
  $effect(() => {
    if (guruState.activeSekolahId && guruState.activeSekolahId !== selectedSekolahId) {
      selectedSekolahId = guruState.activeSekolahId;
    }
  });

  // Sinkronkan jenjang jika user memilih kartu sekolah
  function selectSekolah(id) {
    selectedSekolahId = id;
    guruState.activeSekolahId = id;
    const s = guruState.sekolahList.find(x => x.id == id);
    if (s) {
      guruState.activeSekolahName = s.nama_sekolah;
      if (typeof window !== 'undefined') {
        localStorage.setItem('siakad_active_sekolah_id', String(id));
        localStorage.setItem('siakad_active_sekolah_name', s.nama_sekolah);
      }
    }
    // Sesuaikan kelas pertama untuk jenjang baru
    if (id === 1) {
      selectedKelasId = 1; // Kelas 7A
    } else {
      selectedKelasId = 3; // Kelas 10A
    }
  }

  // 2. Daftar Kategori Penilaian (Section 1)
  const kategoriList = [
    {
      id: 'tahfiz',
      title: "Tahfiz Al-Qur'an",
      desc: 'Setoran & Ujian Juz',
      icon: 'bookOpen',
      badge: 'Juz 30, 29, 28'
    },
    {
      id: 'diniyah',
      title: 'Mata Pelajaran Diniyah',
      desc: 'Kitab Syar’i & Ulangan',
      icon: 'fileText',
      badge: 'Fiqih, Aqidah, Hadits'
    },
    {
      id: 'keseharian',
      title: 'Keseharian & Karakter',
      desc: 'Sholat, Adab & Iqob',
      icon: 'award',
      badge: 'Ibadah & Disiplin'
    },
    {
      id: 'tasmi',
      title: "Ujian Tasmi'",
      desc: 'Sekali Duduk Mutqin',
      icon: 'checkCircle',
      badge: 'Standar Kelulusan'
    }
  ];

  // 3. Daftar Sekolah / Jenjang (Section 2)
  const sekolahOptions = [
    {
      id: 1,
      nama: 'SMP Imam Nawawi',
      jenjang: 'SMP',
      tingkat: 'Tingkat VII, VIII, IX',
      npsn: 'NPSN 69991234',
      icon: 'grid'
    },
    {
      id: 2,
      nama: 'SMA Imam Nawawi',
      jenjang: 'SMA',
      tingkat: 'Tingkat X, XI, XII',
      npsn: 'NPSN 69995678',
      icon: 'award'
    }
  ];

  // 4. Daftar Kelas & Rombel (Section 3) - Multi-column Card Grid
  const kelasOptionsSMP = [
    { id: 1, nama: 'Kelas 7A', rombel: 'A', tingkat: 7, total: 5, label: 'Putra (Halaqah Abu Bakar)' },
    { id: 2, nama: 'Kelas 7B', rombel: 'B', tingkat: 7, total: 5, label: 'Putra (Halaqah Umar)' },
    { id: 5, nama: 'Kelas 8A', rombel: 'A', tingkat: 8, total: 5, label: 'Putra (Halaqah Utsman)' },
    { id: 6, nama: 'Kelas 8B', rombel: 'B', tingkat: 8, total: 5, label: 'Putra (Halaqah Ali)' },
    { id: 7, nama: 'Kelas 9A', rombel: 'A', tingkat: 9, total: 5, label: 'Putra (Tingkat Akhir)' },
    { id: 8, nama: 'Kelas 9B', rombel: 'B', tingkat: 9, total: 5, label: 'Putra (Tingkat Akhir)' }
  ];

  const kelasOptionsSMA = [
    { id: 3, nama: 'Kelas 10A', rombel: 'A', tingkat: 10, total: 5, label: 'Putra (Jurusan Diniyah)' },
    { id: 4, nama: 'Kelas 10B', rombel: 'B', tingkat: 10, total: 5, label: 'Putra (Jurusan IPA Syar’i)' },
    { id: 9, nama: 'Kelas 11A', rombel: 'A', tingkat: 11, total: 5, label: 'Putra (Tahfiz Intensif)' },
    { id: 10, nama: 'Kelas 11B', rombel: 'B', tingkat: 11, total: 5, label: 'Putra (Kajian Kitab)' },
    { id: 11, nama: 'Kelas 12A', rombel: 'A', tingkat: 12, total: 5, label: 'Putra (Persiapan Sanad)' },
    { id: 12, nama: 'Kelas 12B', rombel: 'B', tingkat: 12, total: 5, label: 'Putra (Kaderisasi Da’i)' }
  ];

  let currentKelasList = $derived(selectedSekolahId === 1 ? kelasOptionsSMP : kelasOptionsSMA);

  // 5. Materi Penilaian Dinamis berdasarkan Kategori (Section 4)
  const materiTahfiz = [
    { id: 'juz30', nama: "Juz 30 (Juz 'Amma)", sub: '37 Surah Pendek', badge: 'An-Naba s.d An-Nas', icon: 'bookOpen' },
    { id: 'juz29', nama: 'Juz 29 (Tabarak)', sub: '11 Surah Menengah', badge: 'Al-Mulk s.d Al-Mursalat', icon: 'bookOpen' },
    { id: 'juz28', nama: "Juz 28 (Qad Sami'a)", sub: '9 Surah Al-Mujadilah', badge: 'Standar Mutqin', icon: 'bookOpen' },
    { id: 'tasmi_duduk', nama: "Ujian Tasmi' Duduk", sub: 'Sekali Duduk Tanpa Salah', badge: '1 - 5 Juz Sekaligus', icon: 'checkCircle' },
    { id: 'halaqah_harian', nama: 'Mutaba’ah Harian', sub: 'Halaqah Pagi & Sore', badge: 'Sabaq & Sabqi', icon: 'calendar' }
  ];

  const materiDiniyah = [
    { id: 'fiqih', nama: 'Fiqih Ibadah', sub: 'Kitab Matan Al-Ghayah', badge: 'Thaharah & Shalat • KKM 75', icon: 'fileText' },
    { id: 'aqidah', nama: 'Aqidah & Akhlak', sub: 'Kitab Ushuluts Tsalatsah', badge: 'Tauhid Asas • KKM 75', icon: 'award' },
    { id: 'hadits', nama: 'Hadits Arbain', sub: 'Imam Nawawi (1–20)', badge: 'Hafalan & Terjemah • KKM 75', icon: 'bookOpen' },
    { id: 'arab', nama: 'Bahasa Arab', sub: 'Durusul Lughah Jilid 1', badge: 'Nahwu & Kosakata • KKM 70', icon: 'edit' },
    { id: 'sirah', nama: 'Sirah Nabawiyah', sub: 'Khulafaur Rasyidin', badge: 'Sejarah Islam • KKM 75', icon: 'users' }
  ];

  const materiKeseharian = [
    { id: 'sholat', nama: 'Sholat Berjamaah 5 Waktu', sub: 'Kedisiplinan di Masjid', badge: 'Subuh s.d Isya Berjamaah', icon: 'checkCircle' },
    { id: 'adab', nama: 'Adab & Akhlak Santri', sub: 'Adab Harian di Asrama', badge: 'Makan, Tidur, Berbicara', icon: 'award' },
    { id: 'piket', nama: 'Kedisiplinan & Kebersihan', sub: 'Piket Kamar & Lingkungan', badge: 'Standar Sanitasi Pondok', icon: 'grid' },
    { id: 'pelanggaran', nama: 'Catatan Pelanggaran & Poin', sub: 'Buku Saku Disiplin Santri', badge: 'Rekap Sanksi & Iqob', icon: 'alertCircle' },
    { id: 'pemutihan', nama: 'Pemutihan Iqob Edukatif', sub: 'Penebusan Poin Pelanggaran', badge: 'Hafalan & Tugas Edukatif', icon: 'clock' }
  ];

  const materiTasmi = [
    { id: 'tasmi1', nama: "Tasmi' 1 Juz", sub: 'Sekali Duduk', badge: 'KKM 80 • Dewan Penguji', icon: 'checkCircle' },
    { id: 'tasmi3', nama: "Tasmi' 3 Juz", sub: 'Sekali Duduk', badge: 'KKM 85 • Sertifikat Resmi', icon: 'award' },
    { id: 'tasmi5', nama: "Tasmi' 5 Juz", sub: 'Sekali Duduk', badge: 'Standar Mutqin Pesantren', icon: 'bookOpen' },
    { id: 'tasmi10', nama: "Tasmi' 10 Juz / Sanad", sub: 'Ujian Kelulusan Utama', badge: 'Predikat Mumtaz', icon: 'award' }
  ];

  let currentMateriList = $derived.by(() => {
    if (selectedKategori === 'tahfiz') return materiTahfiz;
    if (selectedKategori === 'diniyah') return materiDiniyah;
    if (selectedKategori === 'keseharian') return materiKeseharian;
    return materiTasmi;
  });

  // 6. Metode Pengisian (Section 5)
  const metodeList = [
    {
      id: 'tabel',
      nama: 'Tabel Massal Kelas',
      sub: 'Input Cepat Se-Kelas',
      badge: 'Semua Santri 1 Layar',
      desc: 'Format spreadsheet langsung dengan auto-save realtime',
      icon: 'grid'
    },
    {
      id: 'satuan',
      nama: 'Formulir Per Santri',
      sub: 'Penilaian Detail Individual',
      badge: 'Skor Per Surah / Aspek',
      desc: 'Form penilaian mendalam dengan catatan evaluasi ustaz',
      icon: 'edit'
    },
    {
      id: 'excel',
      nama: 'Template Excel (XLSX)',
      sub: 'Unggah Berkas Offline',
      badge: 'Kompatibel MS Excel',
      desc: 'Download template resmi, isi di laptop, dan upload kembali',
      icon: 'fileText'
    },
    {
      id: 'rapor',
      nama: 'Rekapitulasi & Rapor',
      sub: 'Pratinjau Hasil Cetak',
      badge: 'Format PDF Resmi',
      desc: 'Lihat rangkuman nilai akhir santri sebelum disahkan',
      icon: 'printer'
    }
  ];

  // Helper info label terpilih
  let activeSekolahObj = $derived(sekolahOptions.find(s => s.id === selectedSekolahId) || sekolahOptions[0]);
  let activeKelasObj = $derived(currentKelasList.find(k => k.id === selectedKelasId) || currentKelasList[0]);
  let activeKategoriObj = $derived(kategoriList.find(k => k.id === selectedKategori) || kategoriList[0]);
  let activeMateriObj = $derived(currentMateriList.find(m => m.id === selectedMateriId) || currentMateriList[0]);
  let activeMetodeObj = $derived(metodeList.find(m => m.id === selectedMetode) || metodeList[0]);

  // Eksekusi Buka Lembar Penilaian
  function bukaLembarPenilaian() {
    const kId = activeKelasObj ? activeKelasObj.id : 1;
    const kNama = activeKelasObj ? encodeURIComponent(activeKelasObj.nama) : 'Kelas 7A';
    const rombel = activeKelasObj ? activeKelasObj.rombel : 'A';
    const sId = selectedSekolahId;
    const taId = guruState.activeTahunId || 1;
    const semId = guruState.activeSemesterId || 1;

    // Rute TAHFIZ
    if (selectedKategori === 'tahfiz') {
      if (selectedMetode === 'rapor') {
        goto('/guru/rapor/ujian-tahfiz');
      } else if (selectedMetode === 'satuan') {
        goto(`/guru/input-nilai-v2/1`);
      } else {
        goto(`/guru/input-nilai/tahfiz-v2/kelas/${kId}?kelas=${kNama}&rombel=${rombel}&sekolah_id=${sId}&jenis_penilaian=semester&tahun_ajaran_id=${taId}&semester_id=${semId}`);
      }
      return;
    }

    // Rute DINIYAH
    if (selectedKategori === 'diniyah') {
      if (selectedMetode === 'rapor') {
        goto('/guru/rapor/diniyah');
      } else {
        goto(`/guru/input-nilai/diniyah/kelas/${kId}?kelas=${kNama}&rombel=${rombel}&sekolah_id=${sId}&tahun_ajaran_id=${taId}&semester_id=${semId}&mapel_id=${selectedMateriId}`);
      }
      return;
    }

    // Rute KESEHARIAN
    if (selectedKategori === 'keseharian') {
      if (selectedMetode === 'rapor') {
        goto('/guru/rapor/keseharian');
      } else if (selectedMetode === 'satuan') {
        goto(`/guru/input-nilai/keseharian/kelas/${kId}/pelanggaran/1`);
      } else {
        goto(`/guru/input-nilai/keseharian/kelas/${kId}?sekolah_id=${sId}`);
      }
      return;
    }

    // Rute TASMI
    if (selectedKategori === 'tasmi') {
      if (selectedMetode === 'rapor') {
        goto('/guru/rapor/tasmi-v2');
      } else if (selectedMetode === 'satuan') {
        goto(`/guru/input-nilai-tasmi-v2/1`);
      } else {
        goto(`/guru/input-nilai/tasmi-v2/kelas/${kId}?kelas=${kNama}&rombel=${rombel}&sekolah_id=${sId}&tahun_ajaran_id=${taId}&semester_id=${semId}`);
      }
      return;
    }
  }
</script>

<svelte:head>
  <title>Pusat Penilaian Santri - SIAKAD Nawawi</title>
</svelte:head>

<div class="config-container">
  
  <!-- PAGE HEADER -->
  <div class="config-header">
    <div class="header-tag">
      <span class="tag-dot"></span>
      <span>Sistem Penilaian Terpadu • Mode Desktop PC</span>
    </div>
    <h1 class="page-title">Pusat Penilaian Santri</h1>
    <p class="page-desc">
      Pilih konfigurasi kurikulum, jenjang sekolah, kelas rombel, dan materi penilaian di bawah ini. Lembar kerja nilai akan langsung terbuka sesuai pilihan Anda.
    </p>
  </div>

  <!-- SECTION 1: KATEGORI PENILAIAN (Type*) -->
  <div class="section-row">
    <div class="section-label-col">
      <span class="section-title">Kategori Penilaian<span class="required">*</span></span>
      <span class="section-hint">Pilih bidang kurikulum yang ingin Anda nilai</span>
    </div>
    <div class="section-cards-col">
      <div class="grid-4">
        {#each kategoriList as item}
          <button
            type="button"
            class="config-card {selectedKategori === item.id ? 'selected' : ''}"
            onclick={() => { selectedKategori = item.id; selectedMateriId = currentMateriList[0].id; }}
          >
            <div class="card-icon-wrapper">
              <Icon name={item.icon} size={28} />
            </div>
            <span class="card-title">{item.title}</span>
            <div class="card-dropdown-badge">
              <span>{item.desc}</span>
              <Icon name="chevronDown" size={12} />
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="section-divider"></div>

  <!-- SECTION 2: UNIT SEKOLAH / JENJANG (Location*) -->
  <div class="section-row">
    <div class="section-label-col">
      <span class="section-title">Unit Sekolah<span class="required">*</span></span>
      <span class="section-hint">Pilih jenjang pendidikan aktif santri</span>
    </div>
    <div class="section-cards-col">
      <div class="grid-2">
        {#each sekolahOptions as item}
          <button
            type="button"
            class="config-card {selectedSekolahId === item.id ? 'selected' : ''}"
            onclick={() => selectSekolah(item.id)}
          >
            <div class="card-icon-wrapper">
              <Icon name={item.icon} size={28} />
            </div>
            <span class="card-title">{item.nama}</span>
            <div class="card-dropdown-badge">
              <span>{item.tingkat} • {item.npsn}</span>
              <Icon name="chevronDown" size={12} />
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="section-divider"></div>

  <!-- SECTION 3: KELAS & ROMBEL (OS* Multi-Column Grid) -->
  <div class="section-row">
    <div class="section-label-col">
      <span class="section-title">Kelas & Rombel<span class="required">*</span></span>
      <span class="section-hint">Tersedia {currentKelasList.length} rombel di {activeSekolahObj.nama}</span>
    </div>
    <div class="section-cards-col">
      <div class="grid-6">
        {#each currentKelasList as item}
          <button
            type="button"
            class="config-card compact {selectedKelasId === item.id ? 'selected' : ''}"
            onclick={() => selectedKelasId = item.id}
          >
            <div class="card-icon-wrapper mini">
              <Icon name="users" size={20} />
            </div>
            <span class="card-title">{item.nama}</span>
            <div class="card-dropdown-badge">
              <span>Rombel {item.rombel} ({item.total} Santri)</span>
              <Icon name="chevronDown" size={11} />
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="section-divider"></div>

  <!-- SECTION 4: MATERI / MAPEL / HALAQAH (App Catalog / Server Class*) -->
  <div class="section-row">
    <div class="section-label-col">
      <span class="section-title">Materi & Mapel<span class="required">*</span></span>
      <span class="section-hint">Target capaian untuk {activeKategoriObj.title}</span>
    </div>
    <div class="section-cards-col">
      <div class="grid-5">
        {#each currentMateriList as item}
          <button
            type="button"
            class="config-card {selectedMateriId === item.id ? 'selected' : ''}"
            onclick={() => selectedMateriId = item.id}
          >
            <div class="card-icon-wrapper">
              <Icon name={item.icon} size={24} />
            </div>
            <span class="card-title">{item.nama}</span>
            <div class="card-dropdown-badge">
              <span>{item.badge}</span>
              <Icon name="chevronDown" size={11} />
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <div class="section-divider"></div>

  <!-- SECTION 5: METODE PENGISIAN (Size*) -->
  <div class="section-row">
    <div class="section-label-col">
      <span class="section-title">Metode Input<span class="required">*</span></span>
      <span class="section-hint">Format lembar kerja penilaian yang diinginkan</span>
    </div>
    <div class="section-cards-col">
      <div class="grid-4">
        {#each metodeList as item}
          <button
            type="button"
            class="config-card method-card {selectedMetode === item.id ? 'selected' : ''}"
            onclick={() => selectedMetode = item.id}
          >
            <div class="card-icon-wrapper">
              <Icon name={item.icon} size={26} />
            </div>
            <span class="card-title">{item.nama}</span>
            <p class="method-desc">{item.desc}</p>
            <div class="card-dropdown-badge">
              <span>{item.badge}</span>
              <Icon name="chevronDown" size={11} />
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- SECTION 6: STICKY BOTTOM ACTION BAR (IDCloudHost Order / Summary Bar) -->
  <div class="action-footer-bar">
    <div class="footer-summary-wrapper">
      <div class="summary-badge">KONFIGURASI TERPILIH</div>
      <div class="summary-tags">
        <span class="sum-pill primary">{activeKategoriObj.title}</span>
        <span class="sum-sep">•</span>
        <span class="sum-pill">{activeSekolahObj.nama}</span>
        <span class="sum-sep">•</span>
        <span class="sum-pill highlight">{activeKelasObj.nama}</span>
        <span class="sum-sep">•</span>
        <span class="sum-pill">{activeMateriObj.nama}</span>
        <span class="sum-sep">•</span>
        <span class="sum-pill">{activeMetodeObj.nama}</span>
      </div>
    </div>

    <div class="footer-action-wrapper">
      <button type="button" class="btn-launch-nilai" onclick={bukaLembarPenilaian}>
        <Icon name="edit" size={18} />
        <span>Buka Lembar Penilaian Sekarang</span>
        <span class="arrow-icon">→</span>
      </button>
    </div>
  </div>

</div>

<style>
  /* --- IDCloudHost Inspired Layout & Spacing --- */
  .config-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 2rem 2rem 6rem;
    font-family: inherit;
    color: var(--color-text-main, #1e293b);
  }

  /* --- Page Header --- */
  .config-header {
    margin-bottom: 2.5rem;
  }

  .header-tag {
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

  .tag-dot {
    width: 8px;
    height: 8px;
    border-radius: 9999px;
    background: #10b981;
  }

  .page-title {
    font-size: 1.85rem;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
    margin: 0 0 0.5rem;
  }

  .page-desc {
    font-size: 0.95rem;
    color: #64748b;
    margin: 0;
    max-width: 800px;
    line-height: 1.5;
  }

  /* --- Section Rows (IDCloudHost Two-Column Flow) --- */
  .section-row {
    display: flex;
    gap: 2.5rem;
    margin-bottom: 2rem;
    align-items: flex-start;
  }

  .section-label-col {
    width: 210px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    padding-top: 4px;
  }

  .section-title {
    font-size: 0.95rem;
    font-weight: 700;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .required {
    color: #ef4444;
    font-weight: 800;
  }

  .section-hint {
    font-size: 0.8rem;
    color: #64748b;
    margin-top: 4px;
    line-height: 1.4;
  }

  .section-cards-col {
    flex-grow: 1;
    min-width: 0;
  }

  .section-divider {
    height: 1px;
    background-color: #e2e8f0;
    margin: 2rem 0;
  }

  /* --- Card Grids --- */
  .grid-2 {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }

  .grid-4 {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .grid-5 {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.85rem;
  }

  .grid-6 {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.85rem;
  }

  /* --- IDCloudHost Card Component --- */
  .config-card {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 1.25rem 1rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    min-height: 110px;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    text-align: center;
    width: 100%;
    box-sizing: border-box;
    position: relative;
    user-select: none;
  }

  .config-card.compact {
    min-height: 95px;
    padding: 1rem 0.75rem;
  }

  .config-card.method-card {
    min-height: 135px;
    align-items: flex-start;
    text-align: left;
    padding: 1.25rem;
  }

  .config-card:hover:not(.selected) {
    border-color: #10b981;
    background: #f0fdf4;
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
  }

  /* ACTIVE / SELECTED CARD STATE (In Emerald Green matching original app colors) */
  .config-card.selected {
    background: #10b981 !important;
    border-color: #059669 !important;
    color: #ffffff !important;
    box-shadow: 0 6px 16px rgba(16, 185, 129, 0.35);
    transform: translateY(-2px);
  }

  .card-icon-wrapper {
    color: #10b981;
    margin-bottom: 0.65rem;
    transition: color 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-icon-wrapper.mini {
    margin-bottom: 0.4rem;
  }

  .config-card.selected .card-icon-wrapper {
    color: #ffffff !important;
  }

  .card-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.3;
    margin-bottom: 0.65rem;
    display: block;
    width: 100%;
  }

  .config-card.selected .card-title {
    color: #ffffff !important;
  }

  .method-desc {
    font-size: 0.78rem;
    color: #64748b;
    margin: 0 0 0.75rem;
    line-height: 1.4;
  }

  .config-card.selected .method-desc {
    color: rgba(255, 255, 255, 0.9) !important;
  }

  /* Dropdown-style Badge at bottom of Card (Like IDCloudHost v10.x / dropdown!) */
  .card-dropdown-badge {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #475569;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: 100%;
    box-sizing: border-box;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .config-card.selected .card-dropdown-badge {
    background: rgba(255, 255, 255, 0.22) !important;
    border-color: rgba(255, 255, 255, 0.35) !important;
    color: #ffffff !important;
  }

  /* --- Sticky Action Bottom Bar (IDCloudHost Order Bar) --- */
  .action-footer-bar {
    position: sticky;
    bottom: 1.5rem;
    left: 0;
    right: 0;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
    padding: 1rem 1.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 40;
    margin-top: 3rem;
  }

  .footer-summary-wrapper {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .summary-badge {
    font-size: 0.7rem;
    font-weight: 800;
    color: #64748b;
    letter-spacing: 0.05em;
  }

  .summary-tags {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 0.85rem;
  }

  .sum-pill {
    font-weight: 600;
    color: #334155;
  }

  .sum-pill.primary {
    color: #059669;
    font-weight: 700;
  }

  .sum-pill.highlight {
    background: #ecfdf5;
    color: #047857;
    padding: 1px 8px;
    border-radius: 4px;
    border: 1px solid #a7f3d0;
    font-weight: 700;
  }

  .sum-sep {
    color: #cbd5e1;
  }

  .footer-action-wrapper {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .btn-launch-nilai {
    background: #10b981;
    color: #ffffff;
    border: 1px solid #059669;
    border-radius: 8px;
    padding: 0.75rem 1.5rem;
    font-size: 0.95rem;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .btn-launch-nilai:hover {
    background: #059669;
    transform: translateY(-2px);
    box-shadow: 0 6px 18px rgba(16, 185, 129, 0.4);
  }

  .arrow-icon {
    font-size: 1.1rem;
    transition: transform 0.2s;
  }

  .btn-launch-nilai:hover .arrow-icon {
    transform: translateX(4px);
  }

  /* Responsive Fallbacks */
  @media (max-width: 1024px) {
    .section-row {
      flex-direction: column;
      gap: 1rem;
    }
    .section-label-col {
      width: 100%;
    }
    .grid-6 {
      grid-template-columns: repeat(3, 1fr);
    }
    .grid-5 {
      grid-template-columns: repeat(3, 1fr);
    }
    .grid-4 {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
