package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 021_restore_post_v17_schema restores the schema that used to be introduced by
// migrations 018-020. It exists to keep production databases that already
// migrated through v17 on a valid forward path after the migration compaction.
//
// Fresh installs are already covered by 001_initial_schema, so every change here
// is guarded and becomes a no-op when the field/collection already exists.
func init() {
	m.Register(func(app core.App) error {
		pages, err := app.FindCollectionByNameOrId("pages")
		if err != nil {
			return nil
		}

		pagesChanged := false

		if pages.Fields.GetByName("isReadOnly") == nil {
			pages.Fields.Add(&core.BoolField{Name: "isReadOnly"})
			pagesChanged = true
		}
		if pages.Fields.GetByName("sourceOrigin") == nil {
			pages.Fields.Add(&core.TextField{Name: "sourceOrigin", Max: 50})
			pagesChanged = true
		}
		if pages.Fields.GetByName("sourceItemType") == nil {
			pages.Fields.Add(&core.TextField{Name: "sourceItemType", Max: 50})
			pagesChanged = true
		}
		if pages.Fields.GetByName("sourceExternalId") == nil {
			pages.Fields.Add(&core.TextField{Name: "sourceExternalId", Max: 500})
			pagesChanged = true
		}
		if pages.Fields.GetByName("sourcePath") == nil {
			pages.Fields.Add(&core.TextField{Name: "sourcePath", Max: 1000})
			pagesChanged = true
		}
		if pages.Fields.GetByName("sourceLastSyncedAt") == nil {
			pages.Fields.Add(&core.TextField{Name: "sourceLastSyncedAt", Max: 40})
			pagesChanged = true
		}
		if pages.Fields.GetByName("sourceCreatedAt") == nil {
			pages.Fields.Add(&core.TextField{Name: "sourceCreatedAt", Max: 40})
			pagesChanged = true
		}
		if pages.Fields.GetByName("sourceModifiedAt") == nil {
			pages.Fields.Add(&core.TextField{Name: "sourceModifiedAt", Max: 40})
			pagesChanged = true
		}
		if pages.Fields.GetByName("sourceContentLength") == nil {
			pages.Fields.Add(&core.TextField{Name: "sourceContentLength", Max: 40})
			pagesChanged = true
		}
		if pages.Fields.GetByName("sourceETag") == nil {
			pages.Fields.Add(&core.TextField{Name: "sourceETag", Max: 500})
			pagesChanged = true
		}
		if pages.Fields.GetByName("previewThumbnail") == nil {
			pages.Fields.Add(&core.FileField{
				Name:      "previewThumbnail",
				MaxSelect: 1,
				MaxSize:   2097152,
				MimeTypes: []string{"image/png", "image/jpeg", "image/webp"},
			})
			pagesChanged = true
		}
		if pages.Fields.GetByName("sourcePageCount") == nil {
			pages.Fields.Add(&core.NumberField{
				Name: "sourcePageCount",
				Min:  floatPtr(0),
			})
			pagesChanged = true
		}

		if pagesChanged {
			if err := app.Save(pages); err != nil {
				return err
			}
		}

		if _, err := app.FindCollectionByNameOrId("boox_integrations"); err == nil {
			return nil
		}

		workspaces, err := app.FindCollectionByNameOrId("workspaces")
		if err != nil {
			return nil
		}

		booxIntegrations := core.NewBaseCollection("boox_integrations")
		booxIntegrations.Fields.Add(
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			&core.RelationField{
				Name:         "workspace",
				CollectionId: workspaces.Id,
				Required:     true,
				MaxSelect:    1,
			},
			&core.BoolField{Name: "enabled"},
			&core.TextField{Name: "serverUrl", Max: 1000},
			&core.TextField{Name: "username", Max: 255},
			&core.TextField{Name: "password", Max: 255},
			&core.TextField{Name: "rootPath", Max: 1000},
			&core.TextField{Name: "lastSyncAt", Max: 40},
			&core.TextField{Name: "lastSyncStatus", Max: 50},
			&core.TextField{Name: "lastSyncError", Max: 2000},
		)
		booxIntegrations.AddIndex("idx_boox_integrations_workspace_unique", true, "workspace", "")

		return app.Save(booxIntegrations)
	}, nil)
}