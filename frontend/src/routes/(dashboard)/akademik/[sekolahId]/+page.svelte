<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Icon from '$lib/components/ui/Icon.svelte';
  import KelasMaster from '$lib/components/akademik/KelasMaster.svelte';
  import SiswaMaster from '$lib/components/akademik/SiswaMaster.svelte';
  import RombelMaster from '$lib/components/akademik/RombelMaster.svelte';

  let sekolahId = $derived($page.params.sekolahId);
  let activeTab = $state('siswa');

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  let sekolah = $state(null);

  onMount(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/sekolah`, { credentials: 'include' });
      if (res.ok) {
        const payload = await res.json();
        const data = payload.data || [];
        sekolah = data.find((s) => s.id == sekolahId);
      }
    } catch (err) {
      console.error(err);
    }
  });

  function setTab(tab) {
    activeTab = tab;
  }
</script>

<div class="workspace">
  <!-- Workspace Header -->
  <div class="workspace-header">
    <div class="breadcrumb">
      <button class="btn-text" onclick={() => goto('/akademik')}>
        <Icon name="arrowLeft" size={16} /> Portal Akademik
      </button>
      <span class="separator">/</span>
      <span class="current-unit">{sekolah ? sekolah.nama_sekolah : 'Memuat...'}</span>
    </div>

    <div class="tabs">
      <button class="tab" class:active={activeTab === 'siswa'} onclick={() => setTab('siswa')}>
        <Icon name="users" size={18} /> Data Siswa
      </button>
      <button class="tab" class:active={activeTab === 'kelas'} onclick={() => setTab('kelas')}>
        <Icon name="layout" size={18} /> Master Kelas
      </button>
      <button class="tab" class:active={activeTab === 'rombel'} onclick={() => setTab('rombel')}>
        <Icon name="archive" size={18} /> Rombongan Belajar
      </button>
    </div>
  </div>

  <!-- Workspace Content (The actual modules) -->
  <div class="workspace-content">
    {#if activeTab === 'siswa'}
      <div class="module-wrapper">
        <SiswaMaster {sekolahId} />
      </div>
    {:else if activeTab === 'kelas'}
      <div class="module-wrapper">
        <KelasMaster {sekolahId} />
      </div>
    {:else if activeTab === 'rombel'}
      <div class="module-wrapper">
        <RombelMaster {sekolahId} />
      </div>
    {/if}
  </div>
</div>

<style>
  .workspace {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 70px); /* minus main header height */
    background: #f8fafc;
  }

  .workspace-header {
    background: white;
    border-bottom: 1px solid #e2e8f0;
    padding: 1.5rem 2rem 0 2rem;
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .btn-text {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0;
    font-size: 0.95rem;
  }
  .btn-text:hover {
    color: #3b82f6;
  }

  .separator {
    color: #cbd5e1;
  }
  .current-unit {
    font-weight: 700;
    color: #1e293b;
    font-size: 1.1rem;
  }

  .tabs {
    display: flex;
    gap: 2rem;
  }

  .tab {
    background: none;
    border: none;
    padding: 0.75rem 0;
    font-size: 1rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
  }

  .tab:hover {
    color: #3b82f6;
  }
  .tab.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
  }

  .workspace-content {
    flex: 1;
    overflow-y: auto;
    padding: 0; /* Let the inner modules handle their own padding */
  }

  /* We force the inner modules to behave nicely inside the wrapper */
  .module-wrapper {
    width: 100%;
    height: 100%;
  }
</style>
