// Planneer Backend - Custom PocketBase Application
//
// This is a custom PocketBase application that embeds migrations directly
// into the binary, making it suitable for CI/CD deployments.
//
// Build: cd backend && go build -o planneer .
// Run:   ./backend/planneer serve
//
// The migrations are automatically applied on startup.
//
// File Organization:
// - main.go     - Application entry point and startup configuration
// - hooks.go    - PocketBase event hooks (SSE, childCount, onboarding)
// - routes.go   - Custom API route handlers
// - export.go   - Workspace export functionality (JSON, CSV, Markdown)

package main

import (
	"io/fs"
	"log"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/joho/godotenv"
	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"planneer/config"

	// Import migrations - they register themselves via init()
	_ "planneer/migrations"
)

// Version is set at build time via ldflags
var Version = "dev"

// authRateLimiter tracks authentication attempts per IP
var authRateLimiter sync.Map

func init() {
	// Start background cleanup goroutine for auth rate limiter
	go cleanupAuthRateLimiter()
}

// cleanupAuthRateLimiter periodically removes stale entries from the rate limiter map.
// Runs every 5 minutes and removes IPs that haven't had attempts in the last 2 minutes.
func cleanupAuthRateLimiter() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		now := time.Now()
		staleThreshold := 2 * time.Minute

		authRateLimiter.Range(func(key, value any) bool {
			attempts := value.([]time.Time)

			// Check if all attempts are older than the threshold
			hasRecent := false
			for _, t := range attempts {
				if now.Sub(t) < staleThreshold {
					hasRecent = true
					break
				}
			}

			// Remove the entry if no recent attempts
			if !hasRecent {
				authRateLimiter.Delete(key)
			}
			return true
		})
	}
}

func main() {
	// Load .env file if it exists (for local development)
	if err := godotenv.Load(); err != nil {
		// Not an error if file doesn't exist (e.g., in production with real env vars)
		log.Printf("[Info] No .env file found, using environment variables")
	}

	// Load config AFTER .env so environment variables are available
	config.LoadConfig()

	// Check if dev mode is enabled via environment variable or "go run"
	isGoRun := strings.HasPrefix(os.Args[0], os.TempDir())
	isDev := isGoRun || os.Getenv("PB_DEV") == "true"

	app := pocketbase.NewWithConfig(pocketbase.Config{
		DefaultDev: isDev,
	})

	// Register migrate command with auto-migration in development
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: isDev,
	})

	// Register all hooks (SSE, childCount, onboarding, etc.)
	RegisterHooks(app)

	// Enable batch API and register routes
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Log security configuration
		allowAdmin := os.Getenv("PLANNEER_ALLOW_ADMIN_UI") == "true"
		log.Printf("[Security] Admin UI allowed: %v (IsDev: %v)", allowAdmin, app.IsDev())

		// Configure CORS via middleware
		allowedOrigins := os.Getenv("PLANNEER_ALLOWED_ORIGINS")
		if allowedOrigins != "" {
			origins := strings.Split(allowedOrigins, ",")
			for i := range origins {
				origins[i] = strings.TrimSpace(origins[i])
			}
			se.Router.Bind(apis.CORS(apis.CORSConfig{
				AllowOrigins: origins,
			}))
			log.Printf("CORS configured with allowed origins: %v", origins)
		}

		// Enable batch API and Rate Limiting
		settings := app.Settings()
		settingsChanged := false

		if !settings.Batch.Enabled {
			settings.Batch.Enabled = true
			settings.Batch.MaxRequests = 50
			settingsChanged = true
			log.Println("Batch API enabled (max 50 requests)")
		}

		// CRITICAL-3: Enable Rate Limiting
		if !settings.RateLimits.Enabled {
			settings.RateLimits.Enabled = true
			// Default rules: 60 requests per minute
			settings.RateLimits.Rules = []core.RateLimitRule{
				{Label: "default", MaxRequests: 60, Duration: 60},
			}
			settingsChanged = true
			log.Println("Rate limiting enabled (60 req/min)")
		}

		if settingsChanged {
			if err := app.Save(settings); err != nil {
				log.Printf("Warning: Failed to save application settings: %v", err)
			}
		}

		// Configure static file serving for frontend
		// Try multiple paths to support both Docker and local development
		frontendPaths := []string{
			"/app/frontend/dist", // Docker (single container)
			"../frontend/dist",   // Local dev (running from backend/)
			"./frontend/dist",    // Local dev (running from root)
			"./pb_public",        // PocketBase default fallback
		}

		var frontendFS fs.FS
		for _, p := range frontendPaths {
			if _, err := os.Stat(p); err == nil {
				log.Printf("Serving frontend from: %s", p)
				frontendFS = os.DirFS(p)
				break
			}
		}

		if frontendFS == nil {
			log.Printf("Warning: Frontend dist directory not found in any of %v", frontendPaths)
			// Fallback to an empty FS to avoid nil pointer panics
			frontendFS = os.DirFS(".")
		}

		// Create superuser from environment if specified
		createSuperuserFromEnv(app)

		// HIGH-2: Add Security Headers and Access Control Middleware
		// Pre-calculate static values to reduce per-request overhead
		csp := "default-src 'self'; " +
			"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com blob:; " +
			"style-src 'self' 'unsafe-inline'; " +
			"img-src 'self' data: blob: https://images.unsplash.com https://api.unsplash.com; " +
			"connect-src 'self' https://api.unsplash.com https://images.unsplash.com https://unpkg.com https://huggingface.co https://*.huggingface.co blob:; " +
			"worker-src 'self' blob:; " +
			"media-src 'self' blob: data:; " +
			"font-src 'self' data:; " +
			"frame-src 'self' blob:; " +
			"frame-ancestors 'self'; " +
			"object-src 'none';"

		se.Router.BindFunc(func(e *core.RequestEvent) error {
			path := e.Request.URL.Path

			// 1. Admin UI Restriction
			// Block access to /_ (Admin UI) in production unless explicitly allowed
			if strings.HasPrefix(path, "/_") {
				if !allowAdmin && !app.IsDev() {
					log.Printf("[Security] Blocking Admin UI access to %s (PLANNEER_ALLOW_ADMIN_UI=%v, IsDev=%v)",
						path, allowAdmin, app.IsDev())
					return e.ForbiddenError("Admin UI is restricted in production. Set PLANNEER_ALLOW_ADMIN_UI=true to enable.", nil)
				}
			}

			// 2. Stricter Rate Limiting for Auth Endpoints
			// Limit to 5 attempts per minute per IP for sensitive auth operations
			if strings.HasPrefix(path, "/api/collections/users/auth-with-password") ||
				strings.HasPrefix(path, "/api/collections/users/request-password-reset") ||
				strings.HasPrefix(path, "/api/collections/users/request-verification") ||
				strings.HasPrefix(path, "/api/collections/users/request-otp") {

				ip := extractIP(e.Request.RemoteAddr)
				now := time.Now()

				val, _ := authRateLimiter.LoadOrStore(ip, []time.Time{})
				attempts := val.([]time.Time)

				// Filter attempts in the last minute
				var recentAttempts []time.Time
				for _, t := range attempts {
					if now.Sub(t) < time.Minute {
						recentAttempts = append(recentAttempts, t)
					}
				}

				if len(recentAttempts) >= 5 {
					return e.TooManyRequestsError("Too many authentication attempts. Please try again in a minute.", nil)
				}

				recentAttempts = append(recentAttempts, now)
				authRateLimiter.Store(ip, recentAttempts)
			}

			// 3. Security Headers
			h := e.Response.Header()
			h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			h.Set("X-Frame-Options", "SAMEORIGIN")
			h.Set("X-Content-Type-Options", "nosniff")
			h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
			h.Set("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), interest-cohort=()")

			// SSE / Realtime specific headers to prevent proxy buffering issues
			if strings.HasPrefix(path, "/api/realtime") {
				h.Set("Content-Type", "text/event-stream")
				h.Set("Cache-Control", "no-cache, no-transform")
				h.Set("Connection", "keep-alive")
				h.Set("X-Accel-Buffering", "no") // Disable Nginx buffering
			}

			// Content-Security-Policy (Basic)
			h.Set("Content-Security-Policy", csp)

			return e.Next()
		})

		// Register all custom API routes
		RegisterRoutes(app, se)

		// Register explicit routes for PWA static files BEFORE the wildcard.
		// These need their own dedicated routes to avoid any wildcard interference.
		// Use fs.ReadFile to read the file content directly and serve with proper headers.
		se.Router.GET("/manifest.json", func(e *core.RequestEvent) error {
			log.Printf("[manifest.json] Request received from %s", e.Request.RemoteAddr)
			data, err := fs.ReadFile(frontendFS, "manifest.json")
			if err != nil {
				log.Printf("[manifest.json] Error reading file: %v", err)
				return e.NotFoundError("manifest.json not found", err)
			}
			log.Printf("[manifest.json] Serving %d bytes", len(data))
			e.Response.Header().Set("Content-Type", "application/manifest+json")
			return e.Blob(200, "application/manifest+json", data)
		})
		se.Router.GET("/favicon.ico", func(e *core.RequestEvent) error {
			data, err := fs.ReadFile(frontendFS, "favicon.ico")
			if err != nil {
				return e.NotFoundError("favicon.ico not found", err)
			}
			return e.Blob(200, "image/x-icon", data)
		})
		se.Router.GET("/sw.js", func(e *core.RequestEvent) error {
			data, err := fs.ReadFile(frontendFS, "sw.js")
			if err != nil {
				return e.NotFoundError("sw.js not found", err)
			}
			return e.Blob(200, "application/javascript", data)
		})
		se.Router.GET("/registerSW.js", func(e *core.RequestEvent) error {
			data, err := fs.ReadFile(frontendFS, "registerSW.js")
			if err != nil {
				return e.NotFoundError("registerSW.js not found", err)
			}
			return e.Blob(200, "application/javascript", data)
		})

		// Unified frontend handler: handles landing page and SPA fallback
		se.Router.GET("/{path...}", func(e *core.RequestEvent) error {
			path := e.Request.URL.Path

			// 1. Skip API routes, PocketBase admin, and health
			if strings.HasPrefix(path, "/api") ||
				strings.HasPrefix(path, "/_") ||
				strings.HasPrefix(path, "/health") {
				return e.Next()
			}

			// 2. Special handling for landing page to avoid SPA fallback loops
			if path == "/landing" {
				return e.Redirect(301, "/landing/")
			}
			if strings.HasPrefix(path, "/landing/") {
				subPath := strings.TrimPrefix(path, "/landing/")
				if subPath == "" || subPath == "index.html" {
					return e.FileFS(frontendFS, "landing/index.html")
				}
				return apis.Static(frontendFS, false)(e)
			}

			// 4. Serve assets and other static files
			if strings.HasPrefix(path, "/assets/") || strings.HasPrefix(path, "/icons/") {
				return apis.Static(frontendFS, false)(e)
			}

			// 5. For all other routes (app routes like /tasks, /pages/xxx):
			// Serve the file if it exists, otherwise fallback to the root index.html
			return apis.Static(frontendFS, true)(e)
		})

		// Reset demo user content on startup
		ResetDemoUser(app)

		return se.Next()
	})

	// Start the application
	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}

// extractIP extracts the IP address from a RemoteAddr string, handling both IPv4 and IPv6.
func extractIP(remoteAddr string) string {
	// Handle IPv6 format [::1]:port
	if strings.HasPrefix(remoteAddr, "[") {
		if idx := strings.LastIndex(remoteAddr, "]"); idx != -1 {
			return remoteAddr[1:idx]
		}
	}
	// Handle IPv4 format 192.168.1.1:port
	if idx := strings.LastIndex(remoteAddr, ":"); idx != -1 {
		return remoteAddr[:idx]
	}
	return remoteAddr
}

// createSuperuserFromEnv creates a superuser from environment variables if specified
func createSuperuserFromEnv(app *pocketbase.PocketBase) {
	adminEmail := os.Getenv("PB_ADMIN_EMAIL")
	adminPassword := os.Getenv("PB_ADMIN_PASSWORD")

	if adminEmail == "" || adminPassword == "" {
		return
	}

	// Check if superuser already exists
	if _, err := app.FindAuthRecordByEmail(core.CollectionNameSuperusers, adminEmail); err == nil {
		return // Already exists
	}

	// Create superuser
	superusers, err := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if err != nil {
		log.Printf("Warning: Failed to find superusers collection: %v", err)
		return
	}

	record := core.NewRecord(superusers)
	record.Set("email", adminEmail)
	record.Set("password", adminPassword)

	if err := app.Save(record); err != nil {
		log.Printf("Warning: Failed to create initial superuser: %v", err)
	} else {
		log.Printf("Created initial superuser: %s", adminEmail)
	}
}
