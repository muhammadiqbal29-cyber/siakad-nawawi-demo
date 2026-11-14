<script>
  import { onMount } from 'svelte';
  import { page, updated } from '$app/stores';
  import { goto, onNavigate } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { getApiUrl } from '$lib/config.js';
  import GuruSidebar from '$lib/components/layout/GuruSidebar.svelte';
  import Header from '$lib/components/layout/Header.svelte';
  import BottomNav from '$lib/components/layout/BottomNav.svelte';
  import JenjangModal from '$lib/components/guru/JenjangModal.svelte';
  import TahunModal from '$lib/components/guru/TahunModal.svelte';
  import PrecacheIndicator from '$lib/components/ui/PrecacheIndicator.svelte';
  import HelpModal from '$lib/components/ui/HelpModal.svelte';
  import { guruState } from '$lib/guruState.svelte.js';
  import { startPrecache } from '$lib/offlinePrecacher.svelte.js';
  import { syncManager } from '$lib/syncManager.svelte.js';

  let isClient = $state(false);
  let { children } = $props();

  let sidebarOpen = $state(true);
  let showHelpModal = $state(false);
  let isNavigating = $state(false);
  let currentPath = $derived($page.url.pathname);

  onMount(() => {
    isClient = true;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('guru_sidebar_open');
      if (saved !== null) {
        sidebarOpen = saved === 'true';
      } else {
        // Buka sidebar secara default jika diakses dari PC / layar besar
        sidebarOpen = window.innerWidth > 768;
      }
    }
  });
  // fiturGuru sekarang di-derive dari aksesMap sekolah yang sedang aktif
  let fiturGuru = $derived(
    guruState.activeSekolahId ? guruState.aksesMap[guruState.activeSekolahId] || [] : []
  );
  
  let showUpdateToast = $state(false);

  $effect(() => {
    // Polling untuk mendeteksi versi baru PWA tiap 15 menit
    const interval = setInterval(async () => {
      try {
        const isUpdate = await updated.check();
        if (isUpdate) showUpdateToast = true;
      } catch (e) {}
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  });

  $effect(() => {
    if (guruState.activeSekolahId && guruState.activeTahunId && guruState.activeSemesterId) {
       startPrecache();
    }
  });

  function applyUpdate() {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
    // Beri jeda sedikit agar SW mengambil alih
    setTimeout(() => {
      window.location.reload();
    }, 200);
  }

  $effect(() => {
    const apiUrl = getApiUrl();

    if (auth.role === 'admin') {
      // Admin has full access to all features based on the school's features

      // Fetch all schools for admin
      fetch(`${apiUrl}/api/sekolah`, { credentials: 'include' })
        .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then((data) => {
          if (data && data.data) {
            guruState.sekolahList = data.data;
            const fullMap = {};
            guruState.sekolahList.forEach((s) => {
              let f = [];
              try {
                if (s.fitur) f = JSON.parse(s.fitur);
              } catch {}
              // Admin sees everything configured for the school, plus all default guru features
              if (!f.includes('cetak_rapor')) f.push('cetak_rapor');
              fullMap[s.id] = f;
            });
            guruState.aksesMap = fullMap;

            if (!guruState.activeSekolahId) {
              let savedId = null;
              if (typeof window !== 'undefined') {
                savedId = localStorage.getItem('siakad_active_sekolah_id');
              }
              const matchingSekolah = savedId
                ? guruState.sekolahList.find((s) => s.id == savedId)
                : null;

              if (matchingSekolah) {
                guruState.activeSekolahId = matchingSekolah.id;
                guruState.activeSekolahName = matchingSekolah.nama_sekolah;
              } else if (guruState.sekolahList.length === 1) {
                guruState.activeSekolahId = guruState.sekolahList[0].id;
                guruState.activeSekolahName = guruState.sekolahList[0].nama_sekolah;
                if (typeof window !== 'undefined') {
                  localStorage.setItem('siakad_active_sekolah_id', guruState.activeSekolahId);
                  localStorage.setItem('siakad_active_sekolah_name', guruState.activeSekolahName);
                }
              } else if (guruState.sekolahList.length > 1) {
                guruState.showJenjangModal = true;
              }
            }
          }
        })
        .catch((err) => console.error('Gagal mengambil jenjang admin', err));
    } else {
      async function loadGuruData() {
        try {
          // 1. Fetch Profil Guru to get guruSchoolAkses
          let guruSchoolAkses = {};
          const profilRes = await fetch(`${apiUrl}/api/guru/me/profil`, { credentials: 'include' });
          if (profilRes.ok) {
            const data = await profilRes.json();
            if (data && data.nama_lengkap) {
              auth.loggedInUser = data.nama_lengkap;
            }
            if (data && data.akses_sekolah) {
              try {
                guruSchoolAkses = JSON.parse(data.akses_sekolah) || {};
              } catch {}
            }
          }

          // 2. Fetch Jenjang Sekolah
          const sekolahRes = await fetch(`${apiUrl}/api/guru/sekolah`, { credentials: 'include' });
          if (sekolahRes.ok) {
            const data = await sekolahRes.json();
            if (data && data.data) {
              guruState.sekolahList = data.data;
              const map = {};
              guruState.sekolahList.forEach((s) => {
                // Get features assigned to the guru for this school
                let guruFeatures = guruSchoolAkses[s.id] || [];
                
                // Get features enabled for the school itself
                let schoolFeatures = [];
                try {
                  if (s.fitur) schoolFeatures = JSON.parse(s.fitur);
                } catch {}

                // Intersect guru features with school features (school features act as a master toggle)
                let f = guruFeatures.filter(feat => feat === 'presensi_manager' || schoolFeatures.includes(feat));

                // Ensure cetak_rapor is always available
                if (!f.includes('cetak_rapor')) f.push('cetak_rapor');
                map[s.id] = f;
              });
              guruState.aksesMap = map;
              
              if (typeof window !== 'undefined') {
                localStorage.setItem('siakad_offline_sekolahList', JSON.stringify(guruState.sekolahList));
                localStorage.setItem('siakad_offline_aksesMap', JSON.stringify(guruState.aksesMap));
              }

              if (!guruState.activeSekolahId) {
                let savedId = null;
                if (typeof window !== 'undefined') {
                  savedId = localStorage.getItem('siakad_active_sekolah_id');
                }
                const matchingSekolah = savedId
                  ? guruState.sekolahList.find((s) => s.id == savedId)
                  : null;

                if (matchingSekolah) {
                  guruState.activeSekolahId = matchingSekolah.id;
                  guruState.activeSekolahName = matchingSekolah.nama_sekolah;
                } else if (guruState.sekolahList.length === 1) {
                  guruState.activeSekolahId = guruState.sekolahList[0].id;
                  guruState.activeSekolahName = guruState.sekolahList[0].nama_sekolah;
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('siakad_active_sekolah_id', guruState.activeSekolahId);
                    localStorage.setItem('siakad_active_sekolah_name', guruState.activeSekolahName);
                  }
                } else if (guruState.sekolahList.length > 1) {
                  guruState.showJenjangModal = true;
                }
              }
            }
          } else {
            throw new Error('Gagal fetch');
          }
        } catch (err) {
          console.error('Gagal mengambil data guru/sekolah, mencoba dari local storage', err);
          if (typeof window !== 'undefined') {
            const cachedSekolah = localStorage.getItem('siakad_offline_sekolahList');
            const cachedAkses = localStorage.getItem('siakad_offline_aksesMap');
            if (cachedSekolah) guruState.sekolahList = JSON.parse(cachedSekolah);
            if (cachedAkses) guruState.aksesMap = JSON.parse(cachedAkses);
            
            // Restore active state
            const savedId = localStorage.getItem('siakad_active_sekolah_id');
            if (savedId && guruState.sekolahList.find(s => s.id == savedId)) {
              guruState.activeSekolahId = savedId;
              guruState.activeSekolahName = localStorage.getItem('siakad_active_sekolah_name');
            }
          }
        }
      }
      loadGuruData();
    }

    // Fetch Tahun Ajaran
    fetch(`${apiUrl}/api/guru/tahun-ajaran`, { credentials: 'include' })
      .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then((data) => {
        if (data && data.length > 0) {
          guruState.tahunList = data;
          if (typeof window !== 'undefined') {
            localStorage.setItem('siakad_offline_tahunList', JSON.stringify(data));
          }
          
          let savedTaId = typeof window !== 'undefined' ? localStorage.getItem('siakad_active_ta_id') : null;
          let savedSemId = typeof window !== 'undefined' ? localStorage.getItem('siakad_active_sem_id') : null;
          let savedTaName = typeof window !== 'undefined' ? localStorage.getItem('siakad_active_ta_name') : null;

          if (savedTaId && savedSemId && savedTaName) {
            guruState.activeTahunId = parseInt(savedTaId);
            guruState.activeSemesterId = parseInt(savedSemId);
            guruState.activeTahunName = savedTaName;
          } else {
            const aktif = data.find((t) => t.status === 'Active') || data[0];
            let semAktif = null;
            if (aktif && aktif.semesters) {
              semAktif = aktif.semesters.find((s) => s.status_aktif) || aktif.semesters[0];
            }
            if (aktif && semAktif) {
              guruState.activeTahunId = aktif.id;
              guruState.activeSemesterId = semAktif.id;
              guruState.activeTahunName = `${aktif.nama_tahun} - ${semAktif.tipe_semester}`;
              
              if (typeof window !== 'undefined') {
                localStorage.setItem('siakad_active_ta_id', aktif.id);
                localStorage.setItem('siakad_active_sem_id', semAktif.id);
                localStorage.setItem('siakad_active_ta_name', guruState.activeTahunName);
              }
            }
          }
        } else {
          throw new Error('Gagal fetch tahun');
        }
      })
      .catch((err) => {
        console.error('Gagal mengambil tahun ajaran aktif, mencoba dari local storage', err);
        if (typeof window !== 'undefined') {
          const cachedTahun = localStorage.getItem('siakad_offline_tahunList');
          if (cachedTahun) guruState.tahunList = JSON.parse(cachedTahun);
          
          let savedTaId = localStorage.getItem('siakad_active_ta_id');
          let savedSemId = localStorage.getItem('siakad_active_sem_id');
          let savedTaName = localStorage.getItem('siakad_active_ta_name');

          if (savedTaId && savedSemId && savedTaName) {
            guruState.activeTahunId = parseInt(savedTaId);
            guruState.activeSemesterId = parseInt(savedSemId);
            guruState.activeTahunName = savedTaName;
          }
        }
      });
  });

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
    if (typeof window !== 'undefined') {
      localStorage.setItem('guru_sidebar_open', String(sidebarOpen));
    }
  }

  function onLogout() {
    fetch(`${getApiUrl()}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    }).finally(() => {
      auth.loggedInUser = null;
      auth.role = '';
      if (typeof window !== 'undefined') {
        localStorage.removeItem('siakad_role');
      }
      goto('/login');
    });
  }

  let currentTitle = $derived(
    currentPath.startsWith('/guru/input-diniyah')
      ? 'Nilai Diniyah'
      : currentPath.startsWith('/guru/input-nilai')
        ? 'Input Nilai'
        : currentPath.startsWith('/guru/rapor')
          ? 'Rapor'
          : currentPath.startsWith('/guru/materi-tahfiz')
            ? 'Konfigurasi Materi'
            : currentPath.startsWith('/guru/log-aktivitas')
              ? 'Log Aktivitas Guru'
              : 'Beranda Guru'
  );
</script>

<svelte:head>
</svelte:head>

<div class="layout-wrapper" class:sidebar-closed={!sidebarOpen}>
  <GuruSidebar isOpen={sidebarOpen} onClose={() => sidebarOpen = false} {currentPath} {onLogout} {fiturGuru} userRole={auth.role} />
  
  {#if sidebarOpen}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="mobile-overlay" onclick={() => sidebarOpen = false}></div>
  {/if}

  <div class="main-content">
    <Header
      title={currentTitle}
      activeTahun={guruState.activeTahunName}
      onGantiTahun={() => (guruState.showTahunModal = true)}
      userRole="guru"
      activeJenjang={guruState.activeSekolahName}
      onGantiJenjang={() => (guruState.showJenjangModal = true)}
      userName={auth.loggedInUser || 'Guru'}
      onToggleSidebar={toggleSidebar}
      onHelpClick={() => (showHelpModal = true)}
      {onLogout}
    />

    <main class="content-area">
      {@render children()}
    </main>
  </div>
</div>

<JenjangModal />
<TahunModal />
<HelpModal bind:isOpen={showHelpModal} {currentPath} />
<BottomNav {currentPath} {fiturGuru} />

{#if showUpdateToast || $updated}
<div class="update-toast">
  <span>Versi sistem terbaru telah tersedia!</span>
  <button onclick={applyUpdate}>Muat Ulang</button>
</div>
{/if}

<style>
  .update-toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #1e293b;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    gap: 12px;
    z-index: 9999;
    font-size: 14px;
    font-weight: 500;
  }
  .update-toast button {
    background: #4f46e5;
    color: white;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
  }
  @media (max-width: 768px) {
    .update-toast {
      bottom: 100px;
      width: 90%;
      justify-content: space-between;
    }
  }

  .layout-wrapper {
    display: flex;
    min-height: 100vh;
    width: 100%;
    background-color: var(--color-bg-body, #f8fafc);
    transition: padding-left 0.3s ease;
    padding-left: var(--sidebar-width, 260px);
  }
  .layout-wrapper.sidebar-closed {
    padding-left: 80px;
  }
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .content-area {
    padding: 2rem;
    flex: 1;
  }
  .mobile-overlay {
    display: none;
  }
  @media (max-width: 768px) {
    .layout-wrapper,
    .layout-wrapper.sidebar-closed {
      padding-left: 0 !important;
    }
    .content-area {
      padding: 1rem;
      padding-bottom: 100px; /* Space for BottomNav */
    }
    /* Sembunyikan GuruSidebar di mobile secara paksa untuk diganti BottomNav */
    :global(.sidebar) {
      display: none !important;
    }
    .mobile-overlay {
      display: none !important; /* Hamburger is gone, no overlay needed */
    }
  }
</style>
