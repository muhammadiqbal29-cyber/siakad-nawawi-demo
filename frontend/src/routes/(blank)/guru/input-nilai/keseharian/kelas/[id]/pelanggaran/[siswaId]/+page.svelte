<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { modalStore } from '$lib/modal.svelte.js';
  import { toastStore } from '$lib/toast.svelte.js';
  import { onMount } from 'svelte';
  import { syncManager } from '$lib/syncManager.svelte.js';
  
  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  
  // URL Params
  const kelasId = $page.params.id;
  const siswaId = $page.params.siswaId;
  const sekolahId = $page.url.searchParams.get('sekolah_id');
  const activeTahun = $page.url.searchParams.get('tahun_ajaran_id');
  const activeSemester = $page.url.searchParams.get('semester_id');
  const namaSiswa = $page.url.searchParams.get('nama') || 'Siswa';
  const kelasLabel = $page.url.searchParams.get('kelas_label') || 'Kelas';
  
  // Data
  let jenisPelanggaranList = $state([]);
  let jenisIqobList = $state([]);
  let pelanggaranCatatan = $state([]);
  let iqobCatatan = $state([]);
  
  // Tab State
  let activeTab = $state('pelanggaran');
  
  // Loading & Error
  let loading = $state(false);
  let pageError = $state('');
  
  // Form Pelanggaran
  let plgFormTanggal = $state(new Date().toISOString().split('T')[0]);
  let plgFormJenisId = $state('');
  let plgFormIqob = $state('');
  let plgFormPoin = $state(0);
  let plgSearchQuery = $state('');
  let plgShowDropdown = $state(false);
  let plgSelectedNama = $state('');
  let pendingPelanggaranList = $state([]);
  let plgFormError = $state('');
  let plgFormLoading = $state(false);
  
  let filteredJenisPelanggaran = $derived(
    jenisPelanggaranList.filter((j) =>
      j.nama.toLowerCase().includes(plgSearchQuery.toLowerCase())
    )
  );
  
  // Form Iqob
  let iqobFormTanggal = $state(new Date().toISOString().split('T')[0]);
  let iqobFormJenisId = $state('');
  let iqobFormPoin = $state(0);
  let iqobSearchQuery = $state('');
  let iqobShowDropdown = $state(false);
  let iqobSelectedNama = $state('');
  let pendingIqobList = $state([]);
  let iqobFormError = $state('');
  let iqobFormLoading = $state(false);
  
  let filteredJenisIqob = $derived(
    jenisIqobList.filter((j) => j.nama.toLowerCase().includes(iqobSearchQuery.toLowerCase()))
  );
  
  // Total Poin
  let totalPoinPelanggaran = $derived(
    pelanggaranCatatan.reduce((sum, item) => sum + item.poin, 0)
  );
  let totalPoinIqob = $derived(
    iqobCatatan.reduce((sum, item) => sum + item.poin, 0)
  );
  let poinAkhir = $derived(totalPoinPelanggaran - totalPoinIqob);
  
  let recommendedIqob = $derived.by(() => {
    if (!jenisIqobList.length) return null;
    if (poinAkhir <= 0) return null;
    let rec = null;
    for (const j of jenisIqobList) {
      if (poinAkhir >= j.poin) {
        if (!rec || j.poin > rec.poin) {
          rec = j;
        }
      }
    }
    return rec;
  });
  
  onMount(() => {
    if (sekolahId && kelasId && siswaId) {
      loadData();
    }
  });
  
  $effect(() => {
    if (typeof window !== 'undefined' && (jenisPelanggaranList.length > 0 || jenisIqobList.length > 0)) {
       const cacheKey = `siakad_offline_pelanggaran_detail_${siswaId}_${activeTahun}_${activeSemester}`;
       localStorage.setItem(cacheKey, JSON.stringify({
         jenisPelanggaranList,
         jenisIqobList,
         pelanggaranCatatan,
         iqobCatatan
       }));
    }
  });

  async function loadData() {
    // 0. OFFLINE-FIRST UX (Stale-While-Revalidate)
    if (typeof window !== 'undefined') {
       const cacheKey = `siakad_offline_pelanggaran_detail_${siswaId}_${activeTahun}_${activeSemester}`;
       const cached = localStorage.getItem(cacheKey);
       if (cached) {
         try {
           const data = JSON.parse(cached);
           jenisPelanggaranList = data.jenisPelanggaranList || [];
           jenisIqobList = data.jenisIqobList || [];
           pelanggaranCatatan = data.pelanggaranCatatan || [];
           iqobCatatan = data.iqobCatatan || [];
           if (jenisPelanggaranList.length > 0 || jenisIqobList.length > 0) {
             loading = false;
           }
         } catch(e) {}
       }
    }

    if (jenisPelanggaranList.length === 0 && jenisIqobList.length === 0) {
      loading = true;
    }
    pageError = '';
    
    await Promise.all([
      loadJenisPelanggaran(),
      loadJenisIqob(),
      loadCatatan()
    ]);
    
    loading = false;
  }
  
  async function loadJenisPelanggaran() {
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${sekolahId}/pelanggaran/jenis`, {
        credentials: 'include'
      });
      if (res.ok) {
        const body = await res.json();
        jenisPelanggaranList = (body.data || []).filter((j) => j.aktif);
      }
    } catch (err) {
      console.error(err);
    }
  }
  
  async function loadJenisIqob() {
    try {
      const res = await fetch(`${apiUrl}/api/guru/sekolah/${sekolahId}/iqob/jenis`, {
        credentials: 'include'
      });
      if (res.ok) {
        const body = await res.json();
        jenisIqobList = (body.data || []).filter((j) => j.aktif);
      }
    } catch (err) {
      console.error(err);
    }
  }
  
  async function loadCatatan() {
    try {
      // Load Pelanggaran
      const urlPlg = new URL(`${apiUrl}/api/guru/kelas/${kelasId}/pelanggaran`);
      urlPlg.searchParams.append('sekolah_id', sekolahId);
      if (activeTahun) urlPlg.searchParams.append('tahun_ajaran_id', activeTahun);
      if (activeSemester) urlPlg.searchParams.append('semester_id', activeSemester);
      
      const resPlg = await fetch(urlPlg.toString(), { credentials: 'include' });
      if (resPlg.ok) {
        const body = await resPlg.json();
        const map = body.data?.catatan || {};
        
        pelanggaranCatatan = map[siswaId] || [];
      }
      
      // Load Iqob
      const urlIqob = new URL(`${apiUrl}/api/guru/kelas/${kelasId}/iqob`);
      urlIqob.searchParams.append('sekolah_id', sekolahId);
      if (activeTahun) urlIqob.searchParams.append('tahun_ajaran_id', activeTahun);
      if (activeSemester) urlIqob.searchParams.append('semester_id', activeSemester);
      
      const resIqob = await fetch(urlIqob.toString(), { credentials: 'include' });
      if (resIqob.ok) {
        const body = await resIqob.json();
        const map = body.data?.catatan || {};
        
        iqobCatatan = map[siswaId] || [];
      }
    } catch (err) {
      pageError = 'Gagal memuat catatan siswa';
      console.error(err);
    }
  }
  
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  
  // --- Pelanggaran Logic ---
  function directAddPelanggaran(j) {
    if (!plgFormTanggal) {
      plgFormError = 'Harap isi Tanggal Kejadian terlebih dahulu';
      return;
    }
    plgFormError = '';
    pendingPelanggaranList = [
      ...pendingPelanggaranList,
      {
        jenis_pelanggaran_id: j.id,
        nama: j.nama,
        tanggal: plgFormTanggal,
        poin: j.poin,
        iqob: '' // Dapat diisi di daftar tunggu
      }
    ];
    plgSearchQuery = '';
  }
  function removePendingPelanggaran(index) {
    pendingPelanggaranList = pendingPelanggaranList.filter((_, i) => i !== index);
  }
  async function submitPelanggaran() {
    if (pendingPelanggaranList.length === 0) {
      plgFormError = 'Tambahkan setidaknya satu pelanggaran ke daftar';
      return;
    }
    plgFormLoading = true;
    plgFormError = '';
    try {
      const url = new URL(`${apiUrl}/api/guru/pelanggaran/catatan`);
      if (activeTahun) url.searchParams.append('tahun_ajaran_id', activeTahun);
      if (activeSemester) url.searchParams.append('semester_id', activeSemester);
      
      pendingPelanggaranList.forEach((item) => {
        syncManager.enqueue(url.toString(), {
            siswa_id: Number(siswaId),
            sekolah_id: Number(sekolahId),
            jenis_pelanggaran_id: Number(item.jenis_pelanggaran_id),
            tanggal: item.tanggal,
            poin: Number(item.poin),
            iqob: item.iqob || ''
        }, { method: 'POST' });
        
        // Optimistic update
        pelanggaranCatatan.push({
           nama_pelanggaran: item.nama,
           tanggal: item.tanggal,
           iqob: item.iqob || '',
           poin: Number(item.poin),
           id: 'pending-' + Date.now()
        });
      });
      
      pelanggaranCatatan = [...pelanggaranCatatan];
      toastStore.show('Pelanggaran berhasil dicatat', 'success');
      pendingPelanggaranList = [];
    } catch (err) {
      plgFormError = err.message;
    } finally {
      plgFormLoading = false;
    }
  }
  async function hapusCatatan(id) {
    if (!(await modalStore.show({ message: 'Hapus catatan pelanggaran ini?' }))) return;
    try {
      const res = await fetch(`${apiUrl}/api/guru/pelanggaran/catatan/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      await loadCatatan();
    } catch (err) {
      toastStore.show(err.message, 'info');
    }
  }
  
  // --- Iqob Logic ---
  function directAddIqob(j) {
    if (!iqobFormTanggal) {
      iqobFormError = 'Harap isi Tanggal Pelaksanaan terlebih dahulu';
      return;
    }
    iqobFormError = '';
    pendingIqobList = [
      ...pendingIqobList,
      {
        jenis_iqob_id: j.id,
        nama: j.nama,
        tanggal: iqobFormTanggal,
        poin: j.poin
      }
    ];
    iqobSearchQuery = '';
  }
  function applyRecommendedIqob() {
    if (recommendedIqob) {
      directAddIqob(recommendedIqob);
    }
  }
  function removePendingIqob(index) {
    pendingIqobList = pendingIqobList.filter((_, i) => i !== index);
  }
  async function submitIqob() {
    if (pendingIqobList.length === 0) {
      iqobFormError = 'Tambahkan setidaknya satu iqob ke daftar';
      return;
    }
    iqobFormLoading = true;
    iqobFormError = '';
    try {
      const url = new URL(`${apiUrl}/api/guru/iqob/catatan`);
      if (activeTahun) url.searchParams.append('tahun_ajaran_id', activeTahun);
      if (activeSemester) url.searchParams.append('semester_id', activeSemester);
      
      pendingIqobList.forEach((item) => {
        syncManager.enqueue(url.toString(), {
            siswa_id: Number(siswaId),
            sekolah_id: Number(sekolahId),
            jenis_iqob_id: Number(item.jenis_iqob_id),
            tanggal: item.tanggal,
            poin: Number(item.poin)
        }, { method: 'POST' });
        
        // Optimistic update
        iqobCatatan.push({
           nama_iqob: item.nama,
           tanggal: item.tanggal,
           poin: Number(item.poin),
           id: 'pending-' + Date.now()
        });
      });
      
      iqobCatatan = [...iqobCatatan];
      toastStore.show('Iqob berhasil dicatat', 'success');
      pendingIqobList = [];
    } catch (err) {
      iqobFormError = err.message;
    } finally {
      iqobFormLoading = false;
    }
  }
  async function hapusCatatanIqob(id) {
    if (!(await modalStore.show({ message: 'Hapus catatan iqob ini?' }))) return;
    try {
      const res = await fetch(`${apiUrl}/api/guru/iqob/catatan/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Gagal menghapus');
      await loadCatatan();
      toastStore.show('Catatan iqob dihapus', 'info');
    } catch (err) {
      alert(err.message);
    }
  }

  async function doPemutihan() {
    if (poinAkhir <= 0) {
      toastStore.show('Poin sudah 0, tidak perlu pemutihan', 'info');
      return;
    }
    if (!(await modalStore.show({ message: 'Lakukan pemutihan poin untuk siswa ini? Seluruh poin akan di-reset (dinolkan).' }))) return;
    
    iqobFormLoading = true;
    try {
      const res = await fetch(`${apiUrl}/api/guru/iqob/pemutihan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siswa_id: Number(siswaId),
          sekolah_id: Number(sekolahId),
          tanggal: iqobFormTanggal || new Date().toISOString().split('T')[0],
          keterangan: 'Pemutihan Manual'
        })
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.message || 'Gagal melakukan pemutihan');
      }
      toastStore.show('Pemutihan berhasil dilakukan', 'success');
      await loadCatatan();
    } catch (err) {
      toastStore.show(err.message, 'error');
    } finally {
      iqobFormLoading = false;
    }
  }
  
  let backUrl = $derived(
    `/guru/input-nilai/keseharian/kelas/${kelasId}?sekolah_id=${sekolahId}&tab=pelanggaran_iqob`
  );
</script>

<svelte:head>
  <title>Input Pelanggaran & Iqob - {namaSiswa}</title>
</svelte:head>

<main class="sheet-page">
  <div class="desktop-only">
    <div class="back-button-wrapper">
      <button type="button" class="back-button" onclick={() => goto(backUrl)}>
        <Icon name="arrowLeft" size={16} /> Kembali
      </button>
    </div>

    <section class="sheet-header">
      <div>
        <h1>Pelanggaran & Iqob</h1>
        <p>{namaSiswa} · Kelas {kelasLabel}</p>
      </div>
      <div class="meta-box">
        <span>Sisa Poin</span>
        <strong>{poinAkhir}</strong>
        <small>{loading ? 'Memuat...' : 'Data aktif'}</small>
      </div>
    </section>
  </div>

  <!-- Mobile Header -->
  <div class="mobile-app-ui mobile-app-header mobile-only">
     <div class="app-header-top">
         <a class="back-btn" href={backUrl}>
             <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                 <path d="M8 2L3.5 6.5L8 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
             </svg>
             Kembali
         </a>
         <div class="page-title">Pelanggaran & Iqob</div>
     </div>
     <div class="student-row">
         <div class="student-avatar" style="background: linear-gradient(135deg, #10b981, #047857);">{namaSiswa.charAt(0)}</div>
         <div class="student-sub"><b>{namaSiswa}</b> · Kelas {kelasLabel}</div>
     </div>
     <div class="stat-card">
         <div class="stat-item" style="border-right: none; padding-bottom: 0;">
             <div class="stat-label">Sisa Poin Siswa</div>
             <div class="stat-num" style="color: {poinAkhir > 0 ? '#ef4444' : '#16a34a'};">{poinAkhir}</div>
         </div>
     </div>
  </div>

  {#if pageError}
    <div class="sheet-alert">{pageError}</div>
  {/if}

  {#if loading}
    <div class="sheet-loading">Memuat data...</div>
  {:else}
    <section class="sheet-wrap" style="padding: 1.5rem; box-sizing: border-box;">
      <div class="tabs" style="margin-bottom: 1.5rem; display: flex; gap: 0.5rem; border-bottom: 2px solid #f1f5f9; padding-bottom: 0.5rem;">
        <button
          class="tab-btn {activeTab === 'pelanggaran' ? 'active' : ''}"
          onclick={() => (activeTab = 'pelanggaran')}
          style="background: none; border: none; font-size: 1rem; font-weight: 700; color: {activeTab === 'pelanggaran' ? '#0f172a' : '#94a3b8'}; border-bottom: {activeTab === 'pelanggaran' ? '2px solid #0f172a' : '2px solid transparent'}; cursor: pointer; padding: 0.25rem 0.5rem;"
        >
          Pelanggaran
        </button>
        <button
          class="tab-btn {activeTab === 'iqob' ? 'active' : ''}"
          onclick={() => (activeTab = 'iqob')}
          style="background: none; border: none; font-size: 1rem; font-weight: 700; color: {activeTab === 'iqob' ? '#0f172a' : '#94a3b8'}; border-bottom: {activeTab === 'iqob' ? '2px solid #0f172a' : '2px solid transparent'}; cursor: pointer; padding: 0.25rem 0.5rem;"
        >
          Iqob
        </button>
      </div>

      <div class="tab-content">
        {#if activeTab === 'pelanggaran'}
          <!-- Form Tambah Pelanggaran -->
          <div class="form-section">
            <h4 style="margin-bottom: 1rem; color: #1e293b; font-size: 1rem;">Tambah Pelanggaran</h4>
            
            

            {#if pendingPelanggaranList.length > 0}
              <div class="pending-list" style="margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                <h5 style="margin-bottom: 0.8rem; color: #1e293b; font-size: 0.95rem;">
                  Daftar Pelanggaran Akan Disimpan:
                </h5>
                <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                  {#each pendingPelanggaranList as p, i}
                    <div class="pending-item-card">
                      <div style="flex: 1;">
                        <div style="font-weight: 600; color: #0f172a; font-size: 0.9rem;">
                          {p.nama}
                        </div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px; ">
                          {formatDate(p.tanggal)} • <span style="color:#ef4444; font-weight:600;">+{p.poin} Poin</span>
                        </div>
                        
                      </div>
                      <button class="btn-icon" onclick={() => removePendingPelanggaran(i)} style="align-self: flex-start; margin-left: 1rem;">
                        <Icon name="x" size={16} color="#ef4444" />
                      </button>
                    </div>
                  {/each}
                </div>
                <div style="margin-top: 1.5rem; text-align: right;">
                  <button
                    class="btn-success"
                    onclick={submitPelanggaran}
                    disabled={plgFormLoading}
                    style="padding: 0.6rem 1.5rem; font-size: 0.95rem;"
                  >
                    {plgFormLoading ? 'Menyimpan...' : 'Simpan Semua Pelanggaran'}
                  </button>
                </div>
              </div>
            {/if}

            <div style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-end; flex-wrap: wrap;">
              <div class="form-group" style="flex: 1; min-width: 150px; margin: 0;">
                <label>Tanggal Kejadian</label>
                <input type="date" bind:value={plgFormTanggal} class="input-modern" />
              </div>
              <div class="form-group" style="flex: 2; min-width: 250px; margin: 0; position: relative;">
                <label>Cari Pelanggaran</label>
                <input type="text" bind:value={plgSearchQuery} placeholder="Ketik untuk mencari..." class="input-modern" />
              </div>
            </div>

            <div class="selection-grid">
              {#each filteredJenisPelanggaran as j}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="selection-card" onclick={() => directAddPelanggaran(j)}>
                  <div style="font-weight: 600; color: #0f172a; font-size: 0.9rem;">{j.nama}</div>
                  <div style="font-size: 0.85rem; color: #ef4444; margin-top: 0.3rem;">
                    +{j.poin} Poin
                  </div>
                </div>
              {:else}
                <div style="padding: 1rem; color: #64748b; font-size: 0.9rem; text-align: center; grid-column: 1 / -1;">
                  Tidak ada pelanggaran ditemukan.
                </div>
              {/each}
            </div>

            {#if plgFormError}
              <div class="alert-error" style="margin-top: 1rem;">{plgFormError}</div>
            {/if}
          </div>
          <hr style="margin: 2rem 0; border: none; border-top: 1px dashed #cbd5e1;" />

          <!-- Histori Pelanggaran -->
          <div>
            <h4 style="margin-bottom: 1rem; color: #1e293b; font-size: 1rem;">Histori Pelanggaran</h4>
            {#if pelanggaranCatatan.length > 0}
              <div class="history-list">
                {#each pelanggaranCatatan as c}
                  <div class="history-item">
                    <div style="flex: 1;">
                      <div style="font-weight: 600; color: #0f172a; font-size: 0.9rem;">
                        {c.nama_pelanggaran}
                      </div>
                      <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
                        {formatDate(c.tanggal)}
                        {#if c.iqob}<br />Iqob: {c.iqob}{/if}
                      </div>
                    </div>
                    <div style="font-weight: 800; color: #ef4444;">+{c.poin} Poin</div>
                    <button
                      class="btn-icon-soft"
                      title="Hapus"
                      onclick={() => hapusCatatan(c.id)}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-text">Tidak ada histori pelanggaran.</div>
            {/if}
          </div>
        {/if}

        {#if activeTab === 'iqob'}
          <!-- Form Tambah Iqob -->
          <div class="form-section">
            <h4 style="margin-bottom: 1rem; color: #1e293b; font-size: 1rem;">Tambah Pelaksanaan Iqob</h4>

            <div class="info-banner" style="margin-bottom: 1.5rem;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                  <div style="font-size: 0.8rem; color: #64748b;">Total Poin Terkumpul</div>
                  <div style="font-weight: 800; font-size: 1.5rem; color: #ef4444;">{poinAkhir}</div>
                </div>
                {#if recommendedIqob}
                  <div style="text-align: right;">
                    <div style="font-size: 0.8rem; color: #64748b;">Rekomendasi Iqob:</div>
                    <div style="font-weight: 700; color: #0f172a; font-size: 0.9rem;">
                      {recommendedIqob.nama} (Poin: -{recommendedIqob.poin})
                    </div>
                    <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top:0.25rem;">
                      <button class="btn-outline-sm" onclick={applyRecommendedIqob}>
                        Gunakan Rekomendasi
                      </button>
                      <button class="btn-outline-sm" onclick={doPemutihan} disabled={iqobFormLoading} style="color: #16a34a; border-color: #16a34a;">
                        Pemutihan (Reset)
                      </button>
                    </div>
                  </div>
                {:else}
                  <div style="text-align: right;">
                     <div style="font-size: 0.8rem; color: #64748b;">Belum ada rekomendasi iqob</div>
                     {#if poinAkhir > 0}
                       <button class="btn-outline-sm" onclick={doPemutihan} disabled={iqobFormLoading} style="margin-top:0.25rem; color: #16a34a; border-color: #16a34a;">
                         Pemutihan (Reset)
                       </button>
                     {/if}
                  </div>
                {/if}
              </div>
            </div>

            

            {#if pendingIqobList.length > 0}
              <div class="pending-list" style="margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 12px; border: 1px solid #e2e8f0;">
                <h5 style="margin-bottom: 0.8rem; color: #334155; font-size: 0.95rem;">
                  Daftar Pelaksanaan Iqob Akan Disimpan:
                </h5>
                <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                  {#each pendingIqobList as p, i}
                    <div class="pending-item-card">
                      <div style="flex: 1;">
                        <div style="font-weight: 600; color: #0f172a; font-size: 0.9rem;">
                          {p.nama}
                        </div>
                        <div style="font-size: 0.8rem; color: #64748b; margin-top: 4px;">
                          {formatDate(p.tanggal)} • <span style="color:#16a34a; font-weight:600;">-{p.poin} Poin</span>
                        </div>
                      </div>
                      <button class="btn-icon" onclick={() => removePendingIqob(i)} style="align-self: flex-start; margin-left: 1rem;">
                        <Icon name="x" size={16} color="#ef4444" />
                      </button>
                    </div>
                  {/each}
                </div>
                <div style="margin-top: 1.5rem; text-align: right;">
                  <button class="btn-success" onclick={submitIqob} disabled={iqobFormLoading} style="padding: 0.6rem 1.5rem; font-size: 0.95rem;">
                    {iqobFormLoading ? 'Menyimpan...' : 'Simpan Semua Pelaksanaan Iqob'}
                  </button>
                </div>
              </div>
            {/if}

            <div style="display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-end; flex-wrap: wrap;">
              <div class="form-group" style="flex: 1; min-width: 150px; margin: 0;">
                <label>Tanggal Pelaksanaan</label>
                <input type="date" bind:value={iqobFormTanggal} class="input-modern" />
              </div>
              <div class="form-group" style="flex: 2; min-width: 250px; margin: 0; position: relative;">
                <label>Cari Iqob</label>
                <input type="text" bind:value={iqobSearchQuery} placeholder="Ketik untuk mencari..." class="input-modern" />
              </div>
            </div>

            <div class="selection-grid">
              {#each filteredJenisIqob as j}
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div class="selection-card" onclick={() => directAddIqob(j)}>
                  <div style="font-weight: 600; color: #0f172a; font-size: 0.9rem;">{j.nama}</div>
                  <div style="font-size: 0.85rem; color: #16a34a; margin-top: 0.3rem;">
                    -{j.poin} Poin
                  </div>
                </div>
              {:else}
                <div style="padding: 1rem; color: #64748b; font-size: 0.9rem; text-align: center; grid-column: 1 / -1;">
                  Tidak ada iqob ditemukan.
                </div>
              {/each}
            </div>

            {#if iqobFormError}
              <div class="alert-error" style="margin-top: 1rem;">{iqobFormError}</div>
            {/if}
          </div>
          <hr style="margin: 2rem 0; border: none; border-top: 1px dashed #cbd5e1;" />

          <!-- Histori Iqob -->
          <div>
            <h4 style="margin-bottom: 1rem; color: #1e293b; font-size: 1rem;">Histori Iqob</h4>
            {#if iqobCatatan.length > 0}
              <div class="history-list">
                {#each iqobCatatan as c}
                  <div class="history-item">
                    <div style="flex: 1;">
                      <div style="font-weight: 600; color: #0f172a; font-size: 0.9rem;">
                        {c.nama_iqob}
                      </div>
                      <div style="font-size: 0.8rem; color: #64748b; margin-top: 2px;">
                        {formatDate(c.tanggal)}
                      </div>
                    </div>
                    <div style="font-weight: 800; color: #16a34a;">-{c.poin} Poin</div>
                    <button
                      class="btn-icon-soft"
                      title="Hapus"
                      onclick={() => hapusCatatanIqob(c.id)}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="empty-text">Tidak ada histori iqob.</div>
            {/if}
          </div>
        {/if}
      </div>
    </section>
  {/if}
</main>

<style>
  /* --- Sheet Page --- */
  .sheet-page {
    min-height: 100vh;
    padding: 24px;
    background: transparent;
  }
  .sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    max-width: 1320px;
    margin: 0 auto 12px;
  }
  .back-button-wrapper {
    max-width: 1320px;
    margin: 0 auto;
    display: flex;
    justify-content: flex-start;
  }
  .back-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 16px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    color: #475569;
    padding: 8px 16px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    transition: all 0.2s ease;
  }
  .back-button:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #0f172a;
  }
  .sheet-header h1 {
    margin: 0;
    font-size: 22px;
    line-height: 1.2;
  }
  .sheet-header p {
    margin: 4px 0 0;
    color: #4b5563;
    font-size: 13px;
  }
  .meta-box {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 160px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #fff;
    padding: 12px 16px;
    text-align: right;
    font-size: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }
  .meta-box span {
    color: #4b5563;
  }
  .meta-box strong {
    font-size: 14px;
    color: #111827;
  }
  .meta-box small {
    color: #16a34a;
    font-size: 11px;
    font-weight: 700;
  }
  .sheet-wrap {
    max-width: 1320px;
    margin: 0 auto;
    overflow: auto;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  .sheet-alert {
    max-width: 1320px;
    margin: 0 auto 12px;
    border: 1px solid #fca5a5;
    background: #fef2f2;
    color: #991b1b;
    padding: 8px 10px;
    font-size: 12px;
    font-weight: 700;
  }
  .sheet-loading {
    max-width: 1320px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
    color: #6b7280;
    font-size: 13px;
    border: 1px solid #e5e7eb;
    background: #fff;
  }
  
  /* --- Mobile Header --- */
  .mobile-app-ui {
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
    margin: -24px -24px 1rem -24px;
    padding-top: 12px;
  }
  .app-header-top {
    display: flex;
    align-items: center;
    padding: 0 1rem 1rem;
    border-bottom: 1px solid #f1f5f9;
  }
  .back-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #64748b;
    text-decoration: none;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .page-title {
    flex: 1;
    text-align: center;
    font-weight: 700;
    color: #0f172a;
    margin-right: 60px;
  }
  .student-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 1.25rem 1rem;
    background: #fff;
  }
  .student-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 700;
    color: #fff;
  }
  .student-sub {
    flex: 1;
    font-size: 0.9rem;
    color: #475569;
  }
  .stat-card {
    display: flex;
    margin: 0 1rem 1.25rem;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
  }
  .stat-item {
    flex: 1;
    padding: 0.75rem;
    border-right: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .stat-label {
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }
  .stat-num {
    font-size: 1.1rem;
    font-weight: 800;
    color: #0f172a;
  }
  
  /* --- Modal Forms --- */
  .form-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .form-group label {
    font-size: 0.85rem;
    font-weight: 600;
    color: #334155;
  }
  .input-modern {
    padding: 0.6rem 0.85rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.95rem;
    outline: none;
    transition: all 0.2s;
  }
  .input-modern:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }
  .input-modern:disabled {
    background: #f1f5f9;
    color: #94a3b8;
  }
  .dropdown-trigger {
    padding: 0.6rem 0.85rem;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 0.95rem;
    background: #fff;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    margin-top: 4px;
    z-index: 10;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .dropdown-search {
    padding: 0.5rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .dropdown-search input {
    border: none;
    outline: none;
    width: 100%;
    font-size: 0.9rem;
  }
  .dropdown-list {
    max-height: 200px;
    overflow-y: auto;
  }
  .dropdown-item {
    padding: 0.5rem 1rem;
    cursor: pointer;
    border-bottom: 1px solid #f1f5f9;
  }
  .dropdown-item:hover {
    background: #f8fafc;
  }
  .text-muted {
    color: #94a3b8;
  }
  .btn-primary {
    background: #6366f1;
    color: #fff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .btn-success {
    background: #10b981;
    color: #fff;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .btn-success:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }
  .btn-outline-sm {
    background: transparent;
    border: 1px solid #cbd5e1;
    color: #475569;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-icon, .btn-icon-soft {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.25rem;
  }
  .btn-icon-soft {
    color: #ef4444;
    background: #fee2e2;
    border-radius: 6px;
  }
  .alert-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #ef4444;
    padding: 0.75rem;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
  }
  .info-banner {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 1rem;
    border-radius: 8px;
  }
  
  .selection-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0.75rem;
    margin-bottom: 1rem;
    max-height: 400px;
    overflow-y: auto;
    padding-right: 0.5rem;
  }
  .selection-grid::-webkit-scrollbar {
    width: 6px;
  }
  .selection-grid::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 10px;
  }
  .selection-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    padding: 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .selection-card:hover {
    border-color: #6366f1;
    box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.1);
    transform: translateY(-2px);
  }
  
  .pending-item-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  }

  
  .pending-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem;
    border-bottom: 1px solid #f1f5f9;
  }
  .pending-item:last-child {
    border-bottom: none;
  }
  .history-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    background: #f8fafc;
  }
  .empty-text {
    color: #64748b;
    font-size: 0.9rem;
    text-align: center;
    padding: 2rem;
    border: 1px dashed #cbd5e1;
    border-radius: 8px;
  }

  .desktop-only { display: block; }
  .mobile-only { display: none !important; }

  @media (min-width: 640px) {
    .form-grid {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 768px) {
    .desktop-only { display: none !important; }
    .mobile-only { display: block !important; }
    
    .sheet-page {
      padding: 12px;
    }
    .sheet-header {
      align-items: stretch;
      flex-direction: column;
    }
    .meta-box {
      text-align: left;
    }
    .mobile-app-ui {
      margin: -12px -12px 1rem -12px;
    }
  }
</style>
