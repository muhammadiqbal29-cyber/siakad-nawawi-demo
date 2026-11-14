# SIAKAD Imam Nawawi - Demo Edition (Go + SvelteKit)

Versi demo mandiri SIAKAD Imam Nawawi yang telah dimodifikasi agar **dapat langsung dijalankan tanpa setup database rumit (zero-config SQLite)** dan **dapat diakses tanpa password (1-Click Demo Login)**.

---

## 🚀 Fitur Khusus Versi Demo

1. **Zero Database Setup (Out-of-the-Box SQLite)**
   - Backend otomatis membuat file database SQLite `siakad_demo.db` saat pertama kali dijalankan. Tidak membutuhkan instalasi MySQL atau MariaDB.
2. **Auto-Seeding Data Realistis**
   - Otomatis mengisi data demo lengkap:
     - Institusi Sekolah (SMP & SMA Imam Nawawi)
     - Tahun Ajaran 2026/2027 (Semester Ganjil & Aktif)
     - 4 Guru Demo dengan role berbeda
     - 4 Kelas (7A, 7B, 10A, 10B) & 10 Santri lengkap dengan Riwayat Kelas
     - 5 Mata Pelajaran Diniyah (Fiqih, Aqidah, Hadits, Bahasa Arab, Sirah Nabawiyah) & Pengampu
     - Halaqah Tahfiz & Pengampu
     - Indikator Keseharian, Pelanggaran, dan Iqob
     - Sampel Nilai Tahfiz (Metode Rubrik V2) & Nilai Diniyah
3. **Passwordless Access (1-Click Demo Login)**
   - Halaman login web (`/login`) telah dilengkapi kartu tombol **1-Click Akses Cepat** untuk berbagai role.
   - Field password bersifat opsional / dapat dikosongkan untuk kemudahan demonstrasi.
4. **Hub Menu Modul Input Nilai Interaktif**
   - Guru tidak lagi diarahkan paksa secara kaku (auto-redirect) ke satu halaman saja.
   - Disediakan Hub Menu pilihan modul nilai (Tahfiz, Diniyah, Keseharian) dengan indikator badge izin akses sesuai peran guru yang sedang login.

---

## 👥 Akun Demo & 1-Click Login

Tersedia tombol akses cepat di halaman login `/login`:

| Tombol Role | Email Demo | Hak Akses |
| :--- | :--- | :--- |
| 👑 **Administrator** | `admin@demo.com` / `admin@siakad.com` | Akses penuh dashboard admin, master data, konfigurasi |
| 📖 **Guru Tahfiz** | `ustadz.tahfiz@demo.com` | Pengampu Halaqah Tahfiz, input nilai tahfiz & tasmi' |
| 📚 **Guru Diniyah** | `ustadz.diniyah@demo.com` | Pengampu Mapel Diniyah (Fiqih, Aqidah, Hadits) |
| 🌟 **Guru Lengkap** | `ustadz.lengkap@demo.com` | Akses mengajar Tahfiz, Diniyah, serta Keseharian |

---

## 🛠️ Cara Menjalankan

### 1. Menjalankan Backend (Go)
```bash
cd backend
go run main.go
```
> Backend akan berjalan di `http://localhost:8080`. File `siakad_demo.db` akan dibuat dan disemai secara otomatis.

### 2. Menjalankan Frontend Web (SvelteKit)
```bash
cd frontend
npm install
npm run dev
```
> Buka browser di `http://localhost:5173`. Di halaman `/login`, klik salah satu kartu **1-Click Login Cepat**.

---

## 📦 Inisialisasi ke Repository GitHub Baru

Untuk mempublikasikan repositori demo ini ke GitHub Anda:

```bash
# Di dalam folder app-nawawi-demo
cd /home/muhammad-iqbal/projek/rea/app-nawawi-demo

# Ganti remote origin ke URL repo demo GitHub Anda
git remote set-url origin https://github.com/<username-anda>/<nama-repo-demo-anda>.git

# Commit dan push
git add .
git commit -m "feat: setup standalone demo with sqlite seed, 1-click passwordless login, and module hub"
git push -u origin main
```
