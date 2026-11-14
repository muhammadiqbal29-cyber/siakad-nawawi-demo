<script>
  import { toastStore } from '$lib/toast.svelte.js';
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  const guruId = $page.params.id;

  let formData = $state({
    nama_lengkap: '',
    email: '',
    password: '', // Optional when editing
    nik: '',
    no_hp: '',
    jam_masuk: '07:00',
    jam_pulang: '16:00',
    status_aktif: true
  });

  let loading = $state(false);
  let pageLoading = $state(true);
  let errorMsg = $state('');

  let sekolahList = $state([]);
  let aksesMap = $state({});

  onMount(async () => {
    await loadSekolahData();
    await loadGuruData();
  });

  async function loadSekolahData() {
    try {
      const res = await fetch(`${apiUrl}/api/sekolah?limit=100`, { credentials: 'include' });
      if (res.ok) {
        const body = await res.json();
        sekolahList = body.data || [];
      }
    } catch (e) {
      console.error('Gagal mengambil data sekolah', e);
    }
  }

  async function loadGuruData() {
    try {
      const res = await fetch(`${apiUrl}/api/guru/${guruId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        formData.nama_lengkap = data.nama_lengkap;
        formData.email = data.user?.email || '';
        formData.nik = data.nik || '';
        formData.no_hp = data.no_hp || '';
        formData.jam_masuk = data.jam_masuk || '';
        formData.jam_pulang = data.jam_pulang || '';
        formData.status_aktif = data.status_aktif;

        try {
          if (data.akses_sekolah) {
            const parsedSekolah = JSON.parse(data.akses_sekolah);
            if (typeof parsedSekolah === 'object' && parsedSekolah !== null && !Array.isArray(parsedSekolah)) {
              // Bersihkan data lama: jika ada input_tahfiz/tasmi yang tersembunyi, ubah jadi paket_alquran
              const migratedMap = {};
              for (const [sekId, fiturs] of Object.entries(parsedSekolah)) {
                let hasPaket = fiturs.includes('paket_alquran');
                const newFiturs = fiturs.filter(f => {
                  if (f.startsWith('input_tahfiz') || f.startsWith('input_tasmi')) {
                    hasPaket = true;
                    return false;
                  }
                  return true;
                });
                if (hasPaket && !newFiturs.includes('paket_alquran')) {
                  newFiturs.push('paket_alquran');
                }
                migratedMap[sekId] = newFiturs;
              }
              aksesMap = migratedMap;
            } else {
              aksesMap = {};
            }
          }
        } catch {
          aksesMap = {};
        }
      } else {
        errorMsg = 'Gagal memuat data guru';
      }
    } catch (e) {
      errorMsg = 'Kesalahan jaringan: ' + e.message;
    } finally {
      pageLoading = false;
    }
  }

  function getSekolahFitur(fiturStr) {
    try {
      const arr = JSON.parse(fiturStr);
      if (!Array.isArray(arr)) return [];
      return arr.filter(f => !f.startsWith('input_tahfiz') && !f.startsWith('input_tasmi'));
    } catch {
      return [];
    }
  }

  function toggleSekolah(id, sekolahFitur) {
    const current = aksesMap[id] || [];
    const isFullyChecked =
      sekolahFitur.length > 0 ? sekolahFitur.every((f) => current.includes(f)) : current.length > 0;

    if (isFullyChecked) {
      const newMap = { ...aksesMap };
      delete newMap[id];
      aksesMap = newMap;
    } else {
      aksesMap = { ...aksesMap, [id]: [...sekolahFitur] };
    }
  }

  function toggleFiturSekolah(sekolahId, fiturId) {
    let current = aksesMap[sekolahId] || [];
    if (current.includes(fiturId)) {
      current = current.filter((f) => f !== fiturId);
    } else {
      current = [...current, fiturId];
    }

    if (current.length === 0) {
      const newMap = { ...aksesMap };
      delete newMap[sekolahId];
      aksesMap = newMap;
    } else {
      aksesMap = {
        ...aksesMap,
        [sekolahId]: current
      };
    }
  }

  function isSekolahFullyChecked(id, sekolahFitur) {
    const current = aksesMap[id];
    if (!current) return false;
    if (sekolahFitur.length === 0) return true;
    return sekolahFitur.every((f) => current.includes(f));
  }

  function setIndeterminate(node, isIndet) {
    node.indeterminate = isIndet;
    return {
      update(newIsIndet) {
        node.indeterminate = newIsIndet;
      }
    };
  }

  function isSekolahIndeterminate(id, sekolahFitur) {
    const current = aksesMap[id];
    if (!current || current.length === 0) return false;
    if (sekolahFitur.length === 0) return false;
    return current.length > 0 && current.length < sekolahFitur.length;
  }

  function getFiturLabel(id) {
    if (id === 'paket_alquran') return "Paket Al-Qur'an (Tahfiz, Tasmi, Kelulusan)";
    if (id === 'input_diniyah') return 'Input Nilai Diniyah';
    if (id === 'rapor_keseharian') return 'Rapor Keseharian';
    if (id === 'konfigurasi_materi') return 'Konfigurasi Materi';
    if (id === 'log_aktivitas') return 'Log Aktivitas Guru';
    if (id === 'presensi_manager') return 'Pengelola Absensi';
    return id;
  }

  function getFiturDesc(id) {
    if (id === 'paket_alquran') return "Bisa menginput dan mengubah nilai Tahfiz, Tasmi', dan ujian kelulusan Al-Qur'an.";
    if (id === 'input_diniyah')
      return 'Bisa menginput dan mengubah nilai mata pelajaran diniyah siswa.';
    if (id === 'rapor_keseharian')
      return 'Bisa memantau dan mengisi catatan keseharian siswa.';
    if (id === 'konfigurasi_materi')
      return 'Bisa mengelola daftar materi tahfiz dan mapel diniyah.';
    if (id === 'log_aktivitas')
      return 'Bisa melihat riwayat aktivitas (tambah, edit, hapus) guru di sekolah ini.';
    if (id === 'presensi_manager') return 'Bisa memeriksa riwayat dan membuat absensi bulanan di sekolah ini.';
    return '';
  }

  async function submitForm(e) {
    e.preventDefault();
    loading = true;
    errorMsg = '';

    const payload = {
      ...formData,
      akses_fitur: '[]',
      akses_sekolah: JSON.stringify(aksesMap)
    };

    try {
      const res = await fetch(`${apiUrl}/api/guru/${guruId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (res.ok) {
        toastStore.show('Berhasil menyimpan pembaruan guru', 'info');
        goto('/admin/guru');
      } else {
        const data = await res.json().catch(() => ({}));
        errorMsg = data.message || 'Gagal menyimpan data';
      }
    } catch (err) {
      errorMsg = err.message || 'Terjadi kesalahan jaringan';
    } finally {
      loading = false;
    }
  }
</script>

<div class="page-container">
  <div class="header">
    <div class="title-group">
      <button class="btn-back" onclick={() => goto('/admin/guru')}>
        <Icon name="arrowLeft" size={20} />
      </button>
      <div>
        <h1>Edit Guru</h1>
        <p>Perbarui informasi atau hak akses untuk guru ini.</p>
      </div>
    </div>
  </div>

  {#if errorMsg}
    <div class="alert alert-error">{errorMsg}</div>
  {/if}

  {#if pageLoading}
    <div class="loading">Memuat data...</div>
  {:else}
    <form onsubmit={submitForm} class="form-grid">
      <div class="card">
        <h2>Informasi Pribadi & Akun</h2>

        <div class="form-group">
          <label for="nama">Nama Lengkap</label>
          <input
            type="text"
            id="nama"
            class="form-input"
            bind:value={formData.nama_lengkap}
            required
          />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="email">Email Login</label>
            <input
              type="email"
              id="email"
              class="form-input"
              bind:value={formData.email}
              required
            />
          </div>
          <div class="form-group">
            <label for="password">Password (Opsional)</label>
            <input
              type="password"
              id="password"
              class="form-input"
              bind:value={formData.password}
              placeholder="Kosongkan jika tidak ingin mengubah"
            />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="nik">NIK / NIP</label>
            <input type="text" id="nik" class="form-input" bind:value={formData.nik} />
          </div>
          <div class="form-group">
            <label for="no_hp">Nomor HP</label>
            <input type="text" id="no_hp" class="form-input" bind:value={formData.no_hp} />
          </div>
        </div>

        <div class="form-group">
          <label class="checkbox-simple">
            <input type="checkbox" bind:checked={formData.status_aktif} />
            Akun Aktif (Bisa Login)
          </label>
        </div>
      </div>

      <div class="card">
        <h2>Pengaturan Jam Kerja</h2>
        <p class="subtitle">Jam spesifik untuk fitur Presensi Mandiri guru ini.</p>

        <div class="form-row time-row">
          <div class="form-group">
            <label for="jam_masuk">Jam Masuk</label>
            <input type="time" id="jam_masuk" class="form-input" bind:value={formData.jam_masuk} />
          </div>
          <div class="form-group">
            <label for="jam_pulang">Jam Pulang</label>
            <input
              type="time"
              id="jam_pulang"
              class="form-input"
              bind:value={formData.jam_pulang}
            />
          </div>
        </div>
      </div>

      <div class="card full-width">
        <h2>Hak Akses Jenjang</h2>
        <p class="subtitle">
          Centang jenjang sekolah sebagai induk. Guru ini akan bisa mengakses fitur sesuai dengan
          pengaturan sekolah.
        </p>

        <div class="nested-grid">
          {#each sekolahList as sekolah (sekolah.id)}
            {@const sFiturRaw = getSekolahFitur(sekolah.fitur)}
            {@const sFitur = [...sFiturRaw, 'presensi_manager']}
            <div class="school-group {aksesMap[sekolah.id] ? 'active-group' : ''}">
              <label class="checkbox-card main-school-card">
                <input
                  type="checkbox"
                  checked={isSekolahFullyChecked(sekolah.id, sFitur)}
                  use:setIndeterminate={isSekolahIndeterminate(sekolah.id, sFitur)}
                  onchange={() => toggleSekolah(sekolah.id, sFitur)}
                />
                <div class="checkbox-text">
                  <span class="title">{sekolah.nama_sekolah}</span>
                  <span class="desc">{sekolah.tingkatan}</span>
                </div>
              </label>

              {#if sFitur.length > 0}
                <div class="features-list">
                  {#each sFitur as fiturId (fiturId)}
                    <label
                      class="checkbox-card feature-card {aksesMap[sekolah.id]?.includes(fiturId)
                        ? 'active-feature'
                        : ''}"
                    >
                      <input
                        type="checkbox"
                        checked={aksesMap[sekolah.id]?.includes(fiturId)}
                        onchange={() => toggleFiturSekolah(sekolah.id, fiturId)}
                      />
                      <div class="checkbox-text">
                        <span class="title">{getFiturLabel(fiturId)}</span>
                        <span class="desc">{getFiturDesc(fiturId)}</span>
                      </div>
                    </label>
                  {/each}
                </div>
              {/if}
            </div>
          {:else}
            <p class="subtitle">Memuat data sekolah...</p>
          {/each}
        </div>
      </div>

      <div class="form-actions full-width">
        <button type="button" class="btn-cancel" onclick={() => goto('/admin/guru')}>Batal</button>
        <button type="submit" class="btn-submit" disabled={loading}>
          {loading ? 'Menyimpan...' : 'Simpan Pembaruan'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  /* Reuse styles from tambah guru */
  .page-container {
    padding: 1.5rem;
    max-width: 900px;
    margin: 0 auto;
  }
  .header {
    margin-bottom: 2rem;
  }
  .title-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .btn-back {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 1px solid #e2e8f0;
    background: white;
    cursor: pointer;
    color: #475569;
    transition: all 0.2s;
  }
  .btn-back:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #0f172a;
  }
  .title-group p {
    margin: 0.2rem 0 0;
    color: #64748b;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  .card {
    background: white;
    padding: 1.5rem;
    border-radius: 1rem;
    border: 1px solid #e2e8f0;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  }
  .card h2 {
    margin: 0 0 1rem;
    font-size: 1.15rem;
    color: #1e293b;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 0.75rem;
  }
  .subtitle {
    margin-top: -0.75rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
    color: #64748b;
  }

  .form-group {
    margin-bottom: 1rem;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  label {
    display: block;
    margin-bottom: 0.4rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #334155;
  }
  .form-input {
    width: 100%;
    padding: 0.65rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid #cbd5e1;
    background: #f8fafc;
    color: #0f172a;
    font-family: inherit;
    font-size: 0.95rem;
    transition: all 0.2s;
    box-sizing: border-box;
  }
  .form-input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
  }
  .checkbox-simple {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: 500;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    margin-top: 0.5rem;
  }
  .btn-submit {
    background: #4f46e5;
    color: white;
    border: none;
    padding: 0.75rem 2rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-submit:hover:not(:disabled) {
    background: #4338ca;
  }
  .btn-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-cancel {
    background: white;
    color: #475569;
    border: 1px solid #cbd5e1;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-cancel:hover {
    background: #f1f5f9;
  }
  .alert-error {
    background: #fee2e2;
    color: #991b1b;
    padding: 1rem;
    border-radius: 0.5rem;
    border: 1px solid #fecaca;
    margin-bottom: 1.5rem;
  }
  .loading {
    text-align: center;
    padding: 3rem;
    color: #64748b;
  }

  /* Nested Checkbox Styles */
  .nested-grid {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    margin-top: 1rem;
  }
  .school-group {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 1rem;
    padding: 1.25rem;
    transition: all 0.2s ease;
  }
  .school-group.active-group {
    border-color: #cbd5e1;
    box-shadow: 0 4px 15px -3px rgba(0, 0, 0, 0.03);
    background: #f8fafc;
  }
  .checkbox-card {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    cursor: pointer;
    border-radius: 0.75rem;
    transition: all 0.2s ease;
  }
  .checkbox-card input[type='checkbox'] {
    margin-top: 0.2rem;
    width: 1.15rem;
    height: 1.15rem;
    accent-color: #4f46e5;
    cursor: pointer;
  }
  .main-school-card {
    padding: 0.5rem;
  }
  .features-list {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px dashed #cbd5e1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 1rem;
  }
  .feature-card {
    background: #ffffff;
    border: 2px solid #e2e8f0;
    padding: 1rem;
  }
  .feature-card:hover {
    border-color: #cbd5e1;
    background: #f1f5f9;
  }
  .feature-card.active-feature {
    border-color: #6366f1;
    background: #eef2ff;
  }
  .checkbox-text {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .checkbox-text .title {
    font-weight: 700;
    color: #1e293b;
    font-size: 0.95rem;
    line-height: 1.2;
  }
  .checkbox-text .desc {
    font-size: 0.85rem;
    color: #64748b;
    line-height: 1.4;
  }

  @media (min-width: 768px) {
    .form-grid {
      grid-template-columns: 2fr 1fr;
    }
    .full-width {
      grid-column: 1 / -1;
    }
    .time-row {
      grid-template-columns: 1fr;
    }
  }
</style>
