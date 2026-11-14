<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth.svelte.js';
  import { getApiUrl } from '$lib/config.js';
  import Sidebar from '$lib/components/layout/Sidebar.svelte';
  import Header from '$lib/components/layout/Header.svelte';

  let { children } = $props();

  let sidebarOpen = $state(true);
  let currentPath = $derived($page.url.pathname);
  let activeTahun = $state('');

  $effect(() => {
    // Proteksi: Hanya role admin yang boleh masuk ke rute (dashboard)
    if (auth.role && auth.role !== 'admin') {
      goto(`/${auth.role}`);
      return;
    }

    const handleTAChange = (e) => {
      activeTahun = e.detail;
    };
    window.addEventListener('tahunAjaranChanged', handleTAChange);

    // Ambil tahun ajaran aktif
    const apiUrl = getApiUrl();
    fetch(`${apiUrl}/api/tahun-ajaran`, { credentials: 'include' })
      .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then((data) => {
        if (data && data.length > 0) {
          const aktif = data.find((t) => t.status === 'Active');
          let semAktif = null;
          if (aktif && aktif.semesters) {
            semAktif = aktif.semesters.find((s) => s.status_aktif);
          }
          if (aktif) {
            activeTahun = `${aktif.nama_tahun} - ${semAktif ? semAktif.tipe_semester : '?'}`;
          }
        }
      })
      .catch((err) => console.error('Gagal mengambil tahun ajaran aktif', err));

    return () => {
      window.removeEventListener('tahunAjaranChanged', handleTAChange);
    };
  });

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
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

  // Tentukan title berdasarkan URL path
  let currentTitle = $derived(
    currentPath.startsWith('/presensi')
      ? 'Presensi & Kehadiran'
      : currentPath.startsWith('/institusi')
        ? 'Data Institusi'
        : currentPath.startsWith('/akademik')
          ? 'Workspace Akademik'
          : currentPath.startsWith('/sdm')
            ? 'Direktori SDM'
            : currentPath.startsWith('/kenaikan-kelas')
              ? 'Kenaikan Kelas'
              : 'Beranda Aplikasi'
  );
</script>

<div class="layout-wrapper" class:sidebar-closed={!sidebarOpen}>
  <Sidebar isOpen={sidebarOpen} {currentPath} {onLogout} />

  <div class="main-content">
    <Header
      title={currentTitle}
      {activeTahun}
      userName={auth.loggedInUser || 'Admin'}
      userRole={auth.role || 'admin'}
      onToggleSidebar={toggleSidebar}
      {onLogout}
    />

    <main class="content-area">
      {@render children()}
    </main>
  </div>
</div>

<style>
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
  @media (max-width: 768px) {
    .layout-wrapper {
      padding-left: 0;
    }
    .sidebar-closed {
      padding-left: 0;
    }
    .content-area {
      padding: 1rem;
    }
  }
</style>
