<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import Icon from '$lib/components/ui/Icon.svelte';
  
  const apiUrl = (import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' ? '' : 'http://localhost:8080'));
  let maintenanceMessage = $state('Sistem sedang dalam perbaikan rutin. Silakan kembali dalam beberapa saat.');
  
  onMount(async () => {
    // Cek status saat ini
    try {
      const res = await fetch(`${apiUrl}/api/system/status`);
      if (res.ok) {
        const data = await res.json();
        if (data.maintenance_message) {
          maintenanceMessage = data.maintenance_message;
        }
        
        // Jika ternyata sudah tidak maintenance, kembali ke home
        if (data.maintenance_mode === false || data.maintenance_mode === 'false') {
          goto('/');
        }
      }
    } catch (e) {
      console.error('Gagal mengecek status', e);
    }
  });
</script>

<svelte:head>
  <title>Sistem Sedang Maintenance</title>
</svelte:head>

<div class="maintenance-container">
  <div class="maintenance-content">
    <div class="icon-wrapper">
      <Icon name="settings" size={64} />
    </div>
    
    <h1>Sistem Sedang Diupdate</h1>
    
    <div class="message-box">
      <p>{maintenanceMessage}</p>
    </div>
    
    <div class="footer-info">
      <p>Terima kasih atas kesabaran Anda.</p>
      <button class="btn-refresh" onclick={() => window.location.reload()}>
        Cek Ulang Status
      </button>
      
      <div class="admin-login">
        <a href="/login" class="link">Login sebagai Admin</a>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #f8fafc;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }
  
  .maintenance-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  
  .maintenance-content {
    background: white;
    max-width: 500px;
    width: 100%;
    padding: 3rem 2rem;
    border-radius: 1rem;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    text-align: center;
    border-top: 6px solid #4f46e5;
  }
  
  .icon-wrapper {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background-color: #eef2ff;
    color: #4f46e5;
    margin-bottom: 1.5rem;
  }
  
  h1 {
    margin: 0 0 1.5rem 0;
    color: #1e293b;
    font-size: 1.8rem;
    font-weight: 700;
  }
  
  .message-box {
    background-color: #f1f5f9;
    padding: 1.5rem;
    border-radius: 0.5rem;
    border-left: 4px solid #94a3b8;
    margin-bottom: 2rem;
  }
  
  .message-box p {
    margin: 0;
    color: #334155;
    font-size: 1.1rem;
    line-height: 1.5;
  }
  
  .footer-info {
    color: #64748b;
    font-size: 0.95rem;
  }
  
  .btn-refresh {
    margin-top: 1.5rem;
    padding: 0.75rem 2rem;
    background-color: #1e293b;
    color: white;
    border: none;
    border-radius: 9999px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .btn-refresh:hover {
    background-color: #0f172a;
  }
  
  .admin-login {
    margin-top: 2rem;
    font-size: 0.85rem;
  }
  
  .link {
    color: #94a3b8;
    text-decoration: none;
    transition: color 0.2s;
  }
  
  .link:hover {
    color: #4f46e5;
    text-decoration: underline;
  }
  
  /* Responsive untuk Layar HP (Mobile) */
  @media (max-width: 640px) {
    .maintenance-content {
      padding: 2rem 1.5rem;
      border-radius: 0.75rem;
    }
    
    .icon-wrapper {
      width: 80px;
      height: 80px;
      margin-bottom: 1rem;
    }
    
    h1 {
      font-size: 1.4rem;
      margin-bottom: 1rem;
    }
    
    .message-box {
      padding: 1rem;
      margin-bottom: 1.5rem;
    }
    
    .message-box p {
      font-size: 1rem;
    }
    
    .btn-refresh {
      width: 100%;
      padding: 0.75rem 1rem;
    }
  }
</style>
