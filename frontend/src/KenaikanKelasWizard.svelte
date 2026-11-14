<script>
  import { toastStore } from '$lib/toast.svelte.js';
  import { onMount } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  let { sekolahId, kelasList, siswaList, tahunAjaranList, onClose } = $props();

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let processing = $state(false);
  let step = $state(1); // 1: Tandai, 2: Proses, 3: Atur Rombel
  let errorMessage = $state('');
  let partialWarningMessage = $state('');

  // Tahun Ajaran
  let activeTA = $derived(tahunAjaranList.find((t) => t.status === 'Active'));
  let nextTA = $derived(
    tahunAjaranList.find((t) => activeTA && t.tahun_awal === activeTA.tahun_awal + 1)
  );

  // Data Siswa Kenaikan (Fase 1)
  // Bentuk state: { [siswa_id]: 'Naik Kelas' | 'Tinggal Kelas' | 'Lulus' }
  let statusSiswa = $state({});

  // Init default statuses
  onMount(() => {
    let initial = {};
    for (const siswa of siswaList) {
      if (siswa.status === 'Aktif' && siswa.kelas_id) {
        const k = kelasList.find((x) => x.id === siswa.kelas_id);
        if (k) {
          // Assume kelas 6, 9, 12 is 'kelas akhir'
          const isKelasAkhir = ['6', '9', '12', 'VI', 'IX', 'XII'].includes(
            k.tingkat.toString().toUpperCase()
          );
          initial[siswa.id] = isKelasAkhir ? 'Lulus' : 'Naik Kelas';
        }
      }
    }
    statusSiswa = initial;
  });

  // Grouping students by their master class for Phase 1 view
  let siswaByKelas = $derived(() => {
    const map = {};
    kelasList.forEach((k) => {
      map[k.id] = {
        kelas: k,
        siswa: siswaList
          .filter((s) => s.status === 'Aktif' && s.kelas_id === k.id)
          .sort((a, b) => a.nama_lengkap.localeCompare(b.nama_lengkap)),
        isKelasAkhir: ['6', '9', '12', 'VI', 'IX', 'XII'].includes(
          k.tingkat.toString().toUpperCase()
        )
      };
    });
    return Object.values(map).filter((group) => group.siswa.length > 0);
  });

  // Statistics for Phase 2
  let statNaik = $derived(Object.values(statusSiswa).filter((v) => v === 'Naik Kelas').length);
  let statLulus = $derived(Object.values(statusSiswa).filter((v) => v === 'Lulus').length);
  let statTinggal = $derived(
    Object.values(statusSiswa).filter((v) => v === 'Tinggal Kelas').length
  );

  function toggleStatus(siswaId, defaultStatus) {
    if (statusSiswa[siswaId] === 'Tinggal Kelas') {
      statusSiswa[siswaId] = defaultStatus;
    } else {
      statusSiswa[siswaId] = 'Tinggal Kelas';
    }
  }

  async function jalankanProsesOtomatis() {
    if (!activeTA || !nextTA) {
      errorMessage =
        'Tahun ajaran aktif atau tahun ajaran berikutnya (Ganjil) belum dikonfigurasi!';
      return;
    }

    processing = true;
    errorMessage = '';
    try {
      const dataSiswaPayload = Object.entries(statusSiswa).map(([id, status_akhir]) => ({
        siswa_id: parseInt(id),
        status_akhir
      }));

      const res = await fetch(`${apiUrl}/api/siswa/kenaikan-kelas`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Sekolah-ID': sekolahId.toString()
        },
        body: JSON.stringify({
          tahun_ajaran_id: activeTA.id,
          data_siswa: dataSiswaPayload
        }),
        credentials: 'include'
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || 'Gagal memproses kenaikan kelas');
      }

      if (body.partial_success) {
        partialWarningMessage = body.message;
      } else {
        partialWarningMessage = '';
      }

      // Success! Proceed to step 3 (Atur Rombel)
      step = 3;
      // We should probably reload the student data to get the updated status and riwayatkelas
      await fetchUpdatedSiswa();
    } catch (err) {
      errorMessage = err.message;
    } finally {
      processing = false;
    }
  }

  async function fetchUpdatedSiswa() {
    try {
      const res = await fetch(`${apiUrl}/api/sekolah/${sekolahId}/siswa?limit=10000`, {
        credentials: 'include'
      });
      if (res.ok) {
        const payload = await res.json();
        siswaList = payload.data || [];
      }
    } catch (err) {
      console.error(err);
    }
  }

  function handleClose() {
    if (onClose) onClose();
  }

  // --- PHASE 3 LOGIC (Smart Placement) ---
  // Students who are active, but have NO kelas_id (belum dirombel).
  // Wait, if they just went through promotion, they are now active in the NEXT TA.
  // Their kelas_id is nil, but they have 'mantan_kelas'.
  let belumDirombel = $derived(siswaList.filter((s) => s.status === 'Aktif' && !s.kelas_id));

  // The admin selects a target Tingkat/Kelas
  let phase3TargetKelasId = $state('');

  // Available target classes
  let availableTargetClasses = $derived(kelasList);

  // New rombels they want to distribute to
  let autoRombelInput = $state('A, B');

  async function handleAutoDistribute() {
    if (!phase3TargetKelasId) {
      toastStore.show('Pilih kelas tujuan terlebih dahulu!', 'info');
      return;
    }
    const rombelNames = autoRombelInput
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r !== '');
    if (rombelNames.length === 0) {
      toastStore.show('Masukkan nama rombel (Misal: A, B)', 'info');
      return;
    }

    // Filter students we want to assign. (For example, we only auto-distribute the students whose tingkat should naturally flow to this class).
    // The user can manually filter them by `mantan_kelas` in a full implementation, but for now we distribute ALL checked students or ALL available students.
    // Let's just distribute ALL in `belumDirombel` for simplicity.
    if (belumDirombel.length === 0) {
      toastStore.show('Tidak ada siswa yang perlu dirombel.', 'info');
      return;
    }

    processing = true;
    try {
      // Split into males and females
      const males = belumDirombel.filter((s) => s.jenis_kelamin === 'L');
      const females = belumDirombel.filter((s) => s.jenis_kelamin === 'P');

      // Sort or shuffle (for simplicity, we just distribute sequentially)
      const assignmentLists = Array.from({ length: rombelNames.length }, () => []);

      let rIndex = 0;
      for (const s of males) {
        assignmentLists[rIndex].push(s);
        rIndex = (rIndex + 1) % rombelNames.length;
      }

      rIndex = 0;
      for (const s of females) {
        assignmentLists[rIndex].push(s);
        rIndex = (rIndex + 1) % rombelNames.length;
      }

      // Execute assignment requests sequentially
      for (let i = 0; i < rombelNames.length; i++) {
        if (assignmentLists[i].length === 0) continue;

        const payload = {
          siswa_ids: assignmentLists[i].map((s) => s.id),
          rombel: rombelNames[i]
        };

        const res = await fetch(`${apiUrl}/api/kelas/${phase3TargetKelasId}/assign`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Sekolah-ID': sekolahId.toString()
          },
          body: JSON.stringify(payload),
          credentials: 'include'
        });

        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.message || `Gagal mengatur rombel ${rombelNames[i]}`);
        }
      }

      toastStore.show('Auto Distribute Berhasil!', 'info');
      await fetchUpdatedSiswa();
    } catch (err) {
      toastStore.show('Error: ' + err.message, 'info');
    } finally {
      processing = false;
    }
  }
</script>

<div class="wizard-overlay">
  <div class="wizard-container">
    <div class="wizard-header">
      <div class="header-left">
        <h2>Kenaikan kelas</h2>
        <div class="header-sub">
          Tahun ajaran {activeTA?.nama_tahun || '?'} → {nextTA?.nama_tahun || '?'}
        </div>
      </div>
      <div class="stepper">
        <div class="step {step === 1 ? 'active' : step > 1 ? 'completed' : ''}">
          <div class="step-icon">
            {#if step > 1}<Icon name="check" size={16} />{:else}1{/if}
          </div>
          Tandai pengecualian
        </div>
        <div class="step {step === 2 ? 'active' : step > 2 ? 'completed' : ''}">
          <div class="step-icon">
            {#if step > 2}<Icon name="check" size={16} />{:else}2{/if}
          </div>
          Proses otomatis
        </div>
        <div class="step {step === 3 ? 'active' : ''}">
          <div class="step-icon">3</div>
          Atur rombel
        </div>
      </div>
      <button class="btn-close" onclick={handleClose}><Icon name="x" size={24} /></button>
    </div>

    <div class="wizard-body">
      {#if step === 1}
        <!-- PHASE 1 -->
        <div class="info-badges">
          <div class="badge-item">
            <Icon name="calendar" size={16} /> Dari
            <strong>{activeTA?.nama_tahun} {activeTA?.semester}</strong>
          </div>
          <div class="badge-item">
            <Icon name="arrowRight" size={16} /> Ke <strong>{nextTA?.nama_tahun} Ganjil</strong>
          </div>
          <div class="badge-item">
            <Icon name="users" size={16} /> Total siswa
            <strong
              >{siswaList.filter((s) => s.status === 'Aktif' && s.kelas_id).length} siswa</strong
            >
          </div>
        </div>

        {#if errorMessage}
          <div class="error-banner">{errorMessage}</div>
        {/if}
        {#if !nextTA}
          <div class="error-banner">
            <Icon name="alertTriangle" size={20} />
            Tidak ada Tahun Ajaran (Semester Ganjil) yang disiapkan untuk tahun depan. Silakan buat di
            menu Manajemen Tahun Ajaran terlebih dahulu.
          </div>
        {/if}

        <div class="warning-banner">
          <Icon name="alertTriangle" size={20} class="text-warning" />
          <div style="flex:1;">
            <strong class="text-warning">Tandai siswa yang tinggal kelas</strong> sebelum proses dimulai.
            Siswa yang tidak ditandai akan naik kelas otomatis.
          </div>
        </div>

        <div class="kelas-grid">
          {#each siswaByKelas() as group (group.kelas.id)}
            <div class="kelas-panel">
              <div class="kelas-panel-header">
                <h3>
                  Kelas {group.kelas.tingkat}
                  {group.isKelasAkhir ? '<span class="muted">(kelas akhir)</span>' : ''}
                </h3>
                <span class="siswa-count">{group.siswa.length} siswa</span>
              </div>
              <div class="kelas-panel-body">
                {#each group.siswa as s (s.id)}
                  {@const status = statusSiswa[s.id]}
                  {@const defaultStatus = group.isKelasAkhir ? 'Lulus' : 'Naik Kelas'}
                  <div class="siswa-row" class:is-tinggal={status === 'Tinggal Kelas'}>
                    <div class="s-name">{s.nama_lengkap}</div>
                    <div class="s-action">
                      {#if status === 'Tinggal Kelas'}
                        <button
                          class="btn-tinggal"
                          onclick={() => toggleStatus(s.id, defaultStatus)}>Tinggal kelas</button
                        >
                      {:else}
                        {#if group.isKelasAkhir}
                          <span class="muted-label">akan lulus</span>
                          <button
                            class="btn-tandai"
                            onclick={() => toggleStatus(s.id, defaultStatus)}>Tandai</button
                          >
                        {:else}
                          <button
                            class="btn-tandai"
                            onclick={() => toggleStatus(s.id, defaultStatus)}>Tandai</button
                          >
                        {/if}
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/each}
        </div>

        <div class="wizard-footer">
          <button class="btn-ghost" onclick={handleClose}>Batalkan</button>
          <button class="btn-primary" disabled={!nextTA} onclick={() => (step = 2)}
            >Selanjutnya <Icon name="arrowRight" size={16} /></button
          >
        </div>
      {:else if step === 2}
        <!-- PHASE 2 -->
        <div class="info-badges">
          <div class="badge-item">
            <Icon name="calendar" size={16} /> Dari
            <strong>{activeTA?.nama_tahun} {activeTA?.semester}</strong>
          </div>
          <div class="badge-item">
            <Icon name="arrowRight" size={16} /> Ke <strong>{nextTA?.nama_tahun} Ganjil</strong>
          </div>
          <div class="badge-item">
            <Icon name="users" size={16} /> Total siswa
            <strong>{statNaik + statLulus + statTinggal} siswa</strong>
          </div>
        </div>

        <div
          class="warning-banner"
          style="border-color: #F5A623; background: rgba(245, 166, 35, 0.1);"
        >
          <Icon name="alertCircle" size={20} class="text-warning" />
          <div style="flex:1;">
            Proses ini akan memperbarui status semua siswa aktif. Pastikan data pengecualian di fase
            1 sudah benar.
          </div>
        </div>

        <div class="summary-panel">
          <div class="summary-header">
            <Icon name="list" size={20} /> Yang akan diproses
          </div>
          <div class="summary-item">
            <div class="s-icon bg-green"><Icon name="arrowUp" size={16} /></div>
            <div><strong>{statNaik} siswa</strong> naik ke kelas berikutnya</div>
          </div>
          <div class="summary-item">
            <div class="s-icon bg-blue"><Icon name="award" size={16} /></div>
            <div><strong>{statLulus} siswa</strong> kelas akhir jenjang → status Lulus</div>
          </div>
          <div class="summary-item">
            <div class="s-icon bg-red"><Icon name="minus" size={16} /></div>
            <div><strong>{statTinggal} siswa</strong> tinggal kelas → tetap di kelas yang sama</div>
          </div>

          <div class="summary-footer">
            <Icon name="lock" size={14} /> Rombel belum diatur — semua siswa naik/tinggal masuk kolam
            "Belum rombel" setelah proses ini
          </div>
        </div>

        {#if errorMessage}
          <div class="error-banner">{errorMessage}</div>
        {/if}

        <div class="wizard-footer space-between">
          <button class="btn-ghost" onclick={() => (step = 1)} disabled={processing}
            ><Icon name="arrowLeft" size={16} /> Kembali</button
          >
          <button class="btn-primary" onclick={jalankanProsesOtomatis} disabled={processing}>
            {processing ? 'Memproses...' : 'Jalankan proses'}
            <Icon name="play" size={16} />
          </button>
        </div>
      {:else if step === 3}
        <!-- PHASE 3 -->
        {#if partialWarningMessage}
          <div
            class="warning-banner"
            style="border-color: #F5A623; background: rgba(245, 166, 35, 0.1);"
          >
            <Icon name="alertTriangle" size={20} class="text-warning" />
            <div style="flex:1;">{partialWarningMessage}</div>
          </div>
        {:else}
          <div class="success-banner">
            <Icon name="checkCircle" size={20} /> Proses kenaikan kelas selesai. Sekarang atur penempatan
            rombel untuk masing-masing siswa.
          </div>
        {/if}

        <div class="phase3-layout">
          <div class="p3-header">
            <h3><Icon name="users" size={20} /> Auto-Distribute (Bagi Rata Gender)</h3>
          </div>
          <div class="p3-body">
            <div class="form-row">
              <div class="form-group">
                <label>Pilih Kelas Tujuan:</label>
                <select bind:value={phase3TargetKelasId} class="form-input">
                  <option value="">-- Pilih Kelas --</option>
                  {#each availableTargetClasses as k (k.id)}
                    <option value={k.id}>Kelas {k.tingkat} {k.nama_kelas}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group">
                <label>Nama Rombel yang Dibuat (pisahkan koma):</label>
                <input
                  type="text"
                  bind:value={autoRombelInput}
                  class="form-input"
                  placeholder="Contoh: A, B, C"
                />
              </div>
            </div>

            <div class="belum-rombel-pool">
              <div class="pool-title">Belum dirombel ({belumDirombel.length} siswa)</div>
              <div class="pool-tags">
                {#each belumDirombel as s (s.id)}
                  <span class="pool-tag">
                    <span class="gender-dot {s.jenis_kelamin === 'L' ? 'bg-blue' : 'bg-pink'}"
                    ></span>
                    {s.nama_lengkap.split(' ')[0]}
                    {s.nama_lengkap.split(' ')[1]?.[0] || ''}
                  </span>
                {/each}
              </div>
            </div>

            <div class="p3-actions">
              <p class="muted">
                <Icon name="info" size={16} /> Siswa dari kolam di atas akan dibagi otomatis ke dalam
                rombel secara bergiliran berdasarkan jenis kelamin.
              </p>
              <button
                class="btn-primary"
                onclick={handleAutoDistribute}
                disabled={processing || belumDirombel.length === 0}
              >
                {processing ? 'Memproses...' : 'Acak Otomatis (Auto Bagi Rata)'}
              </button>
            </div>
          </div>
        </div>

        <div class="wizard-footer space-between">
          <div></div>
          <button class="btn-primary" onclick={handleClose}>Selesai & Tutup</button>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  :global(:root) {
    --w-bg: #f4f6fb;
    --w-surface: #ffffff;
    --w-border: #e2e8f0;
    --w-text: #1a2744;
    --w-muted: #8892a4;
    --w-primary: #4a7cf7;
    --w-primary-hover: #3a63c6;
    --w-danger: #e05252;
    --w-warning: #f5a623;
    --w-success: #4caf82;
  }

  .wizard-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(26, 39, 68, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 2rem;
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  }

  .wizard-container {
    background: var(--w-bg);
    width: 100%;
    max-width: 1200px;
    height: 90vh;
    border-radius: 16px;
    border: 1px solid var(--w-border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    color: var(--w-text);
  }

  .wizard-header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--w-border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--w-surface);
  }

  .header-left h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }
  .header-sub {
    color: var(--w-muted);
    font-size: 0.9rem;
    margin-top: 0.25rem;
  }

  .stepper {
    display: flex;
    gap: 2rem;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--w-muted);
    font-size: 0.95rem;
    font-weight: 500;
    opacity: 0.6;
    transition: 0.3s;
  }
  .step.active {
    opacity: 1;
    color: var(--w-text);
  }
  .step.completed {
    opacity: 1;
    color: var(--w-primary);
  }
  .step-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--w-border);
    color: var(--w-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .step.active .step-icon {
    background: var(--w-primary);
    color: white;
  }
  .step.completed .step-icon {
    background: rgba(37, 99, 235, 0.2);
    color: var(--w-primary);
  }

  .btn-close {
    background: transparent;
    border: none;
    color: var(--w-muted);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 8px;
    transition: 0.2s;
  }
  .btn-close:hover {
    background: var(--w-border);
    color: white;
  }

  .wizard-body {
    flex: 1;
    padding: 2rem;
    overflow-y: auto;
  }

  .info-badges {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .badge-item {
    background: var(--w-surface);
    border: 1px solid var(--w-border);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
  }

  .warning-banner {
    background: rgba(217, 119, 6, 0.1);
    border: 1px solid var(--w-warning);
    padding: 1rem 1.5rem;
    border-radius: 8px;
    margin-bottom: 2rem;
    display: flex;
    gap: 1rem;
    align-items: center;
    font-size: 0.95rem;
  }
  .text-warning {
    color: var(--w-warning);
  }

  .error-banner {
    background: rgba(220, 38, 38, 0.1);
    border: 1px solid var(--w-danger);
    color: #fca5a5;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
  }

  .success-banner {
    background: rgba(22, 163, 74, 0.1);
    border: 1px solid var(--w-success);
    color: #86efac;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* KELAS GRID */
  .kelas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }
  .kelas-panel {
    background: var(--w-surface);
    border: 1px solid var(--w-border);
    border-radius: 12px;
    overflow: hidden;
  }
  .kelas-panel-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--w-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .kelas-panel-header h3 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
  }
  .siswa-count {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.25rem 0.75rem;
    border-radius: 16px;
    font-size: 0.8rem;
  }
  .muted {
    color: var(--w-muted);
    font-weight: normal;
  }

  .kelas-panel-body {
    max-height: 350px;
    overflow-y: auto;
    padding: 0.5rem 1.5rem;
  }
  .siswa-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--w-border);
    transition: 0.2s;
  }
  .siswa-row:last-child {
    border-bottom: none;
  }

  .siswa-row.is-tinggal {
    background: rgba(224, 82, 82, 0.1);
    border-radius: 8px;
    margin: 0.25rem -0.5rem;
    padding: 0.75rem 0.5rem;
    border-bottom: none;
    border-left: 3px solid var(--w-danger);
  }
  .siswa-row.is-tinggal .s-name {
    color: var(--w-danger);
    font-weight: 600;
  }

  .s-name {
    font-size: 0.95rem;
    font-weight: 500;
  }

  .btn-tandai {
    background: transparent;
    border: 1px solid var(--w-border);
    color: var(--w-text);
    padding: 0.4rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: 0.2s;
  }
  .btn-tandai:hover {
    background: var(--w-bg);
  }
  .btn-tinggal {
    background: transparent;
    border: 1px solid var(--w-danger);
    color: var(--w-danger);
    padding: 0.4rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .btn-tinggal:hover {
    background: rgba(224, 82, 82, 0.1);
  }

  .muted-label {
    font-size: 0.8rem;
    color: var(--w-muted);
    font-style: italic;
    margin-right: 1rem;
  }

  .wizard-footer {
    margin-top: 2rem;
    padding: 1.5rem 2rem;
    border-top: 1px solid var(--w-border);
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    position: sticky;
    bottom: -2rem;
    margin-bottom: -2rem;
    margin-left: -2rem;
    margin-right: -2rem;
    background: var(--w-surface);
    z-index: 10;
  }
  .wizard-footer.space-between {
    justify-content: space-between;
  }

  .btn-ghost {
    background: transparent;
    border: none;
    color: var(--w-muted);
    font-size: 0.95rem;
    cursor: pointer;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
  }
  .btn-ghost:hover:not(:disabled) {
    background: var(--w-bg);
    color: var(--w-text);
  }
  .btn-primary {
    background: var(--w-primary);
    border: none;
    color: white;
    font-size: 0.95rem;
    cursor: pointer;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--w-primary-hover);
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* PHASE 2 */
  .summary-panel {
    background: var(--w-surface);
    border: 1px solid var(--w-border);
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 600px;
  }
  .summary-header {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .summary-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
    font-size: 1rem;
    color: var(--w-text);
  }
  .summary-item strong {
    color: var(--w-text);
    font-weight: 700;
  }
  .s-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }
  .bg-green {
    background: var(--w-success);
  }
  .bg-blue {
    background: var(--w-primary);
  }
  .bg-red {
    background: var(--w-danger);
  }

  .summary-footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid var(--w-border);
    color: var(--w-muted);
    font-size: 0.85rem;
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  /* PHASE 3 */
  .phase3-layout {
    background: var(--w-surface);
    border: 1px solid var(--w-border);
    border-radius: 12px;
    padding: 1.5rem;
  }
  .p3-header h3 {
    margin: 0 0 1.5rem 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
  }

  .form-row {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  .form-group {
    flex: 1;
  }
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: var(--w-text);
    font-size: 0.9rem;
    font-weight: 500;
  }
  .form-input {
    width: 100%;
    background: var(--w-surface);
    border: 1px solid var(--w-border);
    color: var(--w-text);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 1rem;
  }

  .belum-rombel-pool {
    background: rgba(217, 119, 6, 0.05);
    border: 1px solid rgba(217, 119, 6, 0.2);
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 2rem;
  }
  .pool-title {
    color: var(--w-warning);
    font-weight: 600;
    margin-bottom: 1rem;
  }
  .pool-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .pool-tag {
    background: var(--w-bg);
    border: 1px solid var(--w-border);
    border-radius: 16px;
    padding: 0.3rem 0.75rem;
    font-size: 0.85rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .gender-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .bg-pink {
    background: #ec4899;
  }

  .p3-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 1.5rem;
    border-top: 1px solid var(--w-border);
  }
</style>
