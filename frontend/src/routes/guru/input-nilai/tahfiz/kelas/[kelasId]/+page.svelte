<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { toastStore } from '$lib/toast.svelte.js';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let kelasId = $derived($page.params.kelasId);
  let kelasLabel = $derived($page.url.searchParams.get('kelas') || `Kelas #${kelasId}`);
  let rombel = $derived($page.url.searchParams.get('rombel') || '__kosong__');
  let rombelText = $derived(rombel === '__kosong__' ? 'Tanpa Rombel' : `Rombel ${rombel}`);
  let sekolahId = $derived($page.url.searchParams.get('sekolah_id') || '1');
  let jenisPenilaian = $derived($page.url.searchParams.get('jenis_penilaian') || 'semester');
  let tahunAjaranId = $derived($page.url.searchParams.get('tahun_ajaran_id'));
  let semesterId = $derived($page.url.searchParams.get('semester_id'));

  let siswaList = $state([]);
  let loading = $state(false);
  let error = $state('');
  let searchQuery = $state('');
  let statusFilter = $state('all'); // 'all' | 'graded' | 'ungraded'

  // Reactive Stats
  let totalSiswa = $derived(siswaList.length);
  let jumlahDinilai = $derived(siswaList.filter((s) => s.sudahDinilai).length);
  let belumDinilai = $derived(totalSiswa - jumlahDinilai);
  let progressPercent = $derived(
    totalSiswa > 0 ? Math.min(100, Math.round((jumlahDinilai / totalSiswa) * 100)) : 0
  );

  let filteredSiswa = $derived(
    siswaList.filter((s) => {
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        (s.nama || '').toLowerCase().includes(q) ||
        (s.nisn && s.nisn.includes(q));
      if (!matchSearch) return false;

      if (statusFilter === 'graded') return s.sudahDinilai;
      if (statusFilter === 'ungraded') return !s.sudahDinilai;
      return true;
    })
  );

  onMount(loadSiswa);

  async function loadSiswa() {
    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    if (typeof window !== 'undefined') {
      const cacheKey = `siakad_offline_tahfiz_v1_kelas_${kelasId}_${rombel}_${jenisPenilaian}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          if (Array.isArray(data) && data.length > 0) {
            siswaList = data;
            loading = false;
          }
        } catch (e) {}
      }
    }

    if (siswaList.length === 0) {
      loading = true;
    }
    
    error = '';
    try {
      const params = new URLSearchParams({
        mata_pelajaran: 'Tahfiz',
        jenis_penilaian: jenisPenilaian,
        rombel
      });
      if (tahunAjaranId) params.append('tahun_ajaran_id', tahunAjaranId);
      if (semesterId) params.append('semester_id', semesterId);

      // Coba fetch endpoint masal terlebih dahulu
      let fetchedList = [];
      const resMasal = await fetch(
        `${apiUrl}/api/guru/kelas/${kelasId}/tahfiz-masal?${params.toString()}`,
        { credentials: 'include' }
      );

      if (resMasal.ok) {
        const rawMasal = await resMasal.json();
        if (Array.isArray(rawMasal)) {
          fetchedList = rawMasal.map((item) => {
            const s = item.siswa || {};
            const hasNilai = Boolean(item.nilai && (item.nilai.id || (item.details && item.details.length > 0)));
            return {
              id: s.id || s.siswa_id,
              nama: s.nama_lengkap || s.nama || '-',
              nisn: s.nisn || '-',
              sudahDinilai: hasNilai,
              nilai: item.nilai || null
            };
          });
        }
      }

      // Fallback ke endpoint nilai standar
      if (fetchedList.length === 0) {
        const res = await fetch(
          `${apiUrl}/api/guru/kelas/${kelasId}/nilai?${params.toString()}`,
          { credentials: 'include' }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || 'Gagal memuat data siswa.');
        }
        const body = await res.json();
        const nilaiMap = body.nilai_map || {};
        fetchedList = (body.siswa || []).map((s) => {
          const keyTahfiz = `${s.siswa_id}_Tahfiz`;
          const keyUjian = `${s.siswa_id}_Ujian Tahfiz`;
          const n = nilaiMap[keyTahfiz] || nilaiMap[keyUjian];
          return {
            id: s.siswa_id,
            nama: s.nama_lengkap || '-',
            nisn: s.nisn || '-',
            sudahDinilai: Boolean(n),
            nilai: n || null
          };
        });
      }

      siswaList = fetchedList;

      if (typeof window !== 'undefined') {
        const cacheKey = `siakad_offline_tahfiz_v1_kelas_${kelasId}_${rombel}_${jenisPenilaian}`;
        localStorage.setItem(cacheKey, JSON.stringify(siswaList));
      }
    } catch (err) {
      if (siswaList.length === 0) {
        error = err.message || 'Gagal memuat data siswa.';
      }
    } finally {
      loading = false;
    }
  }

  function getInitials(name) {
    if (!name) return '?';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }
</script>

<div class="page-container">
  <!-- TOP BREADCRUMB & HEADER -->
  <div class="page-header-actions">
    <div>
      <a class="back-link" href="/guru/input-nilai/tahfiz">
        <Icon name="arrowLeft" size={16} /> Kembali ke Pilih Kelas
      </a>
      <h1 class="page-title">{kelasLabel}</h1>
      <p class="page-subtitle">{rombelText} · {totalSiswa} total siswa</p>
    </div>
  </div>

  {#if error}
    <div class="alert-error">{error}</div>
  {/if}

  <!-- PROGRESS HERO CARD KELAS -->
  <div class="class-progress-hero">
    <div class="progress-hero-top">
      <div class="hero-left">
        <span class="hero-tag">Progress Penilaian Kelas</span>
        <h2 class="hero-title">{jumlahDinilai} dari {totalSiswa} Siswa Selesai Dinilai</h2>
        <p class="hero-desc">
          {#if totalSiswa === 0}
            Belum ada data siswa di kelas ini.
          {:else if progressPercent === 100}
            Alhamdulillah, seluruh siswa di rombel ini telah selesai dinilai!
          {:else}
            Tersisa <strong>{belumDinilai} siswa</strong> yang belum memiliki nilai tahfiz.
          {/if}
        </p>
      </div>

      <div class="hero-badge-container">
        <span class="hero-percent-badge" class:badge-all-done={progressPercent === 100}>
          {#if progressPercent === 100}
            <Icon name="check" size={15} />
          {/if}
          {progressPercent}% Selesai
        </span>
      </div>
    </div>

    <!-- PROGRESS BAR TRACK & FILL -->
    <div class="hero-bar-track">
      <div
        class="hero-bar-fill"
        class:bar-all-done={progressPercent === 100}
        style="width: {progressPercent}%"
      ></div>
    </div>

    <!-- SUMMARY META STATS -->
    <div class="hero-meta-stats">
      <div class="meta-stat-item">
        <span class="stat-dot dot-all"></span>
        <span class="stat-label">Total Siswa:</span>
        <strong class="stat-value">{totalSiswa}</strong>
      </div>
      <div class="meta-stat-item">
        <span class="stat-dot dot-graded"></span>
        <span class="stat-label">Sudah Dinilai:</span>
        <strong class="stat-value text-emerald">{jumlahDinilai}</strong>
      </div>
      <div class="meta-stat-item">
        <span class="stat-dot dot-ungraded"></span>
        <span class="stat-label">Belum Dinilai:</span>
        <strong class="stat-value text-amber">{belumDinilai}</strong>
      </div>
    </div>
  </div>

  <!-- CONTROLS BAR: FILTER PILLS & SEARCH -->
  <div class="controls-bar">
    <div class="filter-pills" role="tablist">
      <button
        type="button"
        class="filter-pill"
        class:active={statusFilter === 'all'}
        onclick={() => (statusFilter = 'all')}
      >
        Semua <span class="pill-count">{totalSiswa}</span>
      </button>

      <button
        type="button"
        class="filter-pill pill-graded"
        class:active={statusFilter === 'graded'}
        onclick={() => (statusFilter = 'graded')}
      >
        <span class="pill-icon">✓</span> Sudah Dinilai <span class="pill-count">{jumlahDinilai}</span>
      </button>

      <button
        type="button"
        class="filter-pill pill-ungraded"
        class:active={statusFilter === 'ungraded'}
        onclick={() => (statusFilter = 'ungraded')}
      >
        <span class="pill-icon">⏳</span> Belum Dinilai <span class="pill-count">{belumDinilai}</span>
      </button>
    </div>

    <div class="search-box">
      <Icon name="search" size={16} class="search-icon" />
      <input
        type="text"
        placeholder="Cari siswa atau NISN..."
        class="form-input search-input"
        bind:value={searchQuery}
      />
      {#if searchQuery}
        <button
          type="button"
          class="search-clear-btn"
          onclick={() => (searchQuery = '')}
          aria-label="Hapus pencarian"
        >
          ×
        </button>
      {/if}
    </div>
  </div>

  <!-- STUDENT LIST -->
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <span>Memuat data siswa kelas...</span>
    </div>
  {:else}
    <div class="student-list">
      {#each filteredSiswa as siswa (siswa.id)}
        <div class="student-row" class:row-graded={siswa.sudahDinilai}>
          <div class="student-info-group">
            <div class="avatar-circle" class:avatar-graded={siswa.sudahDinilai}>
              {getInitials(siswa.nama)}
            </div>
            <div class="student-text">
              <h3 class="student-nama">{siswa.nama}</h3>
              <p class="student-meta">{kelasLabel} · {rombelText} · NISN: {siswa.nisn}</p>
            </div>
          </div>

          <div class="student-right-actions">
            {#if siswa.sudahDinilai}
              <span class="status-badge badge-graded">
                <Icon name="check" size={13} /> Sudah Dinilai
              </span>
              <a
                class="btn-action btn-edit"
                href={`/guru/input-nilai/${siswa.id}?kelas=${encodeURIComponent(`${kelasLabel} - ${rombelText}`)}&nama=${encodeURIComponent(siswa.nama)}&sekolah_id=${sekolahId}&kelas_id=${kelasId}&rombel=${encodeURIComponent(rombel)}&kelas_label=${encodeURIComponent(kelasLabel)}&jenis_penilaian=${encodeURIComponent(jenisPenilaian)}${tahunAjaranId ? `&tahun_ajaran_id=${tahunAjaranId}` : ''}${semesterId ? `&semester_id=${semesterId}` : ''}`}
              >
                <Icon name="edit" size={14} /> Edit Nilai
              </a>
            {:else}
              <span class="status-badge badge-ungraded">
                <Icon name="clock" size={13} /> Belum Dinilai
              </span>
              <a
                class="btn-action btn-input"
                href={`/guru/input-nilai/${siswa.id}?kelas=${encodeURIComponent(`${kelasLabel} - ${rombelText}`)}&nama=${encodeURIComponent(siswa.nama)}&sekolah_id=${sekolahId}&kelas_id=${kelasId}&rombel=${encodeURIComponent(rombel)}&kelas_label=${encodeURIComponent(kelasLabel)}&jenis_penilaian=${encodeURIComponent(jenisPenilaian)}${tahunAjaranId ? `&tahun_ajaran_id=${tahunAjaranId}` : ''}${semesterId ? `&semester_id=${semesterId}` : ''}`}
              >
                <Icon name="plus" size={14} /> + Input Nilai
              </a>
            {/if}
          </div>
        </div>
      {/each}

      {#if filteredSiswa.length === 0}
        <div class="empty-state-feature">
          <Icon name="users" size={48} />
          <h3>Tidak Ada Siswa</h3>
          <p>
            {#if searchQuery}
              Tidak ada siswa yang cocok dengan kata kunci "<strong>{searchQuery}</strong>".
            {:else if statusFilter === 'graded'}
              Belum ada siswa yang sudah dinilai di rombel ini.
            {:else if statusFilter === 'ungraded'}
              Semua siswa di rombel ini sudah dinilai!
            {:else}
              Belum ada siswa aktif di {rombelText} ini.
            {/if}
          </p>
          {#if searchQuery || statusFilter !== 'all'}
            <button
              type="button"
              class="btn-reset-filter"
              onclick={() => { searchQuery = ''; statusFilter = 'all'; }}
            >
              Reset Filter & Pencarian
            </button>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    padding-bottom: 2.5rem;
  }

  .page-header-actions {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-bottom: 0.5rem;
    color: #475569;
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  .back-link:hover {
    color: var(--color-primary, #4f46e5);
  }

  .page-title {
    margin: 0;
    font-size: 1.5rem;
    color: var(--color-text, #1e293b);
    font-weight: 800;
  }

  .page-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.9rem;
    color: var(--color-text-muted, #64748b);
    font-weight: 600;
  }

  /* PROGRESS HERO CARD */
  .class-progress-hero {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .progress-hero-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
  }

  .hero-tag {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #0284c7;
    background: #e0f2fe;
    padding: 0.15rem 0.6rem;
    border-radius: 6px;
    margin-bottom: 0.35rem;
  }

  .hero-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 800;
    color: #0f172a;
  }

  .hero-desc {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: #64748b;
  }

  .hero-desc strong {
    color: #d97706;
  }

  .hero-percent-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.85rem;
    font-weight: 800;
    padding: 0.4rem 0.85rem;
    border-radius: 9999px;
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #e2e8f0;
    white-space: nowrap;
  }

  .hero-percent-badge.badge-all-done {
    background: #dcfce7;
    color: #15803d;
    border-color: #bbf7d0;
  }

  /* TRACK & FILL */
  .hero-bar-track {
    width: 100%;
    height: 10px;
    background: #e2e8f0;
    border-radius: 9999px;
    overflow: hidden;
  }

  .hero-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
    border-radius: 9999px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .hero-bar-fill.bar-all-done {
    background: #10b981;
  }

  /* META STATS */
  .hero-meta-stats {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding-top: 0.25rem;
    border-top: 1px solid #f1f5f9;
    flex-wrap: wrap;
  }

  .meta-stat-item {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.82rem;
    color: #64748b;
  }

  .stat-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dot-all { background: #94a3b8; }
  .dot-graded { background: #10b981; }
  .dot-ungraded { background: #f59e0b; }

  .stat-value {
    color: #0f172a;
    font-weight: 800;
  }

  .text-emerald { color: #15803d !important; }
  .text-amber { color: #d97706 !important; }

  /* CONTROLS BAR */
  .controls-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .filter-pills {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.85rem;
    border-radius: 9999px;
    font-size: 0.82rem;
    font-weight: 700;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-pill:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  .filter-pill.active {
    background: #0f172a;
    color: #ffffff;
    border-color: #0f172a;
  }

  .filter-pill.active .pill-count {
    background: rgba(255, 255, 255, 0.2);
    color: #ffffff;
  }

  .pill-count {
    font-size: 0.74rem;
    padding: 1px 6px;
    border-radius: 9999px;
    background: #f1f5f9;
    color: #64748b;
    font-weight: 800;
  }

  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    min-width: 280px;
  }

  .search-box :global(.search-icon) {
    position: absolute;
    left: 0.85rem;
    color: #94a3b8;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    padding: 0.55rem 2rem 0.55rem 2.4rem;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    font-size: 0.88rem;
    outline: none;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    border-color: var(--color-primary, #4f46e5);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }

  .search-clear-btn {
    position: absolute;
    right: 0.65rem;
    background: transparent;
    border: none;
    color: #94a3b8;
    font-size: 1.1rem;
    cursor: pointer;
    line-height: 1;
    padding: 0.2rem;
  }

  .search-clear-btn:hover {
    color: #334155;
  }

  /* STUDENT LIST */
  .student-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .student-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    background-color: #ffffff;
    padding: 0.9rem 1.25rem;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
    transition: all 0.2s ease;
  }

  .student-row:hover {
    border-color: #cbd5e1;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  }

  .student-row.row-graded {
    border-left: 4px solid #10b981;
  }

  .student-info-group {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    min-width: 0;
  }

  .avatar-circle {
    width: 42px;
    height: 42px;
    border-radius: 50%;
    background: #f1f5f9;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.95rem;
    font-weight: 800;
    border: 1px solid #e2e8f0;
    flex: 0 0 auto;
  }

  .avatar-circle.avatar-graded {
    background: #ecfdf5;
    color: #059669;
    border-color: #a7f3d0;
  }

  .student-text {
    min-width: 0;
  }

  .student-nama {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 800;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .student-meta {
    margin: 0.2rem 0 0 0;
    font-size: 0.78rem;
    color: #64748b;
    font-weight: 600;
  }

  .student-right-actions {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    flex: 0 0 auto;
  }

  /* STATUS BADGE */
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.25rem 0.65rem;
    border-radius: 9999px;
    white-space: nowrap;
  }

  .status-badge.badge-graded {
    background: #ecfdf5;
    color: #059669;
    border: 1px solid #a7f3d0;
  }

  .status-badge.badge-ungraded {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  /* BUTTON ACTIONS */
  .btn-action {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.45rem 0.85rem;
    border-radius: 8px;
    font-weight: 700;
    font-size: 0.82rem;
    text-decoration: none;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .btn-action.btn-input {
    background: var(--color-primary, #4f46e5);
    color: #ffffff;
    border: 1px solid transparent;
  }

  .btn-action.btn-input:hover {
    background: #4338ca;
  }

  .btn-action.btn-edit {
    background: #ffffff;
    color: #334155;
    border: 1px solid #cbd5e1;
  }

  .btn-action.btn-edit:hover {
    background: #f8fafc;
    border-color: #94a3b8;
    color: #0f172a;
  }

  /* LOADING & EMPTY STATES */
  .loading-state,
  .empty-state-feature {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 240px;
    text-align: center;
    color: #64748b;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 2.5rem 1.5rem;
    font-weight: 600;
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #e2e8f0;
    border-top-color: var(--color-primary, #4f46e5);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 0.75rem;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state-feature h3 {
    margin: 1rem 0 0.35rem;
    color: #1e293b;
    font-size: 1.1rem;
    font-weight: 800;
  }

  .empty-state-feature p {
    margin: 0;
    font-size: 0.85rem;
  }

  .btn-reset-filter {
    margin-top: 1rem;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    color: #1e293b;
    padding: 0.45rem 0.9rem;
    border-radius: 8px;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
  }

  .btn-reset-filter:hover {
    background: #e2e8f0;
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

  @media (max-width: 720px) {
    .page-header-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .progress-hero-top {
      flex-direction: column;
      align-items: flex-start;
    }

    .controls-bar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-box {
      min-width: 0;
      width: 100%;
    }

    .student-row {
      flex-direction: column;
      align-items: stretch;
      gap: 0.85rem;
    }

    .student-right-actions {
      justify-content: space-between;
      width: 100%;
      border-top: 1px solid #f1f5f9;
      padding-top: 0.75rem;
    }

    .btn-action {
      flex: 1;
      justify-content: center;
    }
  }
</style>
