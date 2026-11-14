<script>
  import { goto } from '$app/navigation';
  import { guruState } from '$lib/guruState.svelte.js';

  const api = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  const schoolId = $derived(guruState.activeSekolahId);

  let teachers = $state([]);
  let teacherId = $state('0'); // '0' = Semua Guru
  let month = $state(String(new Date().getMonth() + 1));
  let year = $state(new Date().getFullYear());
  let busy = $state(false);
  let message = $state('');
  let error = $state('');

  // Searchable combobox state
  let teacherSearchQuery = $state('');
  let isTeacherDropdownOpen = $state(false);

  let sortedTeachers = $derived.by(() => {
    return [...teachers].sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap, 'id'));
  });

  let displayTeacherText = $derived.by(() => {
    if (teacherId === '0' || teacherId === 'all' || !teacherId) {
      return `🌟 Semua Guru (Seluruh Staf - ${teachers.length} Guru)`;
    }
    const t = teachers.find((guru) => String(guru.id) === String(teacherId));
    return t ? t.nama_lengkap : 'Pilih Guru';
  });

  let comboboxTeachers = $derived.by(() => {
    const q = teacherSearchQuery.trim().toLowerCase();
    if (!q) return sortedTeachers;
    return sortedTeachers.filter((t) => t.nama_lengkap.toLowerCase().includes(q));
  });

  let selectedTeacherName = $derived.by(() => {
    if (teacherId === '0' || teacherId === 'all' || !teacherId) {
      return `Semua Guru (${teachers.length} Staf Sekolah)`;
    }
    const t = teachers.find((guru) => String(guru.id) === String(teacherId));
    return t ? t.nama_lengkap : 'Pilih Guru';
  });

  const monthNames = [
    '', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  let selectedMonthLabel = $derived.by(() => {
    if (!month) return 'Semua Bulan';
    return monthNames[Number(month)] || `Bulan ${month}`;
  });

  function handleTeacherInput(event) {
    const val = event.currentTarget.value;
    teacherSearchQuery = val;
    isTeacherDropdownOpen = true;

    // Saat nama dihapus/hilang, otomatis kembali ke Semua Guru!
    if (!val.trim()) {
      teacherId = '0';
    } else {
      const match = sortedTeachers.find((t) => t.nama_lengkap.toLowerCase() === val.trim().toLowerCase());
      if (match) {
        teacherId = String(match.id);
      }
    }
  }

  function handleTeacherFocus(event) {
    isTeacherDropdownOpen = true;
    if (teacherId === '0' || !teacherId) {
      teacherSearchQuery = '';
    } else {
      const t = teachers.find((guru) => String(guru.id) === String(teacherId));
      teacherSearchQuery = t ? t.nama_lengkap : '';
      event.currentTarget.select();
    }
  }

  function handleTeacherBlur() {
    setTimeout(() => {
      isTeacherDropdownOpen = false;
      if (!teacherSearchQuery.trim() || teacherId === '0') {
        teacherId = '0';
        teacherSearchQuery = '';
      } else {
        const t = teachers.find((guru) => String(guru.id) === String(teacherId));
        teacherSearchQuery = t ? t.nama_lengkap : '';
      }
    }, 200);
  }

  function selectTeacher(id, name) {
    teacherId = id ? String(id) : '0';
    teacherSearchQuery = id ? name : '';
    isTeacherDropdownOpen = false;
  }

  function clearTeacher() {
    teacherId = '0';
    teacherSearchQuery = '';
    isTeacherDropdownOpen = false;
  }

  async function loadTeachers() {
    if (!schoolId) return;
    try {
      const res = await fetch(`${api}/api/guru/presensi/kelola/guru?sekolah_id=${encodeURIComponent(schoolId)}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal memuat daftar guru');
      teachers = await res.json();
    } catch (e) {
      error = e.message;
    }
  }

  $effect(() => {
    if (schoolId) loadTeachers();
  });

  async function downloadExcel() {
    if (!schoolId) {
      error = 'Pilih sekolah aktif terlebih dahulu.';
      return;
    }

    busy = true;
    error = '';
    message = '';

    try {
      const qs = new URLSearchParams({ sekolah_id: String(schoolId) });
      if (month) qs.set('month', String(month));
      if (year) qs.set('year', String(year));
      if (teacherId && teacherId !== '0' && teacherId !== 'all') {
        qs.set('teacher_id', String(teacherId));
      }

      const res = await fetch(`${api}/api/guru/presensi/kelola/export?${qs.toString()}`, { credentials: 'include' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Tidak ada data absensi untuk periode yang dipilih.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const suffix = teacherId && teacherId !== '0' && teacherId !== 'all' ? `_${teacherId}` : '_semua_guru';
      const monthSuffix = month ? `_${String(month).padStart(2, '0')}` : '_semua_bulan';
      link.download = `rekap_absensi_${year}${monthSuffix}${suffix}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      message = `File Excel rekap absensi (${selectedTeacherName} - ${selectedMonthLabel} ${year}) berhasil diunduh.`;
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Unduh Rekap Absensi</title>
</svelte:head>

<div class="page-container">
  <!-- TOPBAR -->
  <div class="topbar">
    <button type="button" class="btn-back" onclick={() => goto('/guru/kelola-presensi')}>
      ← Kembali ke Kelola Absensi
    </button>
    <div class="header-info">
      <h1>Unduh Rekap Absensi Excel</h1>
      <p class="subtitle">Unduh data absensi guru ke format file spreadsheet Excel (.xlsx) berdasarkan periode dan sasaran guru.</p>
    </div>
  </div>

  {#if !schoolId}
    <div class="card empty-state">Pilih sekolah aktif terlebih dahulu di bagian atas.</div>
  {:else}
    <section class="card form-card">
      {#if error}<div class="alert alert-error">{error}</div>{/if}
      {#if message}<div class="alert alert-success">{message}</div>{/if}

      <!-- PILIH GURU -->
      <div class="form-section">
        <label class="section-label" for="guru-download-input">
          1. Pilih Sasaran Guru
        </label>
        
        <div class="combobox-wrapper">
          <input
            id="guru-download-input"
            type="text"
            class="combobox-input"
            placeholder="Ketik untuk mencari nama guru..."
            value={isTeacherDropdownOpen ? teacherSearchQuery : displayTeacherText}
            oninput={handleTeacherInput}
            onfocus={handleTeacherFocus}
            onblur={handleTeacherBlur}
          />
          {#if teacherId !== '0' || (isTeacherDropdownOpen && teacherSearchQuery)}
            <button
              type="button"
              class="combobox-clear-btn"
              onmousedown={(e) => { e.preventDefault(); clearTeacher(); }}
              title="Kembali ke Semua Guru"
            >
              ✕
            </button>
          {/if}
          <span class="combobox-arrow">▾</span>

          {#if isTeacherDropdownOpen}
            <div class="combobox-menu" role="listbox">
              <button
                type="button"
                class="combobox-item"
                class:selected={teacherId === '0' || !teacherId}
                onmousedown={() => selectTeacher('0', 'Semua Guru')}
              >
                🌟 Semua Guru (Seluruh Staf - {teachers.length} Guru)
              </button>
              {#if comboboxTeachers.length > 0}
                {#each comboboxTeachers as teacher}
                  <button
                    type="button"
                    class="combobox-item"
                    class:selected={String(teacher.id) === String(teacherId)}
                    onmousedown={() => selectTeacher(teacher.id, teacher.nama_lengkap)}
                  >
                    {teacher.nama_lengkap}
                  </button>
                {/each}
              {:else}
                <div class="combobox-empty">Tidak ada nama guru yang cocok</div>
              {/if}
            </div>
          {/if}
        </div>

        <div class="target-hint" class:is-all={teacherId === '0' || !teacherId}>
          {#if teacherId === '0' || !teacherId}
            <span>✅ Mengunduh rekap absensi untuk <strong>seluruh guru ({teachers.length} staf sekolah)</strong>.</span>
          {:else}
            <span>👤 Mengunduh rekap absensi hanya untuk <strong>{selectedTeacherName}</strong>.</span>
          {/if}
        </div>
      </div>

      <!-- PERIODE BULAN & TAHUN -->
      <div class="form-section">
        <span class="section-label">2. Pilih Periode Waktu</span>
        <div class="grid-2">
          <label class="field-item">
            <span>Bulan</span>
            <select bind:value={month}>
              <option value="">Semua Bulan (Sepanjang Tahun)</option>
              <option value="1">Januari</option>
              <option value="2">Februari</option>
              <option value="3">Maret</option>
              <option value="4">April</option>
              <option value="5">Mei</option>
              <option value="6">Juni</option>
              <option value="7">Juli</option>
              <option value="8">Agustus</option>
              <option value="9">September</option>
              <option value="10">Oktober</option>
              <option value="11">November</option>
              <option value="12">Desember</option>
            </select>
          </label>

          <label class="field-item">
            <span>Tahun</span>
            <input type="number" min="2000" bind:value={year} />
          </label>
        </div>
      </div>

      <!-- RINGKASAN FILE -->
      <div class="info-summary-box">
        <div class="summary-icon">📄</div>
        <div class="summary-content">
          <h4>Ringkasan Berkas yang Akan Diunduh:</h4>
          <p>
            Rekap absensi: <strong>{selectedTeacherName}</strong><br />
            Periode: <strong>{selectedMonthLabel} {year}</strong><br />
            Format: <strong>Microsoft Excel (.xlsx)</strong>
          </p>
        </div>
      </div>

      <!-- ACTION BUTTON -->
      <div class="form-actions">
        <button type="button" class="btn-cancel" onclick={() => goto('/guru/kelola-presensi')}>
          Batal
        </button>
        <button
          type="button"
          class="btn-download"
          disabled={busy}
          onclick={downloadExcel}
        >
          {#if busy}
            Sedang Menyiapkan File Excel...
          {:else}
            📥 Unduh Rekap Excel (.xlsx)
          {/if}
        </button>
      </div>
    </section>
  {/if}
</div>

<style>
  .page-container {
    max-width: 760px;
    margin: 0 auto;
    padding: 0.5rem 0 2rem;
  }
  .topbar {
    margin-bottom: 1.25rem;
  }
  .btn-back {
    background: transparent;
    border: none;
    color: #4f46e5;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    padding: 0;
    margin-bottom: 0.5rem;
  }
  .btn-back:hover {
    text-decoration: underline;
  }
  h1 {
    margin: 0 0 0.25rem;
    font-size: 1.55rem;
    color: #0f172a;
  }
  .subtitle {
    margin: 0;
    font-size: 0.92rem;
    color: #64748b;
  }

  .card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 1.75rem;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    overflow: visible;
  }
  .form-section {
    padding-bottom: 1.25rem;
    margin-bottom: 1.25rem;
    border-bottom: 1px solid #f1f5f9;
  }
  .form-section:last-of-type {
    border-bottom: none;
  }
  .section-label {
    display: block;
    font-size: 0.95rem;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 0.65rem;
  }

  /* COMBOBOX */
  .combobox-wrapper {
    position: relative;
    width: 100%;
  }
  .combobox-input {
    width: 100%;
    padding: 0.75rem 2.4rem 0.75rem 1rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.95rem;
    color: #0f172a;
    background: #ffffff;
  }
  .combobox-input:focus {
    outline: none;
    border-color: #059669;
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
  }
  .combobox-clear-btn {
    position: absolute;
    right: 1.6rem;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0.25rem;
  }
  .combobox-clear-btn:hover {
    color: #dc2626;
  }
  .combobox-arrow {
    position: absolute;
    right: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.8rem;
    color: #94a3b8;
    pointer-events: none;
  }
  .combobox-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.15);
    max-height: 240px;
    overflow-y: auto;
    z-index: 100;
  }
  .combobox-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.75rem 1rem;
    background: transparent;
    color: #1e293b;
    border: none;
    border-bottom: 1px solid #f1f5f9;
    font-size: 0.92rem;
    cursor: pointer;
  }
  .combobox-item:last-child {
    border-bottom: none;
  }
  .combobox-item:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
  .combobox-item.selected {
    background: #ecfdf5;
    color: #059669;
    font-weight: 600;
  }
  .combobox-empty {
    padding: 1rem;
    color: #94a3b8;
    font-size: 0.9rem;
    text-align: center;
  }

  .target-hint {
    margin-top: 0.5rem;
    font-size: 0.85rem;
    padding: 0.55rem 0.85rem;
    border-radius: 7px;
    background: #f1f5f9;
    color: #475569;
  }
  .target-hint.is-all {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }

  .grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .field-item {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.86rem;
    color: #475569;
    font-weight: 500;
  }
  .field-item select,
  .field-item input {
    padding: 0.65rem 0.85rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.92rem;
    background: #ffffff;
  }
  .field-item select:focus,
  .field-item input:focus {
    outline: none;
    border-color: #059669;
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
  }

  .info-summary-box {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 10px;
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
  }
  .summary-icon {
    font-size: 1.8rem;
    line-height: 1;
  }
  .summary-content h4 {
    margin: 0 0 0.35rem;
    font-size: 0.92rem;
    color: #166534;
  }
  .summary-content p {
    margin: 0;
    font-size: 0.88rem;
    color: #15803d;
    line-height: 1.5;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.85rem;
    padding-top: 1.25rem;
    border-top: 1px solid #e2e8f0;
  }
  .btn-cancel {
    background: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 0.75rem 1.25rem;
    font-size: 0.92rem;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-download {
    background: #059669;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 0.75rem 1.75rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(5, 150, 105, 0.25);
    transition: background 0.15s ease;
  }
  .btn-download:hover:not(:disabled) {
    background: #047857;
  }
  .btn-download:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .alert {
    padding: 0.85rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    margin-bottom: 1.25rem;
  }
  .alert-error {
    background: #fee2e2;
    color: #991b1b;
  }
  .alert-success {
    background: #dcfce7;
    color: #166534;
  }
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #64748b;
  }

  @media (max-width: 640px) {
    .grid-2 {
      grid-template-columns: 1fr;
    }
    .form-actions {
      flex-direction: column-reverse;
      align-items: stretch;
    }
    .form-actions button {
      width: 100%;
    }
  }
</style>
