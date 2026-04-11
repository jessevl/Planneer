package config

import (
	"os"
	"strings"
)

// AppConfig holds global application settings
type AppConfig struct {
	IsClosedBeta      bool   `json:"isClosedBeta"`
	UnsplashAccessKey string `json:"unsplashAccessKey"`
}

// CurrentConfig is the active configuration
var CurrentConfig AppConfig

// LoadConfig reads configuration from environment variables.
// Must be called AFTER godotenv.Load() so .env values are available.
func LoadConfig() {
	// Default to open registration unless explicitly enabled.
	// Use PLANNEER_CLOSED_BETA=true to restrict signups.
	closedBetaEnv := os.Getenv("PLANNEER_CLOSED_BETA")
	CurrentConfig.IsClosedBeta = strings.ToLower(closedBetaEnv) == "true"

	// Unsplash API Key
	CurrentConfig.UnsplashAccessKey = os.Getenv("UNSPLASH_ACCESS_KEY")
}
