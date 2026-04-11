# PocketBase Migrations Guide

This directory contains Go migration files that define and evolve the database schema.

## Overview

Migrations let you change the database schema **without losing data**. Each migration is a Go file that:
1. Registers itself via `init()`
2. Gets compiled into the binary
3. Runs automatically on server startup (if not already applied)
4. Is tracked in the `_migrations` table

## Quick Reference

| Command | Purpose |
|---------|---------|
| `make migrate-create NAME="description"` | Create new migration file |
| `make migrate-collections` | Snapshot Admin UI changes |
| `make build && ./planneer-backend serve` | Apply migrations |

---

## Creating Migrations

### Option 1: Code-Based (Recommended for Production)

```bash
cd backend
make migrate-create NAME="add_task_labels"
```

Creates: `migrations/002_add_task_labels_TIMESTAMP.go`

Edit the file:

```go
package migrations

import (
    "github.com/pocketbase/pocketbase/core"
    m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
    m.Register(func(app core.App) error {
        // UP: Apply changes
        tasks, err := app.FindCollectionByNameOrId("tasks")
        if err != nil {
            return err
        }
        
        tasks.Fields.Add(&core.JSONField{
            Name:    "labels",
            MaxSize: 10000,
        })
        
        return app.Save(tasks)
    }, func(app core.App) error {
        // DOWN: Revert changes
        tasks, err := app.FindCollectionByNameOrId("tasks")
        if err != nil {
            return err
        }
        
        tasks.Fields.RemoveByName("labels")
        return app.Save(tasks)
    })
}
```

Then build and run:
```bash
make build
./planneer-backend serve
```

### Option 2: Admin UI + Auto-Migration (Development Only)

When running with `go run main.go serve`:
1. Open Admin UI at `http://localhost:8090/_/`
2. Modify collections via the UI
3. Changes auto-generate migration files in `pb_migrations/`

⚠️ **Note:** Auto-migration only works in dev mode (`go run`), not with compiled binary.

---

## Common Migration Operations

### Add a Field

```go
collection.Fields.Add(&core.TextField{
    Name:     "newField",
    Required: true,
    Max:      100,
})
```

### Remove a Field

```go
collection.Fields.RemoveByName("oldField")
```

### Add an Index

```go
collection.AddIndex("idx_tasks_labels", false, "labels", "")
// Args: name, unique, columns, partial filter expression
```

### Change Access Rules

```go
collection.ListRule = types.Pointer("@request.auth.id != '' && owner = @request.auth.id")
collection.CreateRule = types.Pointer("@request.auth.id != ''")
```

### Create a New Collection

```go
newCollection := core.NewBaseCollection("comments")
newCollection.Fields.Add(
    &core.TextField{Name: "content", Required: true},
    &core.RelationField{
        Name:         "task",
        CollectionId: tasksCollection.Id,
        Required:     true,
    },
)
if err := app.Save(newCollection); err != nil {
    return err
}
```

### Migrate Existing Data

```go
m.Register(func(app core.App) error {
    // 1. Add new field
    tasks, _ := app.FindCollectionByNameOrId("tasks")
    tasks.Fields.Add(&core.TextField{Name: "priorityNumeric"})
    app.Save(tasks)
    
    // 2. Transform existing data
    records, _ := app.FindAllRecords("tasks")
    for _, r := range records {
        oldPriority := r.GetString("priority")
        var numeric string
        switch oldPriority {
        case "High":
            numeric = "3"
        case "Medium":
            numeric = "2"
        default:
            numeric = "1"
        }
        r.Set("priorityNumeric", numeric)
        app.Save(r)
    }
    
    return nil
}, nil)
```

---

## Field Types Reference

| Type | Go Type | Example |
|------|---------|---------|
| Text | `core.TextField` | `{Name: "title", Min: 1, Max: 200}` |
| Number | `core.NumberField` | `{Name: "order", Min: 0}` |
| Bool | `core.BoolField` | `{Name: "completed"}` |
| Email | `core.EmailField` | `{Name: "email", Required: true}` |
| URL | `core.URLField` | `{Name: "website"}` |
| Date | `core.DateField` | `{Name: "dueDate"}` |
| Select | `core.SelectField` | `{Name: "priority", Values: []string{"Low", "Medium", "High"}}` |
| JSON | `core.JSONField` | `{Name: "metadata", MaxSize: 10000}` |
| File | `core.FileField` | `{Name: "attachment", MaxSize: 5242880}` |
| Relation | `core.RelationField` | `{Name: "project", CollectionId: projectsId}` |
| Editor | `core.EditorField` | `{Name: "content", MaxSize: 1000000}` |
| Autodate | `core.AutodateField` | `{Name: "created", OnCreate: true}` |

---

## Best Practices

### ✅ Do

1. **One logical change per migration** - Keep migrations focused and reviewable
2. **Always write DOWN function** - Enables rollback if something goes wrong
3. **Test on copy of production data** - Before deploying, test migration locally
4. **Backup before migrating** - Run `make backup` before applying to production
5. **Use descriptive names** - `add_task_labels` not `update_tasks`

### ❌ Don't

1. **Never edit applied migrations** - Create new migrations instead
2. **Don't delete migrations** - Keep history for auditability
3. **Avoid data loss** - Be careful with `RemoveByName`, ensure data is migrated first
4. **Don't skip testing DOWN** - Rollbacks save you in emergencies

---

## Migration Order

Migrations run in filename order. Use numeric prefixes:

```
001_initial_schema.go          # First - creates all collections
002_add_task_labels.go         # Adds labels field
003_add_comments_collection.go # New collection
004_migrate_priority_format.go # Data transformation
```

---

## Troubleshooting

### Migration Failed Mid-Way

PocketBase runs each migration in a transaction. If it fails, it rolls back.
Check logs, fix the issue, and re-run.

### Need to Re-Run a Migration

```sql
-- Connect to SQLite and remove from tracking table
DELETE FROM _migrations WHERE file = '002_add_task_labels.go';
```

Then restart the server.

### Check Migration Status

```bash
./planneer-backend migrate status
```

---

## Production Deployment Checklist

1. [ ] Backup production database
2. [ ] Test migration on copy of production data
3. [ ] Review DOWN function works correctly
4. [ ] Build new binary with migration included
5. [ ] Deploy and monitor logs
6. [ ] Verify data integrity after migration
