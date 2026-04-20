package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 023_add_pages_is_top_level distinguishes canonical top-level pages from
// unfiled parentless pages that belong in Inbox.
func init() {
	m.Register(func(app core.App) error {
		pages, err := app.FindCollectionByNameOrId("pages")
		if err != nil {
			return nil
		}

		needsField := pages.Fields.GetByName("isTopLevel") == nil
		if needsField {
			pages.Fields.Add(&core.BoolField{Name: "isTopLevel"})
			pages.AddIndex("idx_pages_workspace_parent_top", false, "workspace,parentId,isTopLevel", "")
			if err := app.Save(pages); err != nil {
				return err
			}
		}

		if !needsField {
			return nil
		}

		records, err := app.FindAllRecords("pages")
		if err != nil {
			return nil
		}

		for _, record := range records {
			record.Set("isTopLevel", record.GetString("parentId") == "")
			if err := app.Save(record); err != nil {
				return err
			}
		}

		return nil
	}, nil)
}
