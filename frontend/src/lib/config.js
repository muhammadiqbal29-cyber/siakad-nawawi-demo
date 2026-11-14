// Konfigurasi API URL Dinamis
// Otomatis mengenali environment Vercel / Production tanpa hardcoded localhost
export function getApiUrl() {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (typeof window !== 'undefined') {
    // Jika dibuka di browser produksi (seperti *.vercel.app), gunakan relative same-origin
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return '';
    }
  }
  // Local development fallback
  return 'http://localhost:8080';
}
