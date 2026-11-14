package database

import (
	"fmt"
	"log"
	"log/slog"
	"os"
	"strings"
	"time"

	"siakad-nawawi-be/internal/models"

	"github.com/glebarez/sqlite"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	driver := strings.ToLower(os.Getenv("DB_DRIVER"))
	dbUser := os.Getenv("DB_USER")
	dbPass := os.Getenv("DB_PASS")
	dbHost := os.Getenv("DB_HOST")
	dbPort := os.Getenv("DB_PORT")
	dbName := os.Getenv("DB_NAME")
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "siakad_demo.db"
	}

	gormConfig := &gorm.Config{
		Logger: gormlogger.New(
			log.New(os.Stdout, "\r\n", log.LstdFlags),
			gormlogger.Config{
				SlowThreshold:             200 * time.Millisecond,
				LogLevel:                  gormlogger.Warn,
				IgnoreRecordNotFoundError: true,
				Colorful:                  false,
			},
		),
	}

	var err error
	if driver == "sqlite" || dbHost == "" {
		slog.Info("Mode Demo: Menggunakan SQLite Database", "path", dbPath)
		DB, err = gorm.Open(sqlite.Open(dbPath), gormConfig)
		if err != nil {
			slog.Error("Gagal membuka database SQLite", "error", err)
			os.Exit(1)
		}
	} else {
		dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&loc=Local&multiStatements=true", dbUser, dbPass, dbHost, dbPort, dbName)

		for i := 1; i <= 10; i++ {
			DB, err = gorm.Open(mysql.Open(dsn), gormConfig)
			if err == nil {
				break
			}
			slog.Warn("Gagal terhubung ke database MySQL, mencoba ulang", "percobaan", i, "max", 10, "error", err)
			time.Sleep(2 * time.Second)
		}

		if err != nil {
			slog.Error("Gagal membuka koneksi database MySQL setelah 10 percobaan", "error", err)
			os.Exit(1)
		}

		// Atur Connection Pool agar database tidak hang jika di-bombardir test Playwright
		sqlDB, err := DB.DB()
		if err == nil {
			sqlDB.SetMaxIdleConns(100)
			sqlDB.SetMaxOpenConns(100)
			sqlDB.SetConnMaxLifetime(time.Hour)
		}
	}

	slog.Info("Berhasil terhubung ke database via GORM")
	migrateAndSeed()
}

func migrateAndSeed() {
	// Fix: Drop incompatible foreign key constraints before AutoMigrate
	// MySQL Error 3780 occurs when column types don't match between FK pairs
	fixForeignKeyMismatch()

	// Fix: Drop old unique indexes for NilaiTasmi and NilaiTasmiV2 to recreate them with the Tahap column
	if DB.Migrator().HasIndex(&models.NilaiTasmi{}, "idx_nilai_tasmi_scope") {
		DB.Migrator().DropIndex(&models.NilaiTasmi{}, "idx_nilai_tasmi_scope")
	}
	if DB.Migrator().HasIndex(&models.NilaiTasmiV2{}, "idx_nilai_tasmi_v2_scope") {
		DB.Migrator().DropIndex(&models.NilaiTasmiV2{}, "idx_nilai_tasmi_v2_scope")
	}

	// Fix: Drop old unique index idx_pengampu_mapel_kelas (tanpa kolom rombel)
	// sehingga GORM dapat membuat ulang index baru idx_pengampu_mapel_kelas_rombel
	if DB.Migrator().HasTable("pengampu_mapel_diniyahs") {
		if DB.Migrator().HasIndex(&models.PengampuMapelDiniyah{}, "idx_pengampu_mapel_kelas") {
			if err := DB.Migrator().DropIndex(&models.PengampuMapelDiniyah{}, "idx_pengampu_mapel_kelas"); err != nil {
				slog.Warn("Gagal menghapus index lama idx_pengampu_mapel_kelas", "error", err)
			}
		}
	}

	// AutoMigrate
	err := DB.AutoMigrate(
		&models.User{},
		&models.HariLibur{},
		&models.PengajuanIzin{},
		&models.Sekolah{},
		&models.KonfigurasiPresensi{},
		&models.KonfigurasiNilaiTahfiz{},
		&models.KonfigurasiNilaiDiniyah{},
		&models.TahunAjaran{},
		&models.Semester{},
		&models.Kelas{},
		&models.Siswa{},
		&models.RiwayatKelas{},
		&models.Nilai{},
		&models.NilaiTahfiz{},
		&models.NilaiTahfizDetail{},
		&models.NilaiTahfizV2{},
		&models.NilaiTahfizDetailV2{},
		&models.NilaiTahfizSambungAyatV2{},
		&models.NilaiTasmi{},
		&models.NilaiTasmiDetail{},
		&models.NilaiTasmiV2{},
		&models.NilaiTasmiDetailV2{},
		&models.MateriTahfiz{},
		&models.Guru{},
		&models.PresensiGuru{},
		&models.SetoranTahfizHarian{},
		&models.Halaqah{},
		&models.AnggotaHalaqah{},
		&models.MapelDiniyah{},
		&models.PengampuMapelDiniyah{},
		&models.NilaiDiniyah{},
		&models.IndikatorKeseharian{},
		&models.SesiKeseharian{},
		&models.SesiKeseharianDetail{},
		&models.NilaiAkhirKeseharian{},
		&models.CatatanNgajiSiswa{},
		&models.JenisPelanggaran{},
		&models.CatatanPelanggaran{},
		&models.JenisIqob{},
		&models.CatatanIqob{},
		&models.CatatanRapor{},
		&models.BankCatatanTahfizV2{},
		&models.BankCatatanDiniyah{},
		&models.SystemConfig{},
		&models.KonfigurasiNilaiKeseharian{},
		models.BankCatatanKeseharian{},
		&models.LogAktivitasGuru{},
		&models.SystemConfig{},
	)
	if err != nil {
		slog.Error("Gagal melakukan migrasi tabel", "error", err)
		os.Exit(1)
	}

	if DB.Migrator().HasIndex(&models.Nilai{}, "idx_nilai_unique") {
		if err := DB.Migrator().DropIndex(&models.Nilai{}, "idx_nilai_unique"); err != nil {
			slog.Warn("Gagal menghapus index nilai lama idx_nilai_unique", "error", err)
		}
	}

	slog.Info("Migrasi tabel selesai")

	// Selalu seed akun Admin Utama (Super Admin)
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "admin@siakad.com"
	}
	adminPass := os.Getenv("ADMIN_PASSWORD")
	if adminPass == "" {
		adminPass = "password"
	}
	seedUser(adminEmail, adminPass, "admin")

	// Seed Dummy Users only if not in production
	if os.Getenv("APP_ENV") != "production" {
		seedUser("finance@siakad.com", "password", "finance")
		seedUser("pengajar@siakad.com", "password", "pengajar")
		seedUser("siswa@siakad.com", "password", "siswa")
	}

	// Seed default konfigurasi presensi (jika belum ada)
	seedKonfigurasiPresensi()

	// Seed bank catatan
	seedBankCatatanTahfizV2()
	seedBankCatatanDiniyah()
	seedBankCatatanKeseharian()

	// Seed master 30 juz Al-Qur'an & default target kelulusan
	SeedMasterMateriTahfiz30Juz()
	SeedDefaultKonfigurasiTahfizKelulusan()

	// Seed data demo lengkap
	SeedDemoData()
}

func seedUser(email, password, role string) {
	var count int64
	DB.Model(&models.User{}).Where("email = ?", email).Count(&count)
	if count == 0 {
		hashed, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		user := models.User{
			Email:    email,
			Password: string(hashed),
			Role:     role,
		}
		if err := DB.Create(&user).Error; err != nil {
			slog.Error("Gagal insert user seed", "email", email, "error", err)
		} else {
			slog.Info("Seeded user", "email", email, "role", role)
		}
	}
}

func seedKonfigurasiPresensi() {
	var count int64
	DB.Model(&models.KonfigurasiPresensi{}).Count(&count)
	if count == 0 {
		cfg := models.KonfigurasiPresensi{
			JamMasuk:    "07:00",
			JamPulang:   "16:00",
			BatasTelat:  15,
			Latitude:    -2.2136,
			Longitude:   113.9213,
			RadiusMeter: 50,
		}
		if err := DB.Create(&cfg).Error; err != nil {
			slog.Error("Gagal seed konfigurasi presensi", "error", err)
		} else {
			slog.Info("Seeded konfigurasi presensi default")
		}
	}
}

// fixForeignKeyMismatch drops incompatible FK constraints and alters columns
// from int(11) to bigint so they match GORM's default mapping for Go int.
// This is idempotent and safe to run on every startup.
func fixForeignKeyMismatch() {
	if DB == nil || DB.Dialector.Name() != "mysql" {
		return
	}
	// Tables whose primary key (id) may need upgrading from int to bigint
	pkTables := []string{"users", "gurus"}

	for _, table := range pkTables {
		// Check if the PK column is already bigint
		var colType string
		DB.Raw("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = 'id'", table).Scan(&colType)
		if colType == "" || colType == "bigint" {
			continue // already correct or table doesn't exist yet
		}

		slog.Info("Fixing int->bigint mismatch", "table", table, "current_type", colType)

		// Find ALL foreign keys that reference this table's id column
		type fkInfo struct {
			TableName      string
			ConstraintName string
			ColumnName     string
		}
		var referencingFKs []fkInfo
		DB.Raw(`SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME
			FROM information_schema.KEY_COLUMN_USAGE
			WHERE TABLE_SCHEMA = DATABASE()
			AND REFERENCED_TABLE_NAME = ?
			AND REFERENCED_COLUMN_NAME = 'id'`, table).Scan(&referencingFKs)

		// Also find FKs ON this table (e.g., gurus -> users)
		var ownFKs []fkInfo
		DB.Raw(`SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME
			FROM information_schema.KEY_COLUMN_USAGE
			WHERE TABLE_SCHEMA = DATABASE()
			AND TABLE_NAME = ?
			AND REFERENCED_TABLE_NAME IS NOT NULL`, table).Scan(&ownFKs)

		// Drop all referencing FKs
		for _, fk := range referencingFKs {
			slog.Info("Dropping referencing FK", "table", fk.TableName, "constraint", fk.ConstraintName)
			DB.Exec(fmt.Sprintf("ALTER TABLE `%s` DROP FOREIGN KEY `%s`", fk.TableName, fk.ConstraintName))
		}

		// Drop own FKs
		for _, fk := range ownFKs {
			slog.Info("Dropping own FK", "table", fk.TableName, "constraint", fk.ConstraintName)
			DB.Exec(fmt.Sprintf("ALTER TABLE `%s` DROP FOREIGN KEY `%s`", fk.TableName, fk.ConstraintName))
		}

		// Alter PK column to bigint
		slog.Info("Altering PK to bigint", "table", table)
		if err := DB.Exec(fmt.Sprintf("ALTER TABLE `%s` MODIFY COLUMN `id` bigint NOT NULL AUTO_INCREMENT", table)).Error; err != nil {
			slog.Warn("Failed to alter PK", "table", table, "error", err)
			continue
		}

		// Alter all referencing FK columns to bigint too
		for _, fk := range referencingFKs {
			var fkColType string
			DB.Raw("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", fk.TableName, fk.ColumnName).Scan(&fkColType)
			if fkColType != "" && fkColType != "bigint" {
				slog.Info("Altering FK column to bigint", "table", fk.TableName, "column", fk.ColumnName)
				// Check if column is nullable
				var isNullable string
				DB.Raw("SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?", fk.TableName, fk.ColumnName).Scan(&isNullable)
				nullStr := "NOT NULL"
				if isNullable == "YES" {
					nullStr = "NULL"
				}
				DB.Exec(fmt.Sprintf("ALTER TABLE `%s` MODIFY COLUMN `%s` bigint %s", fk.TableName, fk.ColumnName, nullStr))
			}
		}
		// AutoMigrate will re-create the FK constraints
	}
}

