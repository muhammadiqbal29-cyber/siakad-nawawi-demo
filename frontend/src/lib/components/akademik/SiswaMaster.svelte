<script>
  import { toastStore } from '$lib/toast.svelte.js';
  import { modalStore } from '$lib/modal.svelte.js';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';

  let { sekolahId } = $props();

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  /** @type {any[]} */
  let siswaData = $state([]);
  /** @type {any} */
  let siswaMeta = $state(null);
  let loading = $state(true);
  let errorMessage = $state('');

  let search = $state('');
  let page = $state(1);
  let limit = $state(10);
  let statusFilter = $state('Aktif');

  // Bulk action state
  let selectedSiswa = $state([]);
  let isAllSelected = $derived(siswaData.length > 0 && selectedSiswa.length === siswaData.length);

  function toggleSelectAll(e) {
    if (e.target.checked) {
      selectedSiswa = siswaData.map(s => s.id);
    } else {
      selectedSiswa = [];
    }
  }

  // Form states
  let showModalForm = $state(false);
  let saving = $state(false);
  let magicPullMode = $state(false);

  let form = $state({
    id: 0,
    nisn: '',
    nis: '',
    nama_lengkap: '',
    jenis_kelamin: 'L',
    tempat_lahir: '',
    tanggal_lahir: '',
    agama: '',
    alamat: '',
    nama_ayah: '',
    nama_ibu: '',
    telepon_ortu: '',
    status: 'Aktif',
    sekolah_id: Number(sekolahId),
    kelas_id: null
  });

  // Modal profil & history
  let showProfile = $state(false);
  /** @type {any} */
  let currentSiswa = $state(null);

  let displayTanggalLahir = $state('');

  function parseDate(val) {
    if (!val) return '';
    // if already YYYY-MM-DD
    if (val.includes('-')) return val;
    // parse DD/MM/YYYY or DD-MM-YYYY
    const parts = val.replace(/-/g, '/').split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      let y = parts[2];
      if (y.length === 2) y = (parseInt(y) < 50 ? '20' : '19') + y;
      return `${y}-${m}-${d}`;
    }
    return val;
  }

  function formatDate(val) {
    if (!val) return '';
    const parts = val.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return val;
  }

  // Sync display state when form changes externally (e.g. edit/reset)
  $effect(() => {
    displayTanggalLahir = formatDate(form.tanggal_lahir);
  });

  onMount(() => {
    loadData();
  });

  async function loadData() {
    loading = true;
    errorMessage = '';
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        search: search,
        status: statusFilter
      }).toString();

      const res = await fetch(`${apiUrl}/api/sekolah/${sekolahId}/siswa?${query}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const body = await res.json();
        if (body.data) {
          siswaData = body.data;
          siswaMeta = body.meta;
        } else {
          siswaData = body;
        }
      } else {
        errorMessage = 'Gagal memuat data siswa.';
      }
    } catch (err) {
      errorMessage = `Koneksi error: ${err.message}`;
    } finally {
      loading = false;
    }
  }

  function resetForm() {
    form = {
      id: 0,
      nisn: '',
      nis: '',
      nama_lengkap: '',
      jenis_kelamin: 'L',
      tempat_lahir: '',
      tanggal_lahir: '',
      agama: '',
      alamat: '',
      nama_ayah: '',
      nama_ibu: '',
      telepon_ortu: '',
      status: 'Aktif',
      sekolah_id: Number(sekolahId),
      kelas_id: null
    };
    magicPullMode = false;
  }

  async function checkNIS() {
    if (!form.nis || form.nis.length < 2) return;
    try {
      const res = await fetch(`${apiUrl}/api/siswa/check/${form.nis}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Magic Pull!
        if (
          await modalStore.show({
            message: `Data ditemukan: ${data.nama_lengkap} (Status saat ini: ${data.status}). Apakah Anda ingin menarik data biodatanya?`
          })
        ) {
          form.nisn = data.nisn || '';
          form.nama_lengkap = data.nama_lengkap;
          form.jenis_kelamin = data.jenis_kelamin;
          form.tempat_lahir = data.tempat_lahir;
          form.tanggal_lahir = data.tanggal_lahir ? data.tanggal_lahir.split('T')[0] : '';
          form.agama = data.agama;
          form.alamat = data.alamat;
          form.nama_ayah = data.nama_ayah;
          form.nama_ibu = data.nama_ibu;
          form.telepon_ortu = data.telepon_ortu;
          // Note: Kita membiarkan ID-nya 0 agar server membuat record baru (atau mengupdate, tergantung arsitektur).
          // Karena kita pakai Option 1 (Single Identity), kita seharusnya melakukan UPDATE (Mutasi) pada data lama tersebut.
          // Untuk versi ini, kita asumsikan server menggunakan UpdateSiswaHandler jika form.id != 0
          form.id = data.id;
          magicPullMode = true;
        }
      } else if (res.status === 404) {
        toastStore.show('NIS belum terdaftar. Silakan isi biodata baru.', 'info');
        magicPullMode = true; // Buka sisa form
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function saveSiswa() {
    saving = true;
    try {
      let url = `${apiUrl}/api/siswa`;
      let method = 'POST';

      if (magicPullMode && form.id > 0) {
        // Ini adalah Mutasi Lintas Sekolah
        url = `${apiUrl}/api/siswa/mutasi`;
        method = 'POST';
      } else if (form.id > 0) {
        // Edit biasa (dalam sekolah yang sama)
        url = `${apiUrl}/api/siswa/${form.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-Sekolah-ID': sekolahId.toString() // Wajib disisipkan untuk tenant isolation
        },
        body: JSON.stringify(form),
        credentials: 'include'
      });

      if (res.ok) {
        showModalForm = false;
        toastStore.show('Data berhasil disimpan!', 'info');
        loadData();
      } else {
        const errBody = await res.json();
        toastStore.show(errBody.message || 'Gagal menyimpan', 'info');
      }
    } catch (err) {
      toastStore.show(`Error: ${err.message}`, 'info');
    } finally {
      saving = false;
    }
  }

  async function deleteSiswa(id, nama) {
    if (
      !(await modalStore.show({
        message: `Apakah Anda yakin ingin menghapus siswa "${nama}"? (Data akan dipindahkan ke bak sampah)`
      }))
    )
      return;
    try {
      const res = await fetch(`${apiUrl}/api/siswa/${id}`, {
        method: 'DELETE',
        headers: { 'X-Sekolah-ID': sekolahId.toString() },
        credentials: 'include'
      });
      if (res.ok) {
        toastStore.show('Siswa berhasil dipindahkan ke bak sampah', 'info');
        // Remove from selection if exists
        selectedSiswa = selectedSiswa.filter(sId => sId !== id);
        loadData();
      } else {
        const body = await res.json();
        toastStore.show(body.message || 'Gagal menghapus siswa', 'info');
      }
    } catch (err) {
      toastStore.show(`Error: ${err.message}`, 'info');
    }
  }

  async function bulkDeleteSiswa() {
    if (selectedSiswa.length === 0) return;
    if (
      !(await modalStore.show({
        message: `Apakah Anda yakin ingin menghapus ${selectedSiswa.length} siswa terpilih? (Data akan dipindahkan ke bak sampah)`
      }))
    )
      return;
    
    try {
      const res = await fetch(`${apiUrl}/api/siswa/bulk`, {
        method: 'DELETE',
        headers: { 
          'X-Sekolah-ID': sekolahId.toString(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ids: selectedSiswa }),
        credentials: 'include'
      });
      if (res.ok) {
        toastStore.show('Siswa terpilih berhasil dipindahkan ke bak sampah', 'info');
        selectedSiswa = [];
        loadData();
      } else {
        const body = await res.json();
        toastStore.show(body.message || 'Gagal menghapus siswa secara masal', 'info');
      }
    } catch (err) {
      toastStore.show(`Error: ${err.message}`, 'info');
    }
  }

  let showModalImport = $state(false);
  /** @type {any} */
  let importFile = $state(null);
  let importing = $state(false);

  async function handleImport() {
    if (!importFile) {
      toastStore.show('Pilih file Excel terlebih dahulu', 'info');
      return;
    }
    importing = true;
    try {
      const formData = new FormData();
      formData.append('excel_file', importFile);

      const res = await fetch(`${apiUrl}/api/sekolah/${sekolahId}/siswa/import`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const body = await res.json();
      if (res.ok) {
        toastStore.show(
          `${body.data.message}\nBerhasil masuk: ${body.data.berhasil} anak\nMutasi otomatis: ${body.data.dimutasi} anak\nDilewati (Duplikat): ${body.data.dilewati} anak`,
          'info'
        );
        showModalImport = false;
        importFile = null;
        loadData();
      } else {
        toastStore.show(body.message || 'Gagal mengimport Excel', 'info');
      }
    } catch (err) {
      toastStore.show(`Error: ${err.message}`, 'info');
    } finally {
      importing = false;
    }
  }
</script>

<div class="page-container">
  <div class="header-action">
    <div>
      <button
        class="btn-secondary"
        onclick={() => goto('/akademik')}
        style="margin-bottom: 0.5rem; display: inline-flex; align-items: center; gap: 0.5rem;"
      >
        <Icon name="arrowLeft" size={16} /> Kembali
      </button>
      <h2 class="page-title">Manajemen Siswa</h2>
      <p class="page-subtitle">Kelola data peserta didik, profil, dan mutasi.</p>
    </div>

    <div style="display: flex; gap: 1rem; align-items: center;">
      {#if selectedSiswa.length > 0}
        <button class="btn-primary" style="background-color: var(--color-error, #ef4444);" onclick={bulkDeleteSiswa}>
          <Icon name="trash" size={16} /> Hapus {selectedSiswa.length} Terpilih
        </button>
      {/if}
      <select
        bind:value={statusFilter}
        onchange={() => {
          page = 1;
          selectedSiswa = [];
          loadData();
        }}
        class="form-input"
        style="width: 150px;"
      >
        <option value="Aktif">Aktif</option>
        <option value="Lulus">Lulus / Alumni</option>
        <option value="Pindah">Pindah</option>
      </select>
      <input
        type="text"
        class="form-input"
        placeholder="Cari nama / NISN..."
        bind:value={search}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            page = 1;
            loadData();
          }
        }}
      />
      <button
        class="btn-secondary"
        onclick={() => {
          importFile = null;
          showModalImport = true;
        }}
      >
        Import Excel
      </button>
      <button
        class="btn-primary"
        onclick={() => {
          resetForm();
          showModalForm = true;
        }}
      >
        <Icon name="plus" size={16} /> Tambah Siswa
      </button>
    </div>
  </div>

  {#if loading}
    <div class="loading-state">Memuat data...</div>
  {:else if errorMessage}
    <div class="error-message">{errorMessage}</div>
  {:else}
    <div class="table-wrapper">
      <table class="table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">
              <input type="checkbox" checked={isAllSelected} onchange={toggleSelectAll} style="cursor: pointer;" />
            </th>
            <th>NISN</th>
            <th>Nama Lengkap</th>
            <th>L/P</th>
            <th>Status</th>
            <th>{statusFilter === 'Lulus' ? 'Tahun Lulus' : 'Tahun Ajaran'}</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {#each siswaData as s (s.id)}
            <tr>
              <td style="text-align: center;">
                <input type="checkbox" value={s.id} bind:group={selectedSiswa} style="cursor: pointer;" />
              </td>
              <td><strong>{s.nisn}</strong></td>
              <td>{s.nama_lengkap}</td>
              <td>{s.jenis_kelamin}</td>
              <td
                ><span
                  class="badge"
                  class:bg-green={s.status === 'Aktif'}
                  class:bg-gray={s.status !== 'Aktif'}>{s.status}</span
                ></td
              >
              <td>{s.tahun_ajaran || '-'}</td>
              <td>
                <button
                  class="btn-icon text-blue"
                  title="Profil Lengkap"
                  onclick={() => {
                    currentSiswa = s;
                    showProfile = true;
                  }}
                >
                  <Icon name="user" size={16} /> Profil
                </button>
                <button
                  class="btn-icon text-yellow"
                  title="Edit"
                  onclick={() => {
                    form = { ...s };
                    form.tanggal_lahir = form.tanggal_lahir ? form.tanggal_lahir.split('T')[0] : '';
                    magicPullMode = false;
                    showModalForm = true;
                  }}
                >
                  <Icon name="edit" size={16} /> Edit
                </button>
                <button
                  class="btn-icon text-red"
                  title="Hapus"
                  onclick={() => deleteSiswa(s.id, s.nama_lengkap)}
                >
                  <Icon name="trash" size={16} /> Hapus
                </button>
              </td>
            </tr>
          {/each}
          {#if siswaData.length === 0}
            <tr><td colspan="5" style="text-align: center;">Tidak ada siswa.</td></tr>
          {/if}
        </tbody>
      </table>
    </div>

    {#if siswaMeta && siswaMeta.total_pages > 1}
      <div class="pagination">
        <button
          class="btn-secondary"
          disabled={siswaMeta.page <= 1}
          onclick={() => {
            page--;
            loadData();
          }}>Sebelumnya</button
        >
        <span>Hal {siswaMeta.page} / {siswaMeta.total_pages}</span>
        <button
          class="btn-secondary"
          disabled={siswaMeta.page >= siswaMeta.total_pages}
          onclick={() => {
            page++;
            selectedSiswa = [];
            loadData();
          }}>Berikutnya</button
        >
      </div>
    {/if}
  {/if}
</div>

<!-- Modal Form Siswa -->
{#if showModalForm}
  <div class="modal-backdrop">
    <div class="modal" style="max-width: 600px;">
      <div class="modal-header">
        <h3>{form.id === 0 ? 'Pendaftaran Siswa Baru' : 'Edit Biodata Siswa'}</h3>
        <button class="close-btn" onclick={() => (showModalForm = false)}
          ><Icon name="x" size={20} /></button
        >
      </div>
      <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
        <div class="form-group" style="display: flex; gap: 1rem; align-items: flex-end;">
          <div style="flex: 1;">
            <label>NIS (Sekolah) *</label>
            <input
              type="text"
              class="form-input"
              bind:value={form.nis}
              required
              disabled={form.id > 0}
            />
          </div>
          {#if form.id === 0 && !magicPullMode}
            <button class="btn-primary" onclick={checkNIS} type="button">Cek Data</button>
          {/if}
        </div>

        {#if magicPullMode || form.id > 0}
          <div class="form-group" style="margin-top: 1rem;">
            <label>Nama Lengkap *</label>
            <input type="text" class="form-input" bind:value={form.nama_lengkap} required />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="form-group">
              <label>NISN</label>
              <input type="text" class="form-input" bind:value={form.nisn} maxlength="10" />
            </div>
            <div class="form-group">
              <label>Jenis Kelamin</label>
              <select class="form-input" bind:value={form.jenis_kelamin}>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Tempat, Tanggal Lahir</label>
            <div style="display: flex; gap: 1rem;">
              <input
                type="text"
                class="form-input"
                bind:value={form.tempat_lahir}
                placeholder="Kota"
              />
              <input
                type="text"
                class="form-input"
                placeholder="DD/MM/YYYY"
                bind:value={displayTanggalLahir}
                oninput={() => (form.tanggal_lahir = parseDate(displayTanggalLahir))}
              />
            </div>
          </div>

          <hr style="margin: 1.5rem 0;" />
          <h4 style="margin-bottom: 1rem;">Data Orang Tua</h4>
          <div class="form-group">
            <label>Nama Ayah</label>
            <input type="text" class="form-input" bind:value={form.nama_ayah} />
          </div>
          <div class="form-group">
            <label>Nama Ibu</label>
            <input type="text" class="form-input" bind:value={form.nama_ibu} />
          </div>
          <div class="form-group">
            <label>No. HP Orang Tua / Wali</label>
            <input type="text" class="form-input" bind:value={form.telepon_ortu} />
          </div>
        {/if}
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => (showModalForm = false)}>Batal</button>
        {#if magicPullMode || form.id > 0}
          <button class="btn-primary" disabled={saving} onclick={saveSiswa}>
            {saving ? 'Menyimpan...' : 'Simpan Data Siswa'}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Drawer Profil -->
{#if showProfile && currentSiswa}
  <div class="modal-backdrop" style="justify-content: center;">
    <div class="modal" style="width: 400px; display: flex; flex-direction: column;">
      <div class="modal-header" style="background: var(--color-primary, #22c55e); color: white;">
        <h3>Profil Siswa</h3>
        <button class="close-btn" style="color: white;" onclick={() => (showProfile = false)}
          ><Icon name="x" size={20} /></button
        >
      </div>
      <div class="modal-body" style="flex: 1; overflow-y: auto;">
        <div style="text-align: center; margin-bottom: 2rem;">
          <div
            style="width: 80px; height: 80px; background: #e2e8f0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 2rem; color: #64748b; margin-bottom: 1rem;"
          >
            {currentSiswa.nama_lengkap.charAt(0)}
          </div>
          <h3 style="margin: 0;">{currentSiswa.nama_lengkap}</h3>
          <p style="color: #64748b; margin: 0.2rem 0;">
            NISN: {currentSiswa.nisn} | NIS: {currentSiswa.nis || '-'}
          </p>
          <span class="badge bg-green">{currentSiswa.status}</span>
        </div>

        <h4 style="border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">Biodata</h4>
        <p>
          <strong>TTL:</strong>
          {currentSiswa.tempat_lahir}, {currentSiswa.tanggal_lahir
            ? currentSiswa.tanggal_lahir.split('T')[0]
            : '-'}
        </p>
        <p><strong>JK:</strong> {currentSiswa.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
        <p><strong>Agama:</strong> {currentSiswa.agama || '-'}</p>

        <h4 style="border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 1.5rem;">
          Data Orang Tua
        </h4>
        <p><strong>Ayah:</strong> {currentSiswa.nama_ayah || '-'}</p>
        <p><strong>Ibu:</strong> {currentSiswa.nama_ibu || '-'}</p>
        <p><strong>Kontak:</strong> {currentSiswa.telepon_ortu || '-'}</p>

        <h4 style="border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 1.5rem;">
          Riwayat Akademik
        </h4>
        <div style="border-left: 2px solid #22c55e; padding-left: 1rem; margin-left: 0.5rem;">
          <p style="margin-bottom: 0;"><strong>Sedang Berjalan</strong></p>
          {#if currentSiswa.kelas_id}
            <p
              style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.2rem; margin-top: 0.2rem;"
            >
              Tahun Ajaran <strong>{currentSiswa.tahun_ajaran}</strong>
            </p>
            <p style="color: #1e293b; font-size: 0.9rem; margin-top: 0.2rem;">
              Kelas <strong>{currentSiswa.nama_kelas}</strong> Rombel
              <strong>{currentSiswa.rombel}</strong>
            </p>
          {:else}
            <p style="color: #ef4444; font-size: 0.85rem; margin-top: 0.2rem;">
              Belum dimasukkan ke rombel kelas.
            </p>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<!-- Modal Import Excel -->
{#if showModalImport}
  <div class="modal-backdrop">
    <div class="modal" style="max-width: 500px;">
      <div class="modal-header">
        <h3>Import Data Siswa (Excel)</h3>
        <button class="close-btn" onclick={() => (showModalImport = false)}
          ><Icon name="x" size={20} /></button
        >
      </div>
      <div class="modal-body">
        <p style="margin-top: 0; color: #64748b; font-size: 0.9rem;">
          Unggah file Excel (.xlsx) yang berisi data siswa. Sistem otomatis akan melewati (skip)
          siswa jika NIS-nya sudah terdaftar.
        </p>

        <div style="margin-bottom: 1.5rem;">
          <a
            href="/Template_Import_Siswa.xlsx"
            download="Template_Import_Siswa.xlsx"
            class="btn-secondary"
            style="width: 100%; justify-content: center; display:flex; text-decoration: none;"
          >
            ⬇️ Download Template Excel
          </a>
        </div>

        <div class="form-group">
          <label>File Excel (.xlsx)</label>
          <input
            type="file"
            accept=".xlsx"
            class="form-input"
            onchange={(e) => (importFile = e.target.files[0])}
          />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => (showModalImport = false)}>Batal</button>
        <button class="btn-primary" disabled={!importFile || importing} onclick={handleImport}>
          {importing ? 'Memproses...' : 'Mulai Import'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page-container {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .header-action {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    margin-bottom: 2rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-main, #1e293b);
    margin: 0 0 0.25rem 0;
  }
  .page-subtitle {
    color: var(--color-text-muted, #64748b);
    margin: 0;
  }
  .loading-state,
  .error-message {
    text-align: center;
    padding: 3rem;
    color: var(--color-text-muted, #64748b);
    background: white;
    border-radius: 1rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .error-message {
    color: var(--color-error, #ef4444);
  }

  /* Table styling */
  .table-wrapper {
    background: white;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    overflow-x: auto;
  }
  .table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }
  .table th {
    background-color: var(--color-surface-hover, #f8fafc);
    color: var(--color-text-muted, #64748b);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }
  .table td {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    color: var(--color-text-main, #1e293b);
    font-size: 0.9rem;
  }
  .table tr:last-child td {
    border-bottom: none;
  }
  .table tr:hover {
    background-color: var(--color-surface-hover, #f8fafc);
  }

  /* Modals */
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  .modal {
    background: white;
    width: 100%;
    border-radius: 1rem;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  .modal-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted, #64748b);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
  }
  .close-btn:hover {
    color: var(--color-error, #ef4444);
  }
  .modal-body {
    padding: 1.5rem;
  }
  .modal-footer {
    padding: 1.25rem 1.5rem;
    background: var(--color-surface-hover, #f8fafc);
    border-top: 1px solid var(--color-border, #e2e8f0);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }

  /* Forms */
  .form-group {
    margin-bottom: 1rem;
  }
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    color: var(--color-text-main, #1e293b);
    font-size: 0.875rem;
  }
  .form-input {
    width: 100%;
    padding: 0.625rem 0.875rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: all 0.2s;
    font-family: inherit;
    box-sizing: border-box;
  }
  .form-input:focus {
    outline: none;
    border-color: var(--color-primary, #22c55e);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }
  .form-input:disabled {
    background-color: var(--color-surface-hover, #f8fafc);
    color: var(--color-text-muted, #64748b);
    cursor: not-allowed;
  }

  /* Buttons & Badges */
  .btn-primary {
    background-color: var(--color-primary, #22c55e);
    color: white;
    border: none;
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .btn-primary:hover:not(:disabled) {
    background-color: var(--color-primary-dark, #15803d);
    transform: translateY(-1px);
  }
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .btn-secondary {
    background-color: white;
    color: var(--color-text-main, #1e293b);
    border: 1px solid var(--color-border, #e2e8f0);
    padding: 0.625rem 1.25rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-secondary:hover:not(:disabled) {
    background-color: var(--color-surface-hover, #f8fafc);
  }
  .btn-icon {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.375rem;
    border-radius: 0.375rem;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
  }
  .btn-icon:hover {
    background-color: var(--color-surface-hover, #f8fafc);
  }
  .text-blue {
    color: #3b82f6;
  }
  .text-yellow {
    color: #eab308;
  }
  .text-red {
    color: #ef4444;
  }

  .badge {
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    display: inline-block;
  }
  .bg-green {
    background: #dcfce7;
    color: #15803d;
  }
  .bg-gray {
    background: #f1f5f9;
    color: #475569;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
