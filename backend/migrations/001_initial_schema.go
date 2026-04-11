// Package migrations contains the database schema for Planneer.
//
// This is the consolidated schema implementing the Unified Pages Architecture.
// It merges all incremental migrations (001-020) into a single idempotent migration.
//
// Schema overview:
// - Users belong to workspaces (multi-tenancy)
// - Pages are the unified content type (notes, collections, and task collections)
// - Tasks reference pages via parentPageId (no separate projects table)
// - BOOX integration for mirrored handwritten notebooks
// - Full-text search via FTS5 virtual tables
package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/tools/types"

	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		// GUARD: Check if collections already exist to prevent data loss
		_, err := app.FindCollectionByNameOrId("workspaces")
		if err == nil {
			return nil // Already migrated
		}

		// Get the built-in users collection
		usersCollection, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return err
		}

		// ========================================================================
		// PHASE 1: CREATE ALL COLLECTIONS (without access rules)
		// ========================================================================

		// ------------------------------------------------------------------------
		// WORKSPACES COLLECTION
		// ------------------------------------------------------------------------
		workspaces := core.NewBaseCollection("workspaces")
		workspaces.Fields.Add(
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			&core.TextField{Name: "name", Required: true, Min: 1, Max: 100},
			&core.TextField{Name: "description", Max: 500},
			&core.TextField{Name: "icon", Max: 50},
			&core.TextField{Name: "color", Max: 20},
			&core.RelationField{
				Name:         "owner",
				CollectionId: usersCollection.Id,
				Required:     true,
				MaxSelect:    1,
			},
			&core.BoolField{Name: "isPersonal"},
			// Cached usage counters (maintained by hooks)
			&core.NumberField{Name: "pageCount"},
			&core.NumberField{Name: "taskCount"},
			&core.NumberField{Name: "storageUsed"},
		)
		if err := app.Save(workspaces); err != nil {
			return err
		}

		// ------------------------------------------------------------------------
		// WORKSPACE MEMBERS COLLECTION
		// ------------------------------------------------------------------------
		workspaceMembers := core.NewBaseCollection("workspace_members")
		workspaceMembers.Fields.Add(
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.RelationField{
				Name:         "user",
				CollectionId: usersCollection.Id,
				Required:     true,
				MaxSelect:    1,
			},
			&core.RelationField{
				Name:         "workspace",
				CollectionId: workspaces.Id,
				Required:     true,
				MaxSelect:    1,
			},
			&core.SelectField{
				Name:     "role",
				Required: true,
				Values:   []string{"owner", "admin", "member"},
			},
		)
		workspaceMembers.AddIndex("idx_unique_membership", true, "user, workspace", "")
		if err := app.Save(workspaceMembers); err != nil {
			return err
		}

		// ------------------------------------------------------------------------
		// PAGES COLLECTION (Unified: notes, collections, and task collections)
		// ------------------------------------------------------------------------
		pages := core.NewBaseCollection("pages")
		pages.Fields.Add(
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			&core.RelationField{
				Name:         "workspace",
				CollectionId: workspaces.Id,
				Required:     true,
				MaxSelect:    1,
			},
			&core.TextField{Name: "title", Required: true, Min: 1, Max: 500},
			&core.EditorField{Name: "content", MaxSize: 10000000},
			&core.TextField{Name: "excerpt", Max: 500},
			&core.TextField{Name: "bodyText", Max: bodyTextFieldMax},
			&core.NumberField{Name: "order"},
			&core.TextField{Name: "icon", Max: 50},
			&core.TextField{Name: "color", Max: 20},
			// Cover image support
			&core.FileField{
				Name:      "coverImage",
				MaxSize:   10485760,
				MimeTypes: []string{"image/jpeg", "image/png", "image/gif", "image/webp"},
			},
			&core.TextField{Name: "coverAttribution", Max: 500},
			&core.TextField{Name: "coverGradient", Max: 200},
			&core.FileField{
				Name:      "images",
				MaxSelect: 100,
				MaxSize:   10485760,
				MimeTypes: []string{"image/jpeg", "image/png", "image/gif", "image/webp"},
			},
			// Files field for PDFs, documents, and SVGs
			&core.FileField{
				Name:      "files",
				MaxSelect: 100,
				MaxSize:   52428800, // 50MB per file
				MimeTypes: []string{
					"application/pdf",
					"application/msword",
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
					"application/vnd.ms-excel",
					"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					"application/vnd.ms-powerpoint",
					"application/vnd.openxmlformats-officedocument.presentationml.presentation",
					"text/plain",
					"text/csv",
					"image/svg+xml",
				},
			},
			// View mode: 'note', 'collection', 'tasks'
			&core.SelectField{
				Name:   "viewMode",
				Values: []string{"note", "collection", "tasks"},
			},
			&core.SelectField{
				Name:   "childrenViewMode",
				Values: []string{"list", "gallery", "board", "inline", "table"},
			},
			// Daily journal support
			&core.BoolField{Name: "isDailyNote"},
			&core.TextField{Name: "dailyNoteDate", Max: 20},
			// Sidebar state
			&core.BoolField{Name: "isExpanded"},
			&core.BoolField{Name: "isPinned"},
			&core.NumberField{Name: "pinnedOrder"},
			&core.BoolField{Name: "showChildrenInSidebar"},
			// Collection view preferences
			&core.SelectField{
				Name:   "collectionSortBy",
				Values: []string{"updated", "created", "title"},
			},
			&core.SelectField{
				Name:   "collectionSortDirection",
				Values: []string{"asc", "desc"},
			},
			&core.SelectField{
				Name:   "collectionGroupBy",
				Values: []string{"none", "date"},
			},
			// Task Collection fields (when viewMode === 'tasks')
			&core.JSONField{Name: "sections", MaxSize: 100000},
			&core.SelectField{
				Name:   "tasksViewMode",
				Values: []string{"list", "kanban", "table"},
			},
			&core.SelectField{
				Name:   "tasksGroupBy",
				Values: []string{"date", "priority", "section", "none", "parentPage", "tag"},
			},
			&core.BoolField{Name: "showCompletedTasks"},
			// Saved views
			&core.JSONField{Name: "savedViews", MaxSize: 100000},
			&core.TextField{Name: "activeSavedViewId", Max: 36},
			// Display options
			&core.JSONField{Name: "showExcerpts", MaxSize: 10000},
			&core.BoolField{Name: "heroCompact"},
			// Tags and filter options
			&core.TextField{Name: "tags"},
			&core.JSONField{Name: "tasksFilterOptions"},
			&core.JSONField{Name: "collectionFilterOptions"},
			// Structured preview for cards
			&core.JSONField{Name: "previewStructured", MaxSize: 50000},
			// Computed field maintained by hooks
			&core.NumberField{Name: "childCount"},
			// Audit
			&core.RelationField{
				Name:         "createdBy",
				CollectionId: usersCollection.Id,
				MaxSelect:    1,
			},
			// BOOX / external source metadata
			&core.BoolField{Name: "isReadOnly"},
			&core.TextField{Name: "sourceOrigin", Max: 50},
			&core.TextField{Name: "sourceItemType", Max: 50},
			&core.TextField{Name: "sourceExternalId", Max: 500},
			&core.TextField{Name: "sourcePath", Max: 1000},
			&core.TextField{Name: "sourceLastSyncedAt", Max: 40},
			&core.TextField{Name: "sourceCreatedAt", Max: 40},
			&core.TextField{Name: "sourceModifiedAt", Max: 40},
			&core.TextField{Name: "sourceContentLength", Max: 40},
			&core.TextField{Name: "sourceETag", Max: 500},
			&core.FileField{
				Name:      "previewThumbnail",
				MaxSelect: 1,
				MaxSize:   2097152, // 2 MB
				MimeTypes: []string{"image/png", "image/jpeg", "image/webp"},
			},
			&core.NumberField{
				Name: "sourcePageCount",
				Min:  floatPtr(0),
			},
		)
		if err := app.Save(pages); err != nil {
			return err
		}

		// Add self-referential parentId field
		pages.Fields.Add(&core.RelationField{
			Name:         "parentId",
			CollectionId: pages.Id,
			MaxSelect:    1,
		})
		pages.AddIndex("idx_pages_workspace", false, "workspace", "")
		pages.AddIndex("idx_pages_parentId", false, "parentId", "")
		pages.AddIndex("idx_pages_viewMode", false, "viewMode", "")
		pages.AddIndex("idx_pages_workspace_viewMode", false, "workspace, viewMode", "")
		pages.AddIndex("idx_pages_dailyNoteDate", false, "dailyNoteDate", "")
		pages.AddIndex("idx_pages_isPinned", false, "isPinned, workspace", "")
		pages.AddIndex("idx_pages_pinnedOrder", false, "pinnedOrder, workspace", "")
		if err := app.Save(pages); err != nil {
			return err
		}

		// ------------------------------------------------------------------------
		// TASKS COLLECTION
		// ------------------------------------------------------------------------
		tasks := core.NewBaseCollection("tasks")
		tasks.Fields.Add(
			&core.AutodateField{Name: "created", OnCreate: true},
			&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
			&core.RelationField{
				Name:         "workspace",
				CollectionId: workspaces.Id,
				Required:     true,
				MaxSelect:    1,
			},
			&core.TextField{Name: "title", Required: true, Min: 1, Max: 500},
			&core.EditorField{Name: "description", MaxSize: 100000},
			&core.TextField{Name: "dueDate", Max: 20},
			&core.SelectField{
				Name:   "priority",
				Values: []string{"Low", "Medium", "High"},
			},
			&core.RelationField{
				Name:         "parentPageId",
				CollectionId: pages.Id,
				MaxSelect:    1,
			},
			&core.TextField{Name: "sectionId", Max: 50},
			&core.BoolField{Name: "completed"},
			&core.TextField{Name: "completedAt", Max: 30},
			&core.JSONField{Name: "subtasks", MaxSize: 100000},
			&core.JSONField{Name: "recurrence", MaxSize: 10000},
			&core.BoolField{Name: "copySubtasksOnRecur"},
			&core.NumberField{Name: "order"},
			&core.TextField{Name: "tag"},
			&core.JSONField{Name: "linkedItems", MaxSize: 100000},
			&core.RelationField{
				Name:         "assignee",
				CollectionId: usersCollection.Id,
				MaxSelect:    1,
			},
			&core.RelationField{
				Name:         "createdBy",
				CollectionId: usersCollection.Id,
				MaxSelect:    1,
			},
		)
		tasks.AddIndex("idx_tasks_workspace", false, "workspace", "")
		tasks.AddIndex("idx_tasks_parentPageId", false, "parentPageId", "")
		tasks.AddIndex("idx_tasks_dueDate", false, "dueDate", "")
		tasks.AddIndex("idx_tasks_completed", false, "completed", "")
		tasks.AddIndex("idx_tasks_tag", false, "tag, workspace", "")
		if err := app.Save(tasks); err != nil {
			return err
		}

		// Add self-referential recurringParentId field
		tasks.Fields.Add(&core.RelationField{
			Name:         "recurringParentId",
			CollectionId: tasks.Id,
			MaxSelect:    1,
		})
		if err := app.Save(tasks); err != nil {
			return err
		}

		// ------------------------------------------------------------------------
		// BOOX INTEGRATIONS COLLECTION
		// ------------------------------------------------------------------------
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
		if err := app.Save(booxIntegrations); err != nil {
			return err
		}

		// ------------------------------------------------------------------------
		// EXTEND USERS COLLECTION
		// ------------------------------------------------------------------------
		usersCollection.Fields.Add(
			&core.TextField{Name: "timezone", Max: 50},
			&core.SelectField{
				Name:   "theme",
				Values: []string{"light", "dark", "system"},
			},
			&core.SelectField{
				Name:   "sidebarLayout",
				Values: []string{"default", "compact"},
			},
			&core.JSONField{Name: "pomodoroSettings", MaxSize: 10000},
			&core.JSONField{Name: "preferences", MaxSize: 100000},
			&core.RelationField{
				Name:         "defaultWorkspace",
				CollectionId: workspaces.Id,
				MaxSelect:    1,
			},
		)
		if err := app.Save(usersCollection); err != nil {
			return err
		}

		// ========================================================================
		// PHASE 2: APPLY ACCESS RULES
		// ========================================================================

		// Re-fetch collections
		workspaces, _ = app.FindCollectionByNameOrId("workspaces")
		workspaceMembers, _ = app.FindCollectionByNameOrId("workspace_members")
		pages, _ = app.FindCollectionByNameOrId("pages")
		tasks, _ = app.FindCollectionByNameOrId("tasks")

		// Workspaces rules
		workspaces.CreateRule = types.Pointer("@request.auth.id != ''")
		workspaces.ListRule = types.Pointer("@request.auth.id != '' && @collection.workspace_members.user ?= @request.auth.id && @collection.workspace_members.workspace ?= id")
		workspaces.ViewRule = workspaces.ListRule
		workspaces.UpdateRule = types.Pointer("@request.auth.id != '' && (owner = @request.auth.id || (@collection.workspace_members.user ?= @request.auth.id && @collection.workspace_members.workspace ?= id && @collection.workspace_members.role ?= 'admin'))")
		workspaces.DeleteRule = types.Pointer("@request.auth.id != '' && owner = @request.auth.id && isPersonal = false")
		if err := app.Save(workspaces); err != nil {
			return err
		}

		// Workspace members rules
		workspaceMembers.CreateRule = types.Pointer(`
			@request.auth.id != '' && 
			@collection.workspaces.id ?= @request.body.workspace && 
			@collection.workspaces.owner ?= @request.auth.id
		`)
		workspaceMembers.ListRule = types.Pointer(`
			@request.auth.id != '' && 
			@collection.workspace_members.user ?= @request.auth.id && 
			@collection.workspace_members.workspace ?= workspace
		`)
		workspaceMembers.ViewRule = workspaceMembers.ListRule
		workspaceMembers.UpdateRule = types.Pointer(`
			@request.auth.id != '' && 
			@collection.workspaces.id ?= workspace && 
			@collection.workspaces.owner ?= @request.auth.id
		`)
		workspaceMembers.DeleteRule = workspaceMembers.UpdateRule
		if err := app.Save(workspaceMembers); err != nil {
			return err
		}

		// Pages rules (workspace-scoped)
		pagesRule := types.Pointer(`
			@request.auth.id != '' && 
			@collection.workspace_members.user ?= @request.auth.id && 
			@collection.workspace_members.workspace ?= workspace
		`)
		pages.ListRule = pagesRule
		pages.ViewRule = pagesRule
		pages.CreateRule = pagesRule
		pages.UpdateRule = pagesRule
		pages.DeleteRule = pagesRule
		if err := app.Save(pages); err != nil {
			return err
		}

		// Tasks rules (workspace-scoped)
		tasksRule := types.Pointer(`
			@request.auth.id != '' && 
			@collection.workspace_members.user ?= @request.auth.id && 
			@collection.workspace_members.workspace ?= workspace
		`)
		tasks.ListRule = tasksRule
		tasks.ViewRule = tasksRule
		tasks.CreateRule = tasksRule
		tasks.UpdateRule = tasksRule
		tasks.DeleteRule = tasksRule
		if err := app.Save(tasks); err != nil {
			return err
		}

		// ========================================================================
		// PHASE 3: CREATE FTS5 VIRTUAL TABLES FOR FULL-TEXT SEARCH
		// ========================================================================

		db := app.DB()

		// Tasks FTS
		if _, err = db.NewQuery(`
			CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
				id UNINDEXED,
				workspace UNINDEXED,
				title,
				description,
				content='tasks',
				content_rowid='rowid',
				tokenize='porter unicode61'
			)
		`).Execute(); err != nil {
			return err
		}

		// Pages FTS (includes bodyText for full-body search)
		if _, err = db.NewQuery(`
			CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
				id UNINDEXED,
				workspace UNINDEXED,
				title,
				excerpt,
				bodyText,
				content='pages',
				content_rowid='rowid',
				tokenize='porter unicode61'
			)
		`).Execute(); err != nil {
			return err
		}

		// Tasks FTS triggers
		for _, q := range []string{
			`CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
				INSERT INTO tasks_fts(rowid, id, workspace, title, description)
				VALUES (NEW.rowid, NEW.id, NEW.workspace, NEW.title, NEW.description);
			END`,
			`CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
				INSERT INTO tasks_fts(tasks_fts, rowid, id, workspace, title, description)
				VALUES ('delete', OLD.rowid, OLD.id, OLD.workspace, OLD.title, OLD.description);
			END`,
			`CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
				INSERT INTO tasks_fts(tasks_fts, rowid, id, workspace, title, description)
				VALUES ('delete', OLD.rowid, OLD.id, OLD.workspace, OLD.title, OLD.description);
				INSERT INTO tasks_fts(rowid, id, workspace, title, description)
				VALUES (NEW.rowid, NEW.id, NEW.workspace, NEW.title, NEW.description);
			END`,
		} {
			if _, err := db.NewQuery(q).Execute(); err != nil {
				return err
			}
		}

		// Pages FTS triggers
		for _, q := range []string{
			`CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
				INSERT INTO pages_fts(rowid, id, workspace, title, excerpt, bodyText)
				VALUES (NEW.rowid, NEW.id, NEW.workspace, NEW.title, NEW.excerpt, NEW.bodyText);
			END`,
			`CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
				INSERT INTO pages_fts(pages_fts, rowid, id, workspace, title, excerpt, bodyText)
				VALUES ('delete', OLD.rowid, OLD.id, OLD.workspace, OLD.title, OLD.excerpt, OLD.bodyText);
			END`,
			`CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
				INSERT INTO pages_fts(pages_fts, rowid, id, workspace, title, excerpt, bodyText)
				VALUES ('delete', OLD.rowid, OLD.id, OLD.workspace, OLD.title, OLD.excerpt, OLD.bodyText);
				INSERT INTO pages_fts(rowid, id, workspace, title, excerpt, bodyText)
				VALUES (NEW.rowid, NEW.id, NEW.workspace, NEW.title, NEW.excerpt, NEW.bodyText);
			END`,
		} {
			if _, err := db.NewQuery(q).Execute(); err != nil {
				return err
			}
		}

		return nil
	}, nil)
}

func floatPtr(v float64) *float64 { return &v }
