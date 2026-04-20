package templates

import (
	"fmt"
	"log"
	"time"

	"github.com/pocketbase/pocketbase/core"
)

// ApplyNewUserContent creates the default workspace, pages, and tasks
// for a newly registered user. This is idempotent - it will not overwrite
// existing data if the user already has a workspace.
func ApplyNewUserContent(app core.App, userId string) error {
	return applyContent(app, userId, false)
}

// ResetDemoUserContent deletes all existing content for the demo user and
// recreates it from templates. This is used to refresh demo data on rebuild.
func ResetDemoUserContent(app core.App, userId string) error {
	return applyContent(app, userId, true)
}

// applyContent creates starter content, optionally deleting existing data first.
func applyContent(app core.App, userId string, forceReset bool) error {
	// Get existing workspace memberships
	memberships, err := app.FindRecordsByFilter(
		"workspace_members",
		"user = {:userId}",
		"",
		100,
		0,
		map[string]any{"userId": userId},
	)

	if !forceReset {
		// GUARD: For normal users, don't overwrite if they have workspaces
		if err == nil && len(memberships) > 0 {
			return nil
		}
	} else if err == nil && len(memberships) > 0 {
		// Force reset: Delete all existing content for this user
		for _, membership := range memberships {
			workspaceId := membership.GetString("workspace")

			// Delete all tasks in workspace
			tasks, _ := app.FindRecordsByFilter("tasks", "workspace = {:wid}", "", 1000, 0, map[string]any{"wid": workspaceId})
			for _, t := range tasks {
				app.Delete(t)
			}

			// Delete all pages in workspace
			pages, _ := app.FindRecordsByFilter("pages", "workspace = {:wid}", "", 1000, 0, map[string]any{"wid": workspaceId})
			for _, p := range pages {
				app.Delete(p)
			}

			// Delete workspace membership
			app.Delete(membership)

			// Delete workspace
			workspace, err := app.FindRecordById("workspaces", workspaceId)
			if err == nil {
				app.Delete(workspace)
			}
		}
	}

	template := GetDefaultWorkspace()

	// ========================================================================
	// CREATE WORKSPACE
	// ========================================================================
	workspacesCollection, err := app.FindCollectionByNameOrId("workspaces")
	if err != nil {
		return err
	}

	workspace := core.NewRecord(workspacesCollection)
	workspace.Set("name", template.Name)
	workspace.Set("slug", template.Slug)
	workspace.Set("color", template.Color)
	workspace.Set("owner", userId)
	workspace.Set("isPersonal", true) // First workspace is the personal workspace

	if err := app.Save(workspace); err != nil {
		return err
	}

	// ========================================================================
	// CREATE WORKSPACE MEMBERSHIP
	// ========================================================================
	membersCollection, err := app.FindCollectionByNameOrId("workspace_members")
	if err != nil {
		return err
	}

	membership := core.NewRecord(membersCollection)
	membership.Set("user", userId)
	membership.Set("workspace", workspace.Id)
	membership.Set("role", "owner")

	if err := app.Save(membership); err != nil {
		return err
	}

	// ========================================================================
	// SET DEFAULT WORKSPACE FOR USER
	// ========================================================================
	user, err := app.FindRecordById("users", userId)
	if err != nil {
		return err
	}
	user.Set("defaultWorkspace", workspace.Id)
	if err := app.Save(user); err != nil {
		return err
	}

	// ========================================================================
	// CREATE PAGES (recursive)
	// ========================================================================
	pagesCollection, err := app.FindCollectionByNameOrId("pages")
	if err != nil {
		return err
	}

	tasksCollection, err := app.FindCollectionByNameOrId("tasks")
	if err != nil {
		return err
	}

	today := time.Now()

	// Recursive function to create pages and their children
	var createPage func(pt PageTemplate, parentId string, order int) (string, error)
	createPage = func(pt PageTemplate, parentId string, order int) (string, error) {
		page := core.NewRecord(pagesCollection)
		page.Set("workspace", workspace.Id)
		page.Set("title", pt.Title)
		page.Set("content", pt.Content)
		page.Set("excerpt", pt.Excerpt)
		page.Set("icon", pt.Icon)
		page.Set("color", pt.Color)
		page.Set("order", order)
		page.Set("viewMode", pt.ViewMode)
		page.Set("childrenViewMode", pt.ChildrenViewMode)
		page.Set("createdBy", userId)
		page.Set("isExpanded", true)
		page.Set("isTopLevel", pt.IsTopLevel)

		// Set cover gradient if provided
		if pt.CoverGradient != "" {
			page.Set("coverGradient", pt.CoverGradient)
		}

		// Set cover image if provided
		// NOTE: PocketBase FileField (coverImage) requires actual files.
		// For demo content using external URLs, we store the URL in the coverGradient field
		// and the frontend handles it as a background image.
		if pt.CoverImage != "" {
			page.Set("coverGradient", pt.CoverImage)
		}
		if pt.CoverAttribution != "" {
			page.Set("coverAttribution", pt.CoverAttribution)
		}

		// Set parent if provided
		if parentId != "" {
			page.Set("parentId", parentId)
		}

		// Task collection specific fields
		if pt.ViewMode == "tasks" {
			if len(pt.Sections) > 0 {
				sections := make([]map[string]any, len(pt.Sections))
				for i, s := range pt.Sections {
					section := map[string]any{
						"id":   s.ID,
						"name": s.Title,
					}
					if s.Color != "" {
						section["color"] = s.Color
					}
					sections[i] = section
				}
				page.Set("sections", sections)
			}
			if pt.TasksViewMode != "" {
				page.Set("tasksViewMode", pt.TasksViewMode)
			}
			if pt.TasksGroupBy != "" {
				page.Set("tasksGroupBy", pt.TasksGroupBy)
			}
		}

		if err := app.Save(page); err != nil {
			return "", err
		}

		pageId := page.Id

		// Create tasks for this page
		for taskOrder, tt := range pt.Tasks {
			task := core.NewRecord(tasksCollection)
			task.Set("workspace", workspace.Id)
			task.Set("title", tt.Title)
			task.Set("description", tt.Description)
			if tt.Priority != "" {
				task.Set("priority", tt.Priority)
			}
			task.Set("order", taskOrder)
			task.Set("completed", false)
			task.Set("createdBy", userId)
			task.Set("parentPageId", pageId)

			// Set tags
			if len(tt.Tags) > 0 {
				task.Set("tags", tt.Tags)
			}

			// Set recurrence
			if tt.Recurrence != "" {
				task.Set("recurrence", tt.Recurrence)
			}

			// Calculate due date
			if tt.DueOffset != 0 {
				dueDate := today.AddDate(0, 0, tt.DueOffset)
				task.Set("dueDate", dueDate.Format("2006-01-02"))
			} else if tt.DueOffset == 0 && tt.Priority != "" {
				// Default to today for prioritized tasks without explicit due
				task.Set("dueDate", today.Format("2006-01-02"))
			}

			// Set section reference
			if tt.SectionRef != "" {
				task.Set("sectionId", tt.SectionRef)
			}

			// Set subtasks
			if len(tt.Subtasks) > 0 {
				subtasks := make([]map[string]any, len(tt.Subtasks))
				for i, st := range tt.Subtasks {
					id := st.ID
					if id == "" {
						id = fmt.Sprintf("subtask_%d_%d_%d", time.Now().UnixNano(), taskOrder, i)
					}
					subtasks[i] = map[string]any{
						"id":        id,
						"title":     st.Title,
						"completed": st.Completed,
					}
				}
				task.Set("subtasks", subtasks)
			}

			if err := app.Save(task); err != nil {
				return "", err
			}
		}

		// Create child pages recursively
		childCount := 0
		for childOrder, child := range pt.Children {
			_, err := createPage(child, pageId, childOrder)
			if err != nil {
				return "", err
			}
			childCount++
		}

		// Update child count if there are children
		if childCount > 0 {
			page.Set("childCount", childCount)
			if err := app.Save(page); err != nil {
				return "", err
			}
		}

		return pageId, nil
	}

	// Create all top-level pages
	log.Printf("Creating %d top-level pages for user %s", len(template.Pages), userId)
	for order, pt := range template.Pages {
		log.Printf("Creating page: %s (viewMode: %s)", pt.Title, pt.ViewMode)
		_, err := createPage(pt, "", order)
		if err != nil {
			log.Printf("ERROR creating page %s: %v", pt.Title, err)
			return err
		}
	}

	log.Printf("Successfully created all demo content for user %s", userId)
	return nil
}
