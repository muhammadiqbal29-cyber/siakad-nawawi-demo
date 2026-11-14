<script>
  import { toastStore } from '$lib/toast.svelte.js';
  import { onMount, onDestroy } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import Icon from '$lib/components/ui/Icon.svelte';

  let { sekolahId } = $props();
  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  /** @type {any[]} */
  let kelasList = $state([]);
  /** @type {any[]} */
  let siswaList = $state([]); // ALL students
  /** @type {any[]} */
  let tahunAjaranList = $state([]);

  let loading = $state(false);
  let processing = $state(false);

  // 'dashboard' or 'detail'
  let viewMode = $state('dashboard');
  let selectedKelasId = $state('');
  let selectedRombel = $state('');

  let removeSiswaState = $state({ active: false, id: null, nama: '' });
  let showAssignModal = $state(false);

  /** @type {any} */
  let activeTahunAjaranId = $state(null);

  // Checkboxes for assignment
  let selectedSiswaKiri = new SvelteSet();

  // Derived filtered lists (ONLY AKTIF)
  let siswaAktif = $derived(siswaList.filter((s) => s.status === 'Aktif' || s.status === 'Lulus' || s.status === 'Pindah'));
  let siswaTanpaKelas = $derived(siswaAktif.filter((s) => !s.kelas_id));

  // Kelas Asal Filter
  let filterKelasAsal = $state('Semua');
  let filterGender = $state('Semua');
  let daftarKelasAsal = $derived(() => {
    const arr = [];
    siswaTanpaKelas.forEach((s) => {
      if (s.kelas_asal && !arr.includes(s.kelas_asal)) arr.push(s.kelas_asal);
    });
    return arr.sort();
  });
  let filteredSiswaTanpaKelas = $derived(
    siswaTanpaKelas.filter((s) => {
      const matchKelas = filterKelasAsal === 'Semua' || (s.kelas_asal || '') === filterKelasAsal;
      const matchGender = filterGender === 'Semua' || s.jenis_kelamin === filterGender;
      return matchKelas && matchGender;
    })
  );

  // Build card list from ACTUAL student placement data per TA (not from master kelas)
  // This ensures cards reflect the selected TA, not a static list
  let kelasRombelList = $derived(() => {
    const map = {};
    siswaAktif.forEach((s) => {
      if (s.kelas_id) {
        const k = kelasList.find((kl) => kl.id === s.kelas_id);
        if (k) {
          const key = `${s.kelas_id}:${s.rombel || ''}`;
          if (!map[key]) map[key] = { kelas: k, rombel: s.rombel || '', siswa: [] };
          map[key].siswa.push(s);
        }
      }
    });
    return Object.values(map).sort((a, b) => {
      const tA = parseInt(a.kelas.tingkat) || 0;
      const tB = parseInt(b.kelas.tingkat) || 0;
      if (tA !== tB) return tA - tB;
      return (a.rombel || '').localeCompare(b.rombel || '');
    });
  });

  let selectedKelasObj = $derived(kelasList.find((k) => k.id == selectedKelasId));
  let kelasName = $derived(
    selectedKelasObj
      ? `${selectedKelasObj.tingkat} - ${selectedKelasObj.nama_kelas}` +
          (selectedRombel ? ` (${selectedRombel})` : '')
      : 'Kelas'
  );
  let siswaDalamKelas = $derived(
    siswaAktif.filter((s) => s.kelas_id == selectedKelasId && (s.rombel || '') === selectedRombel)
  );

  onMount(() => {
    loadData();
    window.addEventListener('tahunAjaranChanged', loadData);
  });

  onDestroy(() => {
    window.removeEventListener('tahunAjaranChanged', loadData);
  });

  async function loadData() {
    loading = true;
    try {
      const resTA = await fetch(`${apiUrl}/api/tahun-ajaran`, { credentials: 'include' });
      if (resTA.ok) {
        tahunAjaranList = await resTA.json();
        // Set default viewed TA if not set
        if (!activeTahunAjaranId && tahunAjaranList.length > 0) {
          activeTahunAjaranId =
            tahunAjaranList.find((t) => t.status === 'Active')?.id || tahunAjaranList[0].id;
        }
      }

      // Fetch students and classes for the currently selected TA
      const taQuery = activeTahunAjaranId ? `&tahun_ajaran_id=${activeTahunAjaranId}` : '';
      const [resKelas, resSiswa] = await Promise.all([
        fetch(`${apiUrl}/api/sekolah/${sekolahId}/kelas`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/sekolah/${sekolahId}/siswa?limit=10000${taQuery}`, {
          credentials: 'include'
        })
      ]);

      if (resKelas.ok) kelasList = await resKelas.json();
      if (resSiswa.ok) {
        const payload = await resSiswa.json();
        siswaList = payload.data || [];
      }

      // Reset selections
      selectedSiswaKiri.clear();
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  }

  function toggleKiri(id) {
    if (selectedSiswaKiri.has(id)) {
      selectedSiswaKiri.delete(id);
    } else {
      selectedSiswaKiri.add(id);
    }
  }

  function toggleSelectAll() {
    if (
      selectedSiswaKiri.size === filteredSiswaTanpaKelas.length &&
      filteredSiswaTanpaKelas.length > 0
    ) {
      selectedSiswaKiri.clear();
    } else {
      selectedSiswaKiri.clear();
      filteredSiswaTanpaKelas.forEach((s) => selectedSiswaKiri.add(s.id));
    }
  }

  async function assignKeKelas() {
    if (selectedSiswaKiri.size === 0) return;
    if (!selectedKelasId) {
      toastStore.show('Pilih kelas tujuan terlebih dahulu!', 'info');
      return;
    }
    if (!selectedRombel.trim()) {
      toastStore.show('Masukkan nama rombel terlebih dahulu (misal: A, B, dsb)', 'info');
      return;
    }

    processing = true;
    try {
      const res = await fetch(`${apiUrl}/api/kelas/${selectedKelasId}/assign`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Sekolah-ID': sekolahId.toString()
        },
        body: JSON.stringify({
          siswa_ids: Array.from(selectedSiswaKiri),
          rombel: selectedRombel.trim(),
          tahun_ajaran_id: activeTahunAjaranId
        }),
        credentials: 'include'
      });

      if (res.ok) {
        showAssignModal = false;
        await loadData();
      } else {
        const body = await res.json();
        toastStore.show(body.message || 'Gagal memasukkan siswa', 'info');
      }
    } catch (err) {
      toastStore.show(err.message, 'info');
    } finally {
      processing = false;
    }
  }

  function openRemoveModal(s) {
    removeSiswaState = { active: true, id: s.id, nama: s.nama_lengkap };
  }

  async function confirmRemove(mode) {
    if (!removeSiswaState.id) return;
    processing = true;
    try {
      const res = await fetch(`${apiUrl}/api/kelas/${selectedKelasId}/keluarkan`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Sekolah-ID': sekolahId.toString()
        },
        body: JSON.stringify({
          siswa_ids: [removeSiswaState.id],
          mode: mode,
          tahun_ajaran_id: activeTahunAjaranId
        }),
        credentials: 'include'
      });

      if (res.ok) {
        removeSiswaState = { active: false, id: null, nama: '' };
        await loadData();
      } else {
        toastStore.show('Gagal mengeluarkan siswa', 'info');
      }
    } catch (err) {
      toastStore.show(err.message, 'info');
    } finally {
      processing = false;
    }
  }

  async function keluarkanSemua() {
    if (siswaDalamKelas.length === 0) return;
    if (!(confirm(`Anda yakin ingin mengeluarkan SEMUA (${siswaDalamKelas.length}) siswa dari rombel ini?`))) return;
    
    processing = true;
    try {
      const res = await fetch(`${apiUrl}/api/kelas/${selectedKelasId}/keluarkan`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Sekolah-ID': sekolahId.toString()
        },
        body: JSON.stringify({
          siswa_ids: siswaDalamKelas.map((s) => s.id),
          mode: 'Biasa',
          tahun_ajaran_id: activeTahunAjaranId
        }),
        credentials: 'include'
      });
      if (res.ok) {
        toastStore.show('Semua siswa berhasil dikeluarkan.', 'info');
        await loadData();
      } else {
        toastStore.show('Gagal mengeluarkan siswa', 'info');
      }
    } catch (err) {
      toastStore.show(err.message, 'info');
    } finally {
      processing = false;
    }
  }
</script>

<div class="page-container">
  {#if viewMode === 'dashboard'}
    <div class="header-action">
      <div>
        <h2 class="page-title">Manajemen Kelas & Rombel</h2>
        <p class="page-subtitle">Kelola pembagian rombel siswa untuk setiap Tahun Ajaran.</p>
        <div style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="font-size: 0.9rem; color: #64748b;">Tahun Ajaran:</span>
          <select
            bind:value={activeTahunAjaranId}
            onchange={loadData}
            class="form-input"
            style="padding: 0.2rem 0.5rem; font-weight: bold; background: #e2e8f0; color: #0f172a; border-radius: 0.25rem; border: none; width: auto; font-size: 0.95rem;"
          >
            {#each tahunAjaranList as ta (ta.id)}
              <option value={ta.id}
                >{ta.nama_tahun} {ta.status === 'Active' ? '(Berjalan)' : ''}</option
              >
            {/each}
          </select>
        </div>
      </div>
      <div>
        <button
          class="btn-primary"
          onclick={() => (showAssignModal = true)}
          style="display: inline-flex; align-items: center; gap: 0.5rem;"
        >
          <Icon name="plus" size={16} /> Masukkan Siswa
          {#if siswaTanpaKelas.length > 0}
            <span
              style="background: white; color: var(--color-primary, #3b82f6); padding: 0.1rem 0.5rem; border-radius: 1rem; font-size: 0.75rem; font-weight: bold; margin-left: 0.2rem;"
            >
              {siswaTanpaKelas.length} Belum Rombel
            </span>
          {/if}
        </button>
      </div>
    </div>

    {#if loading}
      <div class="loading-state">Memuat data...</div>
    {:else}
      <!-- Daftar Rombel -->
      <div class="card" style="margin-top: 1rem;">
        <div class="card-header">
          <h3 style="margin: 0; font-size: 1.1rem;">Daftar Rombel Terbentuk</h3>
          <p style="font-size: 0.85rem; color: #64748b; margin: 0.25rem 0 0 0;">
            Di Tahun Ajaran ini
          </p>
        </div>
        <div class="card-body">
          <div class="table-wrapper" style="margin-top: 1rem;">
            <table class="table">
              <thead>
                <tr>
                  <th>Tingkat</th>
                  <th>Nama Kelas</th>
                  <th>Rombel</th>
                  <th style="text-align: center;">Jumlah Siswa</th>
                  <th style="text-align: center;">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {#each kelasRombelList() as item (item.kelas.id + '_' + item.rombel)}
                  <tr>
                    <td
                      ><span class="badge bg-gray" style="font-size: 0.85rem;"
                        >Tingkat {item.kelas.tingkat}</span
                      ></td
                    >
                    <td><strong>{item.kelas.nama_kelas}</strong></td>
                    <td><span class="badge bg-green">Rombel {item.rombel}</span></td>
                    <td style="text-align: center;"><strong>{item.siswa.length}</strong> Siswa</td>
                    <td style="text-align: center;">
                      <button
                        class="btn-secondary"
                        style="padding: 0.3rem 0.6rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.3rem;"
                        onclick={() => {
                          selectedKelasId = item.kelas.id;
                          selectedRombel = item.rombel;
                          viewMode = 'detail';
                        }}
                      >
                        <Icon name="eye" size={14} /> Lihat Detail
                      </button>
                    </td>
                  </tr>
                {:else}
                  <tr>
                    <td colspan="5" style="text-align: center; color: #64748b; padding: 2rem;"
                      >Belum ada rombel yang terbentuk di Tahun Ajaran ini.</td
                    >
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    {/if}
  {:else}
    <!-- Detail Rombel -->
    <div class="header-action" style="align-items: center;">
      <div style="display: flex; gap: 1rem; align-items: center;">
        <button
          class="btn-secondary"
          onclick={() => {
            viewMode = 'dashboard';
            selectedKelasId = '';
            selectedRombel = '';
            loadData();
          }}
          style="display: inline-flex; align-items: center; gap: 0.4rem;"
        >
          <Icon name="arrowLeft" size={16} /> Kembali
        </button>
        <div>
          <h2 class="page-title">{kelasName}</h2>
          <p class="page-subtitle">{siswaDalamKelas.length} Siswa</p>
        </div>
      </div>
      <div>
        <button
          class="btn-danger"
          onclick={keluarkanSemua}
          disabled={siswaDalamKelas.length === 0 || processing}
          style="display: inline-flex; align-items: center; gap: 0.5rem;"
        >
          <Icon name="trash" size={16} /> Keluarkan Semua
        </button>
      </div>
    </div>

    {#if loading}
      <div class="loading-state">Memuat data...</div>
    {:else}
      <div class="table-wrapper">
        <table class="table">
          <thead>
            <tr>
              <th>NISN</th>
              <th>Nama Lengkap</th>
              <th>L/P</th>
              <th style="text-align: center;">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {#each siswaDalamKelas as s (s.id)}
              <tr>
                <td><strong>{s.nisn}</strong></td>
                <td>{s.nama_lengkap}</td>
                <td>{s.jenis_kelamin}</td>
                <td style="text-align: center;">
                  <button
                    class="btn-danger"
                    style="padding: 0.3rem 0.6rem; font-size: 0.8rem;"
                    onclick={() => openRemoveModal(s)}>Keluarkan</button
                  >
                </td>
              </tr>
            {:else}
              <tr
                ><td colspan="4" style="text-align: center;">Tidak ada siswa di rombel ini.</td></tr
              >
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

{#if showAssignModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) showAssignModal = false;
    }}
  >
    <div class="modal-content" style="max-width: 700px;">
      <div class="modal-header">
        <h3>Masukkan Siswa ke Rombel</h3>
        <button class="btn-close" onclick={() => (showAssignModal = false)}
          ><Icon name="x" size={20} /></button
        >
      </div>
      <div class="modal-body">
        <div
          style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;"
        >
          <div class="form-group">
            <label style="font-size: 0.85rem; font-weight: bold;">Pilih Kelas Tujuan</label>
            <select bind:value={selectedKelasId} class="form-input">
              <option value="">-- Pilih Kelas --</option>
              {#each kelasList as k (k.id)}
                <option value={k.id}>{k.tingkat} - {k.nama_kelas}</option>
              {/each}
            </select>
          </div>
          <div class="form-group">
            <label style="font-size: 0.85rem; font-weight: bold;">Nama Rombel (Misal: A, B)</label>
            <input
              type="text"
              bind:value={selectedRombel}
              class="form-input"
              placeholder="A, B, C..."
            />
          </div>
          <div class="form-group">
            <label style="font-size: 0.85rem; font-weight: bold;">Filter Kelas Asal</label>
            <select bind:value={filterKelasAsal} class="form-input">
              <option value="Semua">Semua ({siswaTanpaKelas.length})</option>
              {#each daftarKelasAsal() as ka (ka)}
                <option value={ka}
                  >{ka} ({siswaTanpaKelas.filter((s) => s.kelas_asal === ka).length})</option
                >
              {/each}
              {#if siswaTanpaKelas.some((s) => !s.kelas_asal)}
                <option value=""
                  >Tanpa Kelas Asal ({siswaTanpaKelas.filter((s) => !s.kelas_asal).length})</option
                >
              {/if}
            </select>
          </div>
          <div class="form-group">
            <label style="font-size: 0.85rem; font-weight: bold;">Filter L/P</label>
            <select bind:value={filterGender} class="form-input">
              <option value="Semua">Semua</option>
              <option value="L">Laki-laki (L)</option>
              <option value="P">Perempuan (P)</option>
            </select>
          </div>
        </div>

        <div
          class="table-wrapper"
          style="max-height: 400px; overflow-y: auto; margin-bottom: 1rem;"
        >
          <table class="table" style="font-size: 0.9rem;">
            <thead
              style="position: sticky; top: 0; background: white; box-shadow: 0 1px 2px rgba(0,0,0,0.05); z-index: 10;"
            >
              <tr>
                <th style="width: 40px; text-align: center;">
                  <input
                    type="checkbox"
                    onchange={toggleSelectAll}
                    checked={selectedSiswaKiri.size === filteredSiswaTanpaKelas.length &&
                      filteredSiswaTanpaKelas.length > 0}
                  />
                </th>
                <th>NISN</th>
                <th>Nama Siswa ({filteredSiswaTanpaKelas.length})</th>
                <th style="text-align: center;">L/P</th>
                <th>Kelas Asal</th>
              </tr>
            </thead>
            <tbody>
              {#each filteredSiswaTanpaKelas as s (s.id)}
                <tr>
                  <td style="text-align: center;">
                    <input
                      type="checkbox"
                      checked={selectedSiswaKiri.has(s.id)}
                      onchange={() => toggleKiri(s.id)}
                    />
                  </td>
                  <td><strong>{s.nisn}</strong></td>
                  <td>{s.nama_lengkap}</td>
                  <td style="text-align: center;"
                    ><span class="badge bg-gray" style="font-size: 0.8rem;"
                      >{s.jenis_kelamin || '-'}</span
                    ></td
                  >
                  <td
                    ><span class="badge bg-gray" style="font-size: 0.8rem;"
                      >{s.kelas_asal || '-'}</span
                    ></td
                  >
                </tr>
              {:else}
                <tr
                  ><td colspan="5" style="text-align: center; color: #64748b; padding: 2rem;"
                    >Semua siswa sudah masuk rombel.</td
                  ></tr
                >
              {/each}
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => (showAssignModal = false)}>Batal</button>
        <button
          class="btn-primary"
          onclick={assignKeKelas}
          disabled={processing || selectedSiswaKiri.size === 0}
        >
          {processing ? 'Memproses...' : `Masukkan ${selectedSiswaKiri.size} Siswa`}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if removeSiswaState.active}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-overlay"
    onclick={(e) => {
      if (e.target === e.currentTarget) removeSiswaState.active = false;
    }}
  >
    <div class="modal-content modal-sm">
      <div class="modal-header">
        <h3>Keluarkan Siswa</h3>
        <button class="btn-close" onclick={() => (removeSiswaState.active = false)}
          ><Icon name="x" size={20} /></button
        >
      </div>
      <div class="modal-body">
        <p>
          Anda yakin ingin mengeluarkan <strong>{removeSiswaState.nama}</strong> dari rombel ini?
        </p>
        <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.5rem;">
          Siswa akan kembali ke daftar "Belum Masuk Rombel".
        </p>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => (removeSiswaState.active = false)}
          >Batal</button
        >
        <button class="btn-danger" onclick={() => confirmRemove('Biasa')} disabled={processing}
          >Ya, Keluarkan</button
        >
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
    align-items: flex-start;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 0.25rem 0;
  }
  .page-subtitle {
    color: #64748b;
    margin: 0;
    font-size: 0.95rem;
  }
  .card {
    background: white;
    border-radius: 1rem;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    overflow: hidden;
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
  .card-header {
    background: #f8fafc;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
  }
  .card-body {
    padding: 1.5rem;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .form-input {
    padding: 0.6rem 0.8rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.5rem;
    font-size: 0.95rem;
    width: 100%;
  }
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
    background-color: #f8fafc;
    padding: 0.75rem 1rem;
    font-size: 0.85rem;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e2e8f0;
  }
  .table td {
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    color: #1e293b;
    font-size: 0.95rem;
  }
  .btn-primary {
    background-color: #3b82f6;
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .btn-primary:hover {
    background-color: #2563eb;
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-secondary {
    background-color: white;
    color: #475569;
    border: 1px solid #cbd5e1;
    padding: 0.6rem 1.2rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-secondary:hover {
    background-color: #f8fafc;
  }
  .btn-danger {
    background-color: #ef4444;
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  .btn-danger:hover {
    background-color: #dc2626;
  }
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal-content {
    background: white;
    border-radius: 1rem;
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
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
    font-size: 1.25rem;
    color: #1e293b;
  }
  .btn-close {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.25rem;
  }
  .modal-body {
    padding: 1.5rem;
  }
  .modal-footer {
    padding: 1.5rem;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
  }
</style>
