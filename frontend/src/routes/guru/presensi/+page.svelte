<script>
  import { onMount } from 'svelte';
  import { auth } from '$lib/auth.svelte.js';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let activeTab = $state('riwayat'); // 'riwayat' atau 'izin'
  let loadingRiwayat = $state(true);
  let loadingIzin = $state(true);
  let errorMsg = $state('');

  let riwayatList = $state([]);
  let izinList = $state([]);

  let showIzinModal = $state(false);
  let isSubmitting = $state(false);

  // Form izin
  let formTanggalMulai = $state('');
  let formTanggalSelesai = $state('');
  let formJenis = $state('Izin');
  let formAlasan = $state('');

  async function fetchRiwayat() {
    loadingRiwayat = true;
    try {
      const res = await fetch(`${apiUrl}/api/guru/me/presensi/riwayat`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal mengambil riwayat presensi');
      riwayatList = await res.json();
    } catch (e) {
      errorMsg = e.message;
    } finally {
      loadingRiwayat = false;
    }
  }

  async function fetchIzin() {
    loadingIzin = true;
    try {
      const res = await fetch(`${apiUrl}/api/guru/me/presensi/izin`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal mengambil riwayat izin');
      izinList = await res.json();
    } catch (e) {
      errorMsg = e.message;
    } finally {
      loadingIzin = false;
    }
  }

  onMount(() => {
    fetchRiwayat();
    fetchIzin();
  });

  async function submitIzin(e) {
    e.preventDefault();
    if (!formTanggalMulai || !formTanggalSelesai || !formJenis || !formAlasan) {
      alert("Mohon lengkapi semua field yang diwajibkan.");
      return;
    }

    if (new Date(formTanggalSelesai) < new Date(formTanggalMulai)) {
      alert("Tanggal selesai tidak boleh sebelum tanggal mulai.");
      return;
    }

    isSubmitting = true;
    try {
      const res = await fetch(`${apiUrl}/api/guru/me/presensi/izin`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tanggal_mulai: formTanggalMulai,
          tanggal_selesai: formTanggalSelesai,
          jenis: formJenis,
          alasan: formAlasan
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal mengajukan izin');
      }

      showIzinModal = false;
      formTanggalMulai = '';
      formTanggalSelesai = '';
      formJenis = 'Izin';
      formAlasan = '';
      
      alert("Pengajuan izin berhasil dibuat. Menunggu persetujuan admin.");
      fetchIzin();

    } catch (e) {
      alert(e.message);
    } finally {
      isSubmitting = false;
    }
  }

  function getStatusColor(status) {
    if (status === 'Hadir') return '#22c55e';
    if (status === 'Izin') return '#eab308';
    if (status === 'Sakit') return '#3b82f6';
    if (status === 'Alpa') return '#ef4444';
    return '#64748b';
  }

  function getIzinStatusBadge(status) {
    if (status === 'Disetujui') return 'badge-success';
    if (status === 'Ditolak') return 'badge-error';
    return 'badge-warning';
  }
</script>

<div class="page-container">
  <div class="header">
    <h1 class="page-title">Presensi & Kehadiran</h1>
    <p class="page-subtitle">Pantau riwayat kehadiran Anda atau ajukan permohonan izin/sakit.</p>
  </div>

  <div class="tabs">
    <button class="tab {activeTab === 'riwayat' ? 'active' : ''}" onclick={() => activeTab = 'riwayat'}>
      <Icon name="clock" size={18} /> Riwayat Kehadiran
    </button>
    <button class="tab {activeTab === 'izin' ? 'active' : ''}" onclick={() => activeTab = 'izin'}>
      <Icon name="fileText" size={18} /> Pengajuan Izin
    </button>
  </div>

  {#if errorMsg}
    <div class="alert alert-error">{errorMsg}</div>
  {/if}

  <div class="card">
    {#if activeTab === 'riwayat'}
      <div class="tab-content">
        {#if loadingRiwayat}
          <div class="loading-state">Memuat riwayat kehadiran...</div>
        {:else if riwayatList.length === 0}
          <div class="empty-state">
            <Icon name="calendar" size={48} class="empty-icon" />
            <p>Belum ada riwayat presensi yang terekam.</p>
          </div>
        {:else}
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Jam Masuk</th>
                  <th>Jam Pulang</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {#each riwayatList as item}
                  <tr>
                    <td style="font-weight: 500;">
                      {new Date(item.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </td>
                    <td>{item.waktu_masuk || '--:--'}</td>
                    <td>{item.waktu_pulang || '--:--'}</td>
                    <td>
                      <span class="status-badge" style="background-color: {getStatusColor(item.status)}20; color: {getStatusColor(item.status)};">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}

    {#if activeTab === 'izin'}
      <div class="tab-content">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
          <h3 style="margin: 0;">Daftar Pengajuan Saya</h3>
          <button class="btn btn-primary" onclick={() => showIzinModal = true}>
            <Icon name="plus" size={16} /> Ajukan Izin Baru
          </button>
        </div>

        {#if loadingIzin}
          <div class="loading-state">Memuat data pengajuan...</div>
        {:else if izinList.length === 0}
          <div class="empty-state">
            <Icon name="inbox" size={48} class="empty-icon" />
            <p>Anda belum pernah mengajukan izin atau sakit.</p>
          </div>
        {:else}
          <div class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tgl Pengajuan</th>
                  <th>Tgl Izin</th>
                  <th>Jenis</th>
                  <th>Alasan</th>
                  <th>Status</th>
                  <th>Catatan Admin</th>
                </tr>
              </thead>
              <tbody>
                {#each izinList as izin}
                  <tr>
                    <td>{new Date(izin.created_at).toLocaleDateString('id-ID')}</td>
                    <td>
                      {new Date(izin.tanggal_mulai).toLocaleDateString('id-ID', {day:'numeric', month:'short'})} - 
                      {new Date(izin.tanggal_selesai).toLocaleDateString('id-ID', {day:'numeric', month:'short', year:'numeric'})}
                    </td>
                    <td style="font-weight: 500;">{izin.jenis}</td>
                    <td>{izin.alasan}</td>
                    <td>
                      <span class="status-badge {getIzinStatusBadge(izin.status)}">
                        {izin.status}
                      </span>
                    </td>
                    <td style="font-style: italic; color: #64748b;">
                      {izin.admin_catatan || '-'}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

{#if showIzinModal}
  <div class="modal-backdrop">
    <div class="modal card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="margin: 0;">Ajukan Permohonan</h3>
        <button class="btn-icon" onclick={() => showIzinModal = false} style="border:none; background:none; cursor:pointer;">
          <Icon name="x" size={20} />
        </button>
      </div>

      <form onsubmit={submitIzin}>
        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label for="tgl_mulai">Dari Tanggal *</label>
            <input type="date" id="tgl_mulai" class="form-input" bind:value={formTanggalMulai} required />
          </div>
          <div class="form-group" style="flex: 1;">
            <label for="tgl_selesai">Sampai Tanggal *</label>
            <input type="date" id="tgl_selesai" class="form-input" bind:value={formTanggalSelesai} required />
          </div>
        </div>

        <div class="form-group">
          <label for="jenis">Jenis Permohonan *</label>
          <select id="jenis" class="form-input" bind:value={formJenis} required>
            <option value="Izin">Izin (Keperluan Pribadi, Dinas, dll)</option>
            <option value="Sakit">Sakit</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 1.5rem;">
          <label for="alasan">Alasan / Keterangan *</label>
          <textarea id="alasan" class="form-input" bind:value={formAlasan} rows="3" placeholder="Sebutkan alasan secara jelas..." required></textarea>
        </div>

        <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 1rem;">
          <button type="button" class="btn btn-outline" onclick={() => showIzinModal = false}>Batal</button>
          <button type="submit" class="btn btn-primary" disabled={isSubmitting}>
            {#if isSubmitting}
              <Icon name="refreshCw" size={16} class="spin" />
            {/if}
            Kirim Pengajuan
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .page-container { display: flex; flex-direction: column; gap: 1.5rem; }
  .header { margin-bottom: 0.5rem; }
  .page-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.25rem 0; color: #1e293b; }
  .page-subtitle { color: #64748b; margin: 0; }

  .tabs { display: flex; gap: 1rem; border-bottom: 2px solid #e2e8f0; margin-bottom: 0.5rem; }
  .tab { 
    background: none; border: none; padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 600;
    color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;
    border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s;
  }
  .tab:hover { color: #334155; }
  .tab.active { color: #4f46e5; border-bottom-color: #4f46e5; }

  .card { background: white; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0; }
  
  .table-wrapper { overflow-x: auto; }
  .data-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
  .data-table th, .data-table td { padding: 1rem; border-bottom: 1px solid #e2e8f0; text-align: left; }
  .data-table th { font-weight: 600; color: #64748b; background: #f8fafc; }
  
  .status-badge { padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; display: inline-block; }
  .badge-success { background: #dcfce7; color: #166534; }
  .badge-error { background: #fee2e2; color: #991b1b; }
  .badge-warning { background: #fef9c3; color: #854d0e; }

  .btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 500; cursor: pointer; border: none; transition: all 0.2s; }
  .btn-primary { background: #4f46e5; color: white; }
  .btn-primary:hover { background: #4338ca; }
  .btn-outline { background: transparent; border: 1px solid #e2e8f0; color: #475569;}
  .btn:disabled { opacity: 0.7; cursor: not-allowed; }

  .form-row { display: flex; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;}
  .form-group label { font-size: 0.875rem; font-weight: 500; color: #64748b; }
  .form-input { padding: 0.75rem 1rem; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size:0.95rem;}

  .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
  .modal { width: 100%; max-width: 500px; background: white; max-height: 90vh; overflow-y: auto;}
  
  .empty-state { text-align: center; padding: 3rem 1rem; color: #64748b; }
  .empty-icon { color: #cbd5e1; margin-bottom: 1rem; }
  .loading-state { text-align: center; padding: 2rem; color: #64748b; }
  
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { 100% { transform: rotate(360deg); } }

  @media (max-width: 640px) {
    .form-row { flex-direction: column; gap: 0; }
  }
</style>
