import { build, files, version } from '$service-worker';

// Create a unique cache name for this deployment
const CACHE = `siakad-cache-${version}`;

// CRITICAL FILES yang wajib di-cache saat install agar PWA bisa offline
// Hanya cache file inti (entry point, layout chunks, icons).
// Halaman-halaman lain akan di-cache on-demand saat dibuka.
const CRITICAL_ASSETS = build.filter(f =>
	f.includes('/chunks/') ||
	f.includes('/entry/') ||
	f.endsWith('.css')
);

// File statis yang kecil saja
const CRITICAL_STATIC = files.filter(f =>
	f.endsWith('manifest.json') ||
	f.endsWith('favicon.png') ||
	f.endsWith('icon-192.png') ||
	f.endsWith('icons.svg')
);

const PRECACHE = [...CRITICAL_ASSETS, ...CRITICAL_STATIC];

// Daftar lengkap semua aset (untuk cache-first lookup)
const ALL_ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
	self.skipWaiting();
	// Cache HANYA file kritis — bukan seluruh aplikasi
	// Ini membuat instalasi PWA SANGAT CEPAT (< 2 detik)
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(PRECACHE);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	// Take control immediately
	event.waitUntil(self.clients.claim());

	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Bypass ALL API endpoints — we use localStorage for offline data
	if (url.pathname.startsWith('/api/')) {
		return;
	}

	async function respond() {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// CACHE-FIRST untuk semua build/static assets (JS, CSS, fonts, images)
		if (ALL_ASSETS.includes(url.pathname)) {
			const cachedAsset = await cache.match(url.pathname);
			if (cachedAsset) {
				return cachedAsset;
			}
		}

		// NETWORK-FIRST untuk halaman HTML dan aset yang belum di-cache
		try {
			const response = await fetch(event.request);

			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			if (response.status === 200) {
				// Cache on-demand: halaman yang dibuka akan ter-cache
				// untuk akses offline berikutnya
				cache.put(event.request, response.clone());
			}

			return response;
		} catch (err) {
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) {
				return cachedResponse;
			}

			throw err;
		}
	}

	event.respondWith(respond());
});

self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});
