<script>
  import { onMount, onDestroy } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  // State Management
  let activeTab = $state('sekolah');
  let errorMessage = $state('');
  let selectedSchool = $state(null);
  let showKopSuratModal = $state(false);

  let enablePaketAlquran = $state(false);
  let versiPenilaian = $state('v1');
  let successMessage = $state('');
  let loading = $state(false);

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  let abortController = new AbortController();

  // === State Sekolah ===
  let sekolahData = $state([]);
  let showModalSekolahCreate = $state(false);
  let showModalSekolahEdit = $state(false);
  let showModalSekolahDelete = $state(false);
  let currentSekolah = $state(null);
  let savingSekolah = $state(false);
  let sekolahMeta = $state(null);
  let sekolahPage = $state(1);
  let sekolahSearch = $state('');

  let sekolahForm = $state({
    id: 0,
    nama_sekolah: '',
    npsn: '',
    jenjang: 'SD',
    status: 'Negeri',
    alamat: '',
    kode_pos: '',
    email: '',
    website: '',
    kepala_sekolah: '',
    fitur: []
  });

  // === State Tahun Ajaran ===
  let taData = $state([]);
  let showModalTACreate = $state(false);
  let showModalTADelete = $state(false);
  let currentTA = $state(null);
  let savingTA = $state(false);

  let taForm = $state({
    tahun_awal: ''
  });

  // === Fetch Data ===
  async function loadData() {
    loading = true;
    errorMessage = '';

    try {
      const query = new URLSearchParams({
        page: sekolahPage.toString(),
        limit: '10',
        search: sekolahSearch
      }).toString();
      const [resSekolah, resTA] = await Promise.all([
        fetch(`${apiUrl}/api/sekolah?${query}`, {
          credentials: 'include',
          signal: abortController.signal
        }),
        fetch(`${apiUrl}/api/tahun-ajaran`, {
          credentials: 'include',
          signal: abortController.signal
        })
      ]);

      if (resSekolah.ok) {
        const body = await resSekolah.json();
        if (body.data) {
          sekolahData = body.data;
          sekolahMeta = body.meta;
        } else {
          sekolahData = body;
        }
      } else if (resSekolah.status === 401 || resSekolah.status === 403) {
        errorMessage = 'Akses ditolak. Anda tidak memiliki izin Admin.';
      }

      if (resTA.ok) {
        const taResp = await resTA.json();
        taData = taResp || [];
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        errorMessage = 'Koneksi ke server gagal.';
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    void loadData();
  });

  onDestroy(() => {
    abortController.abort();
  });

  function clearMessages() {
    errorMessage = '';
    successMessage = '';
  }

  function setTimeoutMessage(msg, isError = false) {
    if (isError) errorMessage = msg;
    else successMessage = msg;
    setTimeout(() => clearMessages(), 3000);
  }

  // === Handlers Sekolah ===
  function resetSekolahForm() {
    sekolahForm = {
      id: 0,
      nama_sekolah: '',
      npsn: '',
      jenjang: 'SD',
      status: 'Negeri',
      alamat: '',
      kode_pos: '',
      email: '',
      website: '',
      kepala_sekolah: '',
      fitur: []
    };
  }

  function openCreateSekolah() {
    resetSekolahForm();
    enablePaketAlquran = false;
    versiPenilaian = 'v1';
    showModalSekolahCreate = true;
  }

  function openEditSekolah(s) {
    let parsedFitur = [];
    try {
      if (s.fitur) parsedFitur = JSON.parse(s.fitur);
    } catch {}
    sekolahForm = { ...s, fitur: parsedFitur };
    enablePaketAlquran = parsedFitur.includes('paket_alquran') || parsedFitur.includes('input_tahfiz') || parsedFitur.includes('input_tahfiz_v2');
    versiPenilaian = (parsedFitur.includes('input_tahfiz_v2') || parsedFitur.includes('input_tasmi_v2')) ? 'v2' : 'v1';
    showModalSekolahEdit = true;
  }

  function openDeleteSekolah(s) {
    currentSekolah = s;
    showModalSekolahDelete = true;
  }

  async function handleSaveSekolah() {
    savingSekolah = true;
    try {
      sekolahForm.fitur = sekolahForm.fitur.filter(f => !f.startsWith('input_tahfiz') && !f.startsWith('input_tasmi') && f !== 'paket_alquran');
      if (enablePaketAlquran) {
        sekolahForm.fitur.push('paket_alquran');
        sekolahForm.fitur.push(versiPenilaian === 'v2' ? 'input_tahfiz_v2' : 'input_tahfiz');
        sekolahForm.fitur.push(versiPenilaian === 'v2' ? 'input_tasmi_v2' : 'input_tasmi');
      }
      const payload = { ...sekolahForm, fitur: JSON.stringify(sekolahForm.fitur) };
      const res = await fetch(`${apiUrl}/api/sekolah`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (res.ok) {
        showModalSekolahCreate = false;
        setTimeoutMessage('Unit sekolah berhasil ditambahkan.');
        await loadData();
      } else {
        const body = await res.json();
        errorMessage = body.message || 'Gagal menyimpan data.';
      }
    } catch {
      errorMessage = 'Koneksi ke server gagal.';
    } finally {
      savingSekolah = false;
    }
  }

  async function handleUpdateSekolah() {
    savingSekolah = true;
    try {
      sekolahForm.fitur = sekolahForm.fitur.filter(f => !f.startsWith('input_tahfiz') && !f.startsWith('input_tasmi') && f !== 'paket_alquran');
      if (enablePaketAlquran) {
        sekolahForm.fitur.push('paket_alquran');
        sekolahForm.fitur.push(versiPenilaian === 'v2' ? 'input_tahfiz_v2' : 'input_tahfiz');
        sekolahForm.fitur.push(versiPenilaian === 'v2' ? 'input_tasmi_v2' : 'input_tasmi');
      }
      const payload = { ...sekolahForm, fitur: JSON.stringify(sekolahForm.fitur) };
      const res = await fetch(`${apiUrl}/api/sekolah/${sekolahForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (res.ok) {
        showModalSekolahEdit = false;
        setTimeoutMessage('Data sekolah berhasil diperbarui.');
        await loadData();
      } else {
        const body = await res.json();
        errorMessage = body.message || 'Gagal memperbarui data.';
      }
    } catch {
      errorMessage = 'Koneksi ke server gagal.';
    } finally {
      savingSekolah = false;
    }
  }

  async function handleDeleteSekolah() {
    try {
      const res = await fetch(`${apiUrl}/api/sekolah/${currentSekolah.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        showModalSekolahDelete = false;
        setTimeoutMessage('Data sekolah berhasil dihapus.');
        await loadData();
      } else {
        const body = await res.json();
        errorMessage = body.message || 'Gagal menghapus data sekolah.';
      }
    } catch {
      errorMessage = 'Terjadi kesalahan sistem.';
    }
  }

  // === Handlers Tahun Ajaran ===
  function resetTAForm() {
    taForm = { tahun_awal: '' };
  }

  function openCreateTA() {
    resetTAForm();
    showModalTACreate = true;
  }

  function openDeleteTA(ta) {
    currentTA = ta;
    showModalTADelete = true;
  }

  async function handleSaveTA() {
    savingTA = true;
    if (!taForm.tahun_awal) {
      errorMessage = 'Tahun Awal wajib diisi.';
      savingTA = false;
      return;
    }

    let payload = { tahun_awal: parseInt(taForm.tahun_awal) };

    try {
      const res = await fetch(`${apiUrl}/api/tahun-ajaran`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      if (res.ok) {
        showModalTACreate = false;
        setTimeoutMessage('Tahun ajaran berhasil ditambahkan.');
        await loadData();
      } else {
        const body = await res.json();
        errorMessage = body.message || 'Gagal menyimpan tahun ajaran.';
      }
    } catch {
      errorMessage = 'Koneksi ke server gagal.';
    } finally {
      savingTA = false;
    }
  }

  async function handleActivateSemester(sem, ta) {
    try {
      const res = await fetch(`${apiUrl}/api/semester/${sem.id}/activate`, {
        method: 'PUT',
        credentials: 'include'
      });
      if (res.ok) {
        setTimeoutMessage(
          `Semester ${sem.tipe_semester} untuk Tahun Ajaran ${ta.nama_tahun} berhasil diaktifkan.`
        );
        window.dispatchEvent(
          new CustomEvent('tahunAjaranChanged', {
            detail: `${ta.nama_tahun} - ${sem.tipe_semester}`
          })
        );
        await loadData();
      } else {
        errorMessage = 'Gagal mengaktifkan semester.';
      }
    } catch {
      errorMessage = 'Terjadi kesalahan sistem.';
    }
  }

  async function handleDeleteTA() {
    try {
      const res = await fetch(`${apiUrl}/api/tahun-ajaran/${currentTA.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        showModalTADelete = false;
        setTimeoutMessage('Tahun ajaran berhasil dihapus.');
        await loadData();
      } else {
        const body = await res.json();
        errorMessage = body.message || 'Gagal menghapus tahun ajaran.';
      }
    } catch {
      errorMessage = 'Terjadi kesalahan sistem.';
    }
  }
</script>

<div class="master-container">
  <div class="tabs-header">
    <button
      class="tab-btn"
      class:active={activeTab === 'sekolah'}
      onclick={() => {
        activeTab = 'sekolah';
        clearMessages();
      }}
    >
      Data Unit Sekolah
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === 'tahun_ajaran'}
      onclick={() => {
        activeTab = 'tahun_ajaran';
        clearMessages();
      }}
    >
      Tahun Ajaran
    </button>
  </div>

  {#if errorMessage}
    <div class="alert-banner error">{errorMessage}</div>
  {/if}
  {#if successMessage}
    <div class="alert-banner success">{successMessage}</div>
  {/if}
  {#if loading}
    <div class="alert-banner">Memuat data dari backend...</div>
  {/if}

  <!-- TAB: SEKOLAH -->
  {#if activeTab === 'sekolah'}
    <div class="header-action">
      <div>
        <h2 class="page-title">Data Unit Sekolah</h2>
        <p class="page-subtitle">Daftar jenjang atau unit pendidikan di bawah naungan yayasan.</p>
      </div>
      <div style="display: flex; gap: 1rem; align-items: center;">
        <input
          type="text"
          class="form-input"
          placeholder="Cari nama/NPSN..."
          bind:value={sekolahSearch}
          onkeydown={(e) => {
            if (e.key === 'Enter') {
              sekolahPage = 1;
              loadData();
            }
          }}
          style="width: 250px;"
        />
        <button class="btn-primary" onclick={openCreateSekolah}>
          <Icon name="plus" size={16} /> Tambah Unit Sekolah
        </button>
      </div>
    </div>

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>NPSN</th>
            <th>Nama Sekolah</th>
            <th>Jenjang</th>
            <th>Status</th>
            <th>Kepala Sekolah</th>
            <th style="text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {#each sekolahData as s (s.id)}
            <tr>
              <td><strong>{s.npsn}</strong></td>
              <td>{s.nama_sekolah}</td>
              <td><span class="badge badge-jenjang">{s.jenjang}</span></td>
              <td>{s.status}</td>
              <td>{s.kepala_sekolah || '-'}</td>
              <td style="text-align: right;">
                <div class="actions">
                  <button
                    class="btn-icon text-blue"
                    onclick={() => openEditSekolah(s)}
                    title="Edit Profil Sekolah"
                  >
                    <Icon name="edit" size={16} /> Edit
                  </button>
                  <button
                    class="btn-icon text-red"
                    onclick={() => openDeleteSekolah(s)}
                    title="Hapus Sekolah"
                  >
                    <Icon name="trash2" size={16} /> Hapus
                  </button>
                </div>
              </td>
            </tr>
          {/each}
          {#if sekolahData.length === 0}
            <tr>
              <td colspan="6" class="text-center">Belum ada data sekolah terdaftar.</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>

    {#if sekolahMeta && sekolahMeta.total_pages > 1}
      <div
        class="pagination"
        style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem;"
      >
        <button
          class="btn-secondary"
          disabled={sekolahMeta.page <= 1}
          onclick={() => {
            sekolahPage--;
            loadData();
          }}
        >
          Sebelumnya
        </button>
        <span
          >Halaman {sekolahMeta.page} dari {sekolahMeta.total_pages} (Total: {sekolahMeta.total})</span
        >
        <button
          class="btn-secondary"
          disabled={sekolahMeta.page >= sekolahMeta.total_pages}
          onclick={() => {
            sekolahPage++;
            loadData();
          }}
        >
          Berikutnya
        </button>
      </div>
    {/if}
  {/if}

  <!-- TAB: TAHUN AJARAN -->
  {#if activeTab === 'tahun_ajaran'}
    <div class="header-action">
      <div>
        <h2 class="page-title">Data Tahun Ajaran</h2>
        <p class="page-subtitle">
          Pengaturan periode akademik untuk semua unit sekolah. Hanya SATU tahun ajaran yang boleh
          aktif.
        </p>
      </div>
      <button class="btn-primary" onclick={openCreateTA}>
        <Icon name="plus" size={16} /> Tambah Tahun Ajaran
      </button>
    </div>

    {#if !taData.some((ta) => ta.semesters && ta.semesters.some((sem) => sem.status_aktif)) && taData.length > 0}
      <div class="alert-banner warning">
        ⚠️ Tidak ada semester aktif! Klik <strong>"Aktifkan"</strong> pada salah satu semester di bawah
        agar sistem dapat berjalan.
      </div>
    {/if}

    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tahun Ajaran</th>
            <th>Semester</th>
            <th>Status</th>
            <th style="text-align: center;">Pilih Semester</th>
            <th style="text-align: right;">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {#each taData as ta (ta.id)}
            {#if ta.semesters && ta.semesters.length > 0}
              {#each ta.semesters as sem (sem.id)}
                <tr class:row-active={sem.status_aktif}>
                  <td class="font-medium">
                    {ta.nama_tahun}
                    {#if ta.status === 'Active'}
                      <span class="badge badge-active" style="margin-left: 8px; font-size: 0.7rem;"
                        >Tahun Berjalan</span
                      >
                    {/if}
                  </td>
                  <td>
                    <span
                      class="badge badge-semester {sem.tipe_semester === 'Ganjil'
                        ? 'badge-ganjil'
                        : 'badge-genap'}"
                    >
                      {sem.tipe_semester}
                    </span>
                  </td>
                  <td>
                    <span class="badge {sem.status_aktif ? 'badge-active' : 'badge-inactive'}">
                      {sem.status_aktif ? 'Semester Berjalan' : '-'}
                    </span>
                  </td>
                  <td style="text-align: center;">
                    {#if !sem.status_aktif}
                      <button class="btn-activate" onclick={() => handleActivateSemester(sem, ta)}>
                        Pilih Semester Ini
                      </button>
                    {:else}
                      <span class="active-label">✔ Terpilih</span>
                    {/if}
                  </td>
                  <td style="text-align: right;">
                    <!-- Tampilkan hapus hanya di baris Ganjil agar tidak dobel tombol hapus per Tahun Ajaran -->
                    {#if sem.tipe_semester === 'Ganjil'}
                      <div class="actions">
                        <button
                          class="btn-icon text-red"
                          onclick={() => openDeleteTA(ta)}
                          title="Hapus Tahun Ajaran"
                        >
                          <Icon name="trash" size={16} /> Hapus TA
                        </button>
                      </div>
                    {/if}
                  </td>
                </tr>
              {/each}
            {/if}
          {/each}
          {#if taData.length === 0}
            <tr>
              <td colspan="5" class="text-center">Belum ada data tahun ajaran terdaftar.</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- ================= MODALS SEKOLAH ================= -->
{#if showModalSekolahCreate || showModalSekolahEdit}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) {
        showModalSekolahCreate = false;
        showModalSekolahEdit = false;
      }
    }}
  >
    <div class="modal-content">
      <div class="modal-header">
        <h3>{showModalSekolahCreate ? 'Tambah' : 'Edit'} Sekolah (Dapodik)</h3>
        <button
          class="btn-close"
          onclick={() => {
            showModalSekolahCreate = false;
            showModalSekolahEdit = false;
          }}
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>NPSN *</label>
            <input
              type="text"
              class="form-input"
              bind:value={sekolahForm.npsn}
              maxlength="8"
              placeholder="8 Digit NPSN"
              required
            />
          </div>
          <div class="form-group">
            <label>Nama Sekolah *</label>
            <input
              type="text"
              class="form-input"
              bind:value={sekolahForm.nama_sekolah}
              placeholder="Cth: SMP IT Nawawi"
              required
            />
          </div>
          <div class="form-group">
            <label>Jenjang</label>
            <select class="form-input" bind:value={sekolahForm.jenjang}>
              <option value="TK">TK</option>
              <option value="SD">SD</option>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
              <option value="SMK">SMK</option>
              <option value="MI">MI</option>
              <option value="MTs">MTs</option>
              <option value="MA">MA</option>
            </select>
          </div>
          <div class="form-group">
            <label>Status</label>
            <select class="form-input" bind:value={sekolahForm.status}>
              <option value="Negeri">Negeri</option>
              <option value="Swasta">Swasta</option>
            </select>
          </div>
          <div class="form-group full-width">
            <label>Alamat Lengkap</label>
            <textarea
              class="form-input"
              bind:value={sekolahForm.alamat}
              rows="2"
              placeholder="Jl. Pendidikan No. 1..."></textarea>
          </div>
          <div class="form-group">
            <label>Kode Pos</label>
            <input
              type="text"
              class="form-input"
              bind:value={sekolahForm.kode_pos}
              placeholder="Cth: 12345"
            />
          </div>
          <div class="form-group">
            <label>Kepala Sekolah</label>
            <input
              type="text"
              class="form-input"
              bind:value={sekolahForm.kepala_sekolah}
              placeholder="Nama Lengkap & Gelar"
            />
          </div>
          <div class="form-group">
            <label>Email Resmi</label>
            <input
              type="email"
              class="form-input"
              bind:value={sekolahForm.email}
              placeholder="admin@sekolah.sch.id"
            />
          </div>
          <div class="form-group">
            <label>Website</label>
            <input
              type="text"
              class="form-input"
              bind:value={sekolahForm.website}
              placeholder="www.sekolah.sch.id"
            />
          </div>
          <div class="form-group full-width" style="margin-top: 1rem;">
            <label>Fitur Tambahan Sekolah (Program Khusus)</label>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;">
                <input type="checkbox" bind:checked={enablePaketAlquran} />
                Paket Al-Qur'an (Tahfiz, Tasmi, Kelulusan)
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;">
                <input type="checkbox" bind:group={sekolahForm.fitur} value="input_diniyah" />
                Input Nilai Diniyah
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;">
                <input type="checkbox" bind:group={sekolahForm.fitur} value="rapor_keseharian" />
                Rapor Keseharian
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;">
                <input type="checkbox" bind:group={sekolahForm.fitur} value="konfigurasi_materi" />
                Konfigurasi Materi
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;">
                <input type="checkbox" bind:group={sekolahForm.fitur} value="log_aktivitas" />
                Log Aktivitas Guru
              </label>
            </div>
            {#if enablePaketAlquran}
              <label style="margin-top: 1rem;">Metode Penilaian Paket Al-Qur'an</label>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;">
                  <input type="radio" bind:group={versiPenilaian} value="v1" />
                  5 Kategori (0-5 per kategori)
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;">
                  <input type="radio" bind:group={versiPenilaian} value="v2" />
                  3 Kategori (0-100 per kategori)
                </label>
              </div>
            {/if}
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button
          class="btn-secondary"
          onclick={() => {
            showModalSekolahCreate = false;
            showModalSekolahEdit = false;
          }}>Batal</button
        >
        <button
          class="btn-primary"
          disabled={savingSekolah}
          onclick={showModalSekolahCreate ? handleSaveSekolah : handleUpdateSekolah}
        >
          {savingSekolah
            ? 'Menyimpan...'
            : showModalSekolahCreate
              ? 'Simpan Data'
              : 'Perbarui Data'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showModalSekolahDelete && currentSekolah}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) showModalSekolahDelete = false;
    }}
  >
    <div class="modal-content modal-sm">
      <div class="modal-header">
        <h3>Konfirmasi Hapus</h3>
        <button class="btn-close" onclick={() => (showModalSekolahDelete = false)}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="modal-body">
        <p>
          Yakin ingin menghapus data sekolah <strong>{currentSekolah.nama_sekolah}</strong> secara permanen?
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => (showModalSekolahDelete = false)}>Batal</button
        >
        <button class="btn-danger" onclick={handleDeleteSekolah}>Ya, Hapus</button>
      </div>
    </div>
  </div>
{/if}

<!-- ================= MODALS TAHUN AJARAN ================= -->
{#if showModalTACreate}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) {
        showModalTACreate = false;
      }
    }}
  >
    <div class="modal-content modal-sm">
      <div class="modal-header">
        <h3>Tambah Tahun Ajaran</h3>
        <button
          class="btn-close"
          onclick={() => {
            showModalTACreate = false;
          }}
        >
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label>Tahun Awal (Angka) *</label>
          <input
            type="number"
            class="form-input"
            bind:value={taForm.tahun_awal}
            required
            placeholder="Cth: 2024"
          />
        </div>
        <div
          class="alert-banner"
          style="background:#e0f2fe; color:#0369a1; padding:0.75rem; border-radius:0.5rem; font-size:0.85rem; margin-top:0.5rem;"
        >
          <Icon name="info" size={16} style="vertical-align: middle; margin-right: 0.25rem;" />
          Sistem otomatis membentuk tahun akhirnya (Cth: 2024/2025) dan membuat Semester Ganjil & Genap
          sekaligus.
        </div>
      </div>
      <div class="modal-footer">
        <button
          class="btn-secondary"
          onclick={() => {
            showModalTACreate = false;
          }}>Batal</button
        >
        <button class="btn-primary" disabled={savingTA} onclick={handleSaveTA}>
          {savingTA ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showModalTADelete && currentTA}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) showModalTADelete = false;
    }}
  >
    <div class="modal-content modal-sm">
      <div class="modal-header">
        <h3>Konfirmasi Hapus</h3>
        <button class="btn-close" onclick={() => (showModalTADelete = false)}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="modal-body">
        <p>
          Yakin ingin menghapus Tahun Ajaran <strong>{currentTA.nama_tahun}</strong> beserta seluruh semesternya
          secara permanen?
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => (showModalTADelete = false)}>Batal</button>
        <button class="btn-danger" onclick={handleDeleteTA}>Ya, Hapus</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .master-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    font-family: inherit;
  }

  /* Tabs */
  .tabs-header {
    display: flex;
    border-bottom: 2px solid var(--color-border, #e2e8f0);
    margin-bottom: 2rem;
    gap: 1rem;
  }
  .tab-btn {
    background: none;
    border: none;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    color: var(--color-text-muted, #64748b);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: all 0.2s;
  }
  .tab-btn:hover {
    color: var(--color-text-main, #1e293b);
  }
  .tab-btn.active {
    color: var(--color-primary, #2563eb);
    border-bottom-color: var(--color-primary, #2563eb);
  }

  .header-action {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }
  .page-title {
    margin: 0 0 0.25rem 0;
    color: var(--color-text-main, #1e293b);
    font-size: 1.5rem;
  }
  .page-subtitle {
    margin: 0;
    color: var(--color-text-muted, #64748b);
    font-size: 0.9rem;
  }

  /* Banners */
  .alert-banner {
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    font-weight: 500;
  }
  .alert-banner.error {
    background-color: #fee2e2;
    color: #b91c1c;
  }
  .alert-banner.success {
    background-color: #dcfce7;
    color: #15803d;
  }
  .alert-banner.warning {
    background-color: #fef9c3;
    color: #a16207;
  }

  .table-wrapper {
    background: var(--color-surface, white);
    border-radius: 12px;
    box-shadow: var(--shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.1));
    overflow: hidden;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
  }
  .data-table th,
  .data-table td {
    padding: 1rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }
  .data-table th {
    background-color: var(--color-bg-body, #f8fafc);
    font-weight: 600;
    color: var(--color-text-muted, #475569);
    font-size: 0.875rem;
    text-transform: uppercase;
  }
  .row-active {
    background-color: #f0f9ff;
  }

  .font-medium {
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Badges & Dots */
  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .badge-jenjang {
    background-color: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }
  .badge-ganjil {
    background-color: rgba(168, 85, 247, 0.1);
    color: #a855f7;
  }
  .badge-genap {
    background-color: rgba(236, 72, 153, 0.1);
    color: #ec4899;
  }
  .badge-active {
    background-color: #dcfce7;
    color: #16a34a;
  }
  .badge-inactive {
    background-color: #f1f5f9;
    color: #64748b;
  }

  .active-dot {
    width: 8px;
    height: 8px;
    background-color: #3b82f6;
    border-radius: 50%;
    display: inline-block;
  }
  .active-label {
    color: #16a34a;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  /* Buttons */
  .btn-primary {
    background-color: var(--color-primary, #2563eb);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .btn-primary:hover {
    background-color: #1d4ed8;
  }

  .btn-secondary {
    background-color: #e2e8f0;
    color: #475569;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-secondary:hover {
    background-color: #cbd5e1;
  }

  .btn-danger {
    background-color: #ef4444;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-danger:hover {
    background-color: #dc2626;
  }

  .btn-activate {
    background-color: white;
    color: #3b82f6;
    border: 1px solid #3b82f6;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }
  .btn-activate:hover {
    background-color: #eff6ff;
  }

  .btn-icon {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-weight: 500;
  }
  .btn-icon:hover {
    background-color: #f1f5f9;
  }
  .text-blue {
    color: #3b82f6;
  }
  .text-red {
    color: #ef4444;
  }

  /* Modals */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(15, 23, 42, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
  }
  .modal-content {
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 600px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }
  .modal-sm {
    max-width: 400px;
  }
  .modal-header {
    padding: 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-header h3 {
    margin: 0;
    color: #1e293b;
  }
  .btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 1.25rem;
  }
  .btn-close:hover {
    color: #334155;
  }
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }
  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  /* Forms */
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  .full-width {
    grid-column: span 2;
  }
  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #475569;
    margin-bottom: 0.5rem;
  }
  .form-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 0.95rem;
    box-sizing: border-box;
    background-color: white;
  }
  .form-input:focus {
    outline: none;
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }
  textarea.form-input {
    resize: vertical;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .text-center {
    text-align: center;
  }
</style>
