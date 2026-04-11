---
applyTo: "backend/migrations/**/*.go"
---

# PocketBase Migration Instructions

## CRITICAL: Migrations MUST be Idempotent

Every migration file must be able to run multiple times without error.

## Required Pattern

```go
func init() {
    m.Register(func(app core.App) error {
        // ALWAYS check if already migrated
        _, err := app.FindCollectionByNameOrId("collection_name")
        if err == nil {
            return nil  // Already exists, skip
        }
        
        // For field additions:
        collection, _ := app.FindCollectionByNameOrId("existing_collection")
        if collection.Fields.GetByName("new_field") != nil {
            return nil  // Field already exists
        }
        
        // ... perform migration
    }, nil)
}
```

## DO NOT

- ❌ Create collections without checking if they exist
- ❌ Add fields without checking if they exist
- ❌ Drop/recreate existing collections
- ❌ Use raw SQL without guards

## File Naming

Pattern: `XXX_description.go` where XXX is zero-padded number.

Examples:
- `001_initial_schema.go`
- `002_add_user_preferences.go`
- `003_add_workspace_settings.go`
