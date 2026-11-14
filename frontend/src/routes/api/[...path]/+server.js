import { json } from '@sveltejs/kit';

// Demo Seed Data
const SEKOLAH_LIST = [
  {
    id: 1,
    nama_sekolah: 'SMP Imam Nawawi',
    jenjang: 'SMP',
    status: 'aktif',
    npsn: '69991234',
    alamat: 'Jl. G. Obos No. 10, Palangka Raya',
    fitur: JSON.stringify([
      'paket_alquran',
      'input_tahfiz',
      'input_tahfiz_v2',
      'input_tasmi',
      'input_tasmi_v2',
      'input_diniyah',
      'rapor_keseharian',
      'presensi',
      'cetak_rapor'
    ])
  },
  {
    id: 2,
    nama_sekolah: 'SMA Imam Nawawi',
    jenjang: 'SMA',
    status: 'aktif',
    npsn: '69995678',
    alamat: 'Jl. G. Obos No. 12, Palangka Raya',
    fitur: JSON.stringify([
      'paket_alquran',
      'input_tahfiz',
      'input_tahfiz_v2',
      'input_tasmi',
      'input_tasmi_v2',
      'input_diniyah',
      'rapor_keseharian',
      'presensi',
      'cetak_rapor'
    ])
  }
];

const TAHUN_AJARAN_LIST = [
  {
    id: 1,
    nama_tahun: '2026/2027',
    status: 'Active',
    is_active: true,
    semesters: [
      { id: 1, tipe_semester: 'Ganjil', status_aktif: true }
    ]
  }
];

const KELAS_LIST = [
  { id: 1, sekolah_id: 1, nama_kelas: 'Kelas 7A', tingkat: 7, rombel: 'A', wali_kelas_id: 2, total_siswa: 5 },
  { id: 2, sekolah_id: 1, nama_kelas: 'Kelas 7B', tingkat: 7, rombel: 'B', wali_kelas_id: 3, total_siswa: 5 },
  { id: 3, sekolah_id: 2, nama_kelas: 'Kelas 10A', tingkat: 10, rombel: 'A', wali_kelas_id: 4, total_siswa: 5 },
  { id: 4, sekolah_id: 2, nama_kelas: 'Kelas 10B', tingkat: 10, rombel: 'B', wali_kelas_id: 4, total_siswa: 5 }
];

const SISWA_LIST = [
  { id: 1, sekolah_id: 1, kelas_id: 1, nama_lengkap: 'Ahmad Zaky Al-Faruq', nisn: '0081234561', nis: '2627001', jenis_kelamin: 'L', status: 'Aktif', nama_kelas: 'Kelas 7A' },
  { id: 2, sekolah_id: 1, kelas_id: 1, nama_lengkap: 'Muhammad Farhan Pratama', nisn: '0081234562', nis: '2627002', jenis_kelamin: 'L', status: 'Aktif', nama_kelas: 'Kelas 7A' },
  { id: 3, sekolah_id: 1, kelas_id: 1, nama_lengkap: 'Abdullah Azzam Robbani', nisn: '0081234563', nis: '2627003', jenis_kelamin: 'L', status: 'Aktif', nama_kelas: 'Kelas 7A' },
  { id: 4, sekolah_id: 1, kelas_id: 1, nama_lengkap: 'Fathir Rizky Ramadhan', nisn: '0081234564', nis: '2627004', jenis_kelamin: 'L', status: 'Aktif', nama_kelas: 'Kelas 7A' },
  { id: 5, sekolah_id: 1, kelas_id: 1, nama_lengkap: 'Hamzah Al-Ghifari', nisn: '0081234565', nis: '2627005', jenis_kelamin: 'L', status: 'Aktif', nama_kelas: 'Kelas 7A' },
  { id: 6, sekolah_id: 2, kelas_id: 3, nama_lengkap: 'Bilal Muhammad Yusuf', nisn: '0071234561', nis: '2627101', jenis_kelamin: 'L', status: 'Aktif', nama_kelas: 'Kelas 10A' },
  { id: 7, sekolah_id: 2, kelas_id: 3, nama_lengkap: 'Salman Al-Farisi', nisn: '0071234562', nis: '2627102', jenis_kelamin: 'L', status: 'Aktif', nama_kelas: 'Kelas 10A' },
  { id: 8, sekolah_id: 2, kelas_id: 3, nama_lengkap: 'Thoriq Ziyad As-Syahid', nisn: '0071234563', nis: '2627103', jenis_kelamin: 'L', status: 'Aktif', nama_kelas: 'Kelas 10A' },
  { id: 9, sekolah_id: 2, kelas_id: 3, nama_lengkap: 'Usamah Zaid Ibrahim', nisn: '0071234564', nis: '2627104', jenis_kelamin: 'L', status: 'Aktif', nama_kelas: 'Kelas 10A' },
  { id: 10, sekolah_id: 2, kelas_id: 3, nama_lengkap: 'Khalid Walid Rabbani', nisn: '0071234565', nis: '2627105', jenis_kelamin: 'L', status: 'Aktif', nama_kelas: 'Kelas 10A' }
];

const MAPEL_LIST = [
  { id: 1, sekolah_id: 1, nama_mapel: 'Fiqih Ibadah', kategori: 'Diniyah', kkm: 75, nama: 'Fiqih Ibadah' },
  { id: 2, sekolah_id: 1, nama_mapel: 'Aqidah & Akhlak', kategori: 'Diniyah', kkm: 75, nama: 'Aqidah & Akhlak' },
  { id: 3, sekolah_id: 1, nama_mapel: 'Hadits Arbain', kategori: 'Diniyah', kkm: 75, nama: 'Hadits Arbain' },
  { id: 4, sekolah_id: 1, nama_mapel: 'Bahasa Arab', kategori: 'Diniyah', kkm: 70, nama: 'Bahasa Arab' },
  { id: 5, sekolah_id: 1, nama_mapel: 'Sirah Nabawiyah', kategori: 'Diniyah', kkm: 75, nama: 'Sirah Nabawiyah' }
];

const HALAQAH_LIST = [
  { id: 1, sekolah_id: 1, nama_halaqah: 'Halaqah Abu Bakar Ash-Shiddiq', pengampu_id: 2, total_santri: 5 },
  { id: 2, sekolah_id: 2, nama_halaqah: 'Halaqah Umar bin Khattab', pengampu_id: 4, total_santri: 5 }
];

const INDIKATOR_LIST = [
  { id: 1, sekolah_id: 1, nama_indikator: 'Sholat Berjamaah 5 Waktu', kategori: 'Ibadah', target_poin: 100 },
  { id: 2, sekolah_id: 1, nama_indikator: 'Kedisiplinan & Piket Kamar', kategori: 'Disiplin', target_poin: 100 },
  { id: 3, sekolah_id: 1, nama_indikator: 'Adab kepada Guru & Teman', kategori: 'Akhlak', target_poin: 100 },
  { id: 4, sekolah_id: 1, nama_indikator: 'Dzikir Pagi & Petang', kategori: 'Ibadah', target_poin: 100 }
];

const GURU_LIST = [
  { id: 1, nama_lengkap: 'Super Administrator Demo', email: 'admin@demo.com', role: 'admin', nip: '198001012005011001' },
  { id: 2, nama_lengkap: 'Ustadz Abdullah Al-Hafiz', email: 'ustadz.tahfiz@demo.com', role: 'guru', nip: '198503152010011002' },
  { id: 3, nama_lengkap: 'Ustadz Fauzi Lc.', email: 'ustadz.diniyah@demo.com', role: 'guru', nip: '198807202012011003' },
  { id: 4, nama_lengkap: 'Ustadz Ahmad Al-Kamil', email: 'ustadz.lengkap@demo.com', role: 'guru', nip: '198605102011011004' }
];

function getGuruProfile(roleOrEmail) {
  if (roleOrEmail === 'guru_tahfiz' || roleOrEmail === 'ustadz.tahfiz@demo.com') {
    return {
      id: 2,
      nama_lengkap: 'Ustadz Abdullah Al-Hafiz',
      email: 'ustadz.tahfiz@demo.com',
      nip: '198503152010011002',
      akses_sekolah: JSON.stringify({
        '1': ['paket_alquran', 'input_tahfiz', 'input_tahfiz_v2', 'input_tasmi', 'input_tasmi_v2', 'cetak_rapor'],
        '2': ['paket_alquran', 'input_tahfiz', 'input_tahfiz_v2', 'input_tasmi', 'input_tasmi_v2', 'cetak_rapor']
      })
    };
  }
  if (roleOrEmail === 'guru_diniyah' || roleOrEmail === 'ustadz.diniyah@demo.com') {
    return {
      id: 3,
      nama_lengkap: 'Ustadz Fauzi Lc.',
      email: 'ustadz.diniyah@demo.com',
      nip: '198807202012011003',
      akses_sekolah: JSON.stringify({
        '1': ['input_diniyah', 'cetak_rapor'],
        '2': ['input_diniyah', 'cetak_rapor']
      })
    };
  }
  return {
    id: 4,
    nama_lengkap: 'Ustadz Ahmad Al-Kamil',
    email: 'ustadz.lengkap@demo.com',
    nip: '198605102011011004',
    akses_sekolah: JSON.stringify({
      '1': ['paket_alquran', 'input_tahfiz', 'input_tahfiz_v2', 'input_tasmi', 'input_tasmi_v2', 'input_diniyah', 'rapor_keseharian', 'presensi', 'cetak_rapor'],
      '2': ['paket_alquran', 'input_tahfiz', 'input_tahfiz_v2', 'input_tasmi', 'input_tasmi_v2', 'input_diniyah', 'rapor_keseharian', 'presensi', 'cetak_rapor']
    })
  };
}

function resolveUserRole(cookies, headers) {
  const token = cookies.get('token') || headers.get('authorization') || '';
  if (token.includes('guru_tahfiz') || token.includes('ustadz.tahfiz')) return 'guru_tahfiz';
  if (token.includes('guru_diniyah') || token.includes('ustadz.diniyah')) return 'guru_diniyah';
  if (token.includes('guru_lengkap') || token.includes('ustadz.lengkap')) return 'guru_lengkap';
  if (token.includes('guru')) return 'guru_lengkap';
  return 'admin';
}

function getCorsHeaders(request) {
  const origin = request.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Sekolah-ID, Accept, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
}

export async function OPTIONS({ request }) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request)
  });
}

export async function GET({ params, url, cookies, request }) {
  const p = params.path || '';
  const cors = getCorsHeaders(request);

  // 1. System Status
  if (p === 'system/status') {
    return json({
      status: 'online',
      app: 'SIAKAD Nawawi Demo (Vercel Cloud Edition)',
      maintenance_mode: false,
      server_time: new Date().toISOString()
    }, { headers: cors });
  }

  // 2. Auth Check: /api/me
  if (p === 'me') {
    const roleKey = resolveUserRole(cookies, request.headers);
    const isGuru = roleKey.startsWith('guru');
    return json({
      role: isGuru ? 'guru' : 'admin',
      email: isGuru ? getGuruProfile(roleKey).email : 'admin@demo.com',
      maintenance_bypass: true,
      message: 'Sesi login demo aktif'
    }, { headers: cors });
  }

  // 3. Sekolah / Jenjang
  if (p === 'sekolah' || p === 'guru/sekolah') {
    return json({
      status: 'success',
      data: SEKOLAH_LIST
    }, { headers: cors });
  }

  // 4. Tahun Ajaran
  if (p.includes('tahun-ajaran')) {
    return json(TAHUN_AJARAN_LIST, { headers: cors });
  }

  // 5. Profil Guru
  if (p === 'guru/me/profil') {
    const roleKey = resolveUserRole(cookies, request.headers);
    return json(getGuruProfile(roleKey), { headers: cors });
  }

  // 6. Kelas
  if (p.endsWith('kelas') || p === 'kelas') {
    return json({
      status: 'success',
      data: KELAS_LIST
    }, { headers: cors });
  }

  // 7. Siswa
  if (p.endsWith('siswa') || p === 'siswa') {
    return json({
      status: 'success',
      data: SISWA_LIST,
      total: SISWA_LIST.length
    }, { headers: cors });
  }

  // 8. Mapel Diniyah
  if (p.includes('mapel-diniyah') || p === 'mapel-diniyah') {
    return json({
      status: 'success',
      data: MAPEL_LIST
    }, { headers: cors });
  }

  // 9. Halaqah Tahfiz
  if (p.includes('halaqah')) {
    return json({
      status: 'success',
      data: HALAQAH_LIST
    }, { headers: cors });
  }

  // 10. Indikator Keseharian
  if (p.includes('keseharian/indikator') || p.includes('indikator')) {
    return json({
      status: 'success',
      data: INDIKATOR_LIST
    }, { headers: cors });
  }

  // 11. Dashboard Guru
  if (p.includes('dashboard')) {
    return json({
      status: 'success',
      total_santri: 10,
      total_setoran: 145,
      rata_rata: 88.5,
      data: {
        total_santri: 10,
        total_kelas: 4,
        total_setoran: 145,
        rata_rata_nilai: 88.5
      }
    }, { headers: cors });
  }

  // 12. Daftar Guru
  if (p === 'guru' || p === 'admin/guru') {
    return json({
      status: 'success',
      data: GURU_LIST
    }, { headers: cors });
  }

  // Default fallback for any other GET
  return json({
    status: 'success',
    endpoint: p,
    data: []
  }, { headers: cors });
}

export async function POST({ params, request, cookies }) {
  const p = params.path || '';
  const cors = getCorsHeaders(request);

  // Handle Login
  if (p === 'login') {
    let body = {};
    try {
      body = await request.json();
    } catch {}

    const roleRequested = body.role || (body.email && body.email.includes('tahfiz') ? 'guru_tahfiz' : body.email && body.email.includes('diniyah') ? 'guru_diniyah' : body.email && body.email.includes('lengkap') ? 'guru_lengkap' : 'admin');
    const isGuru = roleRequested.startsWith('guru');
    const finalRole = isGuru ? 'guru' : 'admin';

    // Set cookie token untuk sesi
    cookies.set('token', `demo-token-${roleRequested}`, {
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });

    const prof = getGuruProfile(roleRequested);
    return json({
      message: 'Login demo berhasil',
      token: `demo-jwt-token-${roleRequested}`,
      role: finalRole,
      user: {
        id: prof.id,
        nama_lengkap: isGuru ? prof.nama_lengkap : 'Super Administrator Demo',
        email: isGuru ? prof.email : 'admin@demo.com',
        role: finalRole
      }
    }, { headers: cors });
  }

  // Handle Logout
  if (p === 'logout') {
    cookies.delete('token', { path: '/' });
    return json({ message: 'Logout demo berhasil' }, { headers: cors });
  }

  // Default POST response (simulasi simpan nilai / presensi / edit)
  return json({
    status: 'success',
    message: 'Data berhasil disimpan (Mode Demo Vercel)',
    data: {}
  }, { headers: cors });
}

export async function PUT({ params, request }) {
  const cors = getCorsHeaders(request);
  return json({
    status: 'success',
    message: 'Data berhasil diperbarui (Mode Demo Vercel)',
    data: {}
  }, { headers: cors });
}

export async function DELETE({ params, request }) {
  const cors = getCorsHeaders(request);
  return json({
    status: 'success',
    message: 'Data berhasil dihapus (Mode Demo Vercel)'
  }, { headers: cors });
}
