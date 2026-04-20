package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

// 024_remove_pinned_fields drops the isPinned and pinnedOrder fields and their
// indexes from the pages collection. The "favorites" feature has been removed;
// top-level pages are now managed via the isTopLevel field instead.
func init() {
	m.Register(func(app core.App) error {
		pages, err := app.FindCollectionByNameOrId("pages")
		if err != nil {
			return nil
		}

		changed := false

		// Drop isPinned field if it exists
		if field := pages.Fields.GetByName("isPinned"); field != nil {
			pages.Fields.RemoveById(field.GetId())
			changed = true
		}

		// Drop pinnedOrder field if it exists
		if field := pages.Fields.GetByName("pinnedOrder"); field != nil {
			pages.Fields.RemoveById(field.GetId())
			changed = true
		}

		// Remove index on isPinned
		pages.RemoveIndex("idx_pages_isPinned")

		// Remove index on pinnedOrder
		pages.RemoveIndex("idx_pages_pinnedOrder")

		if !changed {
			return nil
		}

		return app.Save(pages)
	}, nil)
}
