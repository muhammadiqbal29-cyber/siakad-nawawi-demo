import { guruState } from './guruState.svelte.js';

const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));

export const precacheState = $state({
  isPrecaching: false,
  progress: 0,
  total: 0,
  label: ''
});

// Melacak kombinasi jenjang yang sudah selesai diunduh di sesi ini
const precachedSet = new Set();

// A simple queue processor to avoid slamming the backend
async function fetchWithRetry(url, options = {}, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { ...options, credentials: 'include' });
      if (res.ok) {
        return await res.json();
      }
      // Jika kena rate limit (429), JANGAN retry — tunggu lama lalu kembalikan null
      if (res.status === 429) {
        console.warn('[Precacher] Rate limited (429), menunggu 5 detik...', url);
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return null;
      }
    } catch (err) {
      if (i === retries) throw err;
    }
    // backoff
    await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)));
  }
  return null;
}

export async function startPrecache() {
  if (precacheState.isPrecaching) return;
  if (!guruState.activeSekolahId || !guruState.activeTahunId || !guruState.activeSemesterId) return;

  const sekolahId = guruState.activeSekolahId;
  const taId = guruState.activeTahunId;
  const semId = guruState.activeSemesterId;
  const akses = guruState.aksesMap[sekolahId] || [];

  if (akses.length === 0) return;

  const sessionKey = `${sekolahId}_${taId}_${semId}`;
  if (precachedSet.has(sessionKey)) {
    return; // Sudah pernah di-precache sukses pada sesi login ini
  }

  precacheState.isPrecaching = true;
  precacheState.progress = 0;
  precacheState.total = 100;
  precacheState.label = 'Menyiapkan...';

  const tasks = [];

  try {
    // 1. Diniyah Precaching
    if (akses.includes('input_diniyah')) {
      tasks.push(async () => {
        precacheState.label = 'Mengunduh Kelas Diniyah...';
        // Get Diniyah classes
        const urlKls = `${apiUrl}/api/guru/sekolah/${sekolahId}/kelas?tahun_ajaran_id=${taId}&semester_id=${semId}`;
        const kelasList = await fetchWithRetry(urlKls);
        if (kelasList && Array.isArray(kelasList)) {
          // Sama persis dengan cacheKey di Diniyah/+page.svelte
          localStorage.setItem(`siakad_offline_kelas_${sekolahId}_${taId}_${semId}`, JSON.stringify(kelasList));
          
          // Calculate total progress correctly later, for now just increment
          for (const kls of kelasList) {
            // Get mapel diniyah for this specific class and rombel
            const mapelData = await fetchWithRetry(`${apiUrl}/api/guru/sekolah/${sekolahId}/mapel-diniyah?kelas_id=${kls.id}&rombel=${kls.rombel || '__kosong__'}`);
            if (mapelData && Array.isArray(mapelData)) {
              localStorage.setItem(`siakad_offline_diniyah_mapel_kelas_${kls.id}_${kls.rombel || '__kosong__'}`, JSON.stringify(mapelData));
              for (const mapel of mapelData) {
                const params = new URLSearchParams({ rombel: kls.rombel || '__kosong__', mata_pelajaran_id: mapel.id, tahun_ajaran_id: taId, semester_id: semId });
                const dataSiswa = await fetchWithRetry(`${apiUrl}/api/guru/kelas/${kls.id}/nilai-diniyah?${params.toString()}`);
                if (dataSiswa) {
                  localStorage.setItem(`siakad_offline_diniyah_kelas_${kls.id}_${mapel.id}`, JSON.stringify({
                    siswaList: dataSiswa.siswa || [],
                    nilaiMap: dataSiswa.nilai_map || {}
                  }));
                }
                precacheState.progress += 1;
                await new Promise(r => setTimeout(r, 250)); // Jeda lebih aman dari 429 Cloudflare
              }
            }
          }
        }
      });
    }

    // 2. Keseharian Precaching
    if (akses.includes('rapor_keseharian')) {
      tasks.push(async () => {
        precacheState.label = 'Mengunduh Kelas Keseharian...';
        const urlKls = `${apiUrl}/api/guru/sekolah/${sekolahId}/kelas?tahun_ajaran_id=${taId}&semester_id=${semId}`;
        const kelasList = await fetchWithRetry(urlKls);
        if (kelasList && Array.isArray(kelasList)) {
          localStorage.setItem(`siakad_offline_kelas_${sekolahId}_${taId}_${semId}`, JSON.stringify(kelasList));
          
          for (const kls of kelasList) {
            const tabs = ['poin', 'pelanggaran', 'iqob'];
            for (const tab of tabs) {
               const params = new URLSearchParams({ rombel: kls.rombel || '__kosong__', tahun_ajaran_id: taId, semester_id: semId, type: tab });
               const resData = await fetchWithRetry(`${apiUrl}/api/guru/kelas/${kls.id}/keseharian?${params.toString()}`);
               if (resData) {
                 localStorage.setItem(`siakad_offline_keseharian_kelas_${kls.id}_${tab}`, JSON.stringify(resData));
               }
               precacheState.progress += 1;
               await new Promise(r => setTimeout(r, 250)); // Aman dari 429
            }
          }
        }
      });
    }

    // 3. Tahfiz Precaching (V1 / V2)
    if (akses.includes('input_tahfiz') || akses.includes('input_tahfiz_v2') || akses.includes('paket_alquran')) {
      const isV2 = akses.includes('input_tahfiz_v2');
      tasks.push(async () => {
        precacheState.label = 'Mengunduh Kelas Tahfiz...';
        // Usually Tahfiz uses jenis_penilaian=semester
        const paramsKls = new URLSearchParams({ jenis_penilaian: 'semester', tahun_ajaran_id: taId, semester_id: semId });
        const kelasList = await fetchWithRetry(`${apiUrl}/api/guru/sekolah/${sekolahId}/kelas?${paramsKls.toString()}`);
        if (kelasList && Array.isArray(kelasList)) {
          localStorage.setItem(`siakad_offline_kelas_${sekolahId}_${taId}_${semId}_tahfiz`, JSON.stringify(kelasList));
          
          for (const kls of kelasList) {
            const p = new URLSearchParams({ mata_pelajaran: 'Ujian Tahfiz', jenis_penilaian: 'semester', rombel: kls.rombel || '__kosong__', tahun_ajaran_id: taId, semester_id: semId });
            // In Tahfiz V1 and V2, the UI calls `/api/guru/kelas/${kelasId}/nilai` for students
            const dataSiswa = await fetchWithRetry(`${apiUrl}/api/guru/kelas/${kls.id}/nilai?${p.toString()}`);
            if (dataSiswa) {
              const siswaList = (dataSiswa.siswa || []).map((s) => ({ id: s.siswa_id, nama: s.nama_lengkap || '-', nisn: s.nisn || '-' }));
              const cachedData = JSON.stringify({ siswaList, nilaiMap: dataSiswa.nilai_map || {} });
              localStorage.setItem(`siakad_offline_tahfiz_kelas_${kls.id}_semester`, cachedData);
              if (isV2) {
                localStorage.setItem(`siakad_offline_tahfiz_v2_kelas_${kls.id}_semester`, cachedData);
              }
              
              // PRECACHE INDIVIDUAL STUDENT DETAILS
              let materiData = [];
              const rawMateri = localStorage.getItem(`siakad_offline_materi_tahfiz_${sekolahId}`);
              if (rawMateri) materiData = JSON.parse(rawMateri);
              else {
                const mRes = await fetchWithRetry(`${apiUrl}/api/guru/sekolah/${sekolahId}/materi-tahfiz`);
                if (mRes) {
                  materiData = mRes;
                  localStorage.setItem(`siakad_offline_materi_tahfiz_${sekolahId}`, JSON.stringify(mRes));
                }
              }

              for (const s of siswaList) {
                const pDetail = new URLSearchParams({ mata_pelajaran: 'Tahfiz', jenis_penilaian: 'semester', tahun_ajaran_id: taId, semester_id: semId });
                if (!isV2) {
                  const v1Res = await fetchWithRetry(`${apiUrl}/api/guru/siswa/${s.id}/nilai-tahfiz?${pDetail.toString()}`);
                  if (v1Res) {
                    const detailMap = new Map((v1Res.details || []).map(d => [d.nama_materi, d]));
                    const allRows = materiData.map(m => {
                      const d = detailMap.get(m.nama_materi);
                      return {
                        namaMateri: m.nama_materi, juz: m.juz||0, urutan: m.urutan,
                        hafalan: d ? d.skor_hafalan : '', kelancaran: d ? d.skor_kelancaran : '',
                        mad: d ? d.skor_mad : '', tajwid: d ? d.skor_tajwid : '', makharijulHuruf: d ? d.skor_makharijul_huruf : '', saveStatus: ''
                      };
                    });
                    const selectedJuz = v1Res.nilai?.juz_yang_diujikan
                      ? v1Res.nilai.juz_yang_diujikan.split(',').map(x => parseInt(x.trim())).filter(n => !isNaN(n))
                      : [];
                    const rows = selectedJuz.length > 0 ? allRows.filter(r => selectedJuz.includes(r.juz)) : [];
                    localStorage.setItem(`siakad_offline_nilai_tahfiz_v1_rows_${s.id}_semester`, JSON.stringify({
                      allRows, rows, selectedJuz, lastSavedSummary: v1Res.nilai || null, showJuzSelection: selectedJuz.length === 0
                    }));
                  }
                } else {
                  const v2Res = await fetchWithRetry(`${apiUrl}/api/guru/siswa/${s.id}/nilai-tahfiz-v2?${pDetail.toString()}`);
                  if (v2Res) {
                    const detailMap = new Map((v2Res.details || []).map(d => [d.nama_materi, d]));
                    const allRows = materiData.map(m => {
                      const d = detailMap.get(m.nama_materi);
                      return {
                        namaMateri: m.nama_materi, juz: m.juz||0, urutan: m.urutan,
                        kelancaran: d ? d.skor_kelancaran : '', tajwid: d ? d.skor_tajwid : '', makharijulHuruf: d ? d.skor_makharijul_huruf : '', saveStatus: ''
                      };
                    });
                    const selectedJuz = v2Res.nilai?.juz_yang_diujikan
                      ? v2Res.nilai.juz_yang_diujikan.split(',').map(x => parseInt(x.trim())).filter(n => !isNaN(n))
                      : [];
                    const rows = selectedJuz.length > 0 ? allRows.filter(r => selectedJuz.includes(r.juz)) : [];
                    localStorage.setItem(`siakad_offline_tahfiz_v2_detail_${s.id}_semester`, JSON.stringify({
                      allRows, rows, selectedJuz, lastSavedSummary: v2Res.nilai || null, showJuzSelection: selectedJuz.length === 0
                    }));
                  }
                }
                precacheState.progress += 1;
                await new Promise(r => setTimeout(r, 100)); // fast delay
              }
            }
            precacheState.progress += 2;
            await new Promise(r => setTimeout(r, 250)); // Aman dari 429
          }
        }
      });
    }

    // 4. Tasmi Precaching
    if (akses.includes('input_tasmi') || akses.includes('input_tasmi_v2') || akses.includes('paket_alquran')) {
      const isV2Tasmi = akses.includes('input_tasmi_v2');
      tasks.push(async () => {
        precacheState.label = 'Mengunduh Kelas Tasmi...';
        const paramsKls = new URLSearchParams({ jenis_penilaian: 'semester', tahun_ajaran_id: taId, semester_id: semId });
        const kelasList = await fetchWithRetry(`${apiUrl}/api/guru/sekolah/${sekolahId}/kelas?${paramsKls.toString()}`);
        if (kelasList && Array.isArray(kelasList)) {
          // Sama persis dengan cacheKey di InputNilai.svelte jika currentTab == 'tasmi'
          localStorage.setItem(`siakad_offline_kelas_${sekolahId}_${taId}_${semId}_tasmi`, JSON.stringify(kelasList));
          
          for (const kls of kelasList) {
            const p = new URLSearchParams({ mata_pelajaran: 'Ujian Tasmi', jenis_penilaian: 'semester', rombel: kls.rombel || '__kosong__', tahun_ajaran_id: taId, semester_id: semId });
            const dataSiswa = await fetchWithRetry(`${apiUrl}/api/guru/kelas/${kls.id}/nilai?${p.toString()}`);
            if (dataSiswa) {
              const siswaList = (dataSiswa.siswa || []).map((s) => ({ id: s.siswa_id, nama: s.nama_lengkap || '-', nisn: s.nisn || '-' }));
              const cachedData = JSON.stringify({ siswaList, nilaiMap: dataSiswa.nilai_map || {} });
              localStorage.setItem(`siakad_offline_tasmi_kelas_${kls.id}_semester`, cachedData);
              if (isV2Tasmi) {
                localStorage.setItem(`siakad_offline_tasmi_v2_kelas_${kls.id}_semester`, cachedData);
              }
              
              // PRECACHE INDIVIDUAL STUDENT DETAILS
              let materiData = [];
              const rawMateri = localStorage.getItem(`siakad_offline_materi_tahfiz_${sekolahId}`);
              if (rawMateri) materiData = JSON.parse(rawMateri);
              else {
                const mRes = await fetchWithRetry(`${apiUrl}/api/guru/sekolah/${sekolahId}/materi-tahfiz`);
                if (mRes) {
                  materiData = mRes;
                  localStorage.setItem(`siakad_offline_materi_tahfiz_${sekolahId}`, JSON.stringify(mRes));
                }
              }

              for (const s of siswaList) {
                const riwayatRes = await fetchWithRetry(`${apiUrl}/api/guru/siswa/${s.id}/riwayat-tasmi`);
                let tahap = 1;
                if (riwayatRes && riwayatRes.riwayat && riwayatRes.riwayat.length > 0) {
                  let maxTahap = 0;
                  for (const r of riwayatRes.riwayat) if (r.tahap > maxTahap) maxTahap = r.tahap;
                  tahap = maxTahap < 5 ? maxTahap + 1 : 5;
                }

                const pDetail = new URLSearchParams({ mata_pelajaran: 'Ujian Tasmi', jenis_penilaian: 'semester', tahun_ajaran_id: taId, semester_id: semId, tahap: String(tahap) });
                if (!isV2Tasmi) {
                  const v1Res = await fetchWithRetry(`${apiUrl}/api/guru/siswa/${s.id}/nilai-tasmi?${pDetail.toString()}`);
                  if (v1Res) {
                    const detailMap = new Map((v1Res.details || []).map(d => [d.nama_materi, d]));
                    const allRows = materiData.map(m => {
                      const d = detailMap.get(m.nama_materi);
                      return {
                        namaMateri: m.nama_materi, juz: m.juz||0, urutan: m.urutan,
                        hafalan: d ? d.skor_hafalan : '', kelancaran: d ? d.skor_kelancaran : '',
                        mad: d ? d.skor_mad : '', tajwid: d ? d.skor_tajwid : '', makharijulHuruf: d ? d.skor_makharijul_huruf : '', saveStatus: ''
                      };
                    });
                    localStorage.setItem(`siakad_offline_tasmi_v1_detail_${s.id}_semester`, JSON.stringify({ allRows, rows: [], selectedJuz: [], tahap, lastSavedSummary: v1Res.nilai || null, showJuzSelection: true }));
                  }
                } else {
                  const v2Res = await fetchWithRetry(`${apiUrl}/api/guru/siswa/${s.id}/nilai-tasmi-v2?${pDetail.toString()}`);
                  if (v2Res) {
                    const detailMap = new Map((v2Res.details || []).map(d => [d.nama_materi, d]));
                    const allRows = materiData.map(m => {
                      const d = detailMap.get(m.nama_materi);
                      return {
                        namaMateri: m.nama_materi, juz: m.juz||0, urutan: m.urutan,
                        kelancaran: d ? d.skor_kelancaran : '', tajwid: d ? d.skor_tajwid : '', makharijulHuruf: d ? d.skor_makharijul_huruf : '', saveStatus: ''
                      };
                    });
                    localStorage.setItem(`siakad_offline_tasmi_v2_detail_${s.id}_semester`, JSON.stringify({ allRows, rows: [], selectedJuz: [], tahap, lastSavedSummary: v2Res.nilai || null, showJuzSelection: true }));
                  }
                }
                precacheState.progress += 1;
                await new Promise(r => setTimeout(r, 100)); // fast delay
              }
            }
            precacheState.progress += 2;
            await new Promise(r => setTimeout(r, 250)); // Aman dari 429
          }
        }
      });
    }

    // Assign an arbitrary total based on tasks (much higher now because of student iteration)
    precacheState.total = tasks.length * 100;
    
    // Execute all tasks sequentially to avoid overwhelming
    for (const task of tasks) {
      if (guruState.activeSekolahId !== sekolahId) break; // User switched jenjang mid-sync!
      await task();
    }

    if (guruState.activeSekolahId === sekolahId) {
      precacheState.label = 'Selesai!';
      precacheState.progress = precacheState.total;
      precachedSet.add(sessionKey); // Tandai sukses agar tidak mengulang jika bolak-balik
    }
    
  } catch (err) {
    console.error('Error precaching data:', err);
    precacheState.label = 'Gagal Mengunduh';
  } finally {
    setTimeout(() => {
      precacheState.isPrecaching = false;
    }, 3000);
  }
}
