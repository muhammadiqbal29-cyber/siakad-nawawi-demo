<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';

  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  let sekolahData = $state([]);
  let loading = $state(true);

  onMount(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/sekolah`, { credentials: 'include' });
      if (res.ok) {
        const payload = await res.json();
        sekolahData = payload.data || [];
      }
    } catch (err) {
      console.error(err);
    } finally {
      loading = false;
    }
  });
</script>

<div class="page-container">
  <div class="header">
    <button
      class="btn-secondary"
      onclick={() => goto('/')}
      style="margin-bottom: 1rem; display: inline-flex; align-items: center; gap: 0.5rem;"
    >
      <Icon name="arrowLeft" size={16} /> Kembali ke Beranda
    </button>
    <h1 class="page-title">Pilih Unit Sekolah</h1>
    <p class="page-subtitle">
      Modul Akademik terpisah berdasarkan unit sekolah (Tenant Isolation).
    </p>
  </div>

  {#if loading}
    <div style="text-align: center; padding: 2rem;">Memuat data institusi...</div>
  {:else}
    <div class="app-grid">
      {#each sekolahData as s (s.id)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="app-card" onclick={() => goto(`/akademik/${s.id}`)}>
          <div class="icon-circle">
            <Icon name="home" size={32} />
          </div>
          <h3>{s.nama_sekolah}</h3>
          <p>Jenjang: <strong>{s.jenjang}</strong> | {s.status}</p>
        </div>
      {/each}
      {#if sekolahData.length === 0}
        <div style="grid-column: 1 / -1; text-align: center; color: #64748b;">
          Belum ada sekolah yang terdaftar. <br /><br />
          <button class="btn-primary" onclick={() => goto('/institusi')}
            >Buat Sekolah di Data Institusi</button
          >
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page-container {
    padding: 2rem;
    max-width: 1000px;
    margin: 0 auto;
  }
  .header {
    text-align: center;
    margin-bottom: 3rem;
  }
  .page-title {
    font-size: 2rem;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 0.5rem 0;
  }
  .page-subtitle {
    color: #64748b;
    font-size: 1.1rem;
    margin: 0;
  }

  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
  }

  .app-card {
    background: white;
    border-radius: 1rem;
    padding: 2rem;
    text-align: center;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.05);
    border: 1px solid #e2e8f0;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  .app-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
    border-color: #3b82f6;
  }

  .icon-circle {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background-color: #eff6ff;
    color: #3b82f6;
    display: flex;
    justify-content: center;
    align-items: center;
    margin: 0 auto 1.5rem auto;
  }

  .app-card h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.25rem;
    color: #1e293b;
  }
  .app-card p {
    margin: 0;
    color: #64748b;
    font-size: 0.95rem;
  }
  .btn-secondary {
    background: white;
    border: 1px solid #e2e8f0;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
  }
  .btn-primary {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
  }
</style>
