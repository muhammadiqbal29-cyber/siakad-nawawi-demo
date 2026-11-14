package auth

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"siakad-nawawi-be/internal/database"
	"siakad-nawawi-be/internal/models"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

type LoginResponse struct {
	Role  string `json:"role"`
	Token string `json:"token"`
	User  any    `json:"user,omitempty"`
}

type ErrorResponse struct {
	Message string `json:"message"`
}

func LoginHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Handle CORS preflight
	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(ErrorResponse{Message: "Request tidak valid"})
		return
	}

	// Dukungan login cepat via Role (1-Klik Tanpa Password)
	if req.Email == "" && req.Role != "" {
		switch req.Role {
		case "admin":
			req.Email = "admin@demo.com"
		case "guru_tahfiz", "tahfiz":
			req.Email = "ustadz.tahfiz@demo.com"
		case "guru_diniyah", "diniyah":
			req.Email = "ustadz.diniyah@demo.com"
		case "guru_lengkap", "guru":
			req.Email = "ustadz.lengkap@demo.com"
		default:
			req.Email = "admin@demo.com"
		}
	}

	if req.Email == "" {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(ErrorResponse{Message: "Email wajib diisi"})
		return
	}

	var user models.User
	err := database.DB.WithContext(r.Context()).Where("email = ?", req.Email).First(&user).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// Jika email belum ada di database, buat akun demo secara otomatis
			role := "guru"
			if req.Email == "admin@demo.com" || req.Role == "admin" {
				role = "admin"
			}
			user = models.User{
				Email: req.Email,
				Role:  role,
			}
			_ = database.DB.Create(&user)
		} else {
			w.WriteHeader(http.StatusInternalServerError)
			_ = json.NewEncoder(w).Encode(ErrorResponse{Message: "Terjadi kesalahan server"})
			return
		}
	}

	// MODE DEMO: Akses tanpa password!
	// Jika password diisi selain password demo standar, kita tetap izinkan untuk fleksibilitas demo
	// (Kecuali jika verifikasi password eksplisit diaktifkan lewat DEMO_REQUIRE_PASSWORD=true)
	if os.Getenv("DEMO_REQUIRE_PASSWORD") == "true" && req.Password != "" && user.Password != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
			w.WriteHeader(http.StatusUnauthorized)
			_ = json.NewEncoder(w).Encode(ErrorResponse{Message: "Email atau password salah"})
			return
		}
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "siakad-nawawi-secret-demo-key-2026"
	}

	// Buat JWT Token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().Add(time.Hour * 24 * 180).Unix(), // 180 hari (1 semester)
	})

	tokenString, err := token.SignedString([]byte(jwtSecret))
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(ErrorResponse{Message: "Gagal membuat token"})
		return
	}

	isProd := os.Getenv("APP_ENV") == "production"
	// #nosec G124 -- Secure diatur secara dinamis
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    tokenString,
		Path:     "/",
		HttpOnly: true,
		Secure:   isProd,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   15552000, // 180 hari
	})

	_ = json.NewEncoder(w).Encode(LoginResponse{
		Role:  user.Role,
		Token: tokenString,
		User: map[string]any{
			"id":    user.ID,
			"email": user.Email,
			"role":  user.Role,
		},
	})
}

func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	isProd := os.Getenv("APP_ENV") == "production"
	// #nosec G124 -- Secure diatur secara dinamis (false untuk dev lokal, true untuk prod)
	http.SetCookie(w, &http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   isProd,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})

	_ = json.NewEncoder(w).Encode(map[string]string{"message": "Berhasil logout"})
}
