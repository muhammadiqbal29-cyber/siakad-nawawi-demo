<script>
  import { toastStore } from '$lib/toast.svelte.js';
  import { modalStore } from '$lib/modal.svelte.js';
  import { SvelteMap } from 'svelte/reactivity';
  import { guruState } from '$lib/guruState.svelte.js';
  import Icon from '$lib/components/ui/Icon.svelte';
  import '$lib/components/guru/AlquranMobileUI.css';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  // --- Derived State: Sekolah Terpilih ---
  let selectedSekolah = $derived(
    guruState.sekolahList.find((s) => s.id == guruState.activeSekolahId) || null
  );

  // --- Derived State: Fitur ---
  let selectedFeatures = $derived(
    (() => {
      if (!selectedSekolah || !selectedSekolah.fitur) return [];
      try {
        return JSON.parse(selectedSekolah.fitur);
      } catch {
        return [];
      }
    })()
  );
  let hasTahfiz = $derived(
    selectedFeatures.includes('input_tahfiz') || selectedFeatures.includes('input_tahfiz_v2')
  );
  let hasDiniyah = $derived(selectedFeatures.includes('input_diniyah'));
  let hasKeseharian = $derived(selectedFeatures.includes('rapor_keseharian'));

  // --- State: Materi ---
  let materiList = $state([]);
  let loadingMateri = $state(false);
  let errorMateri = $state('');

  // --- State: Form tambah ---
  let showForm = $state(false);
  let formNama = $state('');
  let formJuz = $state('');
  let formUrutan = $state('');
  let formLoading = $state(false);
  let formError = $state('');

  // --- State: Edit inline ---
  let editingId = $state(null);
  let editNama = $state('');
  let editJuz = $state('');
  let editUrutan = $state('');
  let editLoading = $state(false);

  // --- State: Import Tahfiz ---
  let fileInputTahfiz = $state(null);
  let loadingImportTahfiz = $state(false);

  // --- State: Hapus ---
  let deletingId = $state(null);

  // --- State: Filter/Cari Surah ---
  let surahSearch = $state('');
  let surahJuzFilter = $state(0);
  let filteredMateriList = $derived(
    materiList.filter((m) => {
      const matchSearch = !surahSearch || m.nama_materi.toLowerCase().includes(surahSearch.toLowerCase());
      const matchJuz = !surahJuzFilter || m.juz === Number(surahJuzFilter);
      return matchSearch && matchJuz;
    })
  );

  // --- State: Konfigurasi nilai kelulusan ---
  let loadingKonfigurasi = $state(false);
  let konfigurasiPembagi = $state('1');
  let konfigurasiError = $state('');
  let konfigurasiSuccess = $state('');
  let konfigurasiSaving = $state(false);
  let kelasKelulusanOptions = $state([]);
  let selectedTingkatKelulusan = $state([]);
  let kriteriaPenilaian = $state([]);
  let selectedJuzKelulusan = $state([26, 27, 28, 29, 30]);
  let originalJuzKelulusan = $state('');
  let totalSiswaKelulusan = $state(0);
  let showConfirmChangeModal = $state(false);

  let computedPembagi = $derived(
    materiList.filter(m => selectedJuzKelulusan.includes(m.juz) && m.aktif).length || (selectedJuzKelulusan.length > 0 ? selectedJuzKelulusan.length : 1)
  );

  function toggleJuzKelulusan(juzNum) {
    if (selectedJuzKelulusan.includes(juzNum)) {
      selectedJuzKelulusan = selectedJuzKelulusan.filter(j => j !== juzNum);
    } else {
      selectedJuzKelulusan = [...selectedJuzKelulusan, juzNum].sort((a, b) => a - b);
    }
  }

  function applyPresetJuz(preset) {
    if (preset === 'smp') {
      selectedJuzKelulusan = [26, 27, 28, 29, 30];
    } else if (preset === 'sma') {
      selectedJuzKelulusan = [28, 29, 30];
    } else if (preset === 'sd') {
      selectedJuzKelulusan = [29, 30];
    } else if (preset === '10juz') {
      selectedJuzKelulusan = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
    } else if (preset === 'all') {
      selectedJuzKelulusan = Array.from({ length: 30 }, (_, i) => i + 1);
    } else if (preset === 'reset') {
      selectedJuzKelulusan = [];
    }
  }

  // --- State: Tab ---
  let activeTab = $state('tahfiz');
  let activeSubTab = $state('keseharian');
  let tahfizActiveTab = $state('kelulusan'); // 'kelulusan', 'kriteria'

  // --- State: Mapel Diniyah ---
  let diniyahList = $state([]);
  let loadingDiniyah = $state(false);
  let errorDiniyah = $state('');
  let showDiniyahForm = $state(false);
  let diniyahFormNama = $state('');
  let diniyahFormNamaArab = $state('');
  let diniyahFormKategori = $state('tes_tulis');
  let diniyahFormUrutan = $state('');
  let diniyahFormLoading = $state(false);
  let diniyahFormError = $state('');
  let isTranslatingDiniyahForm = $state(false);
  let diniyahEditingId = $state(null);
  let diniyahEditNama = $state('');
  let diniyahEditNamaArab = $state('');
  let diniyahEditKategori = $state('tes_tulis');
  let diniyahEditUrutan = $state('');
  let diniyahEditLoading = $state(false);
  let diniyahDeletingId = $state(null);

  // --- State: Konfigurasi Diniyah ---
  let diniyahActiveTab = $state('mapel'); // 'mapel', 'kriteria'
  let diniyahKriteriaPenilaian = $state([]);
  let diniyahKonfigurasiLoading = $state(false);
  let diniyahKonfigurasiSaving = $state(false);
  let diniyahKonfigurasiError = $state('');
  let diniyahKonfigurasiSuccess = $state('');

  // --- State: Keseharian ---

  let keseharianKriteriaPenilaian = $state([]);
  let keseharianKonfigurasiLoading = $state(false);
  let keseharianKonfigurasiSaving = $state(false);
  let keseharianKonfigurasiError = $state('');
  let keseharianKonfigurasiSuccess = $state('');

  let indikators = $state([]);
  let loadingKeseharian = $state(false);
  let errorKeseharian = $state('');

  // Import Keseharian
  let fileInputKeseharian = $state(null);
  let loadingImportKeseharian = $state(false);

  // Form Tambah Indikator
  let showKeseharianForm = $state(false);
  let keseharianFormNama = $state('');
  let keseharianFormNilaiPengurang = $state(1);
  let keseharianFormLoading = $state(false);
  let keseharianFormError = $state('');

  // Inline Edit Indikator
  let keseharianEditingId = $state(null);
  let keseharianEditNama = $state('');
  let keseharianEditNilaiPengurang = $state(1);
  let keseharianEditLoading = $state(false);
  let keseharianDeletingId = $state(null);

  // --- State: Kop & Logo Rapor ---
  let customLogoUrl = $state('');
  let logoX = $state(600);
  let logoY = $state(20);
  let logoSize = $state(80);
  let dividerThickness = $state(3);

  let isDragging = false;
  let startX = 0,
    startY = 0;
  let initialLogoX = 0,
    initialLogoY = 0;
  let isSavingLogo = $state(false);

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

  $effect(() => {
    if (selectedSekolah) {
      loadMateri();
      loadKelasKelulusanOptions();
      loadKonfigurasiNilaiTahfiz();
      loadDiniyah();
      loadKonfigurasiNilaiDiniyah();
      loadIndikators();
      if (hasKeseharian) {
        loadPelanggaran();
        loadIqob();
        loadKonfigurasiKeseharian();
      }
      loadKopLogoData();
    }
  });

  function loadKopLogoData() {
    if (!selectedSekolah) return;
    customLogoUrl = selectedSekolah.logo_base64 || '';
    logoX = selectedSekolah.logo_x || 600;
    logoY = selectedSekolah.logo_y || 20;
    logoSize = selectedSekolah.logo_size || 80;
    dividerThickness = selectedSekolah.divider_thickness || 3;

    if (selectedSekolah.kop_surat) {
      try {
        const parsed = JSON.parse(selectedSekolah.kop_surat);
        if (Array.isArray(parsed) && parsed.length > 0) {
          kopLines = parsed;
        }
      } catch (e) {}
    }
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        customLogoUrl = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  function onLogoMouseDown(e) {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLogoX = logoX;
    initialLogoY = logoY;
    window.addEventListener('mousemove', onLogoMouseMove);
    window.addEventListener('mouseup', onLogoMouseUp);
  }

  function onLogoMouseMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    logoX = initialLogoX + dx;
    logoY = initialLogoY + dy;
  }

  function onLogoMouseUp() {
    isDragging = false;
    window.removeEventListener('mousemove', onLogoMouseMove);
    window.removeEventListener('mouseup', onLogoMouseUp);
  }

  function addKopLine() {
    kopLines.push({ text: 'Teks Baru', color: '#000000', size: 14, bold: false });
  }

  function removeKopLine(index) {
    kopLines.splice(index, 1);
  }

  async function saveLogoSettings() {
    isSavingLogo = true;
    try {
      const payload = {
        logo_base64: customLogoUrl,
        logo_x: logoX,
        logo_y: logoY,
        logo_size: logoSize,
        kop_surat: JSON.stringify(kopLines),
        divider_thickness: dividerThickness
      };
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/rapor-logo`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Gagal menyimpan pengaturan rapor');
      toastStore.show('Pengaturan Kop dan Logo Rapor berhasil disimpan', 'success');

      // Update local state directly so it persists if we don't refetch sekolah list immediately
      guruState.sekolahList = guruState.sekolahList.map((s) => {
        if (s.id === selectedSekolah.id) {
          return {
            ...s,
            logo_base64: customLogoUrl,
            logo_x: logoX,
            logo_y: logoY,
            logo_size: logoSize,
            kop_surat: payload.kop_surat,
            divider_thickness: dividerThickness
          };
        }
        return s;
      });
    } catch (err) {
      toastStore.show(err.message, 'error');
    } finally {
      isSavingLogo = false;
    }
  }

  async function loadMateri() {
    if (!selectedSekolah) return;
    loadingMateri = true;
    errorMateri = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/materi-tahfiz/all`,
        {
          credentials: 'include'
        }
      );
      if (!res.ok) throw new Error('Gagal memuat materi');
      materiList = await res.json();
    } catch (err) {
      errorMateri = err.message;
    } finally {
      loadingMateri = false;
    }
  }

  async function loadKonfigurasiNilaiTahfiz() {
    if (!selectedSekolah) return;
    loadingKonfigurasi = true;
    konfigurasiError = '';
    konfigurasiSuccess = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/konfigurasi-nilai-tahfiz`,
        {
          credentials: 'include'
        }
      );
      if (!res.ok) throw new Error('Gagal memuat pengaturan nilai kelulusan');
      const payload = await res.json();
      konfigurasiPembagi = String(payload.pembagi || 1);
      selectedTingkatKelulusan = payload.tingkat_level_kelulusan || [];
      kriteriaPenilaian = payload.kriteria_penilaian || [];
      
      if (payload.juz_kelulusan) {
        selectedJuzKelulusan = payload.juz_kelulusan
          .split(',')
          .map(s => parseInt(s.trim()))
          .filter(n => !isNaN(n));
      } else {
        selectedJuzKelulusan = [26, 27, 28, 29, 30];
      }
      originalJuzKelulusan = selectedJuzKelulusan.slice().sort((a, b) => a - b).join(',');
      totalSiswaKelulusan = payload.total_siswa_kelulusan || 0;
    } catch (err) {
      konfigurasiError = err.message;
    } finally {
      loadingKonfigurasi = false;
    }
  }

  async function loadKelasKelulusanOptions() {
    if (!selectedSekolah) return;
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/kelas`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal memuat daftar kelas');
      const kelasData = await res.json();
      const levelMap = new SvelteMap();
      for (const kelas of kelasData || []) {
        const level = Number(kelas.tingkat_level || 0);
        if (level <= 0 || levelMap.has(level)) continue;
        levelMap.set(level, {
          level,
          label: kelas.tingkat ? `Kelas ${kelas.tingkat}` : `Tingkat ${level}`
        });
      }
      kelasKelulusanOptions = Array.from(levelMap.values()).sort((a, b) => a.level - b.level);
    } catch (err) {
      konfigurasiError = err.message;
    }
  }

  async function simpanKonfigurasiNilaiTahfiz(force = false) {
    if (selectedJuzKelulusan.length === 0) {
      konfigurasiError = 'Wajib memilih minimal 1 Juz untuk standar ujian kelulusan.';
      konfigurasiSuccess = '';
      return;
    }
    if (selectedTingkatKelulusan.length === 0) {
      konfigurasiError = 'Pilih minimal satu tingkat kelas untuk ujian kelulusan.';
      konfigurasiSuccess = '';
      return;
    }

    const currentJuzStr = selectedJuzKelulusan.slice().sort((a, b) => a - b).join(',');
    
    // Anti-Human-Error: Peringatan jika mengubah target saat santri sudah dinilai
    if (!force && totalSiswaKelulusan > 0 && originalJuzKelulusan && currentJuzStr !== originalJuzKelulusan) {
      showConfirmChangeModal = true;
      return;
    }
    showConfirmChangeModal = false;

    konfigurasiSaving = true;
    konfigurasiError = '';
    konfigurasiSuccess = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/konfigurasi-nilai-tahfiz`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jenis_penilaian: 'kelulusan',
            pembagi: computedPembagi,
            juz_kelulusan: currentJuzStr,
            tingkat_level_kelulusan: selectedTingkatKelulusan,
            kriteria_penilaian: kriteriaPenilaian
          })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal menyimpan pengaturan nilai kelulusan');
      }
      const payload = await res.json();
      originalJuzKelulusan = currentJuzStr;
      konfigurasiPembagi = String(payload.pembagi || computedPembagi);
      selectedTingkatKelulusan = payload.tingkat_level_kelulusan || selectedTingkatKelulusan;
      kriteriaPenilaian = payload.kriteria_penilaian || kriteriaPenilaian;
      konfigurasiSuccess = 'Pengaturan nilai ujian kelulusan berhasil disimpan.';
    } catch (err) {
      konfigurasiError = err.message;
    } finally {
      konfigurasiSaving = false;
    }
  }

  async function tambahMateri() {
    if (!formNama.trim()) {
      formError = 'Nama materi wajib diisi.';
      return;
    }
    formLoading = true;
    formError = '';
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/materi-tahfiz`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_materi: formNama.trim(),
          juz: formJuz ? Number(formJuz) : 0,
          urutan: formUrutan ? Number(formUrutan) : 0
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal menambahkan materi');
      }
      formNama = '';
      formJuz = '';
      formUrutan = '';
      showForm = false;
      await loadMateri();
    } catch (err) {
      formError = err.message;
    } finally {
      formLoading = false;
    }
  }

  function handleDownloadTemplateTahfiz() {
    if (!selectedSekolah) return;
    window.location.href = `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/materi-tahfiz-template`;
  }

  async function handleImportTahfiz(event) {
    if (!selectedSekolah) return;
    const file = event.target.files[0];
    if (!file) return;

    loadingImportTahfiz = true;
    errorMateri = '';
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/materi-tahfiz-import`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal melakukan import');
      }
      toastStore.show(data.message || 'Import berhasil', 'info');
      await loadMateri();
    } catch (err) {
      errorMateri = err.message;
    } finally {
      loadingImportTahfiz = false;
      if (fileInputTahfiz) {
        fileInputTahfiz.value = '';
      }
    }
  }

  function startEdit(materi) {
    editingId = materi.id;
    editNama = materi.nama_materi;
    editJuz = materi.juz > 0 ? String(materi.juz) : '';
    editUrutan = materi.urutan > 0 ? String(materi.urutan) : '';
  }

  function cancelEdit() {
    editingId = null;
    editNama = '';
    editJuz = '';
    editUrutan = '';
  }

  async function simpanEdit(materi) {
    if (!editNama.trim()) return;
    editLoading = true;
    try {
      const res = await fetch(`${apiUrl}/api/guru/materi-tahfiz/${materi.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_materi: editNama.trim(),
          juz: editJuz ? Number(editJuz) : 0,
          urutan: editUrutan ? Number(editUrutan) : 0
        })
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      editingId = null;
      await loadMateri();
    } catch (err) {
      errorMateri = err.message;
    } finally {
      editLoading = false;
    }
  }

  async function toggleAktif(materi) {
    try {
      const aktifBaru = !materi.aktif;
      const res = await fetch(`${apiUrl}/api/guru/materi-tahfiz/${materi.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_materi: materi.nama_materi, aktif: aktifBaru })
      });
      if (!res.ok) throw new Error('Gagal mengubah status');
      await loadMateri();
    } catch (err) {
      errorMateri = err.message;
    }
  }

  async function hapusMateri(id) {
    if (!(await modalStore.show({ message: 'Yakin ingin menghapus materi ini?' }))) return;
    deletingId = id;
    try {
      const res = await fetch(`${apiUrl}/api/guru/materi-tahfiz/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      await loadMateri();
    } catch (err) {
      errorMateri = err.message;
    } finally {
      deletingId = null;
    }
  }

  function batalForm() {
    showForm = false;
    formNama = '';
    formJuz = '';
    formUrutan = '';
    formError = '';
  }

  function toggleTingkatKelulusan(level) {
    if (selectedTingkatKelulusan.includes(level)) {
      selectedTingkatKelulusan = selectedTingkatKelulusan.filter((item) => item !== level);
    } else {
      selectedTingkatKelulusan = [...selectedTingkatKelulusan, level].sort((a, b) => a - b);
    }
  }

  function tambahKriteria() {
    kriteriaPenilaian = [...kriteriaPenilaian, { min: 0, max: 0, arab: '', indo: '' }];
  }

  function hapusKriteria(index) {
    kriteriaPenilaian = kriteriaPenilaian.filter((_, i) => i !== index);
  }

  // ===== DINIYAH FUNCTIONS =====
  async function loadDiniyah() {
    if (!selectedSekolah) return;
    loadingDiniyah = true;
    errorDiniyah = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/mapel-diniyah/all`,
        {
          credentials: 'include'
        }
      );
      if (!res.ok) throw new Error('Gagal memuat mapel diniyah');
      diniyahList = await res.json();
    } catch (err) {
      errorDiniyah = err.message;
    } finally {
      loadingDiniyah = false;
    }
  }

  async function loadKonfigurasiNilaiDiniyah() {
    if (!selectedSekolah) return;
    diniyahKonfigurasiLoading = true;
    diniyahKonfigurasiError = '';
    diniyahKonfigurasiSuccess = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/konfigurasi-nilai-diniyah`,
        {
          credentials: 'include'
        }
      );
      if (!res.ok) throw new Error('Gagal memuat pengaturan kriteria penilaian diniyah');
      const payload = await res.json();
      diniyahKriteriaPenilaian = payload.kriteria_penilaian || [];
    } catch (err) {
      diniyahKonfigurasiError = err.message;
    } finally {
      diniyahKonfigurasiLoading = false;
    }
  }

  async function simpanKonfigurasiNilaiDiniyah() {
    diniyahKonfigurasiSaving = true;
    diniyahKonfigurasiError = '';
    diniyahKonfigurasiSuccess = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/konfigurasi-nilai-diniyah`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kriteria_penilaian: diniyahKriteriaPenilaian
          })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal menyimpan pengaturan nilai diniyah');
      }
      const payload = await res.json();
      diniyahKriteriaPenilaian = payload.kriteria_penilaian || diniyahKriteriaPenilaian;
      diniyahKonfigurasiSuccess = 'Pengaturan kriteria penilaian diniyah berhasil disimpan.';
    } catch (err) {
      diniyahKonfigurasiError = err.message;
    } finally {
      diniyahKonfigurasiSaving = false;
    }
  }

  function tambahKriteriaDiniyah() {
    diniyahKriteriaPenilaian = [
      ...diniyahKriteriaPenilaian,
      { min: 0, max: 0, arab: '', indo: '' }
    ];
  }

  function hapusKriteriaDiniyah(index) {
    diniyahKriteriaPenilaian = diniyahKriteriaPenilaian.filter((_, i) => i !== index);
  }

  async function translateDiniyahForm() {
    if (!diniyahFormNama.trim()) return;
    isTranslatingDiniyahForm = true;
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=id&tl=ar&dt=t&q=${encodeURIComponent(diniyahFormNama)}`
      );
      const data = await res.json();
      if (data && data[0] && data[0][0] && data[0][0][0]) {
        diniyahFormNamaArab = data[0][0][0];
      } else {
        toastStore.show('Gagal menerjemahkan teks.', 'error');
      }
    } catch (err) {
      console.error('Translation error:', err);
      toastStore.show('Terjadi kesalahan jaringan saat menerjemahkan.', 'error');
    } finally {
      isTranslatingDiniyahForm = false;
    }
  }

  async function tambahDiniyah() {
    if (!diniyahFormNama.trim()) {
      diniyahFormError = 'Nama mapel wajib diisi.';
      return;
    }
    diniyahFormLoading = true;
    diniyahFormError = '';
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/mapel-diniyah`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_mapel: diniyahFormNama.trim(),
          nama_mapel_arab: diniyahFormNamaArab.trim(),
          kategori: diniyahFormKategori,
          urutan: diniyahFormUrutan ? Number(diniyahFormUrutan) : 0
        })
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.message || 'Gagal menambahkan mapel');
      }
      diniyahFormNama = '';
      diniyahFormNamaArab = '';
      diniyahFormKategori = 'tes_tulis';
      diniyahFormUrutan = '';
      showDiniyahForm = false;
      await loadDiniyah();
    } catch (err) {
      diniyahFormError = err.message;
    } finally {
      diniyahFormLoading = false;
    }
  }

  function startDiniyahEdit(m) {
    diniyahEditingId = m.id;
    diniyahEditNama = m.nama_mapel;
    diniyahEditNamaArab = m.nama_mapel_arab || '';
    diniyahEditKategori = m.kategori || 'tes_tulis';
    diniyahEditUrutan = m.urutan > 0 ? String(m.urutan) : '';
  }

  function cancelDiniyahEdit() {
    diniyahEditingId = null;
  }

  async function simpanDiniyahEdit(m) {
    if (!diniyahEditNama.trim()) return;
    diniyahEditLoading = true;
    try {
      const res = await fetch(`${apiUrl}/api/guru/mapel-diniyah/${m.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_mapel: diniyahEditNama.trim(),
          nama_mapel_arab: diniyahEditNamaArab.trim(),
          kategori: diniyahEditKategori,
          urutan: diniyahEditUrutan ? Number(diniyahEditUrutan) : 0
        })
      });
      if (!res.ok) throw new Error('Gagal menyimpan');
      diniyahEditingId = null;
      await loadDiniyah();
    } catch (err) {
      errorDiniyah = err.message;
    } finally {
      diniyahEditLoading = false;
    }
  }

  async function toggleDiniyahAktif(m) {
    try {
      const res = await fetch(`${apiUrl}/api/guru/mapel-diniyah/${m.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_mapel: m.nama_mapel, aktif: !m.aktif })
      });
      if (!res.ok) throw new Error('Gagal mengubah status');
      await loadDiniyah();
    } catch (err) {
      errorDiniyah = err.message;
    }
  }

  async function hapusDiniyah(id) {
    if (!(await modalStore.show({ message: 'Yakin ingin menghapus mapel ini?' }))) return;
    diniyahDeletingId = id;
    try {
      const res = await fetch(`${apiUrl}/api/guru/mapel-diniyah/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      await loadDiniyah();
    } catch (err) {
      errorDiniyah = err.message;
    } finally {
      diniyahDeletingId = null;
    }
  }

  function batalDiniyahForm() {
    showDiniyahForm = false;
    diniyahFormNama = '';
    diniyahFormNamaArab = '';
    diniyahFormKategori = 'tes_tulis';
    diniyahFormUrutan = '';
    diniyahFormError = '';
  }

  // ==== INDIKATOR KESEHARIAN ACTIONS ====
  async function loadIndikators() {
    if (!selectedSekolah) return;
    loadingKeseharian = true;
    errorKeseharian = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/keseharian/indikator`,
        {
          credentials: 'include'
        }
      );
      if (!res.ok) throw new Error('Gagal memuat indikator keseharian.');

      const body = await res.json();
      indikators = body.data || [];
    } catch (err) {
      errorKeseharian = err.message;
    } finally {
      loadingKeseharian = false;
    }
  }

  function handleDownloadTemplateKeseharian() {
    if (!selectedSekolah) return;
    window.location.href = `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/keseharian/indikator/template`;
  }

  async function handleImportKeseharian(event) {
    if (!selectedSekolah) return;
    const file = event.target.files[0];
    if (!file) return;

    loadingImportKeseharian = true;
    errorKeseharian = '';
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/keseharian/indikator/import`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal melakukan import indikator');
      }
      toastStore.show(data.message || 'Import indikator keseharian berhasil', 'info');
      await loadIndikators();
    } catch (err) {
      errorKeseharian = err.message;
      toastStore.show(errorKeseharian, 'info');
    } finally {
      loadingImportKeseharian = false;
      if (fileInputKeseharian) {
        fileInputKeseharian.value = '';
      }
    }
  }

  function startKeseharianEdit(ind) {
    keseharianEditingId = ind.id;
    keseharianEditNama = ind.nama;
    keseharianEditNilaiPengurang = ind.nilai_pengurang || 1;
  }

  function cancelKeseharianEdit() {
    keseharianEditingId = null;
    keseharianEditNama = '';
    keseharianEditNilaiPengurang = 1;
  }

  async function simpanKeseharianEdit(ind) {
    if (!keseharianEditNama.trim()) return;
    keseharianEditLoading = true;
    try {
      const res = await fetch(`${apiUrl}/api/guru/keseharian/indikator/${ind.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: keseharianEditNama,
          nilai_pengurang: keseharianEditNilaiPengurang,
          aktif: ind.aktif
        })
      });
      if (!res.ok) throw new Error('Gagal menyimpan perubahan');
      await loadIndikators();
      cancelKeseharianEdit();
    } catch (err) {
      toastStore.show(err.message, 'info');
    } finally {
      keseharianEditLoading = false;
    }
  }

  async function toggleKeseharianAktif(ind) {
    try {
      const res = await fetch(`${apiUrl}/api/guru/keseharian/indikator/${ind.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: ind.nama, nilai_pengurang: ind.nilai_pengurang, aktif: !ind.aktif })
      });
      if (!res.ok) throw new Error('Gagal mengubah status');
      await loadIndikators();
    } catch (err) {
      toastStore.show(err.message, 'info');
    }
  }

  async function hapusKeseharian(id) {
    if (!(await modalStore.show({ message: 'Hapus indikator ini?' }))) return;
    keseharianDeletingId = id;
    try {
      const res = await fetch(`${apiUrl}/api/guru/keseharian/indikator/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      await loadIndikators();
    } catch (err) {
      toastStore.show(err.message, 'info');
    } finally {
      keseharianDeletingId = null;
    }
  }

  function batalKeseharianForm() {
    showKeseharianForm = false;
    keseharianFormNama = '';
    keseharianFormNilaiPengurang = 1;
    keseharianFormError = '';
  }

  async function tambahKeseharian() {
    if (!keseharianFormNama.trim()) {
      keseharianFormError = 'Nama indikator harus diisi';
      return;
    }
    keseharianFormLoading = true;
    keseharianFormError = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/keseharian/indikator`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama: keseharianFormNama,
            nilai_pengurang: keseharianFormNilaiPengurang,
            aktif: true
          })
        }
      );
      if (!res.ok) throw new Error('Gagal menyimpan indikator');
      await loadIndikators();
      batalKeseharianForm();
    } catch (err) {
      keseharianFormError = err.message;
    } finally {
      keseharianFormLoading = false;
    }
  }

  // ==== KESEHARIAN KONFIGURASI KRITERIA ====
  async function loadKonfigurasiKeseharian() {
    if (!selectedSekolah) return;
    keseharianKonfigurasiLoading = true;
    keseharianKonfigurasiError = '';
    keseharianKonfigurasiSuccess = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/konfigurasi-nilai-keseharian`,
        {
          credentials: 'include'
        }
      );
      if (!res.ok) throw new Error('Gagal memuat pengaturan kriteria penilaian keseharian');
      const payload = await res.json();
      keseharianKriteriaPenilaian = payload.kriteria_penilaian || [];
    } catch (err) {
      keseharianKonfigurasiError = err.message;
    } finally {
      keseharianKonfigurasiLoading = false;
    }
  }

  async function simpanKeseharianKonfigurasi() {
    keseharianKonfigurasiSaving = true;
    keseharianKonfigurasiError = '';
    keseharianKonfigurasiSuccess = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/konfigurasi-nilai-keseharian`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kriteria_penilaian: keseharianKriteriaPenilaian
          })
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Gagal menyimpan pengaturan nilai keseharian');
      }
      const payload = await res.json();
      keseharianKriteriaPenilaian = payload.kriteria_penilaian || keseharianKriteriaPenilaian;
      keseharianKonfigurasiSuccess = 'Pengaturan kriteria penilaian keseharian berhasil disimpan.';
    } catch (err) {
      keseharianKonfigurasiError = err.message;
    } finally {
      keseharianKonfigurasiSaving = false;
    }
  }

  function tambahKeseharianKriteria() {
    keseharianKriteriaPenilaian = [
      ...keseharianKriteriaPenilaian,
      { min: 0, max: 0, arab: '', indo: '' }
    ];
  }

  function hapusKeseharianKriteria(index) {
    keseharianKriteriaPenilaian = keseharianKriteriaPenilaian.filter((_, i) => i !== index);
  }

  // ==== PELANGGARAN CRUD ====
  let pelanggaranList = $state([]);
  let loadingPelanggaran = $state(false);
  let errorPelanggaran = $state('');
  let showPelanggaranForm = $state(false);

  let iqobList = $state([]);
  let iqobFormNama = $state('');
  let iqobFormPoin = $state(0);
  let iqobFormKeterangan = $state('');
  let iqobFormLoading = $state(false);
  let iqobFormError = $state('');
  let iqobEditingId = $state(null);
  let iqobEditNama = $state('');
  let iqobEditPoin = $state(0);
  let iqobEditKeterangan = $state('');
  let iqobEditLoading = $state(false);
  let iqobDeletingId = $state(null);
  let loadingIqob = $state(false);
  let errorIqob = $state('');
  let showIqobForm = $state(false);
  let pelanggaranFormNama = $state('');
  let pelanggaranFormPoin = $state(0);
  let pelanggaranFormLoading = $state(false);
  let pelanggaranFormError = $state('');
  let pelanggaranEditingId = $state(null);
  let pelanggaranEditNama = $state('');
  let pelanggaranEditPoin = $state(0);
  let pelanggaranEditLoading = $state(false);
  let pelanggaranDeletingId = $state(null);

  // Import Pelanggaran
  let fileInputPelanggaran = $state(null);
  let loadingImportPelanggaran = $state(false);

  // Import Iqob
  let fileInputIqob = $state(null);
  let loadingImportIqob = $state(false);
  async function loadPelanggaran() {
    if (!selectedSekolah) return;
    loadingPelanggaran = true;
    errorPelanggaran = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/pelanggaran/jenis`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Gagal memuat jenis pelanggaran.');
      const body = await res.json();
      pelanggaranList = body.data || [];
    } catch (err) {
      errorPelanggaran = err.message;
    } finally {
      loadingPelanggaran = false;
    }
  }

  async function tambahPelanggaran() {
    if (!pelanggaranFormNama.trim()) {
      pelanggaranFormError = 'Nama pelanggaran harus diisi';
      return;
    }
    pelanggaranFormLoading = true;
    pelanggaranFormError = '';
    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/pelanggaran/jenis`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama: pelanggaranFormNama.trim(),
            poin: Number(pelanggaranFormPoin) || 0,
            aktif: true
          })
        }
      );
      if (!res.ok) throw new Error('Gagal menyimpan jenis pelanggaran');
      await loadPelanggaran();
      pelanggaranFormNama = '';
      pelanggaranFormPoin = 0;
      showPelanggaranForm = false;
    } catch (err) {
      pelanggaranFormError = err.message;
    } finally {
      pelanggaranFormLoading = false;
    }
  }

  function handleDownloadTemplatePelanggaran() {
    if (!selectedSekolah) return;
    window.location.href = `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/pelanggaran/jenis/template`;
  }

  async function handleImportPelanggaran(event) {
    if (!selectedSekolah) return;
    const file = event.target.files[0];
    if (!file) return;

    loadingImportPelanggaran = true;
    errorPelanggaran = '';
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/pelanggaran/jenis/import`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal melakukan import');
      }
      toastStore.show(data.message || 'Import berhasil', 'info');
      await loadPelanggaran();
    } catch (err) {
      errorPelanggaran = err.message;
    } finally {
      loadingImportPelanggaran = false;
      if (fileInputPelanggaran) {
        fileInputPelanggaran.value = '';
      }
    }
  }

  function startPelanggaranEdit(p) {
    pelanggaranEditingId = p.id;
    pelanggaranEditNama = p.nama;
    pelanggaranEditPoin = p.poin || 0;
  }
  function cancelPelanggaranEdit() {
    pelanggaranEditingId = null;
  }

  async function simpanPelanggaranEdit(p) {
    if (!pelanggaranEditNama.trim()) return;
    pelanggaranEditLoading = true;
    try {
      const res = await fetch(`${apiUrl}/api/guru/pelanggaran/jenis/${p.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: pelanggaranEditNama.trim(),
          poin: Number(pelanggaranEditPoin) || 0,
          aktif: p.aktif
        })
      });
      if (!res.ok) throw new Error('Gagal menyimpan perubahan');
      await loadPelanggaran();
      cancelPelanggaranEdit();
    } catch (err) {
      toastStore.show(err.message, 'info');
    } finally {
      pelanggaranEditLoading = false;
    }
  }

  async function togglePelanggaranAktif(p) {
    try {
      const res = await fetch(`${apiUrl}/api/guru/pelanggaran/jenis/${p.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: p.nama, poin: p.poin, aktif: !p.aktif })
      });
      if (!res.ok) throw new Error('Gagal mengubah status');
      await loadPelanggaran();
    } catch (err) {
      toastStore.show(err.message, 'info');
    }
  }

  async function loadIqob() {
    if (!selectedSekolah) return;
    loadingIqob = true;
    errorIqob = '';
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/iqob/jenis`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal memuat jenis iqob.');
      const body = await res.json();
      iqobList = body.data || [];
    } catch (err) {
      errorIqob = err.message;
    } finally {
      loadingIqob = false;
    }
  }

  async function tambahIqob() {
    if (!iqobFormNama.trim()) {
      iqobFormError = 'Nama iqob harus diisi';
      return;
    }
    iqobFormLoading = true;
    iqobFormError = '';
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/iqob/jenis`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: iqobFormNama.trim(),
          poin: Number(iqobFormPoin) || 0,
          keterangan: iqobFormKeterangan.trim(),
          aktif: true
        })
      });
      if (!res.ok) throw new Error('Gagal menyimpan jenis iqob');
      await loadIqob();
      await loadKonfigurasiKeseharian();


      iqobFormNama = '';
      iqobFormPoin = 0;
      iqobFormKeterangan = '';
      showIqobForm = false;
      toastStore.show('Jenis Iqob berhasil ditambahkan', 'success');
    } catch (err) {
      iqobFormError = err.message;
    } finally {
      iqobFormLoading = false;
    }
  }

  function handleDownloadTemplateIqob() {
    if (!selectedSekolah) return;
    window.location.href = `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/iqob/jenis/template`;
  }

  async function handleImportIqob(event) {
    if (!selectedSekolah) return;
    const file = event.target.files[0];
    if (!file) return;

    loadingImportIqob = true;
    errorIqob = '';
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(
        `${apiUrl}/api/guru/sekolah/${selectedSekolah.id}/iqob/jenis/import`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal melakukan import');
      }
      toastStore.show(data.message || 'Import berhasil', 'info');
      await loadIqob();
    } catch (err) {
      errorIqob = err.message;
    } finally {
      loadingImportIqob = false;
      if (fileInputIqob) {
        fileInputIqob.value = '';
      }
    }
  }

  function startIqobEdit(p) {
    iqobEditingId = p.id;
    iqobEditNama = p.nama;
    iqobEditPoin = p.poin;
    iqobEditKeterangan = p.keterangan || '';
  }

  function cancelIqobEdit() {
    iqobEditingId = null;
    iqobEditLoading = false;
  }

  async function simpanIqobEdit(p) {
    iqobEditLoading = true;
    try {
      const res = await fetch(`${apiUrl}/api/guru/iqob/jenis/${p.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: iqobEditNama.trim(),
          poin: Number(iqobEditPoin) || 0,
          keterangan: iqobEditKeterangan.trim(),
          aktif: p.aktif
        })
      });
      if (!res.ok) throw new Error('Gagal mengupdate iqob');
      await loadIqob();
      cancelIqobEdit();
      toastStore.show('Jenis Iqob berhasil diupdate', 'success');
    } catch (err) {
      toastStore.show(err.message, 'error');
    } finally {
      iqobEditLoading = false;
    }
  }

  async function toggleIqobAktif(p) {
    try {
      const res = await fetch(`${apiUrl}/api/guru/iqob/jenis/${p.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: p.nama,
          poin: p.poin,
          keterangan: p.keterangan,
          aktif: !p.aktif
        })
      });
      if (!res.ok) throw new Error('Gagal mengubah status');
      await loadIqob();
      toastStore.show('Status iqob berhasil diubah', 'info');
    } catch (err) {
      toastStore.show(err.message, 'error');
    }
  }

  async function hapusIqob(id) {
    if (!(await modalStore.show({ message: 'Yakin ingin menghapus iqob ini?' }))) return;
    iqobDeletingId = id;
    try {
      const res = await fetch(`${apiUrl}/api/guru/iqob/jenis/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal menghapus iqob');
      await loadIqob();
      toastStore.show('Iqob berhasil dihapus', 'info');
    } catch (err) {
      toastStore.show(err.message, 'error');
    } finally {
      iqobDeletingId = null;
    }
  }

  async function hapusPelanggaran(id) {
    if (!(await modalStore.show({ message: 'Hapus jenis pelanggaran ini?' }))) return;
    pelanggaranDeletingId = id;
    try {
      const res = await fetch(`${apiUrl}/api/guru/pelanggaran/jenis/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      await loadPelanggaran();
    } catch (err) {
      toastStore.show(err.message, 'info');
    } finally {
      pelanggaranDeletingId = null;
    }
  }
</script>

<svelte:head>
  <title>Konfigurasi Materi - SIAKAD</title>
</svelte:head>

<div class="page-container desktop-only">
  <!-- Pilih Sekolah via Layout -->
  {#if !selectedSekolah}
    <div class="empty-state">
      <Icon name="grid" size={48} />
      <h3>Pilih Jenjang Sekolah</h3>
      <p>Silakan klik tombol Pilih Jenjang terlebih dahulu.</p>
    </div>
  {:else}
    <!-- Tabs -->
    <div class="tabs-header">
      {#if hasTahfiz}
        <button
          class="tab-link"
          class:active={activeTab === 'tahfiz'}
          onclick={() => (activeTab = 'tahfiz')}
        >
          <div class="icon-wrapper"><Icon name="bookOpen" size={18} /></div>
          <span>Kelulusan Tahfiz</span>
        </button>
      {/if}
      {#if hasDiniyah}
        <button
          class="tab-link"
          class:active={activeTab === 'diniyah'}
          onclick={() => (activeTab = 'diniyah')}
        >
          <div class="icon-wrapper"><Icon name="book" size={18} /></div>
          <span>Mapel Diniyah</span>
        </button>
      {/if}
      {#if hasKeseharian}
        <button
          class="tab-link"
          class:active={activeTab === 'keseharian'}
          onclick={() => (activeTab = 'keseharian')}
        >
          <div class="icon-wrapper"><Icon name="smile" size={18} /></div>
          <span>Keseharian</span>
        </button>
      {/if}
      {#if hasTahfiz || hasDiniyah || hasKeseharian}
        <button
          class="tab-link"
          class:active={activeTab === 'kop_logo'}
          onclick={() => (activeTab = 'kop_logo')}
        >
          <div class="icon-wrapper"><Icon name="image" size={18} /></div>
          <span>Kop & Logo Rapor</span>
        </button>
      {/if}
    </div>

    <div class="page-header">
      <div>
        <h1 class="page-title">Konfigurasi Materi</h1>
      </div>
    </div>

    {#if !hasTahfiz && !hasDiniyah && !hasKeseharian}
      <div class="empty-state">
        <Icon name="slash" size={48} />
        <h3>Tidak Ada Program Khusus</h3>
        <p>
          Sekolah ini tidak memiliki pengaturan program Tahfiz, Diniyah, ataupun Keseharian. Silakan
          aktifkan melalui Pengaturan Institusi jika diperlukan.
        </p>
      </div>
    {:else}
      {#if activeTab === 'tahfiz' && hasTahfiz}
        <!-- ======= TAB TAHFIZ (konten lama) ======= -->

        <!-- Sub-tabs for Tahfiz -->
        <div class="card-tabs">
          <button
            class="card-tab-btn"
            class:active={tahfizActiveTab === 'kelulusan'}
            onclick={() => (tahfizActiveTab = 'kelulusan')}
          >
            Target Juz Kelulusan
          </button>
          <button
            class="card-tab-btn"
            class:active={tahfizActiveTab === 'kriteria'}
            onclick={() => (tahfizActiveTab = 'kriteria')}
          >
            Kriteria Penilaian Rapor
          </button>
          <button
            class="card-tab-btn"
            class:active={tahfizActiveTab === 'materi'}
            onclick={() => (tahfizActiveTab = 'materi')}
          >
            Daftar Surah (30 Juz)
          </button>
        </div>

        {#if tahfizActiveTab === 'kelulusan'}
          <section class="kelulusan-settings">
            <!-- Header -->
            <div class="settings-header">
              <div>
                <h2 class="settings-title">Target Juz Ujian Kelulusan</h2>
                <p class="settings-subtitle">
                  Tentukan Juz Al-Qur'an yang wajib diujikan saat kelulusan santri jenjang {selectedSekolah?.nama || ''}. Sistem otomatis menghitung total surah aktif dan pembagi nilai akhir kelulusan.
                </p>
              </div>
              <button
                class="btn-primary"
                onclick={() => simpanKonfigurasiNilaiTahfiz()}
                disabled={loadingKonfigurasi || konfigurasiSaving}
              >
                <Icon name="save" size={16} />
                <span>{konfigurasiSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
              </button>
            </div>

            {#if konfigurasiError}
              <div class="alert-error">{konfigurasiError}</div>
            {/if}
            {#if konfigurasiSuccess}
              <div class="alert-success">{konfigurasiSuccess}</div>
            {/if}

            <!-- Summary KPI Card -->
            <div class="target-summary-card">
              <div class="summary-item">
                <span class="summary-label">Jenjang Sekolah</span>
                <span class="summary-value summary-bold">{selectedSekolah?.nama || '—'}</span>
              </div>
              <div class="summary-divider"></div>
              <div class="summary-item">
                <span class="summary-label">Juz Terpilih</span>
                <span class="summary-value text-primary">
                  {selectedJuzKelulusan.length} Juz
                  <span class="summary-subtext">
                    ({selectedJuzKelulusan.length > 0 ? selectedJuzKelulusan.join(', ') : 'Belum dipilih'})
                  </span>
                </span>
              </div>
              <div class="summary-divider"></div>
              <div class="summary-item">
                <span class="summary-label">Total Surah Diujikan</span>
                <span class="summary-value text-success">{computedPembagi} Surah</span>
              </div>
              <div class="summary-divider"></div>
              <div class="summary-item">
                <span class="summary-label">Pembagi Nilai Akhir</span>
                <span class="summary-value summary-bold">{computedPembagi}</span>
              </div>
              <div class="summary-divider"></div>
              <div class="summary-item">
                <span class="summary-label">Data Nilai Santri</span>
                {#if totalSiswaKelulusan > 0}
                  <span class="status-badge badge-warning" title="Sudah ada data nilai ujian kelulusan santri">
                    <Icon name="alertTriangle" size={13} />
                    {totalSiswaKelulusan} Santri Terdata
                  </span>
                {:else}
                  <span class="status-badge badge-neutral">Belum ada nilai</span>
                {/if}
              </div>
            </div>

            <!-- Quick Preset Buttons -->
            <div class="preset-section">
              <span class="preset-title">Pilihan Cepat Standar Sekolah:</span>
              <div class="preset-buttons">
                <button
                  type="button"
                  class="preset-btn"
                  class:preset-active={selectedJuzKelulusan.join(',') === '26,27,28,29,30'}
                  onclick={() => applyPresetJuz('smp')}
                >
                  SMP (Juz 26–30: 69 Surah)
                </button>
                <button
                  type="button"
                  class="preset-btn"
                  class:preset-active={selectedJuzKelulusan.join(',') === '28,29,30'}
                  onclick={() => applyPresetJuz('sma')}
                >
                  SMA (Juz 28–30)
                </button>
                <button
                  type="button"
                  class="preset-btn"
                  class:preset-active={selectedJuzKelulusan.join(',') === '29,30'}
                  onclick={() => applyPresetJuz('sd')}
                >
                  SD (Juz 29–30)
                </button>
                <button
                  type="button"
                  class="preset-btn"
                  class:preset-active={selectedJuzKelulusan.join(',') === '21,22,23,24,25,26,27,28,29,30'}
                  onclick={() => applyPresetJuz('10juz')}
                >
                  10 Juz Akhir (21–30)
                </button>
                <button
                  type="button"
                  class="preset-btn"
                  class:preset-active={selectedJuzKelulusan.length === 30}
                  onclick={() => applyPresetJuz('all')}
                >
                  Pilih Semua (30 Juz)
                </button>
                <button
                  type="button"
                  class="preset-btn preset-btn-reset"
                  onclick={() => applyPresetJuz('reset')}
                >
                  Kosongkan
                </button>
              </div>
            </div>

            <!-- 30 Juz Grid -->
            <div class="juz-selector-block">
              <div class="juz-selector-header">
                <div>
                  <h3 class="juz-selector-title">Pilih Juz Ujian Kelulusan (Juz 1 s.d 30)</h3>
                  <p class="juz-selector-subtitle">Klik kotak Juz untuk memilih atau membatalkan pilihan</p>
                </div>
                <div class="juz-selector-count">
                  Terpilih: <strong>{selectedJuzKelulusan.length} / 30 Juz</strong>
                </div>
              </div>

              <div class="juz-grid">
                {#each Array.from({ length: 30 }, (_, i) => i + 1) as juzNum}
                  {@const isSelected = selectedJuzKelulusan.includes(juzNum)}
                  {@const surahCount = materiList.filter(m => m.juz === juzNum && m.aktif).length}
                  <button
                    type="button"
                    class="juz-card"
                    class:juz-card-selected={isSelected}
                    onclick={() => toggleJuzKelulusan(juzNum)}
                    aria-pressed={isSelected}
                  >
                    <div class="juz-card-top">
                      <span class="juz-num">Juz {juzNum}</span>
                      <div class="juz-check" class:juz-check-active={isSelected}>
                        {#if isSelected}
                          <Icon name="check" size={13} />
                        {/if}
                      </div>
                    </div>
                    <div class="juz-card-surah">
                      {surahCount > 0 ? `${surahCount} Surah` : '0 Surah'}
                    </div>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Tingkat Kelas Kelulusan -->
            <div class="settings-class-block">
              <div class="settings-class-header">
                <div class="settings-class-label">Tingkat kelas yang mengikuti ujian kelulusan</div>
              </div>
              {#if kelasKelulusanOptions.length === 0}
                <div class="settings-note">
                  Belum ada kelas yang bisa dipilih untuk sekolah ini.
                </div>
              {:else}
                <div class="level-options">
                  {#each kelasKelulusanOptions as option (option.level)}
                    <label class="level-option">
                      <input
                        type="checkbox"
                        checked={selectedTingkatKelulusan.includes(option.level)}
                        onchange={() => toggleTingkatKelulusan(option.level)}
                        disabled={loadingKonfigurasi || konfigurasiSaving}
                      />
                      <span>{option.label}</span>
                    </label>
                  {/each}
                </div>
              {/if}
            </div>

            <div class="settings-save-footer">
              <p class="settings-note">
                Perubahan target kelulusan mengunci standar ujian bagi seluruh guru penguji.
              </p>
              <button
                class="btn-primary"
                onclick={() => simpanKonfigurasiNilaiTahfiz()}
                disabled={loadingKonfigurasi || konfigurasiSaving}
              >
                <Icon name="save" size={16} />
                <span>{konfigurasiSaving ? 'Menyimpan...' : 'Simpan Konfigurasi'}</span>
              </button>
            </div>
          </section>
        {/if}

        {#if tahfizActiveTab === 'materi'}
          <!-- Toolbar -->
          <div class="toolbar" style="flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 8px; flex: 1; min-width: 280px; align-items: center;">
              <input
                type="text"
                placeholder="Cari nama surah..."
                bind:value={surahSearch}
                class="input"
                style="max-width: 250px;"
              />
              <select bind:value={surahJuzFilter} class="input" style="max-width: 160px;">
                <option value={0}>Semua Juz (1-30)</option>
                {#each Array.from({ length: 30 }, (_, i) => i + 1) as j}
                  <option value={j}>Juz {j}</option>
                {/each}
              </select>
            </div>
            <span class="materi-count">
              {filteredMateriList.length} surah ditampilkan ({materiList.length} total, {materiList.filter((m) => m.aktif).length} aktif)
            </span>
          </div>

          <!-- Tabel materi -->
          {#if loadingMateri}
            <div class="card-loading">Memuat daftar surah...</div>
          {:else if filteredMateriList.length === 0}
            <div class="empty-state">
              <Icon name="list" size={48} />
              <h3>Tidak ada surah ditemukan</h3>
              <p>Coba ubah kata kunci pencarian atau filter juz.</p>
            </div>
          {:else}
            <div class="table-wrapper">
              <table class="materi-table">
                <thead>
                  <tr>
                    <th class="col-urutan">Urutan</th>
                    <th class="col-nama">Nama Surah</th>
                    <th class="col-juz">Juz</th>
                    <th class="col-status">Status Target</th>
                    <th class="col-status">Status Aktif</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredMateriList as materi (materi.id)}
                    {@const isTargetKelulusan = selectedJuzKelulusan.includes(materi.juz)}
                    <tr class:row-nonaktif={!materi.aktif}>
                      <td class="text-center text-muted">{materi.urutan || '—'}</td>
                      <td class="nama-cell">
                        <span class:text-muted={!materi.aktif} class="font-medium">{materi.nama_materi}</span>
                      </td>
                      <td class="text-center">
                        <span class="badge-juz">{materi.juz > 0 ? `Juz ${materi.juz}` : '—'}</span>
                      </td>
                      <td class="text-center">
                        {#if isTargetKelulusan}
                          <span class="status-badge badge-success">Target Kelulusan</span>
                        {:else}
                          <span class="status-badge badge-neutral">Bukan Target</span>
                        {/if}
                      </td>
                      <td class="text-center">
                        <button
                          class="toggle-btn"
                          class:aktif={materi.aktif}
                          class:nonaktif={!materi.aktif}
                          onclick={() => toggleAktif(materi)}
                          title={materi.aktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                        >
                          {materi.aktif ? 'Aktif' : 'Nonaktif'}
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {/if}

        {#if showConfirmChangeModal}
          <div class="modal-backdrop"></div>
          <div class="modal">
            <div class="modal-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: #f59e0b;"><Icon name="alertTriangle" size={20} /></span>
                <h3>Peringatan Perubahan Target</h3>
              </div>
              <button class="btn-close" onclick={() => (showConfirmChangeModal = false)}>×</button>
            </div>
            <div class="modal-body">
              <p style="margin: 0 0 10px; font-size: 0.95rem; color: #1e293b;">
                Terdapat <strong>{totalSiswaKelulusan} santri</strong> yang sudah memiliki data nilai ujian kelulusan dengan konfigurasi sebelumnya (<strong>Juz {originalJuzKelulusan}</strong>).
              </p>
              <p style="margin: 0 0 10px; font-size: 0.9rem; color: #475569;">
                Anda akan mengubah target kelulusan menjadi: <strong>Juz {selectedJuzKelulusan.join(', ')}</strong> (Total <strong>{computedPembagi} surah</strong>).
              </p>
              <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 10px; color: #b45309; font-size: 0.85rem; line-height: 1.4;">
                ⚠️ Mengubah konfigurasi ini akan mengubah pembagi rata-rata nilai santri tersebut saat rapor digenerate.
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn-secondary" onclick={() => (showConfirmChangeModal = false)}>
                Batal
              </button>
              <button
                class="btn-primary"
                style="background: #e11d48; border-color: #e11d48;"
                onclick={() => simpanKonfigurasiNilaiTahfiz(true)}
                disabled={konfigurasiSaving}
              >
                {konfigurasiSaving ? 'Menyimpan...' : 'Tetap Simpan Perubahan'}
              </button>
            </div>
          </div>
        {/if}

        {#if tahfizActiveTab === 'kriteria'}
          <section class="kelulusan-settings">
            <div class="settings-header">
              <div>
                <h2 class="settings-title">Kriteria Penilaian Rapor</h2>
                <p class="settings-subtitle">Atur batas predikat (Misal: 90 - 100 = Istimewa)</p>
              </div>
            </div>

            {#if konfigurasiError}
              <div class="alert-error">{konfigurasiError}</div>
            {/if}
            {#if konfigurasiSuccess}
              <div class="alert-success">{konfigurasiSuccess}</div>
            {/if}

            <div class="settings-kriteria-block" style="margin-top: 1rem;">
              <div class="settings-kriteria-header">
                <div class="settings-class-label">Kriteria Penilaian (Skala 100)</div>
                <button
                  class="btn-secondary btn-sm"
                  onclick={tambahKriteria}
                  disabled={loadingKonfigurasi || konfigurasiSaving}
                >
                  <Icon name="plus" size={14} /> Tambah
                </button>
              </div>

              <div class="kriteria-list">
                {#each kriteriaPenilaian as kriteria, index (index)}
                  <div class="kriteria-row">
                    <div class="form-group">
                      <label>Batas Bawah</label>
                      <input
                        type="number"
                        class="input"
                        bind:value={kriteria.min}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div class="form-group">
                      <label>Batas Atas</label>
                      <input
                        type="number"
                        class="input"
                        bind:value={kriteria.max}
                        min="0"
                        max="100"
                      />
                    </div>
                    <div class="form-group kriteria-arab">
                      <label>Predikat Arab</label>
                      <input
                        type="text"
                        class="input"
                        bind:value={kriteria.arab}
                        placeholder="مُمْتَاز"
                        dir="rtl"
                      />
                    </div>
                    <div class="form-group kriteria-indo">
                      <label>Predikat Indonesia</label>
                      <input
                        type="text"
                        class="input"
                        bind:value={kriteria.indo}
                        placeholder="Istimewa"
                      />
                    </div>
                    <button
                      class="btn-icon btn-icon-danger kriteria-hapus"
                      onclick={() => hapusKriteria(index)}
                      title="Hapus Kriteria"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                {/each}
                {#if kriteriaPenilaian.length === 0}
                  <div class="settings-note">
                    Belum ada kriteria penilaian. Klik Tambah untuk membuat.
                  </div>
                {/if}
              </div>
            </div>

            <div style="margin-top: 1.5rem;">
              <button
                class="btn-primary"
                onclick={simpanKonfigurasiNilaiTahfiz}
                disabled={loadingKonfigurasi || konfigurasiSaving}
              >
                {konfigurasiSaving ? 'Menyimpan...' : 'Simpan Kriteria'}
              </button>
            </div>
          </section>
        {/if}
        <!-- ======= END TAB TAHFIZ ======= -->
      {:else if activeTab === 'diniyah' && hasDiniyah}
        <!-- ======= TAB DINIYAH ======= -->
        <div
          style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; background: #f1f5f9; border: 1px solid #cbd5e1; padding: 0.35rem; border-radius: 999px; max-width: 750px;"
        >
          <button
            style="flex: 1; border-radius: 999px; padding: 0.5rem 1rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; {diniyahActiveTab ===
            'mapel'
              ? 'background: #10b981; color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);'
              : 'background: transparent; color: #64748b;'}"
            onclick={() => (diniyahActiveTab = 'mapel')}
          >
            Daftar Mapel
          </button>
          <button
            style="flex: 1; border-radius: 999px; padding: 0.5rem 1rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; {diniyahActiveTab ===
            'kriteria'
              ? 'background: #10b981; color: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1);'
              : 'background: transparent; color: #64748b;'}"
            onclick={() => (diniyahActiveTab = 'kriteria')}
          >
            Kriteria Penilaian
          </button>
        </div>

        {#if diniyahActiveTab === 'mapel'}
          <div class="toolbar">
            <span class="materi-count">
              {diniyahList.length} mapel terdaftar ({diniyahList.filter((m) => m.aktif).length} aktif)
            </span>
            <button class="btn-primary" onclick={() => (showDiniyahForm = !showDiniyahForm)}>
              <Icon name="plus" size={16} />
              Tambah Mapel
            </button>
          </div>

          {#if showDiniyahForm}
            <div class="form-card">
              <h3 class="form-title">Tambah Mapel Diniyah Baru</h3>
              {#if diniyahFormError}
                <div class="alert-error">{diniyahFormError}</div>
              {/if}
              <div class="form-row">
                <div class="form-group form-group-wide">
                  <label for="diniyah-nama"
                    >Nama Mapel (Latin) <span class="required">*</span></label
                  >
                  <input
                    id="diniyah-nama"
                    type="text"
                    placeholder="contoh: KHUDZ AQIDATAKA"
                    bind:value={diniyahFormNama}
                    class="input"
                  />
                </div>
                <div class="form-group form-group-wide">
                  <div
                    style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;"
                  >
                    <label for="diniyah-arab" style="margin-bottom: 0;">Nama Mapel (Arab)</label>
                    <button
                      type="button"
                      class="btn-secondary btn-sm"
                      style="padding: 0.2rem 0.5rem; font-size: 0.75rem;"
                      onclick={translateDiniyahForm}
                      disabled={isTranslatingDiniyahForm || !diniyahFormNama.trim()}
                      title="Terjemahkan otomatis dari Latin"
                    >
                      <Icon name="refreshCw" size={12} />
                      {isTranslatingDiniyahForm ? 'Menerjemahkan...' : 'Translate'}
                    </button>
                  </div>
                  <input
                    id="diniyah-arab"
                    type="text"
                    placeholder="contoh: خذ عقيدتك"
                    bind:value={diniyahFormNamaArab}
                    class="input input-arab"
                    dir="rtl"
                  />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="diniyah-kategori">Kategori</label>
                  <select id="diniyah-kategori" bind:value={diniyahFormKategori} class="input">
                    <option value="tes_tulis">Tes Tulis</option>
                    <option value="tes_lisan">Tes Lisan</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="diniyah-urutan">Urutan</label>
                  <input
                    id="diniyah-urutan"
                    type="number"
                    min="1"
                    placeholder="Otomatis"
                    bind:value={diniyahFormUrutan}
                    class="input"
                  />
                </div>
              </div>
              <div class="form-actions">
                <button
                  class="btn-secondary"
                  onclick={batalDiniyahForm}
                  disabled={diniyahFormLoading}>Batal</button
                >
                <button class="btn-primary" onclick={tambahDiniyah} disabled={diniyahFormLoading}>
                  {diniyahFormLoading ? 'Menyimpan...' : 'Simpan Mapel'}
                </button>
              </div>
            </div>
          {/if}

          {#if errorDiniyah}
            <div class="alert-error">{errorDiniyah}</div>
          {/if}

          {#if loadingDiniyah}
            <div class="card-loading">Memuat daftar mapel diniyah...</div>
          {:else if diniyahList.length === 0}
            <div class="empty-state">
              <Icon name="book" size={48} />
              <h3>Belum ada mapel diniyah</h3>
              <p>Tambahkan mapel diniyah agar guru dapat mulai menginput nilai.</p>
              <button class="btn-primary" onclick={() => (showDiniyahForm = true)}>
                <Icon name="plus" size={16} /> Tambah Mapel Pertama
              </button>
            </div>
          {:else}
            <div class="table-wrapper">
              <table class="materi-table">
                <thead>
                  <tr>
                    <th class="col-urutan">Urutan</th>
                    <th class="col-nama">Nama Mapel</th>
                    <th class="col-nama">Nama Arab</th>
                    <th class="col-juz">Kategori</th>
                    <th class="col-status">Status</th>
                    <th class="col-aksi">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {#each diniyahList as mapel (mapel.id)}
                    <tr class:row-nonaktif={!mapel.aktif}>
                      {#if diniyahEditingId === mapel.id}
                        <td
                          ><input
                            type="number"
                            min="1"
                            bind:value={diniyahEditUrutan}
                            class="input-inline"
                            placeholder="—"
                          /></td
                        >
                        <td
                          ><input
                            type="text"
                            bind:value={diniyahEditNama}
                            class="input-inline input-wide"
                            placeholder="Nama mapel"
                          /></td
                        >
                        <td
                          ><input
                            type="text"
                            bind:value={diniyahEditNamaArab}
                            class="input-inline input-wide input-arab"
                            dir="rtl"
                            placeholder="Nama arab"
                          /></td
                        >
                        <td>
                          <select bind:value={diniyahEditKategori} class="input-inline">
                            <option value="tes_tulis">Tes Tulis</option>
                            <option value="tes_lisan">Tes Lisan</option>
                          </select>
                        </td>
                        <td>—</td>
                        <td class="aksi-cell">
                          <button
                            class="btn-save"
                            onclick={() => simpanDiniyahEdit(mapel)}
                            disabled={diniyahEditLoading}
                            >{diniyahEditLoading ? '...' : 'Simpan'}</button
                          >
                          <button class="btn-cancel" onclick={cancelDiniyahEdit}>Batal</button>
                        </td>
                      {:else}
                        <td class="text-center text-muted">{mapel.urutan || '—'}</td>
                        <td class="nama-cell"
                          ><span class:text-muted={!mapel.aktif}>{mapel.nama_mapel}</span></td
                        >
                        <td class="nama-cell arab-cell" dir="rtl"
                          ><span class:text-muted={!mapel.aktif}
                            >{mapel.nama_mapel_arab || '—'}</span
                          ></td
                        >
                        <td class="text-center"
                          >{mapel.kategori === 'tes_lisan' ? 'Tes Lisan' : 'Tes Tulis'}</td
                        >
                        <td class="text-center">
                          <button
                            class="toggle-btn"
                            class:aktif={mapel.aktif}
                            class:nonaktif={!mapel.aktif}
                            onclick={() => toggleDiniyahAktif(mapel)}
                            title={mapel.aktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                          >
                            {mapel.aktif ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td class="aksi-cell">
                          <button
                            class="btn-icon"
                            title="Edit"
                            onclick={() => startDiniyahEdit(mapel)}
                            ><Icon name="edit2" size={15} /></button
                          >
                          <button
                            class="btn-icon btn-icon-danger"
                            title="Hapus"
                            onclick={() => hapusDiniyah(mapel.id)}
                            disabled={diniyahDeletingId === mapel.id}
                            ><Icon name="trash" size={15} /></button
                          >
                        </td>
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {/if}

        {#if diniyahActiveTab === 'kriteria'}
          <section class="kelulusan-settings">
            <div class="settings-header">
              <div>
                <h2 class="settings-title">Kriteria Penilaian Diniyah</h2>
                <p class="settings-subtitle">Atur batas predikat (Misal: 90 - 100 = Mumtaz)</p>
              </div>
            </div>

            {#if diniyahKonfigurasiError}
              <div class="alert-error">{diniyahKonfigurasiError}</div>
            {/if}
            {#if diniyahKonfigurasiSuccess}
              <div class="alert-success">{diniyahKonfigurasiSuccess}</div>
            {/if}

            <div class="settings-kriteria-block" style="margin-top: 1rem;">
              <div class="settings-kriteria-header">
                <div class="settings-class-label">Kriteria Penilaian (Skala 100)</div>
                <button
                  class="btn-secondary btn-sm"
                  onclick={tambahKriteriaDiniyah}
                  disabled={diniyahKonfigurasiLoading || diniyahKonfigurasiSaving}
                >
                  + Tambah Kriteria
                </button>
              </div>

              {#if diniyahKriteriaPenilaian.length === 0}
                <div class="settings-note">Belum ada kriteria penilaian yang dikonfigurasi.</div>
              {:else}
                <div class="kriteria-list">
                  <div class="kriteria-header-row">
                    <div>Batas Minimal</div>
                    <div>Batas Maksimal</div>
                    <div>Predikat (Arab)</div>
                    <div>Predikat (Indonesia)</div>
                    <div>Aksi</div>
                  </div>
                  {#each diniyahKriteriaPenilaian as k, i}
                    <div class="kriteria-row">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        class="form-input"
                        bind:value={k.min}
                        disabled={diniyahKonfigurasiLoading || diniyahKonfigurasiSaving}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        class="form-input"
                        bind:value={k.max}
                        disabled={diniyahKonfigurasiLoading || diniyahKonfigurasiSaving}
                      />
                      <input
                        type="text"
                        class="form-input arabic-text"
                        dir="rtl"
                        placeholder="مُمْتَاز"
                        bind:value={k.arab}
                        disabled={diniyahKonfigurasiLoading || diniyahKonfigurasiSaving}
                      />
                      <input
                        type="text"
                        class="form-input"
                        placeholder="Istimewa"
                        bind:value={k.indo}
                        disabled={diniyahKonfigurasiLoading || diniyahKonfigurasiSaving}
                      />
                      <button
                        class="btn-icon btn-icon-danger"
                        onclick={() => hapusKriteriaDiniyah(i)}
                        title="Hapus kriteria ini"
                        disabled={diniyahKonfigurasiLoading || diniyahKonfigurasiSaving}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}

              <div style="margin-top: 1rem; text-align: right;">
                <button
                  class="btn-primary"
                  onclick={simpanKonfigurasiNilaiDiniyah}
                  disabled={diniyahKonfigurasiLoading || diniyahKonfigurasiSaving}
                >
                  {diniyahKonfigurasiSaving ? 'Menyimpan...' : 'Simpan Kriteria'}
                </button>
              </div>
            </div>
          </section>
        {/if}
        <!-- ======= END TAB DINIYAH ======= -->
      {:else if activeTab === 'keseharian' && hasKeseharian}
        <div class="card-tabs">
          <button
            class="card-tab-btn"
            class:active={activeSubTab === 'keseharian'}
            onclick={() => (activeSubTab = 'keseharian')}
          >
            Indikator Keseharian
          </button>
          <button
            class="card-tab-btn"
            class:active={activeSubTab === 'pelanggaran'}
            onclick={() => (activeSubTab = 'pelanggaran')}
          >
            Pelanggaran
          </button>
          <button
            class="card-tab-btn"
            class:active={activeSubTab === 'iqob'}
            onclick={() => (activeSubTab = 'iqob')}
          >
            Iqob
          </button>
          <button
            class="card-tab-btn"
            class:active={activeSubTab === 'kriteria'}
            onclick={() => (activeSubTab = 'kriteria')}
          >
            Kriteria Penilaian
          </button>
        </div>

        {#if activeSubTab === 'keseharian'}
          <!-- ======= TAB KESEHARIAN ======= -->
          <div class="toolbar">
            <span class="materi-count">
              {indikators.length} indikator ({indikators.filter((m) => m.aktif).length} aktif)
            </span>
            <div class="toolbar-actions" style="display: flex; gap: 8px;">
              <button class="btn-secondary" onclick={handleDownloadTemplateKeseharian}>
                <Icon name="download" size={16} />
                Template
              </button>
              <button
                class="btn-secondary"
                onclick={() => fileInputKeseharian.click()}
                disabled={loadingImportKeseharian}
              >
                <Icon name="import" size={16} />
                {loadingImportKeseharian ? 'Mengimport...' : 'Import'}
              </button>
              <input
                type="file"
                accept=".xlsx"
                bind:this={fileInputKeseharian}
                onchange={handleImportKeseharian}
                style="display: none;"
              />
              <button
                class="btn-primary"
                onclick={() => (showKeseharianForm = !showKeseharianForm)}
              >
                <Icon name="plus" size={16} /> Tambah Indikator
              </button>
            </div>
          </div>

          {#if showKeseharianForm}
            <div class="materi-form">
              <div class="form-grid" style="grid-template-columns: 2fr 1fr;">
                <div class="form-group">
                  <label for="kes-nama">Nama Indikator Keseharian</label>
                  <input
                    id="kes-nama"
                    type="text"
                    placeholder="Contoh: Shalat Dhuha, Piket Asrama, dsb"
                    bind:value={keseharianFormNama}
                    class="input"
                  />
                </div>
              </div>
              <div class="form-actions">
                <button
                  class="btn-secondary"
                  onclick={batalKeseharianForm}
                  disabled={keseharianFormLoading}>Batal</button
                >
                <button
                  class="btn-primary"
                  onclick={tambahKeseharian}
                  disabled={keseharianFormLoading || !keseharianFormNama.trim()}
                >
                  {keseharianFormLoading ? 'Menyimpan...' : 'Simpan Indikator'}
                </button>
              </div>
            </div>
          {/if}

          {#if keseharianFormError}
            <div class="alert-error">{keseharianFormError}</div>
          {/if}

          {#if errorKeseharian}
            <div class="alert-error">{errorKeseharian}</div>
          {/if}

          {#if loadingKeseharian}
            <div class="card-loading">Memuat daftar indikator keseharian...</div>
          {:else if indikators.length === 0}
            <div class="empty-state">
              <Icon name="checkCircle" size={48} />
              <h3>Belum ada indikator keseharian</h3>
              <p>
                Tambahkan indikator (misal: Shalat Dhuha, Izin) agar musyrif dapat mengisi rapor
                keseharian siswa.
              </p>
              <button class="btn-primary" onclick={() => (showKeseharianForm = true)}>
                <Icon name="plus" size={16} /> Tambah Indikator Pertama
              </button>
            </div>
          {:else}
            <div class="table-wrapper">
              <table class="materi-table">
                <thead>
                  <tr>
                    <th style="width: 50px;">No</th>
                    <th class="col-nama">Nama Indikator</th>
                    <th class="col-status">Status</th>
                    <th class="col-aksi">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {#each indikators as ind, i (ind.id)}
                    <tr class:row-nonaktif={!ind.aktif}>
                      {#if keseharianEditingId === ind.id}
                        <td class="text-center">{i + 1}</td>
                        <td>
                          <input
                            type="text"
                            bind:value={keseharianEditNama}
                            class="input-inline input-wide"
                            placeholder="Nama indikator"
                          />
                        </td>
                        <td>—</td>
                        <td class="aksi-cell">
                          <button
                            class="btn-save"
                            onclick={() => simpanKeseharianEdit(ind)}
                            disabled={keseharianEditLoading}
                          >
                            {keseharianEditLoading ? '...' : 'Simpan'}
                          </button>
                          <button class="btn-cancel" onclick={cancelKeseharianEdit}>Batal</button>
                        </td>
                      {:else}
                        <td class="text-center text-muted">{i + 1}</td>
                        <td class="nama-cell">
                          <span class:text-muted={!ind.aktif}>{ind.nama}</span>
                        </td>
                        <td class="text-center">
                          <button
                            class="toggle-btn"
                            class:aktif={ind.aktif}
                            class:nonaktif={!ind.aktif}
                            onclick={() => toggleKeseharianAktif(ind)}
                            title={ind.aktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                          >
                            {ind.aktif ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td class="aksi-cell">
                          <button
                            class="btn-icon"
                            title="Edit"
                            onclick={() => startKeseharianEdit(ind)}
                          >
                            <Icon name="edit2" size={15} />
                          </button>
                          <button
                            class="btn-icon btn-icon-danger"
                            title="Hapus"
                            onclick={() => hapusKeseharian(ind.id)}
                            disabled={keseharianDeletingId === ind.id}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </td>
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
          <!-- ======= END TAB KESEHARIAN ======= -->
        {:else if activeSubTab === 'pelanggaran'}
          <!-- ======= TAB PELANGGARAN ======= -->
          <div class="toolbar">
            <span class="materi-count">
              {pelanggaranList.length} jenis pelanggaran ({pelanggaranList.filter((p) => p.aktif)
                .length} aktif)
            </span>
            <div class="toolbar-actions" style="display: flex; gap: 8px;">
              <button class="btn-secondary" onclick={handleDownloadTemplatePelanggaran}>
                <Icon name="download" size={16} />
                Template
              </button>
              <button
                class="btn-secondary"
                onclick={() => fileInputPelanggaran.click()}
                disabled={loadingImportPelanggaran}
              >
                <Icon name="import" size={16} />
                {loadingImportPelanggaran ? 'Mengimport...' : 'Import'}
              </button>
              <input
                type="file"
                accept=".xlsx"
                bind:this={fileInputPelanggaran}
                onchange={handleImportPelanggaran}
                style="display: none;"
              />
              <button
                class="btn-primary"
                onclick={() => (showPelanggaranForm = !showPelanggaranForm)}
              >
                <Icon name="plus" size={16} /> Tambah Pelanggaran
              </button>
            </div>
          </div>

          {#if showPelanggaranForm}
            <div class="materi-form">
              <div class="form-grid" style="grid-template-columns: 2fr 1fr;">
                <div class="form-group">
                  <label for="plg-nama">Nama Pelanggaran</label>
                  <input
                    id="plg-nama"
                    type="text"
                    placeholder="Contoh: Telat disiplin subuh"
                    bind:value={pelanggaranFormNama}
                    class="input"
                  />
                </div>
                <div class="form-group">
                  <label for="plg-poin">Poin Pelanggaran</label>
                  <input
                    id="plg-poin"
                    type="number"
                    min="0"
                    step="1"
                    bind:value={pelanggaranFormPoin}
                    class="input"
                  />
                </div>
              </div>
              <div class="form-actions">
                <button
                  class="btn-secondary"
                  onclick={() => {
                    showPelanggaranForm = false;
                    pelanggaranFormNama = '';
                    pelanggaranFormPoin = 0;
                    pelanggaranFormError = '';
                  }}
                  disabled={pelanggaranFormLoading}>Batal</button
                >
                <button
                  class="btn-primary"
                  onclick={tambahPelanggaran}
                  disabled={pelanggaranFormLoading || !pelanggaranFormNama.trim()}
                >
                  {pelanggaranFormLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          {/if}

          {#if pelanggaranFormError}
            <div class="alert-error">{pelanggaranFormError}</div>
          {/if}
          {#if errorPelanggaran}
            <div class="alert-error">{errorPelanggaran}</div>
          {/if}

          {#if loadingPelanggaran}
            <div class="card-loading">Memuat daftar pelanggaran...</div>
          {:else if pelanggaranList.length === 0}
            <div class="empty-state">
              <Icon name="alertCircle" size={48} />
              <h3>Belum ada jenis pelanggaran</h3>
              <p>Tambahkan jenis pelanggaran dan poinnya untuk bisa digunakan dalam pencatatan.</p>
              <button class="btn-primary" onclick={() => (showPelanggaranForm = true)}>
                <Icon name="plus" size={16} /> Tambah Pelanggaran Pertama
              </button>
            </div>
          {:else}
            <div class="table-wrapper">
              <table class="materi-table">
                <thead>
                  <tr>
                    <th style="width: 50px;">No</th>
                    <th class="col-nama">Nama Pelanggaran</th>
                    <th>Poin</th>
                    <th class="col-status">Status</th>
                    <th class="col-aksi">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {#each pelanggaranList as plg, i (plg.id)}
                    <tr class:row-nonaktif={!plg.aktif}>
                      {#if pelanggaranEditingId === plg.id}
                        <td class="text-center">{i + 1}</td>
                        <td>
                          <input
                            type="text"
                            bind:value={pelanggaranEditNama}
                            class="input-inline input-wide"
                            placeholder="Nama pelanggaran"
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            bind:value={pelanggaranEditPoin}
                            class="input-inline"
                            style="width: 70px"
                          />
                        </td>
                        <td>—</td>
                        <td class="aksi-cell">
                          <button
                            class="btn-save"
                            onclick={() => simpanPelanggaranEdit(plg)}
                            disabled={pelanggaranEditLoading}
                          >
                            {pelanggaranEditLoading ? '...' : 'Simpan'}
                          </button>
                          <button class="btn-cancel" onclick={cancelPelanggaranEdit}>Batal</button>
                        </td>
                      {:else}
                        <td class="text-center text-muted">{i + 1}</td>
                        <td class="nama-cell">
                          <span class:text-muted={!plg.aktif}>{plg.nama}</span>
                        </td>
                        <td class="text-center">
                          <span class:text-muted={!plg.aktif}>{plg.poin}</span>
                        </td>
                        <td class="text-center">
                          <button
                            class="toggle-btn"
                            class:aktif={plg.aktif}
                            class:nonaktif={!plg.aktif}
                            onclick={() => togglePelanggaranAktif(plg)}
                            title={plg.aktif ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                          >
                            {plg.aktif ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td class="aksi-cell">
                          <button
                            class="btn-icon"
                            title="Edit"
                            onclick={() => startPelanggaranEdit(plg)}
                          >
                            <Icon name="edit2" size={15} />
                          </button>
                          <button
                            class="btn-icon btn-icon-danger"
                            title="Hapus"
                            onclick={() => hapusPelanggaran(plg.id)}
                            disabled={pelanggaranDeletingId === plg.id}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </td>
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
          <!-- ======= END TAB PELANGGARAN ======= -->
        {:else if activeSubTab === 'iqob'}
          <!-- ======= TAB IQOB ======= -->
          <div class="toolbar">
            <span class="materi-count">
              {iqobList.length} jenis iqob ({iqobList.filter((p) => p.aktif).length} aktif)
            </span>
            <div class="toolbar-actions" style="display: flex; gap: 8px;">
              <button class="btn-secondary" onclick={handleDownloadTemplateIqob}>
                <Icon name="download" size={16} />
                Template
              </button>
              <button
                class="btn-secondary"
                onclick={() => fileInputIqob.click()}
                disabled={loadingImportIqob}
              >
                <Icon name="import" size={16} />
                {loadingImportIqob ? 'Mengimport...' : 'Import'}
              </button>
              <input
                type="file"
                accept=".xlsx"
                bind:this={fileInputIqob}
                onchange={handleImportIqob}
                style="display: none;"
              />
              <button class="btn-primary" onclick={() => (showIqobForm = !showIqobForm)}>
                <Icon name="plus" size={16} /> Tambah Iqob
              </button>
            </div>
          </div>

          {#if showIqobForm}
            <div class="materi-form">
              <div class="form-grid" style="grid-template-columns: 2fr 1fr;">
                <div class="form-group">
                  <label for="iqob-nama">Nama Iqob</label>
                  <input
                    id="iqob-nama"
                    type="text"
                    placeholder="Contoh: Membersihkan Masjid"
                    bind:value={iqobFormNama}
                    class="input"
                  />
                </div>
                <div class="form-group">
                  <label for="iqob-poin">Poin (Pengurangan)</label>
                  <input
                    id="iqob-poin"
                    type="number"
                    min="0"
                    step="0.1"
                    bind:value={iqobFormPoin}
                    class="input"
                  />
                </div>
              </div>
              <div class="form-group" style="margin-top: 16px;">
                <label for="iqob-ket">Keterangan (Opsional)</label>
                <input
                  id="iqob-ket"
                  type="text"
                  placeholder="Penjelasan..."
                  bind:value={iqobFormKeterangan}
                  class="input"
                />
              </div>
              <div class="form-actions" style="margin-top: 16px;">
                <button
                  class="btn-cancel"
                  onclick={() => {
                    showIqobForm = false;
                    iqobFormError = '';
                  }}>Batal</button
                >
                <button class="btn-save" onclick={tambahIqob} disabled={iqobFormLoading}>
                  {iqobFormLoading ? 'Menyimpan...' : 'Simpan Iqob'}
                </button>
              </div>
              {#if iqobFormError}
                <div class="alert-error mt-2">{iqobFormError}</div>
              {/if}
            </div>
          {/if}

          {#if errorIqob}
            <div class="alert-error">{errorIqob}</div>
          {/if}
          {#if loadingIqob}
            <div class="loading-state">Memuat data iqob...</div>
          {:else if iqobList.length === 0 && !errorIqob}
            <div class="empty-state">
              <Icon name="folderOpen" size={48} color="#cbd5e1" />
              <p>Belum ada konfigurasi jenis iqob.</p>
              <button class="btn-primary" onclick={() => (showIqobForm = true)}>
                <Icon name="plus" size={16} /> Tambah Jenis Iqob
              </button>
            </div>
          {:else if iqobList.length > 0}
            <div class="table-container">
              <table class="table-modern">
                <thead>
                  <tr>
                    <th class="col-nama">Nama Iqob</th>
                    <th class="col-poin">Poin Pengurang</th>
                    <th>Keterangan</th>
                    <th class="col-status">Status</th>
                    <th class="col-action">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {#each iqobList as p}
                    <tr>
                      {#if iqobEditingId === p.id}
                        <td><input type="text" class="input" bind:value={iqobEditNama} /></td>
                        <td
                          ><input
                            type="number"
                            step="0.1"
                            class="input"
                            bind:value={iqobEditPoin}
                          /></td
                        >
                        <td><input type="text" class="input" bind:value={iqobEditKeterangan} /></td>
                        <td></td>
                        <td>
                          <div class="action-buttons">
                            <button
                              class="btn-save"
                              onclick={() => simpanIqobEdit(p)}
                              disabled={iqobEditLoading}
                            >
                              <Icon name="check" size={16} />
                            </button>
                            <button class="btn-cancel" onclick={cancelIqobEdit}>Batal</button>
                          </div>
                        </td>
                      {:else}
                        <td>{p.nama}</td>
                        <td><span class="badge badge-success">-{p.poin}</span></td>
                        <td>{p.keterangan || '-'}</td>
                        <td>
                          <button
                            class="badge {p.aktif ? 'badge-success' : 'badge-danger'}"
                            style="cursor:pointer; border:none;"
                            onclick={() => toggleIqobAktif(p)}
                            title="Klik untuk mengubah status"
                          >
                            {p.aktif ? 'Aktif' : 'Nonaktif'}
                          </button>
                        </td>
                        <td>
                          <div class="action-buttons">
                            <button
                              class="btn-icon text-blue"
                              onclick={() => startIqobEdit(p)}
                              title="Edit Iqob"
                            >
                              <Icon name="edit" size={18} />
                            </button>
                            <button
                              class="btn-icon text-red"
                              onclick={() => hapusIqob(p.id)}
                              disabled={iqobDeletingId === p.id}
                              title="Hapus Iqob"
                            >
                              <Icon name="trash" size={18} />
                            </button>
                          </div>
                        </td>
                      {/if}
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        {:else if activeSubTab === 'kriteria'}
          <section class="kelulusan-settings">
            <div class="settings-header">
              <div>
                <h2 class="settings-title">Kriteria Penilaian Keseharian</h2>
                <p class="settings-subtitle">Atur batas predikat (Misal: 90 - 100 = Sangat Baik)</p>
              </div>
            </div>

            {#if keseharianKonfigurasiError}
              <div class="alert-error" style="margin-bottom: 1rem;">
                {keseharianKonfigurasiError}
              </div>
            {/if}
            {#if keseharianKonfigurasiSuccess}
              <div class="alert-success" style="margin-bottom: 1rem;">
                {keseharianKonfigurasiSuccess}
              </div>
            {/if}

            <div class="settings-kriteria-block" style="margin-top: 1rem;">
              <div class="settings-kriteria-header">
                <div class="settings-class-label">Kriteria Penilaian (Skala 100)</div>
                <button
                  class="btn-secondary btn-sm"
                  onclick={tambahKeseharianKriteria}
                  disabled={keseharianKonfigurasiLoading || keseharianKonfigurasiSaving}
                >
                  + Tambah Kriteria
                </button>
              </div>

              {#if keseharianKriteriaPenilaian.length === 0}
                <div class="settings-note">Belum ada kriteria penilaian yang dikonfigurasi.</div>
              {:else}
                <div class="kriteria-list">
                  <div class="kriteria-header-row">
                    <div>Batas Minimal</div>
                    <div>Batas Maksimal</div>
                    <div>Predikat Arab</div>
                    <div>Predikat Indonesia</div>
                    <div>Aksi</div>
                  </div>
                  {#each keseharianKriteriaPenilaian as k, i}
                    <div class="kriteria-row">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        class="form-input"
                        bind:value={k.min}
                        disabled={keseharianKonfigurasiLoading || keseharianKonfigurasiSaving}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        class="form-input"
                        bind:value={k.max}
                        disabled={keseharianKonfigurasiLoading || keseharianKonfigurasiSaving}
                      />
                      <input
                        type="text"
                        class="form-input arabic-text"
                        dir="rtl"
                        placeholder="مُمْتَاز"
                        bind:value={k.arab}
                        disabled={keseharianKonfigurasiLoading || keseharianKonfigurasiSaving}
                      />
                      <input
                        type="text"
                        class="form-input"
                        placeholder="Sangat Baik"
                        bind:value={k.indo}
                        disabled={keseharianKonfigurasiLoading || keseharianKonfigurasiSaving}
                      />
                      <button
                        class="btn-icon btn-icon-danger"
                        onclick={() => hapusKeseharianKriteria(i)}
                        title="Hapus kriteria ini"
                        disabled={keseharianKonfigurasiLoading || keseharianKonfigurasiSaving}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  {/each}
                </div>
              {/if}

              <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
                <button
                  class="btn-primary"
                  onclick={simpanKeseharianKonfigurasi}
                  disabled={keseharianKonfigurasiLoading || keseharianKonfigurasiSaving}
                >
                  {keseharianKonfigurasiSaving ? 'Menyimpan...' : 'Simpan Kriteria'}
                </button>
              </div>
            </div>
          </section>
        {/if}
      {:else if activeTab === 'kop_logo'}
        <!-- ======= TAB KOP & LOGO ======= -->
        <div class="card" style="padding: 2rem;">
          <h2 style="margin-top: 0;">Pengaturan Kop & Logo Rapor</h2>
          <p style="color: #64748b; margin-bottom: 2rem;">
            Atur Kop Surat (teks baris) dan Logo Sekolah. Pengaturan ini akan diaplikasikan ke semua
            jenis rapor.
          </p>

          <div
            style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;"
          >
            <!-- Logo Settings -->
            <div>
              <h3
                style="border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem;"
              >
                Logo Sekolah
              </h3>
              <div class="form-group" style="margin-bottom: 1rem;">
                <label>Unggah Logo</label>
                <input
                  type="file"
                  accept="image/*"
                  onchange={handleLogoUpload}
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label>Ukuran Logo ({logoSize}px)</label>
                <input type="range" min="30" max="300" bind:value={logoSize} />
              </div>
              <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.5rem;">
                Geser logo pada area pratinjau di bawah untuk mengatur letaknya secara bebas.
              </p>
              <div class="form-group" style="margin-top: 1rem;">
                <label>Ketebalan Garis Pemisah ({dividerThickness}px)</label>
                <input type="range" min="1" max="8" bind:value={dividerThickness} />
              </div>
            </div>

            <!-- Kop Settings -->
            <div>
              <h3
                style="border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem;"
              >
                Teks Kop Surat
              </h3>
              <div
                style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; padding-right: 0.5rem;"
              >
                {#each kopLines as line, i}
                  <div
                    style="display: flex; gap: 0.5rem; align-items: center; background: #f8fafc; padding: 0.5rem; border: 1px solid #e2e8f0; border-radius: 6px;"
                  >
                    <input
                      type="text"
                      class="form-input"
                      bind:value={line.text}
                      style="flex: 1;"
                      placeholder="Teks baris..."
                    />
                    <input
                      type="color"
                      bind:value={line.color}
                      title="Warna Teks"
                      style="width: 32px; height: 32px; padding: 0; border: none; cursor: pointer;"
                    />
                    <input
                      type="number"
                      class="form-input"
                      bind:value={line.size}
                      min="8"
                      max="48"
                      style="width: 60px;"
                      title="Ukuran Font (px)"
                    />
                    <label
                      style="display: flex; align-items: center; gap: 4px; font-size: 0.85rem; cursor: pointer;"
                    >
                      <input type="checkbox" bind:checked={line.bold} /> Bold
                    </label>
                    <button
                      class="btn-icon text-danger"
                      onclick={() => removeKopLine(i)}
                      title="Hapus"
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                {/each}
              </div>
              <button
                class="btn-secondary"
                style="margin-top: 1rem; width: 100%; justify-content: center;"
                onclick={addKopLine}
              >
                <Icon name="plus" size={16} /> Tambah Baris Kop
              </button>
            </div>
          </div>

          <!-- Preview -->
          <h3
            style="border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-bottom: 1rem;"
          >
            Pratinjau Kertas A4 (Area Atas)
          </h3>
          <div
            style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; background: #f1f5f9; padding: 2rem 0;"
          >
            <!-- Simulation of A4 Container at scaled size, matching .page in reports -->
            <div
              style="width: 210mm; min-height: 100mm; background: white; margin: 0 auto; position: relative; box-shadow: 0 4px 6px rgba(0,0,0,0.1); transform: scale(0.8); transform-origin: top center; overflow: hidden; padding: 1cm !important; box-sizing: border-box;"
            >
              <!-- header-section: same as in reports (position: relative; text-align: center; margin-bottom: 16px) -->
              <div style="position: relative; text-align: center; margin-bottom: 16px;">
                {#if customLogoUrl}
                  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                  <img
                    src={customLogoUrl}
                    alt="Logo"
                    style="position: absolute; left: {logoX}px; top: {logoY}px; width: {logoSize}px; cursor: move; z-index: 50; border: {isDragging
                      ? '1px dashed #3b82f6'
                      : '1px transparent solid'};"
                    onmousedown={onLogoMouseDown}
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

              <!-- Double Line: same as .header-line in reports -->
              <div
                style="border-top: {dividerThickness}px double black; border-bottom: none; height: 0; margin-bottom: 24px;"
              ></div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 2rem;">
            <button class="btn-primary" onclick={saveLogoSettings} disabled={isSavingLogo}>
              <Icon name={isSavingLogo ? 'loader' : 'save'} size={18} />
              {isSavingLogo ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </div>
        <!-- ======= END TAB KOP & LOGO ======= -->
      {/if}
    {/if}
    <!-- Akhir else (!hasTahfiz && !hasDiniyah) -->
  {/if}
</div>

<!-- TAMPILAN MOBILE: KONFIGURASI -->
<div class="mobile-app-ui sheet-page" style="padding-top: 0 !important; margin-bottom: 80px;">
  <div class="mobile-app-header">
    <h1 class="page-title">Konfigurasi</h1>
    <div class="student-sub" style="margin-top: 4px;">Atur parameter penilaian dan rapor.</div>
  </div>

  {#if !selectedSekolah}
    <div class="empty-state" style="border: none; margin-top: 1rem;">
      Silakan klik tombol Pilih Jenjang terlebih dahulu.
    </div>
  {:else}
    <div class="mobile-cards-view" style="padding-bottom: 0;">
      
      {#if hasTahfiz}
      <div class="surah-card" style="margin-top: 0;">
        <div class="surah-top" style="border-bottom: 1px solid var(--border);" onclick={() => activeTab = activeTab === 'tahfiz_m' ? '' : 'tahfiz_m'}>
          <div class="surah-no" style="background: #e0f2fe; color: #0284c7;"><Icon name="bookOpen" size={14}/></div>
          <div class="surah-name">Konfigurasi Tahfiz</div>
          <Icon name={activeTab === 'tahfiz_m' ? 'chevronUp' : 'chevronDown'} size={18} color="#94a3b8" />
        </div>
        {#if activeTab === 'tahfiz_m'}
        <div style="padding: 12px 14px; font-size: 13px; color: var(--muted); text-align: center; background: var(--bg);">
          Pengaturan Materi Tahfiz terlalu rumit untuk layar kecil. Silakan gunakan perangkat Desktop/Tablet PC.
        </div>
        {/if}
      </div>
      {/if}

      {#if hasDiniyah}
      <div class="surah-card">
        <div class="surah-top" style="border-bottom: 1px solid var(--border);" onclick={() => activeTab = activeTab === 'diniyah_m' ? '' : 'diniyah_m'}>
          <div class="surah-no" style="background: #dcfce7; color: #16a34a;"><Icon name="book" size={14}/></div>
          <div class="surah-name">Mapel Diniyah</div>
          <Icon name={activeTab === 'diniyah_m' ? 'chevronUp' : 'chevronDown'} size={18} color="#94a3b8" />
        </div>
        {#if activeTab === 'diniyah_m'}
        <div style="padding: 12px 14px; font-size: 13px; color: var(--muted); text-align: center; background: var(--bg);">
          Pengaturan Mapel Diniyah terlalu rumit untuk layar kecil. Silakan gunakan perangkat Desktop/Tablet PC.
        </div>
        {/if}
      </div>
      {/if}

      {#if hasKeseharian}
      <div class="surah-card">
        <div class="surah-top" style="border-bottom: 1px solid var(--border);" onclick={() => activeTab = activeTab === 'keseharian_m' ? '' : 'keseharian_m'}>
          <div class="surah-no" style="background: #fce7f3; color: #db2777;"><Icon name="smile" size={14}/></div>
          <div class="surah-name">Indikator Keseharian</div>
          <Icon name={activeTab === 'keseharian_m' ? 'chevronUp' : 'chevronDown'} size={18} color="#94a3b8" />
        </div>
        {#if activeTab === 'keseharian_m'}
        <div style="padding: 12px 14px; font-size: 13px; color: var(--muted); text-align: center; background: var(--bg);">
          Pengaturan Indikator Keseharian terlalu rumit untuk layar kecil. Silakan gunakan perangkat Desktop/Tablet PC.
        </div>
        {/if}
      </div>
      {/if}

      <div class="surah-card">
        <div class="surah-top" style="border-bottom: 1px solid var(--border);" onclick={() => activeTab = activeTab === 'logo_m' ? '' : 'logo_m'}>
          <div class="surah-no" style="background: #fef3c7; color: #d97706;"><Icon name="image" size={14}/></div>
          <div class="surah-name">Kop & Logo Rapor</div>
          <Icon name={activeTab === 'logo_m' ? 'chevronUp' : 'chevronDown'} size={18} color="#94a3b8" />
        </div>
        {#if activeTab === 'logo_m'}
        <div style="padding: 12px 14px; font-size: 13px; color: var(--muted); text-align: center; background: var(--bg);">
          Pengaturan letak posisi logo dan penyusunan Kop Rapor hanya didukung di perangkat Desktop.
        </div>
        {/if}
      </div>

    </div>
  {/if}
</div>

<style>

  .desktop-only { display: block; }
  .mobile-only { display: none !important; }
  @media (max-width: 768px) {
    .desktop-only { display: none !important; }
    .mobile-only { display: block !important; }
  }

  @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');

  /* Main Tabs */
  .tabs-header {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--color-border, #e2e8f0);
    margin-bottom: 1.5rem;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .tabs-header::-webkit-scrollbar {
    display: none;
  }
  .icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tab-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    color: var(--color-text-muted, #64748b);
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    border-bottom: 3px solid transparent;
    margin-bottom: -2px;
    transition: all 0.2s;
    white-space: nowrap;
    background: transparent;
    border-top: none;
    border-left: none;
    border-right: none;
    cursor: pointer;
  }
  .tab-link:hover {
    color: var(--color-primary, #4f46e5);
    background-color: var(--color-background, #f8fafc);
    border-radius: 8px 8px 0 0;
  }
  .tab-link.active {
    color: var(--color-primary, #4f46e5);
    border-bottom-color: var(--color-primary, #4f46e5);
  }

  /* Sub Tabs */
  .card-tabs {
    display: inline-flex;
    align-self: flex-start;
    background-color: #f1f5f9;
    border-radius: 999px;
    padding: 0.35rem;
    margin-bottom: 1.5rem;
    border: 1px solid #e2e8f0;
  }
  .card-tab-btn {
    padding: 0.6rem 1.5rem;
    font-size: 0.9rem;
    font-weight: 600;
    border: none;
    background: transparent;
    color: var(--color-text-muted, #64748b);
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-family: inherit;
    white-space: nowrap;
  }
  .card-tab-btn.active {
    background-color: white;
    color: var(--color-primary, #10b981);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  /* Arabic */
  .input-arab,
  .arab-cell {
    font-family: 'Amiri', 'Traditional Arabic', serif;
    font-size: 1.2rem;
  }
  .arab-cell {
    text-align: right;
  }
  .page-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding-bottom: 2rem;
  }

  .page-header {
    margin-bottom: 1.75rem;
  }

  .page-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 800;
    color: #0f172a;
  }

  .page-subtitle {
    margin: 0.3rem 0 0;
    color: #64748b;
    font-size: 0.9rem;
  }

  /* Sekolah picker */
  .section-label {
    font-size: 0.9rem;
    font-weight: 600;
    color: #475569;
    margin-bottom: 0.75rem;
  }

  .level-option span {
    font-size: 0.95rem;
    font-weight: 500;
  }

  /* Kriteria */
  .settings-kriteria-block {
    margin-top: 2rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.25rem;
  }

  .settings-kriteria-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 0.75rem;
  }

  .settings-kriteria-header .settings-class-label {
    margin-bottom: 0;
  }

  .kriteria-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .kriteria-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    background: #fff;
    padding: 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .kriteria-row .form-group {
    flex: 1 1 100px;
  }

  .kriteria-row .kriteria-arab,
  .kriteria-row .kriteria-indo {
    flex: 2 1 150px;
  }

  .kriteria-arab input {
    font-family: 'Aref Ruqaa', serif;
    font-size: 1.2rem;
  }

  .kriteria-hapus {
    height: 38px;
    width: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1px;
    background: #fee2e2;
    border-radius: 8px;
  }

  .kriteria-hapus:hover {
    background: #fecaca;
  }

  .sekolah-grid {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .sekolah-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: 1rem;
    text-align: left;
    transition: all 0.2s;
    color: #1e293b;
  }

  .sekolah-card:hover {
    border-color: #22c55e;
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.1);
  }

  .sekolah-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    background: #f0fdf4;
    color: #16a34a;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .sekolah-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .sekolah-nama {
    font-weight: 700;
    font-size: 0.95rem;
    color: #0f172a;
  }

  .sekolah-jenjang {
    font-size: 0.82rem;
    color: #64748b;
  }

  /* Selected header */
  .selected-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }

  .selected-sekolah {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
    color: #1e293b;
  }

  .badge-jenjang {
    background: #dcfce7;
    color: #166534;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.15rem 0.5rem;
    border-radius: 999px;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.85rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #475569;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
  }

  .btn-back:hover {
    border-color: #94a3b8;
    color: #1e293b;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .materi-count {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 600;
  }

  /* Form tambah */
  .form-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.25rem;
  }

  .form-title {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 700;
    color: #0f172a;
  }

  .form-row {
    display: flex;
    gap: 0.75rem;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    flex: 0 0 110px;
  }

  .form-group-wide {
    flex: 1 1 260px;
  }

  .form-group label {
    font-size: 0.82rem;
    font-weight: 600;
    color: #475569;
  }

  .required {
    color: #ef4444;
  }

  .input {
    height: 38px;
    padding: 0 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.9rem;
    font-family: inherit;
    color: #0f172a;
    outline: none;
    transition: border-color 0.2s;
    background: #f8fafc;
  }

  .input:focus {
    border-color: #22c55e;
    background: #fff;
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 1rem;
  }

  .kelulusan-settings {
    margin-top: 1.25rem;
    padding: 1.25rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }

  .settings-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .settings-title {
    margin: 0;
    color: #0f172a;
    font-size: 1rem;
    font-weight: 800;
  }

  .settings-subtitle {
    margin: 0.25rem 0 0;
    color: #64748b;
    font-size: 0.86rem;
  }

  .settings-row {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .settings-input {
    flex: 0 1 260px;
  }

  .settings-note {
    margin: 0.9rem 0 0;
    color: #64748b;
    font-size: 0.84rem;
  }

  .settings-class-block {
    background: #f8fafc;
    border-radius: 8px;
    padding: 1.25rem;
    border: 1px solid #e2e8f0;
    margin-top: 1rem;
  }

  .settings-class-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }
  .settings-class-label {
    margin-bottom: 0.5rem;
    font-size: 0.82rem;
    font-weight: 700;
    color: #475569;
  }

  .level-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .level-option {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-height: 36px;
    padding: 0.45rem 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #f8fafc;
    color: #1e293b;
    font-size: 0.86rem;
    font-weight: 700;
    cursor: pointer;
  }

  .level-option input {
    width: 15px;
    height: 15px;
    accent-color: #22c55e;
  }

  /* Target Summary Card */
  .target-summary-card {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 1.2rem;
    background: linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%);
    border: 1px solid #bbf7d0;
    border-radius: 12px;
    padding: 1.1rem 1.4rem;
    margin-bottom: 1.25rem;
  }
  .summary-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .summary-divider {
    width: 1px;
    height: 38px;
    background: #cbd5e1;
  }
  .summary-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
  }
  .summary-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: #0f172a;
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }
  .summary-subtext {
    font-size: 0.8rem;
    font-weight: 500;
    color: #64748b;
  }
  .summary-bold {
    font-weight: 800;
  }
  .text-primary {
    color: #16a34a !important;
  }
  .text-success {
    color: #059669 !important;
  }

  /* Preset Section */
  .preset-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }
  .preset-title {
    font-size: 0.82rem;
    font-weight: 700;
    color: #475569;
  }
  .preset-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .preset-btn {
    padding: 0.45rem 0.85rem;
    font-size: 0.82rem;
    font-weight: 600;
    color: #334155;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .preset-btn:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
  }
  .preset-btn.preset-active {
    background: #16a34a;
    border-color: #15803d;
    color: #fff;
    box-shadow: 0 2px 4px rgba(22, 163, 74, 0.25);
  }
  .preset-btn-reset {
    color: #dc2626;
    background: #fff;
    border-color: #fca5a5;
  }
  .preset-btn-reset:hover {
    background: #fef2f2;
    border-color: #ef4444;
  }

  /* 30 Juz Grid */
  .juz-selector-block {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 1.25rem;
    margin-bottom: 1rem;
  }
  .juz-selector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .juz-selector-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: #1e293b;
  }
  .juz-selector-subtitle {
    margin: 0.2rem 0 0;
    font-size: 0.82rem;
    color: #64748b;
  }
  .juz-selector-count {
    font-size: 0.86rem;
    color: #475569;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 0.3rem 0.65rem;
    border-radius: 6px;
  }
  .juz-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
    gap: 0.6rem;
  }
  .juz-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.65rem 0.75rem;
    background: #f8fafc;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
  }
  .juz-card:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    transform: translateY(-1px);
  }
  .juz-card.juz-card-selected {
    background: #ecfdf5;
    border-color: #10b981;
    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);
  }
  .juz-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.35rem;
  }
  .juz-num {
    font-size: 0.88rem;
    font-weight: 700;
    color: #0f172a;
  }
  .juz-card-selected .juz-num {
    color: #065f46;
  }
  .juz-check {
    width: 18px;
    height: 18px;
    border-radius: 5px;
    border: 1.5px solid #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    color: transparent;
  }
  .juz-check.juz-check-active {
    background: #10b981;
    border-color: #10b981;
    color: #fff;
  }
  .juz-card-surah {
    font-size: 0.75rem;
    font-weight: 500;
    color: #64748b;
  }
  .juz-card-selected .juz-card-surah {
    color: #047857;
    font-weight: 600;
  }

  /* Status Badges */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.25rem 0.55rem;
    border-radius: 6px;
    line-height: 1;
  }
  .badge-warning {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }
  .badge-success {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }
  .badge-neutral {
    background: #f1f5f9;
    color: #64748b;
    border: 1px solid #e2e8f0;
  }
  .badge-juz {
    display: inline-block;
    font-size: 0.8rem;
    font-weight: 600;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 0.2rem 0.5rem;
    border-radius: 6px;
    color: #334155;
  }
  .settings-save-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.25rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  /* Buttons */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1.1rem;
    background: #22c55e;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background: #16a34a;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.55rem 1.1rem;
    background: #fff;
    color: #475569;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s;
  }

  .btn-secondary:hover:not(:disabled) {
    border-color: #94a3b8;
    color: #1e293b;
  }

  /* Table */
  .table-wrapper {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
  }

  .materi-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .materi-table th {
    background: #f8fafc;
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 700;
    font-size: 0.8rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 1px solid #e2e8f0;
  }

  .materi-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }

  .materi-table tbody tr:last-child td {
    border-bottom: none;
  }

  .materi-table tbody tr:hover {
    background: #f8fafc;
  }

  .row-nonaktif {
    opacity: 0.55;
  }

  .col-urutan {
    width: 80px;
  }
  .col-juz {
    width: 100px;
  }
  .col-status {
    width: 110px;
  }
  .col-aksi {
    width: 100px;
  }

  .nama-cell {
    font-weight: 600;
    color: #1e293b;
  }
  .text-center {
    text-align: center;
  }
  .text-muted {
    color: #94a3b8;
  }

  /* Toggle aktif */
  .toggle-btn {
    display: inline-block;
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: all 0.2s;
  }

  .toggle-btn.aktif {
    background: #dcfce7;
    color: #166534;
  }

  .toggle-btn.aktif:hover {
    background: #bbf7d0;
  }

  .toggle-btn.nonaktif {
    background: #f1f5f9;
    color: #64748b;
  }

  .toggle-btn.nonaktif:hover {
    background: #e2e8f0;
  }

  /* Inline edit */
  .input-inline {
    height: 32px;
    width: 70px;
    padding: 0 0.5rem;
    border: 1px solid #22c55e;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    background: #f0fdf4;
    color: #0f172a;
  }

  .input-wide {
    width: 200px;
  }

  /* Aksi */
  .aksi-cell {
    display: flex;
    gap: 0.35rem;
    align-items: center;
  }

  .btn-icon {
    width: 30px;
    height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #fff;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
  }

  .btn-icon:hover {
    border-color: #22c55e;
    color: #16a34a;
    background: #f0fdf4;
  }

  .btn-icon-danger:hover {
    border-color: #fca5a5;
    color: #dc2626;
    background: #fef2f2;
  }

  .btn-save {
    padding: 0.3rem 0.7rem;
    background: #22c55e;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-cancel {
    padding: 0.3rem 0.7rem;
    background: #fff;
    color: #64748b;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }

  /* Alert & Empty */
  .alert-error {
    padding: 0.75rem 1rem;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fecaca;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .alert-success {
    padding: 0.75rem 1rem;
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    min-height: 260px;
    background: #fff;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    color: #64748b;
    text-align: center;
    padding: 2rem;
  }

  .empty-state h3 {
    margin: 0;
    font-size: 1rem;
    color: #1e293b;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .card-loading {
    padding: 2rem;
    text-align: center;
    color: #64748b;
    font-size: 0.9rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }

  @media (max-width: 640px) {
    .form-row {
      flex-direction: column;
    }
    .form-group {
      flex: 1 1 auto;
    }
    .toolbar {
      flex-direction: column;
      align-items: flex-start;
    }
    .materi-table {
      font-size: 0.8rem;
    }
    .col-urutan,
    .col-juz {
      display: none;
    }
  }

  .text-danger:hover {
    color: #dc2626 !important;
    background: #fee2e2 !important;
  }

  /* Modals for Keseharian */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    z-index: 50;
    backdrop-filter: blur(2px);
  }
  .modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    width: 100%;
    max-width: 400px;
    border-radius: 12px;
    z-index: 51;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  }
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid #e2e8f0;
  }
  .modal-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #1e293b;
  }
  .btn-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #64748b;
  }
  .modal-body {
    padding: 1.25rem;
  }
  .modal-footer {
    padding: 1rem 1.25rem;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .form-group-check {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .form-group-check label {
    font-size: 0.9rem;
    color: #334155;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .tabs-header {
      border-bottom: none;
      margin-bottom: 0.5rem;
      padding-bottom: 0.5rem;
      gap: 10px;
    }

    .tab-link {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 7px;
      padding: 12px 6px 10px;
      border-radius: 18px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0);
      margin-bottom: 0;
    }

    .tab-link:hover {
      background: var(--color-surface, #fff);
      border-radius: 18px;
    }

    .tab-link.active {
      background: var(--color-primary, #22c55e);
      border-color: var(--color-primary, #22c55e);
      color: #fff;
      transform: translateY(-2px);
      box-shadow: 0 10px 30px -12px rgba(34, 197, 94, 0.4);
    }

    .icon-wrapper {
      width: 34px;
      height: 34px;
      border-radius: 11px;
      background: #e6f7ec;
      color: var(--color-primary, #22c55e);
      transition: all 0.2s;
    }

    .tab-link.active .icon-wrapper {
      background: rgba(255, 255, 255, 0.25);
      color: #fff;
    }

    .tab-link span {
      font-size: 11.5px;
      font-weight: 700;
    }

    .card-tabs {
      display: flex;
      width: 100%;
      overflow-x: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      background: transparent;
      border: none;
      padding: 0;
      gap: 8px;
      margin-bottom: 1rem;
    }
    .card-tabs::-webkit-scrollbar {
      display: none;
    }

    .card-tab-btn {
      padding: 9px 14px;
      border-radius: 12px;
      font-size: 12.5px;
      background: var(--color-surface, #fff);
      border: 1px solid var(--color-border, #e2e8f0);
      box-shadow: none;
    }

    .card-tab-btn.active {
      background: var(--color-text-main, #1e293b);
      border-color: var(--color-text-main, #1e293b);
      color: #fff;
      box-shadow: none;
    }
  }
</style>
