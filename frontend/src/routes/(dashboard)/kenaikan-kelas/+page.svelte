<script>
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let sekolahList = $state([]);
  let tahunAjaranList = $state([]);

  let selectedSekolahId = $state('');

  let kelasList = $state([]);
  let siswaList = $state([]);
  let searchQuery = $state('');

  let loading = $state(false);
  let processing = $state(false);
  let errorMessage = $state('');
  let successMessage = $state('');

  let activeTA = $derived(tahunAjaranList.find((t) => t.status === 'Active'));
  let nextTA = $derived(
    tahunAjaranList.find((t) => activeTA && t.tahun_awal === activeTA.tahun_awal + 1)
  );

  // { siswa_id: 'Naik Kelas' | 'Tinggal Kelas' }
  let statusSiswa = $state({});

  onMount(async () => {
    try {
      loading = true;
      const [resSek, resTA] = await Promise.all([
        fetch(`${apiUrl}/api/sekolah`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/tahun-ajaran`, { credentials: 'include' })
      ]);

      if (resSek.ok) {
        const payload = await resSek.json();
        sekolahList = payload.data || [];
      }
      if (resTA.ok) {
        tahunAjaranList = await resTA.json();
      }
    } catch (err) {
      console.error(err);
      errorMessage = 'Gagal memuat data master.';
    } finally {
      loading = false;
    }
  });

  async function onSekolahChange() {
    kelasList = [];
    siswaList = [];
    statusSiswa = {};
    searchQuery = '';
    if (!selectedSekolahId || !activeTA) return;

    try {
      loading = true;
      const [resK, resS] = await Promise.all([
        fetch(`${apiUrl}/api/sekolah/${selectedSekolahId}/kelas`, { credentials: 'include' }),
        fetch(
          `${apiUrl}/api/sekolah/${selectedSekolahId}/siswa?limit=10000&status=Aktif&tahun_ajaran_id=${activeTA.id}`,
          { credentials: 'include' }
        )
      ]);

      if (resK.ok) {
        kelasList = await resK.json();
      }
      if (resS.ok) {
        const payload = await resS.json();
        // Hanya proses siswa yang punya kelas_id (artinya mereka beneran sedang belajar di kelas, bukan di kolam belum rombel)
        siswaList = (payload.data || []).filter((s) => s.kelas_id && s.status === 'Aktif');

        let initial = {};
        for (let s of siswaList) {
          initial[s.id] = 'Naik Kelas';
        }
        statusSiswa = initial;
      }
    } catch (err) {
      console.error(err);
      errorMessage = 'Gagal memuat data.';
    } finally {
      loading = false;
    }
  }

  let groupedSiswa = $derived(() => {
    let map = {};
    // Inisialisasi map dengan kelas yang ada
    for (let k of kelasList) {
      map[k.id] = { kelas: k, siswa: [] };
    }

    // Kelompokkan siswa, filter dengan search query
    let q = searchQuery.toLowerCase();
    for (let s of siswaList) {
      if (q && !s.nama_lengkap.toLowerCase().includes(q) && !s.nisn.toLowerCase().includes(q))
        continue;

      if (map[s.kelas_id]) {
        map[s.kelas_id].siswa.push(s);
      }
    }

    // Sort array per kelas dan hapus kelas yang kosong
    let result = Object.values(map).filter((g) => g.siswa.length > 0);
    result.forEach((g) => {
      g.siswa.sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap));
    });
    // Sort kelas berdasarkan tingkat_level
    result.sort((a, b) => a.kelas.tingkat_level - b.kelas.tingkat_level);

    return result;
  });

  function toggleStatus(siswaId) {
    if (statusSiswa[siswaId] === 'Tinggal Kelas') {
      statusSiswa[siswaId] = 'Naik Kelas';
    } else {
      statusSiswa[siswaId] = 'Tinggal Kelas';
    }
  }

  async function prosesKenaikan() {
    if (!activeTA) {
      errorMessage = 'Tahun ajaran aktif tidak ditemukan.';
      return;
    }
    if (!nextTA) {
      errorMessage =
        'Tahun ajaran berikutnya belum dikonfigurasi. Buat tahun ajaran baru terlebih dahulu.';
      return;
    }

    processing = true;
    errorMessage = '';
    successMessage = '';

    try {
      const dataSiswaPayload = Object.entries(statusSiswa).map(([id, status_akhir]) => ({
        siswa_id: parseInt(id),
        status_akhir
      }));

      if (dataSiswaPayload.length === 0) {
        throw new Error('Tidak ada siswa untuk diproses.');
      }

      const res = await fetch(`${apiUrl}/api/siswa/kenaikan-kelas`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Sekolah-ID': selectedSekolahId.toString()
        },
        body: JSON.stringify({
          tahun_ajaran_id: activeTA.id,
          data_siswa: dataSiswaPayload
        }),
        credentials: 'include'
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || 'Gagal memproses kenaikan kelas');
      }

      successMessage =
        'Proses Kenaikan Kelas Berhasil! Siswa yang naik kelas sekarang berada di kolam (Belum dirombel).';

      // Refresh the view (students should disappear from this class context for this TA since they promoted)
      // Actually we are querying them for the current TA, their status_akhir might be updated to Naik Kelas.
      // So they are technically done for this TA. We can just clear the list.
      siswaList = [];
      statusSiswa = {};
      searchQuery = '';
    } catch (err) {
      errorMessage = err.message;
    } finally {
      processing = false;
    }
  }
</script>

<div class="page-container">
  <div class="header">
    <h2 class="title"><Icon name="trendingUp" size={24} /> Kenaikan Kelas</h2>
    <p class="subtitle">Kelola proses kenaikan kelas dan kelulusan siswa dengan mudah.</p>
  </div>

  {#if errorMessage}
    <div class="alert error"><Icon name="alertCircle" size={20} /> {errorMessage}</div>
  {/if}
  {#if successMessage}
    <div class="alert success"><Icon name="checkCircle" size={20} /> {successMessage}</div>
  {/if}
  {#if !nextTA && activeTA && !loading}
    <div class="alert warning">
      <Icon name="alertTriangle" size={20} /> <strong>Perhatian:</strong> Tahun Ajaran Ganjil berikutnya
      belum dibuat. Anda tidak dapat melakukan kenaikan kelas.
    </div>
  {/if}

  <div class="card">
    <div class="filters">
      <div class="form-group">
        <label>Sekolah</label>
        <select
          class="form-select"
          bind:value={selectedSekolahId}
          onchange={onSekolahChange}
          disabled={loading || processing}
        >
          <option value="">-- Pilih Sekolah --</option>
          {#each sekolahList as sek (sek.id)}
            <option value={sek.id}>{sek.nama_sekolah}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label>Tahun Ajaran Asal</label>
        <input
          type="text"
          class="form-input"
          disabled
          value={activeTA ? activeTA.nama_tahun : 'Memuat...'}
        />
      </div>

      <div class="form-group" style="flex: 2;">
        <label>Cari Siswa</label>
        <div style="position: relative;">
          <Icon
            name="search"
            size={18}
            style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #94a3b8;"
          />
          <input
            type="text"
            class="form-input"
            style="padding-left: 2.75rem;"
            bind:value={searchQuery}
            disabled={loading || processing || siswaList.length === 0}
            placeholder="Cari nama atau NISN..."
          />
        </div>
      </div>
    </div>
  </div>

  {#if loading}
    <div class="loading"><Icon name="loader" size={24} /> Memuat data...</div>
  {/if}

  {#if selectedSekolahId && !loading && siswaList.length > 0}
    <div class="card">
      <div class="card-header">
        <h3>Daftar Siswa {sekolahList.find((s) => s.id == selectedSekolahId)?.nama_sekolah}</h3>
        <p class="muted">
          Pencarian dan penandaan dilakukan untuk seluruh kelas sekaligus. Siswa yang tidak ditandai
          akan otomatis Naik Kelas / Lulus.
        </p>
      </div>

      <div class="table-container">
        <table class="siswa-table">
          <thead>
            <tr>
              <th>Kelas Asal</th>
              <th>Nama Siswa</th>
              <th>Status Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each groupedSiswa() as group (group.kelas.id)}
              <tr class="kelas-header-row">
                <td colspan="3">
                  <strong
                    >Level {group.kelas.tingkat_level} - {group.kelas.tingkat}
                    {group.kelas.nama_kelas}</strong
                  >
                  <span class="badge-count">{group.siswa.length} Siswa</span>
                </td>
              </tr>
              {#each group.siswa as s (s.id)}
                <tr class:is-tinggal={statusSiswa[s.id] === 'Tinggal Kelas'}>
                  <td class="muted-text">{s.nisn}</td>
                  <td class="nama">{s.nama_lengkap}</td>
                  <td>
                    <label class="toggle-container">
                      <input
                        type="checkbox"
                        checked={statusSiswa[s.id] === 'Tinggal Kelas'}
                        onchange={() => toggleStatus(s.id)}
                      />
                      <span
                        class="toggle-btn {statusSiswa[s.id] === 'Tinggal Kelas'
                          ? 'btn-red'
                          : 'btn-green'}"
                      >
                        {#if statusSiswa[s.id] === 'Tinggal Kelas'}
                          <Icon name="xCircle" size={16} /> Tinggal Kelas
                        {:else}
                          <Icon name="checkCircle" size={16} /> Naik Kelas
                        {/if}
                      </span>
                    </label>
                  </td>
                </tr>
              {/each}
            {/each}
            {#if groupedSiswa().length === 0 && searchQuery}
              <tr>
                <td colspan="3" style="text-align: center; padding: 3rem;">
                  Pencarian "<strong>{searchQuery}</strong>" tidak ditemukan.
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>

      <div class="card-footer">
        <button
          class="btn-primary btn-large"
          onclick={prosesKenaikan}
          disabled={processing || !nextTA || statusSiswa.length === 0}
        >
          {processing ? 'Memproses Seluruh Sekolah...' : 'Eksekusi Kenaikan Kelas Se-Sekolah'}
          <Icon name="arrowRight" size={18} />
        </button>
      </div>
    </div>
  {:else if selectedSekolahId && !loading && siswaList.length === 0}
    <div class="empty-state">
      <Icon name="users" size={48} />
      <p>Tidak ada siswa aktif (belum diproses) di sekolah ini pada Tahun Ajaran yang aktif.</p>
    </div>
  {/if}
</div>

<style>
  .page-container {
    max-width: 1000px;
    margin: 0 auto;
    font-family: inherit;
  }
  .header {
    margin-bottom: 2rem;
  }
  .title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.75rem;
    color: #1e293b;
    margin: 0 0 0.5rem 0;
  }
  .subtitle {
    color: #64748b;
    margin: 0;
  }

  .alert {
    padding: 1rem 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-weight: 500;
  }
  .error {
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
  }
  .success {
    background: #f0fdf4;
    color: #15803d;
    border: 1px solid #86efac;
  }
  .warning {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fcd34d;
  }

  .card {
    background: white;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
    overflow: hidden;
  }
  .filters {
    display: flex;
    gap: 1.5rem;
    padding: 1.5rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }
  .form-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .form-group label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
  }
  .form-select,
  .form-input {
    padding: 0.6rem 1rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.95rem;
    outline: none;
    background: white;
  }
  .form-select:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  .form-input:disabled {
    background: #e2e8f0;
    color: #475569;
  }

  .card-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }
  .card-header h3 {
    margin: 0 0 0.25rem 0;
    color: #1e293b;
  }
  .card-header .muted {
    margin: 0;
    color: #64748b;
    font-size: 0.9rem;
  }

  .table-container {
    width: 100%;
    overflow-x: auto;
  }
  .siswa-table {
    width: 100%;
    border-collapse: collapse;
  }
  .siswa-table th,
  .siswa-table td {
    padding: 1rem 1.5rem;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }
  .siswa-table th {
    background: #f8fafc;
    font-weight: 600;
    color: #475569;
    font-size: 0.875rem;
    text-transform: uppercase;
  }
  .siswa-table .nama {
    font-weight: 600;
    color: #1e293b;
  }

  .kelas-header-row td {
    background: #f1f5f9;
    color: #334155;
    font-size: 0.95rem;
    padding: 0.75rem 1.5rem;
  }
  .badge-count {
    background: white;
    padding: 0.15rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    margin-left: 0.5rem;
    border: 1px solid #cbd5e1;
    color: #64748b;
  }
  .muted-text {
    color: #64748b;
  }
  .is-tinggal {
    background: #fef2f2;
  }

  .toggle-container {
    display: inline-flex;
    cursor: pointer;
  }
  .toggle-container input {
    display: none;
  }
  .toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    transition: 0.2s;
  }
  .btn-green {
    background: rgba(34, 197, 94, 0.1);
    color: #16a34a;
    border: 1px solid #bbf7d0;
  }
  .btn-red {
    background: #fee2e2;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .card-footer {
    padding: 1.5rem;
    display: flex;
    justify-content: flex-end;
    background: #f8fafc;
    border-top: 1px solid #e2e8f0;
  }
  .btn-primary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s;
  }
  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-large {
    font-size: 1rem;
    padding: 1rem 2rem;
  }

  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #64748b;
    padding: 2rem;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: #94a3b8;
    background: white;
    border-radius: 12px;
    border: 1px dashed #cbd5e1;
  }
  .empty-state p {
    margin-top: 1rem;
    font-size: 1.1rem;
  }
</style>
