package database

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"golang.org/x/crypto/bcrypt"
	"siakad-nawawi-be/internal/models"
)

// SeedDemoData menginisialisasi database dengan data sekolah, guru, santri, dan nilai demo yang realistis
func SeedDemoData() {
	slog.Info("Memeriksa dan menyemai (seed) data demo lengkap...")

	// 1. Seed Sekolah
	sekolahSMP := models.Sekolah{
		NamaSekolah:      "SMP Imam Nawawi",
		NPSN:             "69990001",
		Jenjang:          "SMP",
		Status:           "Swasta",
		Alamat:           "Jl. Mahir Mahar Km. 5, Palangka Raya",
		KodePos:          "73111",
		Email:            "smp@islamimamnawawi.sch.id",
		Website:          "https://islamimamnawawi.sch.id",
		KepalaSekolah:    "Ustadz H. Ahmad Sobri, Lc., M.H.",
		Fitur:            `["paket_alquran","input_tahfiz","input_tahfiz_v2","input_tasmi","input_tasmi_v2","input_diniyah","rapor_keseharian","analitik","cetak_rapor"]`,
		DividerThickness: 3,
	}
	var existingSekolah models.Sekolah
	if err := DB.Where("npsn = ?", sekolahSMP.NPSN).First(&existingSekolah).Error; err != nil {
		DB.Create(&sekolahSMP)
	} else {
		sekolahSMP = existingSekolah
	}

	sekolahSMA := models.Sekolah{
		NamaSekolah:      "SMA Imam Nawawi",
		NPSN:             "69990002",
		Jenjang:          "SMA",
		Status:           "Swasta",
		Alamat:           "Jl. Mahir Mahar Km. 5, Palangka Raya",
		KodePos:          "73111",
		Email:            "sma@islamimamnawawi.sch.id",
		Website:          "https://islamimamnawawi.sch.id",
		KepalaSekolah:    "Ustadz Dr. Muhammad Rasyid, M.Pd.",
		Fitur:            `["paket_alquran","input_tahfiz_v2","input_tasmi_v2","input_diniyah","rapor_keseharian","analitik","cetak_rapor"]`,
		DividerThickness: 3,
	}
	if err := DB.Where("npsn = ?", sekolahSMA.NPSN).First(&existingSekolah).Error; err != nil {
		DB.Create(&sekolahSMA)
	}

	// 2. Seed Tahun Ajaran & Semester
	var tahunAjaran models.TahunAjaran
	if err := DB.Where("tahun_awal = ? AND tahun_akhir = ?", 2026, 2027).First(&tahunAjaran).Error; err != nil {
		tahunAjaran = models.TahunAjaran{
			TahunAwal:  2026,
			TahunAkhir: 2027,
			NamaTahun:  "2026/2027",
			Status:     "Active",
		}
		DB.Create(&tahunAjaran)

		// Buat Semester Ganjil (Aktif) dan Genap
		semGanjil := models.Semester{
			TahunAjaranID: tahunAjaran.ID,
			TipeSemester:  "Ganjil",
			StatusAktif:   true,
		}
		semGenap := models.Semester{
			TahunAjaranID: tahunAjaran.ID,
			TipeSemester:  "Genap",
			StatusAktif:   false,
		}
		DB.Create(&semGanjil)
		DB.Create(&semGenap)
	}

	var semAktif models.Semester
	DB.Where("tahun_ajaran_id = ? AND status_aktif = ?", tahunAjaran.ID, true).First(&semAktif)

	// 3. Seed Users & Gurus
	hashPass, _ := bcrypt.GenerateFromPassword([]byte("demo123"), bcrypt.DefaultCost)
	passStr := string(hashPass)

	demoUsers := []struct {
		Email       string
		Role        string
		NamaLengkap string
		AksesFitur  []string
	}{
		{
			Email:       "admin@demo.com",
			Role:        "admin",
			NamaLengkap: "Administrator Utama Demo",
			AksesFitur:  []string{"admin"},
		},
		{
			Email:       "ustadz.tahfiz@demo.com",
			Role:        "guru",
			NamaLengkap: "Ustadz Abdullah Al-Hafizh",
			AksesFitur:  []string{"paket_alquran", "input_tahfiz", "input_tahfiz_v2", "input_tasmi", "input_tasmi_v2", "cetak_rapor"},
		},
		{
			Email:       "ustadz.diniyah@demo.com",
			Role:        "guru",
			NamaLengkap: "Ustadz Ahmad Fauzi, S.Pd.I.",
			AksesFitur:  []string{"input_diniyah", "analitik", "cetak_rapor"},
		},
		{
			Email:       "ustadz.lengkap@demo.com",
			Role:        "guru",
			NamaLengkap: "Ustadz Muhammad Zaki, M.Pd.",
			AksesFitur:  []string{"paket_alquran", "input_tahfiz", "input_tahfiz_v2", "input_tasmi", "input_tasmi_v2", "input_diniyah", "rapor_keseharian", "analitik", "presensi_manager", "cetak_rapor"},
		},
	}

	guruMap := make(map[string]models.Guru)

	for idx, du := range demoUsers {
		var u models.User
		if err := DB.Where("email = ?", du.Email).First(&u).Error; err != nil {
			u = models.User{
				Email:    du.Email,
				Password: passStr,
				Role:     du.Role,
			}
			DB.Create(&u)
		}

		if du.Role == "guru" {
			var g models.Guru
			if err := DB.Where("user_id = ?", u.ID).First(&g).Error; err != nil {
				fiturJSON, _ := json.Marshal(du.AksesFitur)
				aksesSekolahMap := map[string][]string{
					"1": du.AksesFitur,
					"2": du.AksesFitur,
				}
				sekolahJSON, _ := json.Marshal(aksesSekolahMap)

				nik := fmt.Sprintf("627101000%d", idx+1)
				noHp := fmt.Sprintf("08123456789%d", idx+1)

				g = models.Guru{
					UserID:       u.ID,
					NamaLengkap:  du.NamaLengkap,
					NIK:          &nik,
					NoHP:         &noHp,
					JamMasuk:     "07:00",
					JamPulang:    "16:00",
					AksesFitur:   string(fiturJSON),
					AksesSekolah: string(sekolahJSON),
					StatusAktif:  true,
				}
				DB.Create(&g)
			}
			guruMap[du.Email] = g
		}
	}

	// 4. Seed Kelas
	kelasData := []struct {
		Tingkat      string
		TingkatLevel int
		NamaKelas    string
		SekolahID    int
	}{
		{"7", 1, "7A (Thariq bin Ziyad)", sekolahSMP.ID},
		{"7", 1, "7B (Usamah bin Zaid)", sekolahSMP.ID},
		{"8", 2, "8A (Shalahuddin Al-Ayyubi)", sekolahSMP.ID},
		{"9", 3, "9A (Muhammad Al-Fatih)", sekolahSMP.ID},
	}

	kelasMap := make(map[string]models.Kelas)
	for _, kd := range kelasData {
		var k models.Kelas
		if err := DB.Where("sekolah_id = ? AND nama_kelas = ?", kd.SekolahID, kd.NamaKelas).First(&k).Error; err != nil {
			k = models.Kelas{
				SekolahID:    kd.SekolahID,
				Tingkat:      kd.Tingkat,
				TingkatLevel: kd.TingkatLevel,
				NamaKelas:    kd.NamaKelas,
			}
			DB.Create(&k)
		}
		kelasMap[kd.NamaKelas] = k
	}

	// 5. Seed Santri (Siswa)
	santriList := []struct {
		NIS  string
		NISN string
		Nama string
		JK   string
		Kls  string
	}{
		{"202607001", "0081234001", "Muhammad Farhan Al-Ghifari", "L", "7A (Thariq bin Ziyad)"},
		{"202607002", "0081234002", "Ahmad Rayyan Al-Farisi", "L", "7A (Thariq bin Ziyad)"},
		{"202607003", "0081234003", "Zaid bin Tsabit An-Nawawi", "L", "7A (Thariq bin Ziyad)"},
		{"202607004", "0081234004", "Fathir Al-Ayyubi Robbani", "L", "7A (Thariq bin Ziyad)"},
		{"202607005", "0081234005", "Ibrahim Hakim As-Siraj", "L", "7A (Thariq bin Ziyad)"},
		{"202607006", "0081234006", "Rafi Ahmad Syauqi", "L", "7A (Thariq bin Ziyad)"},
		{"202607007", "0081234007", "Bilal Al-Habasyi Mubarak", "L", "7B (Usamah bin Zaid)"},
		{"202607008", "0081234008", "Hamzah Asadullah Al-Qadir", "L", "7B (Usamah bin Zaid)"},
		{"202607009", "0081234009", "Umar Al-Faruq Al-Habsyi", "L", "8A (Shalahuddin Al-Ayyubi)"},
		{"202607010", "0081234010", "Khalid bin Walid Al-Muhtadi", "L", "8A (Shalahuddin Al-Ayyubi)"},
	}

	siswaIDs := []int{}
	tglLahir := "2012-05-15"
	for _, s := range santriList {
		var existing models.Siswa
		if err := DB.Where("nis = ?", s.NIS).First(&existing).Error; err != nil {
			newSiswa := models.Siswa{
				NIS:          s.NIS,
				NISN:         s.NISN,
				NamaLengkap:  s.Nama,
				Status:       "Aktif",
				TempatLahir:  "Palangka Raya",
				TanggalLahir: &tglLahir,
				JenisKelamin: s.JK,
				Agama:        "Islam",
				Alamat:       "Komplek Pesantren Imam Nawawi",
				SekolahID:    sekolahSMP.ID,
			}
			DB.Create(&newSiswa)

			// Masukkan ke Riwayat Kelas (Rombel)
			targetKls := kelasMap[s.Kls]
			klsIDPtr := &targetKls.ID
			rk := models.RiwayatKelas{
				SiswaID:       newSiswa.ID,
				KelasID:       klsIDPtr,
				SekolahID:     sekolahSMP.ID,
				TahunAjaranID: tahunAjaran.ID,
				Rombel:        "",
			}
			DB.Create(&rk)
			siswaIDs = append(siswaIDs, newSiswa.ID)
		} else {
			siswaIDs = append(siswaIDs, existing.ID)
		}
	}

	// 6. Seed Mapel Diniyah
	diniyahMapels := []string{
		"Fiqih Ibadah",
		"Hadits Arbain An-Nawawiyah",
		"Aqidah Ahlussunnah",
		"Bahasa Arab Dasar",
		"Sirah Nabawiyah",
	}

	guruFauzi := guruMap["ustadz.diniyah@demo.com"]
	kls7A := kelasMap["7A (Thariq bin Ziyad)"]

	for i, mName := range diniyahMapels {
		var md models.MapelDiniyah
		if err := DB.Where("sekolah_id = ? AND nama_mapel = ?", sekolahSMP.ID, mName).First(&md).Error; err != nil {
			md = models.MapelDiniyah{
				SekolahID: sekolahSMP.ID,
				NamaMapel: mName,
				Kategori:  "tes_tulis",
				Urutan:    i + 1,
				Aktif:     true,
			}
			DB.Create(&md)

			// Tetapkan Ustadz Fauzi sebagai pengampu kelas 7A
			if guruFauzi.ID > 0 && kls7A.ID > 0 {
				var p models.PengampuMapelDiniyah
				if err := DB.Where("mapel_diniyah_id = ? AND kelas_id = ?", md.ID, kls7A.ID).First(&p).Error; err != nil {
					p = models.PengampuMapelDiniyah{
						MapelDiniyahID: md.ID,
						KelasID:        kls7A.ID,
						GuruID:         guruFauzi.ID,
						Rombel:         "",
					}
					DB.Create(&p)
				}
			}
		}
	}

	// 7. Seed Halaqah Tahfiz
	guruAbdullah := guruMap["ustadz.tahfiz@demo.com"]
	if guruAbdullah.ID > 0 {
		var halaqah models.Halaqah
		if err := DB.Where("guru_id = ? AND nama_halaqah = ?", guruAbdullah.ID, "Halaqah Abu Bakar Ash-Shiddiq").First(&halaqah).Error; err != nil {
			halaqah = models.Halaqah{
				SekolahID:     sekolahSMP.ID,
				GuruID:        guruAbdullah.ID,
				TahunAjaranID: tahunAjaran.ID,
				SemesterID:    semAktif.ID,
				NamaHalaqah:   "Halaqah Abu Bakar Ash-Shiddiq",
			}
			DB.Create(&halaqah)

			// Masukkan 6 santri pertama ke halaqah ini
			for i := 0; i < 6 && i < len(siswaIDs); i++ {
				var ang models.AnggotaHalaqah
				if err := DB.Where("halaqah_id = ? AND siswa_id = ?", halaqah.ID, siswaIDs[i]).First(&ang).Error; err != nil {
					ang = models.AnggotaHalaqah{
						HalaqahID: halaqah.ID,
						SiswaID:   siswaIDs[i],
					}
					DB.Create(&ang)
				}
			}
		}
	}

	// 8. Seed Indikator Keseharian (Adab & Asrama)
	indikators := []struct {
		Nama  string
		Bobot float64
	}{
		{"Sholat Fardhu Berjamaah di Masjid", 1.0},
		{"Qiyamul Lail & Sholat Dhuha", 1.0},
		{"Kerapian Kamar & Lemari Asrama", 1.0},
		{"Adab Bertutur Kata & Santun", 1.0},
		{"Kedisiplinan Waktu Belajar Mandiri", 1.0},
	}
	for _, ind := range indikators {
		var ik models.IndikatorKeseharian
		if err := DB.Where("sekolah_id = ? AND nama = ?", sekolahSMP.ID, ind.Nama).First(&ik).Error; err != nil {
			ik = models.IndikatorKeseharian{
				SekolahID:      sekolahSMP.ID,
				Nama:           ind.Nama,
				NilaiPengurang: ind.Bobot,
				Aktif:          true,
			}
			DB.Create(&ik)
		}
	}

	// 9. Seed Jenis Pelanggaran & Jenis Iqob
	pelanggarans := []struct {
		Nama string
		Poin float64
	}{
		{"Terlambat Sholat Berjamaah", 5.0},
		{"Keluar Lingkungan Asrama Tanpa Izin", 20.0},
		{"Tidak Mengikuti Sesi Belajar Mandiri", 10.0},
		{"Memakai Pakaian Tidak Rapi Saat Sholat", 5.0},
	}
	for _, p := range pelanggarans {
		var jp models.JenisPelanggaran
		if err := DB.Where("sekolah_id = ? AND nama = ?", sekolahSMP.ID, p.Nama).First(&jp).Error; err != nil {
			jp = models.JenisPelanggaran{
				SekolahID: sekolahSMP.ID,
				Nama:      p.Nama,
				Poin:      p.Poin,
				Aktif:     true,
			}
			DB.Create(&jp)
		}
	}

	iqobs := []string{
		"Muroja'ah Hafalan 1 Juz di Hadapan Musyrif",
		"Membersihkan Perpustakaan / Masjid Asrama",
		"Menulis Faidah Hadits Arbain 5 Lembar",
	}
	for _, iq := range iqobs {
		var ji models.JenisIqob
		if err := DB.Where("sekolah_id = ? AND nama = ?", sekolahSMP.ID, iq).First(&ji).Error; err != nil {
			ji = models.JenisIqob{
				SekolahID:  sekolahSMP.ID,
				Nama:       iq,
				Poin:       10.0,
				Keterangan: "Sanksi pembinaan santri",
				Aktif:      true,
			}
			DB.Create(&ji)
		}
	}

	// 10. Sample Nilai Diniyah dan Nilai Tahfiz untuk Santri Pertama
	if len(siswaIDs) > 0 {
		firstSiswaID := siswaIDs[0]
		var sampleMapel models.MapelDiniyah
		if err := DB.Where("sekolah_id = ? AND nama_mapel = ?", sekolahSMP.ID, "Fiqih Ibadah").First(&sampleMapel).Error; err == nil {
			var nd models.NilaiDiniyah
			if err := DB.Where("siswa_id = ? AND mapel_diniyah_id = ?", firstSiswaID, sampleMapel.ID).First(&nd).Error; err != nil {
				nd = models.NilaiDiniyah{
					SiswaID:        firstSiswaID,
					SekolahID:      sekolahSMP.ID,
					TahunAjaranID:  tahunAjaran.ID,
					SemesterID:     semAktif.ID,
					MapelDiniyahID: sampleMapel.ID,
					UhScores:       "[85, 90]",
					RataUh:         87.5,
					MurniPts:       88,
					NaPts:          88,
					Pas:            92,
					NilaiRapor:     89.25,
				}
				DB.Create(&nd)
			}
		}

		// Nilai Tahfiz V2 Sample
		var ntv models.NilaiTahfizV2
		if err := DB.Where("siswa_id = ? AND jenis_penilaian = ?", firstSiswaID, "semester").First(&ntv).Error; err != nil {
			nilaiAkhir := 88.5
			ntv = models.NilaiTahfizV2{
				SiswaID:         firstSiswaID,
				JenisPenilaian:  "semester",
				TahunAjaranID:   tahunAjaran.ID,
				SemesterID:      semAktif.ID,
				JuzYangDiujikan: "30",
				NilaiAkhir:      nilaiAkhir,
				Predikat:        "Mumtaz",
			}
			DB.Create(&ntv)

			// Detail Surah An-Naba & An-Nazi'at
			skor88 := 88
			skor90 := 90
			detail1 := models.NilaiTahfizDetailV2{
				NilaiTahfizV2ID:     ntv.ID,
				NamaMateri:          "An-Naba'",
				Juz:                 30,
				Urutan:              1,
				SkorKelancaran:      &skor88,
				SkorTajwid:          &skor90,
				SkorMakharijulHuruf: &skor88,
			}
			DB.Create(&detail1)
		}
	}

	_ = time.Now()
	slog.Info("Penyemaian (seed) data demo berhasil diselesaikan secara total!")
}
