<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

  let lokasiList = $state([]);
  let currentConfig = $state(null);
  let errorMsg = $state('');
  let successMsg = $state('');
  let loading = $state(true);
  let saving = $state(false);
  let showModal = $state(false);

  let currentTab = $state('lokasi'); // 'lokasi' | 'riwayat'
  let riwayatList = $state([]);
  let loadingRiwayat = $state(false);
  let errorRiwayat = $state('');

  // Import State
  let fileInputPresensi = $state(null);
  let loadingImport = $state(false);

  // Riwayat Filter & Pagination
  let filterMonth = $state((new Date().getMonth() + 1).toString().padStart(2, '0'));
  let filterYear = $state(new Date().getFullYear().toString());
  let riwayatPage = $state(1);
  let riwayatTotalPages = $state(1);
  let limit = 50;

  // Manual Upsert Modal
  let showManualModal = $state(false);
  let savingManual = $state(false);
  let isEditingManual = $state(false);
  let guruList = $state([]);
  let manualForm = $state({
    guru_id: 0,
    nama_lengkap: '',
    tanggal: '',
    waktu_masuk: '',
    waktu_pulang: '',
    status: 'Hadir'
  });

  let mapElement = $state(null);
  let mapInstance = null;
  let mapReady = false;
  let mapLayers = [];

  let form = $state({
    jam_masuk: '07:00',
    jam_pulang: '16:00',
    batas_telat: 15,
    latitude: -6.2,
    longitude: 106.816666,
    radius_meter: 50
  });

  onMount(() => {
    loadConfig();
    loadRiwayat();
    loadGuru(); // MUHAMMAD IQBAL: THIS WAS MISSING!
  });

  function changeTab(tab) {
    currentTab = tab;
    if (tab === 'lokasi') {
      if (mapReady && mapInstance) {
        setTimeout(() => mapInstance.invalidateSize(), 100);
      } else {
        setTimeout(initMainMap, 200);
      }
    } else if (tab === 'riwayat') {
      loadRiwayat();
    }
  }

  async function loadRiwayat() {
    loadingRiwayat = true;
    errorRiwayat = '';
    try {
      const qs = `month=${filterMonth}&year=${filterYear}&page=${riwayatPage}&limit=${limit}`;
      const res = await fetchWithTimeout(`${apiUrl}/api/presensi/riwayat?${qs}`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        riwayatList = data.data || [];
        riwayatTotalPages = data.meta?.total_pages || 1;
      } else {
        const body = await res.json().catch(() => ({}));
        errorRiwayat = body.message || 'Gagal memuat riwayat presensi.';
      }
    } catch (err) {
      errorRiwayat = 'Koneksi ke server gagal.';
    } finally {
      loadingRiwayat = false;
    }
  }

  function handleDownloadTemplate() {
    window.location.href = `${apiUrl}/api/presensi/template-import`;
  }

  async function handleImportExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    loadingImport = true;
    errorRiwayat = '';
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${apiUrl}/api/presensi/import`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal melakukan import');
      }
      alert(data.message || 'Import berhasil');
      await loadRiwayat();
    } catch (err) {
      errorRiwayat = err.message;
    } finally {
      loadingImport = false;
      if (fileInputPresensi) {
        fileInputPresensi.value = '';
      }
    }
  }

  async function loadGuru() {
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/guru?limit=1000`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        guruList = Array.isArray(data) ? data : (data.data || []);
      }
    } catch (e) {
      console.error("Gagal memuat daftar guru", e);
    }
  }

  function formatSuspiciousReasons(jsonStr) {
    if (!jsonStr) return 'Indikasi kecurangan terdeteksi';
    try {
      const arr = JSON.parse(jsonStr);
      if (Array.isArray(arr)) {
        return arr.map(a => a.replace(/_/g, ' ')).join(', ');
      }
    } catch (e) {
      // do nothing
    }
    return jsonStr;
  }

  function openManualModal(riwayat = null) {
    if (riwayat) {
      isEditingManual = true;
      manualForm = {
        guru_id: riwayat.guru_id,
        nama_lengkap: riwayat.nama_lengkap,
        tanggal: riwayat.tanggal.split('T')[0], // format YYYY-MM-DD
        waktu_masuk: riwayat.waktu_masuk || '',
        waktu_pulang: riwayat.waktu_pulang || '',
        status: riwayat.status || 'Hadir'
      };
    } else {
      isEditingManual = false;
      const d = new Date();
      const localDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      
      manualForm = {
        guru_id: guruList.length > 0 ? guruList[0].id : 0,
        nama_lengkap: '',
        tanggal: localDate,
        waktu_masuk: '07:00',
        waktu_pulang: '16:00',
        status: 'Hadir'
      };
    }
    showManualModal = true;
  }

  async function handleSaveManual() {
    if (manualForm.guru_id == 0) {
      alert("Silakan pilih guru terlebih dahulu");
      return;
    }
    savingManual = true;
    try {
      const payload = {
        guru_id: parseInt(manualForm.guru_id),
        tanggal: manualForm.tanggal,
        waktu_masuk: manualForm.waktu_masuk ? manualForm.waktu_masuk : null,
        waktu_pulang: manualForm.waktu_pulang ? manualForm.waktu_pulang : null,
        status: manualForm.status
      };
      const res = await fetchWithTimeout(`${apiUrl}/api/presensi/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showManualModal = false;
        alert('Presensi berhasil diperbarui.');
        loadRiwayat();
      } else {
        alert(data.message || 'Gagal menyimpan presensi manual.');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      savingManual = false;
    }
  }

  async function generateAcak() {
    const isConfirm = confirm(`Generate presensi acak HARI INI untuk semua guru aktif?\nCatatan: Ini akan me-replace data hari ini.`);
    if (!isConfirm) return;

    loadingRiwayat = true;
    errorRiwayat = '';
    const hariIni = new Date().toISOString().split('T')[0];

    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/presensi/generate-acak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tanggal: hariIni }),
        credentials: 'include'
      });
      if (res.ok) {
        alert('Berhasil men-generate presensi acak hari ini.');
        loadRiwayat();
      } else {
        const body = await res.json().catch(() => ({}));
        alert(body.message || 'Gagal men-generate presensi.');
      }
    } catch (err) {
      alert('Terjadi kesalahan koneksi.');
    } finally {
      loadingRiwayat = false;
    }
  }

  function goToGenerateBulan() {
    goto('/presensi/generate-bulan');
  }

  let isExporting = $state(false);
  let showExportModal = $state(false);
  let exportStartDate = $state('');
  let exportEndDate = $state('');

  function openExportModal() {
    const today = new Date().toISOString().split('T')[0];
    exportStartDate = today;
    exportEndDate = today;
    showExportModal = true;
  }

  async function eksporExcel() {
    if (!exportStartDate || !exportEndDate) {
      alert("Harap pilih rentang tanggal");
      return;
    }
    
    isExporting = true;
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/presensi/riwayat?start_date=${exportStartDate}&end_date=${exportEndDate}&limit=all`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error("Gagal mengambil data");
      const data = await res.json();
      const list = data.data || [];
      
      if (list.length === 0) {
        alert("Tidak ada data pada rentang tanggal tersebut");
        isExporting = false;
        return;
      }

      const headers = ["Tanggal", "Nama Lengkap", "Waktu Masuk", "Waktu Pulang", "Status Kehadiran"];
      const rows = list.map(r => {
        const tanggal = new Date(r.tanggal).toLocaleDateString('id-ID');
        const nama = `"${r.nama_lengkap || ''}"`;
        const masuk = r.waktu_masuk || '-';
        const pulang = r.waktu_pulang || '-';
        const status = r.is_suspicious ? `${r.status} (Suspicious)` : r.status;
        return [tanggal, nama, masuk, pulang, status].join(',');
      });
      
      const csvContent = headers.join(',') + '\n' + rows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Laporan_Kehadiran_Guru_${exportStartDate}_sd_${exportEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showExportModal = false;
    } catch (err) {
      alert("Terjadi kesalahan saat mengekspor: " + err.message);
    } finally {
      isExporting = false;
    }
  }

  async function eksporPDF() {
    isExporting = true;
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById('kop-surat-tabel');
      
      // Munculkan sementara div laporan
      element.style.display = 'block';

      const opt = {
        margin:       [10, 10, 10, 10], // top, left, bottom, right
        filename:     `Laporan_Presensi_Guru_${filterMonth}_${filterYear}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      alert('Gagal mengekspor PDF: ' + err.message);
    } finally {
      const element = document.getElementById('kop-surat-tabel');
      if(element) element.style.display = 'none';
      isExporting = false;
    }
  }

  onDestroy(() => {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
  });

  async function fetchWithTimeout(url, options, timeoutMs = 10000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  }

  async function loadConfig() {
    if (!currentConfig) loading = true;
    errorMsg = '';
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/presensi/konfigurasi`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        lokasiList = [data];
        currentConfig = data;
        // Re-render map: jika sudah siap render ulang, jika belum init
        if (mapReady && mapInstance) {
          setTimeout(() => renderAllLocations(), 100);
        } else {
          setTimeout(() => initMainMap(), 200);
        }
      } else if (res.status === 401 || res.status === 403) {
        errorMsg = 'Akses ditolak. Silakan login ulang.';
      } else {
        const body = await res.json().catch(() => ({}));
        errorMsg = body.message || 'Gagal memuat konfigurasi.';
      }
    } catch (err) {
      errorMsg = err.name === 'AbortError' ? 'Koneksi timeout.' : 'Koneksi ke server gagal.';
    } finally {
      loading = false;
    }
  }

  function initMainMap() {
    if (mapReady || !mapElement) return;
    if (!window.L) {
      setTimeout(initMainMap, 100);
      return;
    }
    mapReady = true;
    const lat = lokasiList[0]?.latitude ?? -6.2;
    const lng = lokasiList[0]?.longitude ?? 106.816666;
    mapInstance = window.L.map(mapElement).setView([lat, lng], 15);
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(mapInstance);
    renderAllLocations();
    setTimeout(() => mapInstance.invalidateSize(), 400);
  }

  function renderAllLocations() {
    if (!mapInstance) return;
    mapLayers.forEach((l) => mapInstance.removeLayer(l));
    mapLayers = [];
    if (lokasiList.length === 0) return;
    const bounds = [];
    lokasiList.forEach((lok, i) => {
      const m = window.L.marker([lok.latitude, lok.longitude]).addTo(mapInstance);
      m.bindPopup(
        `<b>Lokasi #${i + 1}</b><br>⏰ ${lok.jam_masuk} – ${lok.jam_pulang}<br>🔵 Radius: ${lok.radius_meter}m`
      );
      mapLayers.push(m);
      const c = window.L.circle([lok.latitude, lok.longitude], {
        radius: lok.radius_meter,
        color: '#22c55e',
        fillColor: '#22c55e',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '6 4'
      }).addTo(mapInstance);
      mapLayers.push(c);
      bounds.push([lok.latitude, lok.longitude]);
    });
    if (bounds.length > 1) {
      mapInstance.fitBounds(bounds, { padding: [50, 50] });
    } else if (bounds.length === 1) {
      mapInstance.setView(bounds[0], 15);
    }
  }

  function openEditModal() {
    if (!currentConfig) return;
    form = {
      jam_masuk: currentConfig.jam_masuk || '07:00',
      jam_pulang: currentConfig.jam_pulang || '16:00',
      batas_telat: currentConfig.batas_telat ?? 15,
      latitude: currentConfig.latitude,
      longitude: currentConfig.longitude,
      radius_meter: currentConfig.radius_meter ?? 50
    };
    errorMsg = '';
    successMsg = '';
    showModal = true;
    setTimeout(() => initModalMap(), 300);
  }

  function closeModal() {
    showModal = false;
    if (window._modalMap) {
      window._modalMap.remove();
      window._modalMap = null;
    }
    window._modalMarker = null;
  }

  function initModalMap() {
    const el = document.getElementById('modal-map');
    if (!el || !window.L) {
      setTimeout(initModalMap, 150);
      return;
    }
    if (window._modalMap) window._modalMap.remove();
    const map = window.L.map(el).setView([form.latitude, form.longitude], 16);
    window._modalMap = map;
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);
    const marker = window.L.marker([form.latitude, form.longitude], { draggable: true }).addTo(map);
    window._modalMarker = marker;
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      form.latitude = p.lat;
      form.longitude = p.lng;
    });
    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      form.latitude = e.latlng.lat;
      form.longitude = e.latlng.lng;
    });
    setTimeout(() => map.invalidateSize(), 300);
  }

  async function handleSave() {
    saving = true;
    errorMsg = '';
    successMsg = '';
    try {
      const res = await fetchWithTimeout(`${apiUrl}/api/presensi/konfigurasi`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        successMsg = data.message;
        closeModal();
        await loadConfig();
      } else {
        errorMsg = data.message || 'Gagal menyimpan.';
      }
    } catch {
      errorMsg = 'Terjadi kesalahan sistem.';
    } finally {
      saving = false;
    }
  }

  function handleCoordinateInput() {
    if (window._modalMarker && window._modalMap) {
      const lat = parseFloat(form.latitude);
      const lng = parseFloat(form.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        window._modalMarker.setLatLng([lat, lng]);
        window._modalMap.panTo([lat, lng]);
      }
    }
  }
</script>

<svelte:head>
  <title>Presensi - SIAKAD Nawawi</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
</svelte:head>

{#if loading && currentTab === 'lokasi'}
  <div class="loading-state"><p class="text-muted">Memuat konfigurasi presensi...</p></div>
{:else}
  <div class="master-container">
    <div class="page-header" style="margin-bottom: 0.5rem;">
      <div>
        <h2>Presensi</h2>
        <p class="page-subtitle">Kelola lokasi dan riwayat kehadiran guru.</p>
      </div>
    </div>

    <div class="card-tabs">
      <button
        class="tab-btn"
        class:active={currentTab === 'lokasi'}
        onclick={() => changeTab('lokasi')}
      >
        Atur Lokasi
      </button>
      <button
        class="tab-btn"
        class:active={currentTab === 'riwayat'}
        onclick={() => changeTab('riwayat')}
      >
        Lihat Riwayat
      </button>
    </div>

    {#if errorMsg}<div class="alert-error">{errorMsg}</div>{/if}
    {#if successMsg}<div class="alert-success">{successMsg}</div>{/if}

    {#if currentTab === 'lokasi'}
      <div class="page-header" style="margin-bottom: 1rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.1rem;">Lokasi Presensi</h3>
          <p class="page-subtitle">
            Titik lokasi dan radius area yang disetujui untuk absensi guru.
          </p>
        </div>
        <button class="btn-primary" onclick={openEditModal}>
          <Icon name="settings" size={16} /> Atur Konfigurasi
        </button>
      </div>

      <!-- MAP UTAMA -->
      <div class="card map-card">
        <div bind:this={mapElement} class="main-map"></div>
      </div>

      <!-- TABEL LOKASI -->
      <div class="card" style="margin-top: 1.5rem;">
        <h3 style="margin:0 0 1rem;font-size:1rem;color:var(--color-text-main)">
          Daftar Lokasi Terdaftar
        </h3>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>#</th><th>Jam Masuk</th><th>Jam Pulang</th><th>Batas Telat</th><th>Radius</th
                ><th>Koordinat</th>
              </tr>
            </thead>
            <tbody>
              {#each lokasiList as lok, i (i)}
                <tr>
                  <td><span class="badge-loc">{i + 1}</span></td>
                  <td class="font-medium">{lok.jam_masuk}</td>
                  <td class="font-medium">{lok.jam_pulang}</td>
                  <td>{lok.batas_telat} menit</td>
                  <td><span class="badge badge-radius">{lok.radius_meter} m</span></td>
                  <td class="text-sm text-muted"
                    >{lok.latitude.toFixed(6)}, {lok.longitude.toFixed(6)}</td
                  >
                </tr>
              {/each}
              {#if lokasiList.length === 0}
                <tr
                  ><td colspan="6" class="text-muted text-center">Belum ada lokasi terdaftar.</td
                  ></tr
                >
              {/if}
            </tbody>
          </table>
        </div>
      </div>
    {:else if currentTab === 'riwayat'}
      <div class="card">
        <div class="page-header" style="margin-bottom: 1rem;">
          <div>
            <h3 style="margin: 0; font-size: 1.1rem;">Riwayat Presensi Guru</h3>
            <p class="page-subtitle">Data presensi seluruh guru terbaru.</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-primary" onclick={() => openManualModal(null)}>
              <Icon name="plus" size={16} /> Tambah Manual
            </button>
            <button class="btn-secondary" style="background: #eab308; color: white; border: none;" onclick={generateAcak} disabled={loadingRiwayat}>
              <Icon name="zap" size={16} /> Generate Acak Harian
            </button>
            <button class="btn-secondary" style="background: #a855f7; color: white; border: none;" onclick={goToGenerateBulan} disabled={loadingRiwayat}>
              <Icon name="calendar" size={16} /> Generate 1 Bulan
            </button>
            <button class="btn-secondary" style="background: #10b981; color: white; border: none;" onclick={openExportModal} disabled={loadingRiwayat}>
              <Icon name="download" size={16} /> Ekspor Excel
            </button>
            <button class="btn-secondary" style="background: #ef4444; color: white; border: none;" onclick={eksporPDF} disabled={isExporting}>
              <Icon name="printer" size={16} /> {isExporting ? 'Mengekspor...' : 'Ekspor PDF'}
            </button>
            <button class="btn-secondary" onclick={handleDownloadTemplate}>
              <Icon name="download" size={16} /> Template
            </button>
            <button
              class="btn-secondary"
              title="Mendukung template Siakad & file export dari Finjer Online"
              onclick={() => fileInputPresensi.click()}
              disabled={loadingImport}
            >
              <Icon name="import" size={16} />
              {loadingImport ? 'Mengimport...' : 'Import Excel'}
            </button>
            <input
              type="file"
              accept=".xlsx"
              bind:this={fileInputPresensi}
              onchange={handleImportExcel}
              style="display: none;"
            />
            <button class="btn-secondary" onclick={loadRiwayat} disabled={loadingRiwayat}>
              <Icon name="refreshCw" size={16} /> Segarkan
            </button>
          </div>
        </div>

        <!-- FILTER -->
        <div class="card-tabs" style="display:flex; align-items:center; gap: 1rem; flex-wrap:wrap">
          <div class="form-group" style="margin: 0;">
            <select class="form-input" style="padding: 0.4rem; font-size:0.9rem;" bind:value={filterMonth} onchange={() => {riwayatPage=1; loadRiwayat();}}>
              <option value="01">Januari</option>
              <option value="02">Februari</option>
              <option value="03">Maret</option>
              <option value="04">April</option>
              <option value="05">Mei</option>
              <option value="06">Juni</option>
              <option value="07">Juli</option>
              <option value="08">Agustus</option>
              <option value="09">September</option>
              <option value="10">Oktober</option>
              <option value="11">November</option>
              <option value="12">Desember</option>
            </select>
          </div>
          <div class="form-group" style="margin: 0;">
            <input type="number" class="form-input" style="padding: 0.4rem; font-size:0.9rem; width: 100px;" bind:value={filterYear} onchange={() => {riwayatPage=1; loadRiwayat();}} placeholder="Tahun" />
          </div>
          <span class="text-sm text-muted">Halaman {riwayatPage} dari {riwayatTotalPages}</span>
        </div>

        {#if errorRiwayat}
          <div class="alert-error">{errorRiwayat}</div>
        {/if}

        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Nama Guru</th>
                <th>Jam Masuk</th>
                <th>Jam Pulang</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {#if loadingRiwayat && riwayatList.length === 0}
                <tr><td colspan="5" class="text-center text-muted">Memuat data...</td></tr>
              {:else if riwayatList.length === 0}
                <tr
                  ><td colspan="5" class="text-center text-muted"
                    >Belum ada data riwayat presensi.</td
                  ></tr
                >
              {:else}
                {#each riwayatList as r, index (r.id || index)}
                  <tr>
                    <td>{new Date(r.tanggal).toLocaleDateString('id-ID')}</td>
                    <td class="font-medium">{r.nama_lengkap}</td>
                    <td>{r.waktu_masuk ? r.waktu_masuk : '-'}</td>
                    <td>{r.waktu_pulang ? r.waktu_pulang : '-'}</td>
                    <td>
                      <span
                        class="status-badge"
                        class:hadir={r.status === 'Hadir'}
                        class:telat={r.status === 'Terlambat'}
                      >
                        {r.status}
                      </span>
                      {#if r.is_suspicious}
                        <div style="margin-top: 6px;">
                          <span class="status-badge" style="background: #fee2e2; color: #dc2626; border-color: #fca5a5; font-size: 0.7rem;" title={formatSuspiciousReasons(r.suspicious_reasons)}>
                            ⚠️ Suspicious
                          </span>
                        </div>
                      {/if}
                    </td>
                    <td>
                      <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick={() => openManualModal(r)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>

        <!-- PAGINATION CONTROLS -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
          <button 
            class="btn-secondary" 
            disabled={riwayatPage <= 1} 
            onclick={() => { riwayatPage--; loadRiwayat(); }}
          >
            ← Sebelumnya
          </button>
          <span class="text-muted text-sm">Hal {riwayatPage} / {riwayatTotalPages}</span>
          <button 
            class="btn-secondary" 
            disabled={riwayatPage >= riwayatTotalPages} 
            onclick={() => { riwayatPage++; loadRiwayat(); }}
          >
            Selanjutnya →
          </button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<!-- MODAL -->
{#if showModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) closeModal();
    }}
  >
    <div class="modal-content">
      <div class="modal-header">
        <h3>Atur Konfigurasi Presensi</h3>
        <button class="btn-close" onclick={closeModal}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Jam Masuk</label><input
              type="time"
              class="form-input"
              bind:value={form.jam_masuk}
            />
          </div>
          <div class="form-group">
            <label>Jam Pulang</label><input
              type="time"
              class="form-input"
              bind:value={form.jam_pulang}
            />
          </div>
          <div class="form-group">
            <label>Batas Telat (menit)</label><input
              type="number"
              class="form-input"
              bind:value={form.batas_telat}
              min="0"
              max="120"
            />
          </div>
          <div class="form-group">
            <label>Radius (meter)</label><input
              type="number"
              class="form-input"
              bind:value={form.radius_meter}
              min="1"
              max="500"
            />
          </div>
        </div>
        <div class="form-group" style="margin-top:1.5rem">
          <label>Pilih Titik Lokasi atau Masukkan Manual</label>
          <div id="modal-map" class="modal-map"></div>

          <div class="form-grid" style="margin-top: 1rem;">
            <div class="form-group">
              <label>Latitude</label>
              <input
                type="number"
                step="any"
                class="form-input"
                bind:value={form.latitude}
                oninput={handleCoordinateInput}
              />
            </div>
            <div class="form-group">
              <label>Longitude</label>
              <input
                type="number"
                step="any"
                class="form-input"
                bind:value={form.longitude}
                oninput={handleCoordinateInput}
              />
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={closeModal}>Batal</button>
        <button class="btn-primary" onclick={handleSave} disabled={saving}
          >{saving ? 'Menyimpan...' : 'Simpan'}</button
        >
      </div>
    </div>
  </div>
{/if}

<!-- MODAL MANUAL UPSERT -->
{#if showManualModal}
  <div class="modal-overlay" role="button" tabindex="-1" onclick={(e) => { if (e.target === e.currentTarget) showManualModal = false; }}>
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-header">
        <h3>{isEditingManual ? 'Edit Presensi' : 'Tambah Presensi Manual'}</h3>
        <button class="btn-close" onclick={() => showManualModal = false}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="modal-body">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label>Guru</label>
          {#if isEditingManual}
            <input type="text" class="form-input" disabled value={manualForm.nama_lengkap} />
          {:else}
            <select class="form-input" bind:value={manualForm.guru_id}>
              {#each guruList as g}
                <option value={g.id}>{g.nama_lengkap}</option>
              {/each}
            </select>
          {/if}
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label>Tanggal</label>
          <input type="date" class="form-input" disabled={isEditingManual} bind:value={manualForm.tanggal} />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label>Jam Masuk</label>
          <input type="time" class="form-input" bind:value={manualForm.waktu_masuk} />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label>Jam Pulang</label>
          <input type="time" class="form-input" bind:value={manualForm.waktu_pulang} />
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label>Status</label>
          <select class="form-input" bind:value={manualForm.status}>
            <option value="Hadir">Hadir</option>
            <option value="Terlambat">Terlambat</option>
            <option value="Izin">Izin</option>
            <option value="Sakit">Sakit</option>
            <option value="Alpha">Alpha</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn-secondary" onclick={() => showManualModal = false}>Batal</button>
        <button class="btn-primary" onclick={handleSaveManual} disabled={savingManual}>
          {savingManual ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </div>
  </div>
{/if}

  <!-- KOP SURAT HIDDEN UNTUK EKSPOR PDF -->
  <div id="kop-surat-tabel" style="display: none; background: white; padding: 20px; color: black; width: 100%;">
    <div style="display: flex; align-items: center; border-bottom: 3px solid black; padding-bottom: 10px; margin-bottom: 20px;">
      <div style="flex: 1; text-align: center;">
        <h2 style="margin: 0; font-size: 24px; text-transform: uppercase;">YAYASAN PENDIDIKAN ISLAM NAWAWI</h2>
        <h1 style="margin: 5px 0; font-size: 28px; font-weight: bold;">SIAKAD NAWAWI</h1>
        <p style="margin: 0; font-size: 14px;">Jl. Raya Pendidikan No. 1, Kota Pelajar, Provinsi Ilmu Pengetahuan</p>
        <p style="margin: 0; font-size: 14px;">Telp: (021) 1234567 | Email: info@siakadnawawi.sch.id | Web: www.siakadnawawi.sch.id</p>
      </div>
    </div>
    <div style="text-align: center; margin-bottom: 20px;">
      <h3 style="margin: 0; font-size: 18px; text-decoration: underline;">LAPORAN PRESENSI GURU</h3>
      <p style="margin: 5px 0 0 0; font-size: 14px;">Periode: {filterMonth}/{filterYear}</p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
      <thead>
        <tr>
          <th style="border: 1px solid black; padding: 8px; background-color: #f3f4f6;">Tanggal</th>
          <th style="border: 1px solid black; padding: 8px; background-color: #f3f4f6;">Nama Guru</th>
          <th style="border: 1px solid black; padding: 8px; background-color: #f3f4f6;">Jam Masuk</th>
          <th style="border: 1px solid black; padding: 8px; background-color: #f3f4f6;">Jam Pulang</th>
          <th style="border: 1px solid black; padding: 8px; background-color: #f3f4f6;">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each riwayatList as r}
          <tr>
            <td style="border: 1px solid black; padding: 8px;">{new Date(r.tanggal).toLocaleDateString('id-ID')}</td>
            <td style="border: 1px solid black; padding: 8px;">{r.nama_lengkap}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">{r.waktu_masuk || '-'}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">{r.waktu_pulang || '-'}</td>
            <td style="border: 1px solid black; padding: 8px; text-align: center;">
              {r.status}
              {#if r.is_suspicious}
                <br><small style="color: red;">⚠️ Suspicious</small>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    
    <div style="margin-top: 50px; text-align: right; font-size: 14px; padding-right: 50px;">
      <p style="margin-bottom: 60px;">Kepala Sekolah,</p>
      <p style="font-weight: bold; text-decoration: underline; margin: 0;">( ......................................... )</p>
      <p style="margin: 0;">NIP. ....................................</p>
    </div>
  </div>



<!-- MODAL EKSPOR -->
{#if showExportModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="-1"
    onclick={(e) => {
      if (e.target === e.currentTarget) showExportModal = false;
    }}
  >
    <div class="modal-content" style="max-width: 400px;">
      <div class="modal-header">
        <h3>Ekspor Riwayat Absensi</h3>
        <button class="btn-close" onclick={() => showExportModal = false}>
          <Icon name="x" size={20} />
        </button>
      </div>
      <div class="modal-body">
        <p class="text-sm text-muted" style="margin-bottom: 1rem;">
          Pilih rentang tanggal riwayat absensi yang ingin Anda unduh (format Excel / CSV).
        </p>
        <div class="form-group">
          <label>Dari Tanggal</label>
          <input type="date" class="form-input" bind:value={exportStartDate} />
        </div>
        <div class="form-group">
          <label>Sampai Tanggal</label>
          <input type="date" class="form-input" bind:value={exportEndDate} />
        </div>
        
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button class="btn-secondary" onclick={() => showExportModal = false}>Batal</button>
          <button class="btn-primary" onclick={eksporExcel} disabled={isExporting}>
            {isExporting ? 'Mengekspor...' : 'Unduh File'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .card-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    padding-bottom: 0.5rem;
  }
  .tab-btn {
    padding: 0.5rem 1.2rem;
    border-radius: 8px;
    border: none;
    background: transparent;
    font-weight: 600;
    font-size: 0.95rem;
    color: var(--color-text-muted, #64748b);
    cursor: pointer;
    transition: all 0.2s;
  }
  .tab-btn:hover {
    background: var(--color-surface-hover, #f1f5f9);
    color: var(--color-text-main, #1e293b);
  }
  .tab-btn.active {
    background: var(--color-primary, #22c55e);
    color: white;
  }
  .status-badge {
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .status-badge.hadir {
    background: #dcfce7;
    color: #15803d;
  }
  .status-badge.telat {
    background: #fef9c3;
    color: #a16207;
  }

  .master-container {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    font-family: inherit;
  }
  .loading-state {
    text-align: center;
    padding: 3rem;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }
  .page-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: var(--color-text-main, #1e293b);
  }
  .page-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.85rem;
    color: var(--color-text-muted, #64748b);
  }
  .alert-error {
    background: #fee2e2;
    color: #b91c1c;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .alert-success {
    background: #dcfce7;
    color: #15803d;
    padding: 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.9rem;
  }
  .card {
    background: var(--color-surface, #fff);
    border-radius: 12px;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.05));
    padding: 1.5rem;
  }
  .map-card {
    padding: 0;
    overflow: hidden;
  }
  .main-map {
    height: 420px;
    width: 100%;
    z-index: 1;
  }
  .table-wrapper {
    overflow-x: auto;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 500px;
  }
  .data-table th,
  .data-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    font-size: 0.9rem;
  }
  .data-table th {
    font-weight: 600;
    color: var(--color-text-muted);
    background: var(--color-surface-hover, #f1f5f9);
    text-transform: uppercase;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
  }
  .data-table tbody tr:hover {
    background: var(--color-background, #f8fafc);
  }
  .font-medium {
    font-weight: 600;
    color: var(--color-text-main, #1e293b);
  }
  .text-sm {
    font-size: 0.85rem;
  }
  .text-muted {
    color: var(--color-text-muted, #64748b);
  }
  .text-center {
    text-align: center;
  }
  .badge-loc {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--color-primary, #22c55e);
    color: white;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 700;
  }
  .badge-radius {
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(34, 197, 94, 0.1);
    color: var(--color-primary, #22c55e);
  }
  .btn-primary {
    background: var(--color-primary, #22c55e);
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-weight: 600;
    font-family: inherit;
    font-size: 0.9rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  .btn-primary:hover {
    background: var(--color-primary-hover, #16a34a);
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-secondary {
    background: transparent;
    border: 1px solid var(--color-border, #e2e8f0);
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    font-weight: 600;
    font-family: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    color: var(--color-text-muted);
  }
  .btn-secondary:hover {
    background: var(--color-surface-hover, #f1f5f9);
  }
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.6);
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
    max-width: 640px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }
  .modal-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .modal-header h3 {
    margin: 0;
    color: #1e293b;
    font-size: 1.1rem;
  }
  .btn-close {
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
  }
  .btn-close:hover {
    color: #334155;
    background: #f1f5f9;
  }
  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
  }
  .modal-footer {
    padding: 1.25rem 1.5rem;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
  }
  @media (max-width: 500px) {
    .form-grid {
      grid-template-columns: 1fr;
    }
    .modal-content {
      max-width: 95vw;
    }
  }
  .form-group label {
    display: block;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--color-text-main, #1e293b);
    margin-bottom: 0.4rem;
  }
  .form-input {
    width: 100%;
    padding: 0.65rem 0.85rem;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    background: white;
    color: var(--color-text-main, #1e293b);
    font-family: inherit;
    font-size: 0.9rem;
    transition: all 0.2s;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }
  .form-input:focus {
    outline: none;
    border-color: var(--color-primary, #22c55e);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }
  .modal-map {
    height: 250px;
    width: 100%;
    border-radius: 10px;
    border: 1px solid var(--color-border, #e2e8f0);
    z-index: 1;
    overflow: hidden;
    margin-top: 0.4rem;
  }
  .coordinates-info {
    display: inline-flex;
    gap: 1rem;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    background: var(--color-surface-hover, #f1f5f9);
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
