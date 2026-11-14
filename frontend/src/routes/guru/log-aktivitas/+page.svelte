<script>
  import { onMount, untrack } from 'svelte';
  import { guruState } from '$lib/guruState.svelte.js';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let logs = $state([]);
  let teacherOptions = $state([]);
  let selectedGuruId = $state('');
  let teacherQuery = $state('');
  let showTeacherMenu = $state(false);
  let loading = $state(false);
  let errorMsg = $state('');
  let page = $state(1);
  let limit = $state(20);
  let hasMore = $state(true);

  let activeSekolahId = $derived(guruState.activeSekolahId);

  let filteredTeachers = $derived.by(() => {
    const q = teacherQuery.trim().toLowerCase();
    if (!q) return teacherOptions;
    return teacherOptions.filter((teacher) => teacher.nama_lengkap.toLowerCase().includes(q));
  });

  async function fetchTeacherOptions() {
    if (!activeSekolahId) {
      teacherOptions = [];
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/api/guru/log-aktivitas/guru?sekolah_id=${activeSekolahId}`, {
        credentials: 'include'
      });
      if (!res.ok) {
        teacherOptions = [];
        return;
      }
      const data = await res.json();
      teacherOptions = Array.isArray(data) ? data : [];
      if (!selectedGuruId && teacherOptions.length > 0) {
        teacherQuery = 'Semua guru';
      }
    } catch (e) {
      teacherOptions = [];
    }
  }

  async function fetchLogs(reset = false) {
    if (!activeSekolahId) return;
    if (reset) {
      page = 1;
      logs = [];
      hasMore = true;
    }

    if (!hasMore) return;

    loading = true;
    errorMsg = '';

    try {
      const qs = new URLSearchParams({
        sekolah_id: String(activeSekolahId),
        page: String(page),
        limit: String(limit)
      });
      if (selectedGuruId) {
        qs.set('guru_id', String(selectedGuruId));
      }

      const res = await fetch(`${apiUrl}/api/guru/log-aktivitas?${qs.toString()}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const body = await res.json();
        const newLogs = body.data || [];
        if (newLogs.length < limit) {
          hasMore = false;
        }
        logs = [...logs, ...newLogs];
      } else {
        const err = await res.json();
        errorMsg = err.message || 'Gagal mengambil log aktivitas';
      }
    } catch (e) {
      errorMsg = 'Kesalahan jaringan: ' + e.message;
    } finally {
      loading = false;
    }
  }

  function loadMore() {
    page += 1;
    fetchLogs();
  }

  function formatDate(isoString) {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  function getIconForAksi(aksi) {
    const lower = aksi.toLowerCase();
    if (lower.includes('hapus') || lower.includes('delete')) return 'trash';
    if (lower.includes('edit') || lower.includes('perbaru') || lower.includes('autosave')) return 'edit';
    if (lower.includes('tambah') || lower.includes('input') || lower.includes('create')) return 'plus';
    return 'info';
  }

  function getPelakuNama(log) {
    if (log?.guru?.nama_lengkap) return log.guru.nama_lengkap;
    if (log?.guru?.User?.nama_lengkap) return log.guru.User.nama_lengkap;
    if (log?.guru?.user?.nama_lengkap) return log.guru.user.nama_lengkap;
    if (log?.guru?.user?.email) return log.guru.user.email;
    return 'Guru';
  }

  function getLogSummary(log) {
    const aksi = (log?.aksi || 'Aktivitas').trim();
    const deskripsi = (log?.deskripsi || '').trim();
    const modul = log?.modul || 'Aktivitas';

    if (!deskripsi) return `${aksi} · ${modul}`;
    const prefix = deskripsi.toLowerCase().startsWith('mem') || deskripsi.toLowerCase().startsWith('meng') || deskripsi.toLowerCase().startsWith('men')
      ? deskripsi
      : `${aksi} · ${deskripsi}`;
    return `${modul}: ${prefix}`;
  }

  $effect(() => {
    if (activeSekolahId) {
      untrack(() => {
        fetchTeacherOptions();
        fetchLogs(true);
      });
    }
  });

  function selectTeacher(teacherId, nama) {
    selectedGuruId = teacherId;
    teacherQuery = nama;
    showTeacherMenu = false;
    fetchLogs(true);
  }
</script>

<div class="page-container">
  <div class="header">
    <div class="title-group">
      <h1>Log Aktivitas Guru</h1>
      <p>Rekam jejak aktivitas Anda di sistem.</p>
    </div>
  </div>

  {#if errorMsg}
    <div class="alert alert-error">
      <Icon name="alertTriangle" size={20} />
      <span>{errorMsg}</span>
    </div>
  {/if}

  <div class="filter-bar">
    <div class="teacher-picker">
      <input
        type="text"
        value={teacherQuery || 'Semua guru'}
        placeholder="Cari guru..."
        oninput={(event) => {
          teacherQuery = event.currentTarget.value;
          showTeacherMenu = true;
        }}
        onfocus={() => (showTeacherMenu = true)}
      />

      {#if showTeacherMenu}
        <div class="teacher-menu" role="listbox" aria-label="Daftar guru log">
          <button
            type="button"
            class:active={!selectedGuruId}
            onclick={() => {
              selectedGuruId = '';
              teacherQuery = 'Semua guru';
              showTeacherMenu = false;
              fetchLogs(true);
            }}
          >
            Semua guru
          </button>

          {#if filteredTeachers.length > 0}
            {#each filteredTeachers as teacher}
              <button
                type="button"
                class:active={String(teacher.id) === String(selectedGuruId)}
                onclick={() => selectTeacher(String(teacher.id), teacher.nama_lengkap)}
              >
                {teacher.nama_lengkap}
              </button>
            {/each}
          {:else}
            <div class="teacher-empty">Tidak ada guru yang cocok</div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <div class="log-container">
    {#if logs.length === 0 && !loading}
      <div class="empty-state">
        <Icon name="clock" size={48} />
        <p>Belum ada aktivitas yang terekam.</p>
      </div>
    {/if}

    <div class="timeline">
      {#each logs as log (log.id)}
        <div class="timeline-item">
          <div class="timeline-icon">
            <Icon name={getIconForAksi(log.aksi)} size={16} />
          </div>
          <div class="timeline-content card">
            <div class="log-header">
              <div class="header-left">
                <span class="log-module badge">{log.modul}</span>
                <span class="guru-name">
                  <Icon name="user" size={12} />
                  {getPelakuNama(log)}
                </span>
              </div>
              <span class="log-date">{formatDate(log.updated_at)}</span>
            </div>
            <h3 class="log-action">{log.aksi}</h3>
            <p class="log-desc">{getLogSummary(log)}</p>
          </div>
        </div>
      {/each}
    </div>

    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <span>Memuat log...</span>
      </div>
    {/if}

    {#if hasMore && !loading && logs.length > 0}
      <button class="btn-load-more" onclick={loadMore}>Muat Lebih Banyak</button>
    {/if}
  </div>
</div>

<style>
  .page-container {
    max-width: 800px;
    margin: 0 auto;
    padding-bottom: 2rem;
  }
  .filter-bar {
    margin-bottom: 1.25rem;
  }
  .teacher-picker {
    position: relative;
    max-width: 360px;
  }
  .teacher-picker input {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 0.75rem 0.9rem;
    font-size: 0.95rem;
    background: white;
  }
  .teacher-menu {
    position: absolute;
    top: calc(100% + 0.4rem);
    left: 0;
    right: 0;
    z-index: 20;
    max-height: 220px;
    overflow: auto;
    background: white;
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    box-shadow: 0 12px 26px rgba(15, 23, 42, 0.12);
  }
  .teacher-menu button {
    display: block;
    width: 100%;
    padding: 0.75rem 0.9rem;
    text-align: left;
    border: 0;
    border-bottom: 1px solid #f1f5f9;
    background: transparent;
    color: #1e293b;
    cursor: pointer;
  }
  .teacher-menu button:last-child {
    border-bottom: 0;
  }
  .teacher-menu button:hover,
  .teacher-menu button.active {
    background: #eff6ff;
  }
  .teacher-empty {
    padding: 0.8rem;
    color: #64748b;
    font-size: 0.85rem;
  }
  .header {
    margin-bottom: 2rem;
  }
  .title-group h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #1e293b;
  }
  .title-group p {
    margin: 0.2rem 0 0;
    color: #64748b;
  }
  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    padding: 1rem;
    border-radius: 0.5rem;
    border: 1px solid #fecaca;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .empty-state {
    text-align: center;
    padding: 4rem 1rem;
    color: #94a3b8;
  }
  .empty-state :global(svg) {
    margin-bottom: 1rem;
    opacity: 0.5;
  }
  
  .timeline {
    position: relative;
    padding-left: 24px;
  }
  
  .timeline::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 7px;
    width: 2px;
    background: #e2e8f0;
  }

  .timeline-item {
    position: relative;
    margin-bottom: 1.5rem;
  }

  .timeline-icon {
    position: absolute;
    left: -24px;
    top: 0;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #4f46e5;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 4px solid #f8fafc;
  }

  .card {
    background: white;
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }

  .log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }
  .header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  .guru-name {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: #475569;
    background: #f1f5f9;
    padding: 0.2rem 0.5rem;
    border-radius: 0.25rem;
  }
  .badge {
    background: #eef2ff;
    color: #4f46e5;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .log-date {
    font-size: 0.8rem;
    color: #64748b;
  }
  .log-action {
    margin: 0 0 0.5rem 0;
    font-size: 1.05rem;
    color: #1e293b;
  }
  .log-desc {
    margin: 0;
    font-size: 0.9rem;
    color: #475569;
    line-height: 1.4;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #64748b;
    padding: 1rem 0;
  }
  .spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid #e2e8f0;
    border-top-color: #4f46e5;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .btn-load-more {
    display: block;
    width: 100%;
    padding: 0.75rem;
    background: white;
    border: 1px dashed #cbd5e1;
    color: #4f46e5;
    font-weight: 600;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 1rem;
  }
  .btn-load-more:hover {
    background: #f8fafc;
    border-color: #94a3b8;
  }
</style>
