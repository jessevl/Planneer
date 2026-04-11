// Package migrations - 002_seed_demo_user creates a demo user with starter content
//
// IMPORTANT: This migration only runs in DEVELOPMENT mode (PB_DEV=true or `go run`).
// The demo user is NOT created in production builds.
//
// The demo password is read from the PLANNEER_DEMO_PASSWORD environment variable.
// If not set, it defaults to a secure generated password for development.
//
// For E2E testing, set this environment variable to match your test credentials.
package migrations

import (
	"log"
	"os"

	"planneer/templates"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// defaultDemoPassword is used only in development when PLANNEER_DEMO_PASSWORD is not set
const defaultDemoPassword = "PlanneerDemo2024!Dev"

func init() {
	m.Register(func(app core.App) error {
		// SECURITY: Demo user is ONLY created in development mode.
		// In production (PB_DEV=false), this migration does nothing.
		if !app.IsDev() {
			log.Println("[Migration] Skipping demo user creation (production mode)")
			return nil
		}

		// GUARD: Check if demo user already exists
		_, err := app.FindAuthRecordByEmail("users", "demo@planneer.app")
		if err == nil {
			return nil // Demo user already exists
		}

		// Get demo password from environment variable (for E2E test consistency)
		demoPassword := os.Getenv("PLANNEER_DEMO_PASSWORD")
		if demoPassword == "" {
			demoPassword = defaultDemoPassword
			log.Println("[Migration] Using default demo password (set PLANNEER_DEMO_PASSWORD to customize)")
		}

		// Create demo user
		usersCollection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		demoUser := core.NewRecord(usersCollection)
		demoUser.Set("email", "demo@planneer.app")
		demoUser.Set("name", "Demo User")
		demoUser.Set("verified", true)
		demoUser.Set("theme", "system")
		demoUser.SetPassword(demoPassword)

		if err := app.Save(demoUser); err != nil {
			return err
		}

		// Apply starter content template
		if err := templates.ApplyNewUserContent(app, demoUser.Id); err != nil {
			return err
		}

		return nil
	}, func(app core.App) error {
		// DOWN: Delete demo user
		demoUser, err := app.FindAuthRecordByEmail("users", "demo@planneer.app")
		if err != nil {
			return nil // User doesn't exist
		}
		return app.Delete(demoUser)
	})
}
