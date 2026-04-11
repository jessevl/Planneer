// Idempotent data cleanup migration for existing databases.
//
// Performs two operations:
// 1. Converts any remaining whiteboard pages to notes (viewMode='note')
// 2. Backfills previewStructured JSON for pages that have content but no preview
//
// This is a no-op on fresh databases created with the consolidated 001 schema.
package migrations

import (
	"log"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"

	"planneer/pagepreview"
)

func init() {
	m.Register(func(app core.App) error {
		pages, err := app.FindCollectionByNameOrId("pages")
		if err != nil {
			return nil // Pages collection doesn't exist yet
		}

		// ====================================================================
		// 1. Convert whiteboard pages to notes
		// ====================================================================
		viewModeField := pages.Fields.GetByName("viewMode")
		if viewModeField != nil {
			if sf, ok := viewModeField.(*core.SelectField); ok {
				hasWhiteboard := false
				for _, v := range sf.Values {
					if v == "whiteboard" {
						hasWhiteboard = true
						break
					}
				}
				if hasWhiteboard {
					records, findErr := app.FindRecordsByFilter("pages", "viewMode = 'whiteboard'", "", 0, 0)
					if findErr == nil {
						for _, record := range records {
							record.Set("viewMode", "note")
							if saveErr := app.Save(record); saveErr != nil {
								log.Printf("[Migration 003] Failed to convert whiteboard page %s: %v", record.Id, saveErr)
							} else {
								log.Printf("[Migration 003] Converted whiteboard page %s to note", record.Id)
							}
						}
					}

					// Remove 'whiteboard' from viewMode select values
					newValues := make([]string, 0, len(sf.Values))
					for _, v := range sf.Values {
						if v != "whiteboard" {
							newValues = append(newValues, v)
						}
					}
					sf.Values = newValues

					// Also remove whiteboard-specific fields if they exist
					if f := pages.Fields.GetByName("whiteboardContent"); f != nil {
						pages.Fields.RemoveById(f.GetId())
					}
					if f := pages.Fields.GetByName("whiteboardThumbnail"); f != nil {
						pages.Fields.RemoveById(f.GetId())
					}

					if err := app.Save(pages); err != nil {
						return err
					}
				}
			}
		}

		// ====================================================================
		// 2. Backfill previewStructured for pages with content
		// ====================================================================
		if pages.Fields.GetByName("previewStructured") == nil {
			return nil // Field not available yet
		}

		// Increase bodyText max if needed
		if bodyTextField, ok := pages.Fields.GetByName("bodyText").(*core.TextField); ok && bodyTextField.Max < bodyTextFieldMax {
			bodyTextField.Max = bodyTextFieldMax
			if err := app.Save(pages); err != nil {
				return err
			}
		}

		records, err := app.FindAllRecords("pages")
		if err != nil {
			return err
		}

		for _, record := range records {
			// Only backfill if previewStructured is empty
			existing := record.GetString("previewStructured")
			if existing != "" && existing != "null" && existing != "[]" {
				continue
			}

			content := record.GetString("content")
			if content == "" {
				continue
			}

			previewBlocks := pagepreview.ExtractBlocks(content, 4)
			if len(previewBlocks) == 0 {
				continue
			}

			record.Set("previewStructured", previewBlocks)
			if err := app.Save(record); err != nil {
				if strings.Contains(err.Error(), "createdBy") {
					record.Set("createdBy", nil)
					if retryErr := app.Save(record); retryErr != nil {
						log.Printf("[Migration 003] Failed to backfill preview for page %s: %v", record.Id, retryErr)
					}
					continue
				}
				log.Printf("[Migration 003] Failed to backfill preview for page %s: %v", record.Id, err)
			}
		}

		return nil
	}, nil)
}
