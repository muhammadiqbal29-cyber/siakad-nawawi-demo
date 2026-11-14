<script>
  import { goto } from '$app/navigation';
  import { guruState } from '$lib/guruState.svelte.js';

  const api = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  // Default bulan berjalan (YYYY-MM)
  function getDefaultMonth() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  const DEFAULT_MONTH = getDefaultMonth();

  // State
  let rows = $state([]);
  let searchQuery = $state('');
  let filterMonth = $state(DEFAULT_MONTH);
  let filterStatus = $state('');
  let busy = $state(false);
  let message = $state('');
  let error = $state('');
  let lastUpdatedText = $state('');

  // Table Sorting State
  let sortColumn = $state('tanggal');
  let sortOrder = $state('desc'); // 'asc' | 'desc'

  const schoolId = $derived(guruState.activeSekolahId);

  function formatBulanText(yearMonthStr) {
    if (!yearMonthStr) return '';
    const parts = yearMonthStr.split('-');
    if (parts.length < 2) return yearMonthStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const d = new Date(year, month, 1);
    if (Number.isNaN(d.getTime())) return yearMonthStr;
    return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(d);
  }

  function formatTanggal(value) {
    if (!value) return '—';
    const raw = new Date(value.includes('T') ? value : `${value}T00:00:00`);
    if (Number.isNaN(raw.getTime())) return String(value);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(raw);
  }

  function updateTimeLabel() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    lastUpdatedText = `Diperbarui ${hh}:${mm}`;
  }

  // Cek apakah ada filter yang aktif (menyimpang dari default)
  let isFilterActive = $derived.by(() => {
    return Boolean(
      searchQuery.trim() ||
      filterStatus ||
      (filterMonth && filterMonth !== DEFAULT_MONTH)
    );
  });

  // Filter & Sort
  let displayedRows = $derived.by(() => {
    let result = rows;

    // 1. Filter Bulan & Tahun Terpadu
    if (filterMonth) {
      result = result.filter((r) => r.tanggal && (r.tanggal.startsWith(filterMonth) || r.tanggal.slice(0, 7) === filterMonth));
    }

    // 2. Filter Nama Guru (Teks Bebas)
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((r) => (r.nama_lengkap || '').toLowerCase().includes(q));
    }

    // 3. Filter Status Kehadiran
    if (filterStatus) {
      result = result.filter((r) => (r.status || '').toLowerCase() === filterStatus.toLowerCase());
    }

    // 4. Pengurutan Kolom (Sorting)
    return [...result].sort((a, b) => {
      let valA = a[sortColumn] ?? '';
      let valB = b[sortColumn] ?? '';
      if (typeof valA === 'string') {
        return sortOrder === 'asc'
          ? valA.localeCompare(valB, 'id')
          : valB.localeCompare(valA, 'id');
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  });

  $effect(() => {
    if (!schoolId) return;
    void load();
  });

  function toggleSort(col) {
    if (sortColumn === col) {
      sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortOrder = 'asc';
    }
  }

  function resetAllFilters() {
    searchQuery = '';
    filterMonth = DEFAULT_MONTH;
    filterStatus = '';
  }

  async function load() {
    if (!schoolId) return;
    error = '';
    busy = true;
    try {
      const qs = new URLSearchParams({ sekolah_id: String(schoolId) });
      const res = await fetch(`${api}/api/guru/presensi/kelola/riwayat?${qs.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Tidak dapat memuat data riwayat absensi.');
      rows = await res.json();
      updateTimeLabel();
    } catch (e) {
      error = e.message;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Kelola Absensi</title></svelte:head>

<div class="page-container">
  <!-- PAGE HEADER -->
  <div class="page-header">
    <div class="title-area">
      <div class="breadcrumb">GURU &bull; PRESENSI</div>
      <h1 class="page-title">Kelola Absensi</h1>
      <div class="school-tag">
        <span class="dot"></span>
        <span>{guruState.activeSekolahName || 'Pilih sekolah'}</span>
      </div>
    </div>
    
    <!-- NAVIGATION TO DEDICATED ACTION PAGES -->
    <div class="action-area">
      <button type="button" class="btn-download-page" onclick={() => goto('/guru/kelola-presensi/unduh')}>
        📥 Unduh Rekap Excel
      </button>
      <button type="button" class="btn-create" onclick={() => goto('/guru/kelola-presensi/generate')}>
        <span class="btn-icon">+</span> Buat / Timpa Absensi
      </button>
    </div>
  </div>

  {#if error}
    <div class="alert alert-error">
      <span>{error}</span>
      <button type="button" class="alert-close" onclick={() => error = ''}>✕</button>
    </div>
  {/if}

  {#if message}
    <div class="alert alert-success">
      <span>{message}</span>
      <button type="button" class="alert-close" onclick={() => message = ''}>✕</button>
    </div>
  {/if}

  {#if !schoolId}
    <div class="empty-card">
      <div class="empty-icon">🏫</div>
      <h3>Pilih Sekolah Aktif</h3>
      <p>Silakan pilih jenjang / sekolah aktif terlebih dahulu di bagian atas.</p>
    </div>
  {:else}
    <div class="main-card">
      
      <!-- CARD HEADER & 3 MAIN CONTROLS (DESAIN MINIMALIS) -->
      <div class="card-search-section">
        
        <div class="card-intro">
          <h2 class="card-title">Riwayat Absensi Guru</h2>
          <p class="card-subtitle">Pantau dan cari catatan kehadiran guru berdasarkan bulan dan status.</p>
        </div>

        <!-- 3 CONTROLS GRID -->
        <div class="filter-controls-grid">
          
          <!-- 1. Cari Nama Guru (Kontrol Utama) -->
          <div class="control-group search-group">
            <label for="search-guru" class="control-label">Cari Nama Guru</label>
            <input
              id="search-guru"
              type="text"
              placeholder="Ketik nama guru..."
              bind:value={searchQuery}
              class="input-text"
            />
          </div>

          <!-- 2. Filter Bulan & Tahun Terpadu -->
          <div class="control-group month-group">
            <label for="filter-month" class="control-label">Bulan</label>
            <input
              id="filter-month"
              type="month"
              bind:value={filterMonth}
              class="input-month"
            />
          </div>

          <!-- 3. Status Kehadiran -->
          <div class="control-group status-group">
            <label for="filter-status" class="control-label">Status Kehadiran</label>
            <select id="filter-status" bind:value={filterStatus} class="input-select">
              <option value="">Semua Status</option>
              <option value="Hadir">Hadir</option>
              <option value="Terlambat">Terlambat</option>
              <option value="Izin">Izin</option>
              <option value="Sakit">Sakit</option>
              <option value="Alpa">Alpa</option>
            </select>
          </div>

        </div>

        <!-- ACTIVE FILTER CHIPS (HANYA MUNCUL KETIKA ADA FILTER AKTIF) -->
        {#if isFilterActive}
          <div class="filter-chips-row">
            <div class="chips-group">
              <span class="chips-label">Filter aktif:</span>
              <div class="chips-list">
                
                {#if filterMonth}
                  <span class="filter-chip">
                    <span class="chip-val">{formatBulanText(filterMonth)}</span>
                    <button
                      type="button"
                      class="chip-remove"
                      onclick={() => filterMonth = DEFAULT_MONTH}
                      title="Kembali ke bulan berjalan"
                    >×</button>
                  </span>
                {/if}

                {#if searchQuery.trim()}
                  <span class="filter-chip">
                    <span class="chip-prop">Nama:</span>
                    <span class="chip-val">"{searchQuery}"</span>
                    <button
                      type="button"
                      class="chip-remove"
                      onclick={() => searchQuery = ''}
                      title="Hapus pencarian nama"
                    >×</button>
                  </span>
                {/if}

                {#if filterStatus}
                  <span class="filter-chip">
                    <span class="chip-prop">Status:</span>
                    <span class="chip-val">{filterStatus}</span>
                    <button
                      type="button"
                      class="chip-remove"
                      onclick={() => filterStatus = ''}
                      title="Hapus filter status"
                    >×</button>
                  </span>
                {/if}

              </div>
            </div>

            <!-- SATU-SATUNYA TOMBOL RESET FILTER -->
            <button
              type="button"
              class="btn-reset-single"
              onclick={resetAllFilters}
            >
              Reset filter
            </button>
          </div>
        {/if}

      </div>

      <!-- TABLE META & RESULT BAR -->
      <div class="table-meta-bar">
        <div class="meta-count">
          <strong>{displayedRows.length}</strong> catatan absensi
          <span class="meta-sub">Hasil pencarian</span>
        </div>
        <div class="meta-actions">
          <span>{lastUpdatedText || 'Diperbarui baru saja'}</span>
          <button
            type="button"
            class="btn-refresh-icon"
            onclick={load}
            disabled={busy}
            title="Muat ulang data dari server"
          >
            {busy ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      <!-- ATTENDANCE TABLE -->
      {#if rows.length === 0}
        <div class="empty-state">
          <div class="empty-icon-subtle">📋</div>
          <p class="empty-title">Belum ada catatan riwayat absensi guru</p>
          <p class="empty-desc">Data absensi belum dibuat untuk sekolah ini.</p>
        </div>
      {:else if displayedRows.length === 0}
        <div class="empty-state">
          <div class="empty-icon-subtle">🔎</div>
          <p class="empty-title">Tidak ada catatan absensi yang cocok</p>
          <p class="empty-desc">Coba sesuaikan kata kunci nama guru, pilih bulan lain, atau ubah status kehadiran.</p>
        </div>
      {:else}
        <div class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;" onclick={() => toggleSort('id')} class="sortable-th">
                  NO <span class="sort-indicator">{sortColumn === 'id' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th style="width: 175px;" onclick={() => toggleSort('tanggal')} class="sortable-th">
                  TANGGAL <span class="sort-indicator" class:active-sort={sortColumn === 'tanggal'}>{sortColumn === 'tanggal' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th onclick={() => toggleSort('nama_lengkap')} class="sortable-th">
                  NAMA GURU <span class="sort-indicator" class:active-sort={sortColumn === 'nama_lengkap'}>{sortColumn === 'nama_lengkap' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th style="width: 120px;" onclick={() => toggleSort('status')} class="sortable-th">
                  STATUS <span class="sort-indicator" class:active-sort={sortColumn === 'status'}>{sortColumn === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th style="width: 110px;" onclick={() => toggleSort('waktu_masuk')} class="sortable-th">
                  JAM MASUK <span class="sort-indicator" class:active-sort={sortColumn === 'waktu_masuk'}>{sortColumn === 'waktu_masuk' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
                <th style="width: 110px;" onclick={() => toggleSort('waktu_pulang')} class="sortable-th">
                  JAM PULANG <span class="sort-indicator" class:active-sort={sortColumn === 'waktu_pulang'}>{sortColumn === 'waktu_pulang' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {#each displayedRows as row, i}
                <tr>
                  <td class="text-center text-muted">{i + 1}</td>
                  <td class="cell-date">{formatTanggal(row.tanggal)}</td>
                  <td class="cell-name">{row.nama_lengkap}</td>
                  <td>
                    <span class="status-pill status-{row.status?.toLowerCase()}">{row.status}</span>
                  </td>
                  <td class="cell-time">{row.waktu_masuk || '—'}</td>
                  <td class="cell-time">{row.waktu_pulang || '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

    </div>
  {/if}
</div>

<style>
  .page-container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0.5rem 0 2rem;
  }

  /* HEADER */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.25rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .breadcrumb {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #6366f1;
    margin-bottom: 0.2rem;
  }
  .page-title {
    margin: 0 0 0.35rem;
    font-size: 1.55rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.2;
  }
  .school-tag {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: 0.85rem;
    color: #475569;
    font-weight: 500;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
  }

  .action-area {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .btn-download-page {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: #059669;
    color: #ffffff;
    border: none;
    padding: 0.6rem 1.1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .btn-download-page:hover {
    background: #047857;
  }
  .btn-create {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    background: #2563eb;
    color: #ffffff;
    border: none;
    padding: 0.6rem 1.1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .btn-create:hover {
    background: #1d4ed8;
  }
  .btn-icon {
    font-size: 1.1rem;
    line-height: 1;
    font-weight: bold;
  }

  /* CARD */
  .main-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    overflow: hidden;
  }

  /* CARD SEARCH SECTION (MINIMALIS) */
  .card-search-section {
    padding: 1.35rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .card-intro {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .card-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #0f172a;
  }
  .card-subtitle {
    margin: 0;
    font-size: 0.8rem;
    color: #64748b;
  }

  /* 3 CONTROLS GRID */
  .filter-controls-grid {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    gap: 0.85rem;
  }
  .control-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .search-group {
    grid-column: span 6;
  }
  .month-group {
    grid-column: span 3;
  }
  .status-group {
    grid-column: span 3;
  }
  @media (max-width: 768px) {
    .search-group, .month-group, .status-group {
      grid-column: span 12;
    }
  }

  .control-label {
    font-size: 0.8rem;
    font-weight: 500;
    color: #334155;
  }
  .input-text, .input-month, .input-select {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.88rem;
    background: #ffffff;
    color: #1e293b;
    outline: none;
    transition: all 0.15s ease;
    box-sizing: border-box;
  }
  .input-text:focus, .input-month:focus, .input-select:focus {
    border-color: #4f46e5;
    box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.12);
  }

  /* FILTER CHIPS ROW */
  .filter-chips-row {
    padding-top: 0.75rem;
    border-top: 1px solid #f1f5f9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .chips-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .chips-label {
    font-size: 0.78rem;
    font-weight: 500;
    color: #64748b;
  }
  .chips-list {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 0.2rem 0.55rem;
    border-radius: 6px;
    font-size: 0.78rem;
    color: #1e293b;
  }
  .chip-prop {
    color: #64748b;
    font-weight: 500;
  }
  .chip-val {
    font-weight: 600;
  }
  .chip-remove {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 0;
    line-height: 1;
    display: inline-flex;
    align-items: center;
  }
  .chip-remove:hover {
    color: #dc2626;
  }

  .btn-reset-single {
    background: transparent;
    border: none;
    color: #dc2626;
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    text-decoration: underline;
    padding: 0.2rem 0;
  }
  .btn-reset-single:hover {
    color: #b91c1c;
  }

  /* TABLE META BAR */
  .table-meta-bar {
    padding: 0.7rem 1.5rem;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.82rem;
    color: #64748b;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .meta-count strong {
    color: #0f172a;
    font-weight: 700;
  }
  .meta-sub {
    color: #94a3b8;
    margin-left: 0.35rem;
  }
  .meta-actions {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .btn-refresh-icon {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.2rem 0.35rem;
    font-size: 0.85rem;
    border-radius: 4px;
    transition: background 0.15s ease;
  }
  .btn-refresh-icon:hover {
    background: #e2e8f0;
  }

  /* TABLE */
  .table-wrapper {
    width: 100%;
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    text-align: left;
    min-width: 650px;
  }
  th {
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    color: #475569;
    font-weight: 600;
    letter-spacing: 0.02em;
    font-size: 0.78rem;
    user-select: none;
  }
  .sortable-th {
    cursor: pointer;
    transition: background 0.15s ease;
  }
  .sortable-th:hover {
    background: #f1f5f9;
  }
  .sort-indicator {
    color: #94a3b8;
    font-size: 0.75rem;
    margin-left: 0.25rem;
  }
  .sort-indicator.active-sort {
    color: #4f46e5;
    font-weight: bold;
  }

  td {
    padding: 0.8rem 1rem;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
  }
  tr:hover td {
    background: #f8fafc;
  }
  .cell-date {
    font-weight: 500;
    color: #1e293b;
  }
  .cell-name {
    font-weight: 600;
    color: #0f172a;
  }
  .cell-time {
    font-family: monospace;
    color: #64748b;
  }

  /* STATUS PILLS */
  .status-pill {
    display: inline-block;
    padding: 0.18rem 0.55rem;
    border-radius: 9999px;
    font-size: 0.74rem;
    font-weight: 600;
    text-transform: capitalize;
  }
  .status-hadir {
    background: #dcfce7;
    color: #15803d;
  }
  .status-terlambat {
    background: #fef9c3;
    color: #854d0e;
  }
  .status-izin {
    background: #e0e7ff;
    color: #4338ca;
  }
  .status-sakit {
    background: #f3e8ff;
    color: #7e22ce;
  }
  .status-alpa {
    background: #fee2e2;
    color: #b91c1c;
  }

  /* EMPTY STATES */
  .empty-state {
    text-align: center;
    padding: 3rem 1.5rem;
  }
  .empty-icon-subtle {
    font-size: 2.2rem;
    margin-bottom: 0.5rem;
    opacity: 0.7;
  }
  .empty-title {
    margin: 0 0 0.25rem;
    font-size: 0.95rem;
    font-weight: 600;
    color: #334155;
  }
  .empty-desc {
    margin: 0;
    font-size: 0.82rem;
    color: #94a3b8;
  }

  .empty-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 3rem 1.5rem;
    text-align: center;
    color: #64748b;
  }
  .empty-icon {
    font-size: 2.5rem;
    margin-bottom: 0.5rem;
  }

  .alert {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.88rem;
  }
  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
  .alert-success {
    background: #dcfce7;
    color: #166534;
    border: 1px solid #bbf7d0;
  }
  .alert-close {
    background: transparent;
    border: none;
    font-size: 0.9rem;
    cursor: pointer;
    color: inherit;
  }
</style>
