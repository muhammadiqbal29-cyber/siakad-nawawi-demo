<script>
  import { goto } from '$app/navigation';
  import { guruState } from '$lib/guruState.svelte.js';

  const api = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  const schoolId = $derived(guruState.activeSekolahId);

  let teachers = $state([]);
  let teacherId = $state('0'); // '0' represents "Semua Guru"
  let teacherSearchQuery = $state('');
  let isTeacherDropdownOpen = $state(false);

  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  let config = $state({
    check_in_from: '07:00',
    check_in_to: '07:30',
    check_out_from: '15:00',
    check_out_to: '16:00',
    skip_sundays: true,
    overwrite_existing: true,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

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

  // Saat nama guru di filter pencarian dihapus/kosong, otomatis kembali ke "Semua Guru" ('0')!
  function handleTeacherInput(event) {
    const val = event.currentTarget.value;
    teacherSearchQuery = val;
    isTeacherDropdownOpen = true;

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

  async function generate() {
    if (!schoolId) {
      error = 'Pilih sekolah aktif terlebih dahulu.';
      return;
    }

    busy = true;
    error = '';
    message = '';

    try {
      const targetTeacherId = teacherId === 'all' ? 0 : Number(teacherId);

      const res = await fetch(`${api}/api/guru/presensi/kelola/generate-bulan?sekolah_id=${encodeURIComponent(schoolId)}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacher_id: targetTeacherId,
          bulan: Number(config.month),
          tahun: Number(config.year),
          check_in_from: config.check_in_from,
          check_in_to: config.check_in_to,
          check_out_from: config.check_out_from,
          check_out_to: config.check_out_to,
          skip_sundays: config.skip_sundays,
          overwrite_existing: config.overwrite_existing
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Gagal membuat/menimpa absensi bulanan');

      const result = data.data || {};
      message = `Berhasil! Target: ${result.teacher_name || 'Guru'}. Dibuat: ${result.created || 0}, Ditimpa: ${result.updated || 0}, Dilewati: ${result.skipped || 0}.`;
      setTimeout(() => goto('/guru/kelola-presensi'), 1000);
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>Generate / Timpa Absensi</title>
</svelte:head>

<div class="page-container">
  <!-- TOPBAR -->
  <div class="topbar">
    <button type="button" class="btn-back" onclick={() => goto('/guru/kelola-presensi')}>
      ← Kembali ke Kelola Absensi
    </button>
    <div class="header-info">
      <h1>Buat / Timpa Absensi Bulanan</h1>
      <p class="subtitle">Buat atau timpa data absensi guru secara otomatis selama satu bulan penuh.</p>
    </div>
  </div>

  {#if !schoolId}
    <div class="card empty-state">Pilih sekolah aktif terlebih dahulu di bagian atas.</div>
  {:else}
    <section class="card form-card">
      {#if error}<div class="alert alert-error">{error}</div>{/if}
      {#if message}<div class="alert alert-success">{message}</div>{/if}

      <!-- TARGET GURU COMBOBOX -->
      <div class="form-section">
        <label class="section-label" for="guru-input">
          1. Pilih Guru / Sasaran Absensi
        </label>
        
        <div class="combobox-wrapper">
          <input
            id="guru-input"
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
            <span>✅ <strong>Semua Guru:</strong> Absensi akan dibuat/ditimpa sekaligus untuk <strong>seluruh staf ({teachers.length} guru)</strong>.</span>
          {:else}
            <span>👤 <strong>Guru Individu:</strong> Absensi hanya akan dibuat/ditimpa untuk <strong>{selectedTeacherName}</strong>.</span>
          {/if}
        </div>
      </div>

      <!-- PERIODE BULAN & TAHUN -->
      <div class="form-section">
        <span class="section-label">2. Periode Absensi</span>
        <div class="grid-2">
          <label class="field-item">
            <span>Bulan</span>
            <select bind:value={config.month}>
              <option value={1}>Januari</option>
              <option value={2}>Februari</option>
              <option value={3}>Maret</option>
              <option value={4}>April</option>
              <option value={5}>Mei</option>
              <option value={6}>Juni</option>
              <option value={7}>Juli</option>
              <option value={8}>Agustus</option>
              <option value={9}>September</option>
              <option value={10}>Oktober</option>
              <option value={11}>November</option>
              <option value={12}>Desember</option>
            </select>
          </label>

          <label class="field-item">
            <span>Tahun</span>
            <input type="number" min="2000" bind:value={config.year} />
          </label>
        </div>
      </div>

      <!-- RENTANG JAM -->
      <div class="form-section">
        <span class="section-label">3. Rentang Jam Kehadiran (Acak Otomatis)</span>
        <div class="grid-4">
          <label class="field-item">
            <span>Jam Masuk (Mulai)</span>
            <input type="time" bind:value={config.check_in_from} />
          </label>
          <label class="field-item">
            <span>Jam Masuk (Sampai)</span>
            <input type="time" bind:value={config.check_in_to} />
          </label>
          <label class="field-item">
            <span>Jam Pulang (Mulai)</span>
            <input type="time" bind:value={config.check_out_from} />
          </label>
          <label class="field-item">
            <span>Jam Pulang (Sampai)</span>
            <input type="time" bind:value={config.check_out_to} />
          </label>
        </div>
      </div>

      <!-- PENGATURAN TAMBAHAN -->
      <div class="form-section options-area">
        <span class="section-label">4. Opsi & Mode Timpa</span>
        <div class="checkbox-container">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={config.skip_sundays} />
            <span><strong>Lewati hari Minggu</strong> (tidak ada absensi pada hari Minggu)</span>
          </label>

          <label class="checkbox-label highlight">
            <input type="checkbox" bind:checked={config.overwrite_existing} />
            <span><strong>Timpa data absensi yang sudah ada (Overwrite)</strong></span>
          </label>
        </div>

        {#if config.overwrite_existing}
          <div class="alert-box-warning">
            ⚠️ <strong>Mode Timpa Aktif:</strong> Seluruh tanggal absensi yang sudah ada pada periode ini akan <strong>ditimpa/diperbarui</strong> dengan jam baru.
          </div>
        {:else}
          <div class="alert-box-info">
            ℹ️ <strong>Mode Aman:</strong> Tanggal yang sudah memiliki data kehadiran tidak akan diubah (dilewati).
          </div>
        {/if}
      </div>

      <!-- SUBMIT ACTION -->
      <div class="form-actions">
        <button type="button" class="btn-cancel" onclick={() => goto('/guru/kelola-presensi')}>
          Batal
        </button>
        <button
          type="button"
          class="btn-submit"
          class:is-overwrite={config.overwrite_existing}
          disabled={busy}
          onclick={generate}
        >
          {#if busy}
            Sedang Memproses...
          {:else if config.overwrite_existing}
            ⚡ Timpa & Generate Absensi
          {:else}
            ✨ Buat Absensi
          {/if}
        </button>
      </div>
    </section>
  {/if}
</div>

<style>
  .page-container {
    max-width: 800px;
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
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
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
    background: #eff6ff;
    color: #2563eb;
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
  .grid-4 {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
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

  .checkbox-container {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    margin-bottom: 0.85rem;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    font-size: 0.92rem;
    color: #334155;
    cursor: pointer;
  }
  .checkbox-label input {
    width: 1.15rem;
    height: 1.15rem;
    cursor: pointer;
  }
  .checkbox-label.highlight {
    color: #9a3412;
  }

  .alert-box-warning {
    background: #fffbeb;
    color: #92400e;
    border: 1px solid #fef3c7;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.86rem;
    line-height: 1.45;
  }
  .alert-box-info {
    background: #f0fdf4;
    color: #166534;
    border: 1px solid #dcfce7;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.86rem;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 0.85rem;
    margin-top: 1.5rem;
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
  .btn-submit {
    background: #2563eb;
    color: #ffffff;
    border: none;
    border-radius: 8px;
    padding: 0.75rem 1.65rem;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);
  }
  .btn-submit:hover:not(:disabled) {
    background: #1d4ed8;
  }
  .btn-submit.is-overwrite {
    background: #ea580c;
    box-shadow: 0 1px 3px rgba(234, 88, 12, 0.25);
  }
  .btn-submit.is-overwrite:hover:not(:disabled) {
    background: #c2410c;
  }
  .btn-submit:disabled {
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
