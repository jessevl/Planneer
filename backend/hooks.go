// Hooks for PocketBase event handling
//
// Contains all PocketBase hooks for:
// - SSE content stripping for pages (bandwidth optimization)
// - Page childCount maintenance
// - ViewMode change enforcement (move tasks to Inbox when changing from 'tasks')
// - Demo user content reset
// - New user onboarding
// - Personal workspace deletion prevention
// - Workspace usage tracking and onboarding

package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	"planneer/config"
	"planneer/pagepreview"
	"planneer/templates"
)

// ============================================================================
// SSE PATCH DATA MANAGEMENT
// ============================================================================

// PendingPatchData holds block changes to inject into SSE broadcasts
type PendingPatchData struct {
	ChangedBlocks map[string]json.RawMessage `json:"changedBlocks"`
	DeletedBlocks []string                   `json:"deletedBlocks"`
	BlockOrders   map[string]int             `json:"blockOrders"` // Block ID -> new order (for reordering)
}

// pendingPatches stores patch data keyed by pageId
// Written before app.Save(), read by OnRealtimeMessageSend during Save(),
// deleted after Save() returns (SSE dispatch is synchronous within Save).
var pendingPatches sync.Map

// pendingPatchesMu protects read-modify-write operations on pendingPatches
var pendingPatchesMu sync.Mutex

// MergePendingPatch adds new block changes to any existing pending patch for a page.
// This handles the race condition where multiple rapid saves occur before SSE fires.
// IMPORTANT: We deep-copy the block data to avoid race conditions with request buffer reuse.
func MergePendingPatch(pageId string, newBlocks map[string]json.RawMessage, newDeleted []string, newBlockOrders map[string]int) {
	pendingPatchesMu.Lock()
	defer pendingPatchesMu.Unlock()

	// Deep-copy the new blocks to avoid issues with request buffer reuse
	copiedBlocks := make(map[string]json.RawMessage, len(newBlocks))
	for k, v := range newBlocks {
		copied := make(json.RawMessage, len(v))
		copy(copied, v)
		copiedBlocks[k] = copied
	}

	// Copy deleted slice
	copiedDeleted := make([]string, len(newDeleted))
	copy(copiedDeleted, newDeleted)

	// Copy blockOrders
	copiedBlockOrders := make(map[string]int, len(newBlockOrders))
	for k, v := range newBlockOrders {
		copiedBlockOrders[k] = v
	}

	existing, ok := pendingPatches.Load(pageId)
	if !ok {
		// No existing patch, store new one
		pendingPatches.Store(pageId, PendingPatchData{
			ChangedBlocks: copiedBlocks,
			DeletedBlocks: copiedDeleted,
			BlockOrders:   copiedBlockOrders,
		})
		return
	}

	// Merge with existing patch
	patch := existing.(PendingPatchData)

	// Merge changed blocks (new values override old)
	if patch.ChangedBlocks == nil {
		patch.ChangedBlocks = make(map[string]json.RawMessage)
	}
	for k, v := range copiedBlocks {
		patch.ChangedBlocks[k] = v
	}

	// Merge block orders (new values override old)
	if patch.BlockOrders == nil {
		patch.BlockOrders = make(map[string]int)
	}
	for k, v := range copiedBlockOrders {
		patch.BlockOrders[k] = v
	}

	// Merge deleted blocks (deduplicate)
	deletedSet := make(map[string]bool)
	for _, d := range patch.DeletedBlocks {
		deletedSet[d] = true
	}
	for _, d := range copiedDeleted {
		deletedSet[d] = true
	}
	// Remove from deleted if it was re-added
	for k := range copiedBlocks {
		delete(deletedSet, k)
	}
	patch.DeletedBlocks = make([]string, 0, len(deletedSet))
	for d := range deletedSet {
		patch.DeletedBlocks = append(patch.DeletedBlocks, d)
	}
	// Also remove from changedBlocks if it's being deleted
	for _, d := range copiedDeleted {
		delete(patch.ChangedBlocks, d)
	}
	// Remove from blockOrders if deleted
	for _, d := range copiedDeleted {
		delete(patch.BlockOrders, d)
	}

	pendingPatches.Store(pageId, patch)
}

// DeletePendingPatch removes the pending patch for a page
func DeletePendingPatch(pageId string) {
	pendingPatches.Delete(pageId)
}

// ============================================================================
// HOOK REGISTRATION
// ============================================================================

// RegisterHooks sets up all PocketBase hooks
func RegisterHooks(app *pocketbase.PocketBase) {
	registerSSEHook(app)
	registerThumbnailUploadResponseHook(app)
	registerPageChildCountHooks(app)
	registerViewModeEnforcementHook(app)
	registerRegistrationRestrictionHook(app) // Block new registrations
	registerUserOnboardingHook(app)
	registerWorkspaceDeletionHook(app)
	registerWorkspaceUsageHooks(app)
	registerPageDerivedFieldsHook(app)
}

// ============================================================================
// REGISTRATION RESTRICTION HOOK
// ============================================================================

func registerRegistrationRestrictionHook(app *pocketbase.PocketBase) {
	// Temporarily disable new user registrations for closed beta.
	app.OnRecordCreateRequest("users").BindFunc(func(e *core.RecordRequestEvent) error {
		// If not in closed beta, allow registration
		if !config.CurrentConfig.IsClosedBeta {
			return e.Next()
		}

		// Allow creation by superusers (e.g. via admin UI)
		if e.HasSuperuserAuth() {
			return e.Next()
		}

		// Block all other registration attempts
		return e.ForbiddenError("Registrations are temporarily disabled during closed beta. Please contact us for an invite.", nil)
	})
}

// ============================================================================
// SSE HOOK - Strip content from pages broadcasts
// ============================================================================

func registerSSEHook(app *pocketbase.PocketBase) {
	// PocketBase's default realtime broadcasts include full record data.
	// For pages, this means sending the entire content (which can be large)
	// on every edit. This hook intercepts SSE messages for pages and strips
	// the content field, reducing bandwidth by ~90%.
	//
	// Clients use the /api/pages/{id}/blocks endpoint to fetch changed blocks
	// incrementally when the custom broadcastPagePatch event includes changedBlocks.
	//
	// IMPORTANT: OnRealtimeMessageSend is called ONCE PER CLIENT receiving the message.
	// We use Load (not LoadAndDelete) so all clients get the changedBlocks data.
	// Cleanup happens via OnRecordAfterUpdateSuccess hook after all messages are sent.
	app.OnRealtimeMessageSend().BindFunc(func(e *core.RealtimeMessageEvent) error {
		// Only process pages collection messages
		if !strings.HasPrefix(e.Message.Name, "pages/") {
			return e.Next()
		}

		// Parse the message data
		var msgData map[string]any
		if err := json.Unmarshal(e.Message.Data, &msgData); err != nil {
			log.Printf("[SSE Hook] Failed to parse message data: %v, raw data: %s", err, string(e.Message.Data))
			return e.Next()
		}

		// Check if this is a record event with a record object
		record, ok := msgData["record"].(map[string]any)
		if !ok {
			log.Printf("[SSE Hook] No record object in message, skipping")
			return e.Next()
		}

		// Get record ID to check for pending patch data
		recordId, ok := record["id"].(string)
		if !ok || recordId == "" {
			log.Printf("[SSE Hook] No valid record ID found, skipping")
			return e.Next()
		}

		// Always remove content field for bandwidth efficiency
		delete(record, "content")

		// Check if we have pending patch data to inject
		if recordId != "" {
			if patchData, ok := pendingPatches.Load(recordId); ok {
				patch := patchData.(PendingPatchData)

				// Inject changedBlocks and deletedBlocks into the message
				if len(patch.ChangedBlocks) > 0 {
					changedBlocks := make(map[string]any)
					for k, v := range patch.ChangedBlocks {
						var block any
						if err := json.Unmarshal(v, &block); err != nil {
							log.Printf("[SSE Hook] Failed to unmarshal block %s: %v", k, err)
							continue
						}
						changedBlocks[k] = block
					}
					msgData["changedBlocks"] = changedBlocks
				}
				if len(patch.DeletedBlocks) > 0 {
					msgData["deletedBlocks"] = patch.DeletedBlocks
				}
				if len(patch.BlockOrders) > 0 {
					msgData["blockOrders"] = patch.BlockOrders
				}
				log.Printf("[SSE Hook] Injected %d changedBlocks, %d deletedBlocks, %d blockOrders for page %s",
					len(patch.ChangedBlocks), len(patch.DeletedBlocks), len(patch.BlockOrders), recordId)
			} else {
				log.Printf("[SSE Hook] No pending patch found for page %s (metadata-only SSE)", recordId)
			}
		}

		// Re-serialize the message
		newData, err := json.Marshal(msgData)
		if err != nil {
			log.Printf("[SSE Hook] Failed to re-serialize message for page %s: %v", recordId, err)
			return e.Next()
		}

		// Validate the JSON is well-formed
		if !json.Valid(newData) {
			log.Printf("[SSE Hook] Generated invalid JSON for page %s, skipping message modification", recordId)
			return e.Next()
		}

		e.Message.Data = newData

		return e.Next()
	})
}

// ============================================================================
// THUMBNAIL UPLOAD RESPONSE HOOK - Strip content from direct API responses
// ============================================================================

func registerThumbnailUploadResponseHook(app *pocketbase.PocketBase) {
	// When uploading thumbnails via pb.collection('pages').update(), we only send
	// the thumbnail field, but PocketBase returns the full record in the response.
	// For whiteboards with large content, this wastes bandwidth since the client
	// already has the content and only needs the thumbnail URL.
	//
	// This hook strips the content field from API responses for UPDATE operations
	// where the content wasn't modified (thumbnail-only updates).
	app.OnRecordEnrich("pages").BindFunc(func(e *core.RecordEnrichEvent) error {
		// Only process API responses (not realtime/admin)
		if e.RequestInfo == nil {
			return e.Next()
		}

		// Only process PATCH/PUT requests (updates)
		method := e.RequestInfo.Method
		if method != "PATCH" && method != "PUT" {
			return e.Next()
		}

		// Check if content was modified in this update
		// If original exists and content is the same, this is a metadata-only update
		if e.Record.Original() != nil {
			originalContent := e.Record.Original().GetString("content")
			currentContent := e.Record.GetString("content")

			// If content hasn't changed, strip it from response to save bandwidth
			if originalContent == currentContent && currentContent != "" {
				e.Record.Set("content", nil)
			}
		}

		return e.Next()
	})
}

// ============================================================================
// PAGE CHILD COUNT HOOKS
// ============================================================================

func registerPageChildCountHooks(app *pocketbase.PocketBase) {
	// After a page is created, increment parent's childCount
	app.OnRecordAfterCreateSuccess("pages").BindFunc(func(e *core.RecordEvent) error {
		parentId := e.Record.GetString("parentId")
		if parentId != "" {
			updateChildCount(app, parentId)
		}
		return e.Next()
	})

	// After a page is updated, update childCount if parentId changed
	app.OnRecordAfterUpdateSuccess("pages").BindFunc(func(e *core.RecordEvent) error {
		oldParentId := e.Record.Original().GetString("parentId")
		newParentId := e.Record.GetString("parentId")

		if oldParentId != newParentId {
			if oldParentId != "" {
				updateChildCount(app, oldParentId)
			}
			if newParentId != "" {
				updateChildCount(app, newParentId)
			}
		}
		return e.Next()
	})

	// After a page is deleted, decrement parent's childCount
	app.OnRecordAfterDeleteSuccess("pages").BindFunc(func(e *core.RecordEvent) error {
		parentId := e.Record.GetString("parentId")
		if parentId != "" {
			updateChildCount(app, parentId)
		}
		return e.Next()
	})
}

// updateChildCount recalculates and updates the childCount for a page
func updateChildCount(app *pocketbase.PocketBase, pageId string) {
	var count struct {
		Total int `db:"total"`
	}

	err := app.DB().
		NewQuery("SELECT COUNT(*) as total FROM pages WHERE parentId = {:parentId}").
		Bind(map[string]any{"parentId": pageId}).
		One(&count)

	if err != nil {
		log.Printf("Warning: Failed to count children for page %s: %v", pageId, err)
		return
	}

	page, err := app.FindRecordById("pages", pageId)
	if err != nil {
		log.Printf("Warning: Failed to find page %s to update childCount: %v", pageId, err)
		return
	}

	oldCount := page.GetInt("childCount")
	if oldCount == count.Total {
		// No change needed, avoid unnecessary SSE broadcast
		log.Printf("[ChildCount] Page %s: count unchanged at %d, skipping save", pageId, count.Total)
		return
	}

	log.Printf("[ChildCount] Page %s: updating count from %d to %d", pageId, oldCount, count.Total)
	page.Set("childCount", count.Total)
	if err := app.Save(page); err != nil {
		log.Printf("Warning: Failed to save childCount for page %s: %v", pageId, err)
	}
}

// ============================================================================
// VIEW MODE ENFORCEMENT HOOK
// ============================================================================

func registerViewModeEnforcementHook(app *pocketbase.PocketBase) {
	// When a page's viewMode changes FROM 'tasks' to something else,
	// move all tasks that reference this page to Inbox (parentPageId = null)
	app.OnRecordAfterUpdateSuccess("pages").BindFunc(func(e *core.RecordEvent) error {
		oldViewMode := e.Record.Original().GetString("viewMode")
		newViewMode := e.Record.GetString("viewMode")

		// Only act if changing away from 'tasks' viewMode
		if oldViewMode == "tasks" && newViewMode != "tasks" {
			pageId := e.Record.Id
			_, err := app.DB().
				NewQuery("UPDATE tasks SET parentPageId = NULL WHERE parentPageId = {:pageId}").
				Bind(map[string]any{"pageId": pageId}).
				Execute()
			if err != nil {
				log.Printf("Warning: Failed to orphan tasks when changing page %s viewMode from tasks: %v", pageId, err)
			} else {
				log.Printf("[ViewMode] Page %s changed from 'tasks' to '%s', moved tasks to Inbox", pageId, newViewMode)
			}
		}
		return e.Next()
	})
}

// ============================================================================
// USER ONBOARDING HOOK
// ============================================================================

func registerUserOnboardingHook(app *pocketbase.PocketBase) {
	// When a new user registers, create their default workspace with
	// sample pages (including task collections), tasks, and content to help them get started.
	app.OnRecordAfterCreateSuccess("users").BindFunc(func(e *core.RecordEvent) error {
		e.Record.Set("storageUsed", 0)
		if err := app.Save(e.Record); err != nil {
			log.Printf("Warning: Failed to initialize user %s: %v", e.Record.Id, err)
		}

		go func() {
			if err := templates.ApplyNewUserContent(app, e.Record.Id); err != nil {
				log.Printf("Warning: Failed to create starter content for user %s: %v", e.Record.Id, err)
			}
		}()
		return e.Next()
	})
}

// ============================================================================
// WORKSPACE DELETION HOOK
// ============================================================================

func registerWorkspaceDeletionHook(app *pocketbase.PocketBase) {
	// The personal workspace (isPersonal=true) cannot be deleted by users.
	app.OnRecordDeleteRequest("workspaces").BindFunc(func(e *core.RecordRequestEvent) error {
		if e.Record.GetBool("isPersonal") {
			return e.BadRequestError("Cannot delete your personal workspace. You must always have at least one workspace.", nil)
		}
		return e.Next()
	})
}

// ============================================================================
// DEMO USER RESET
// ============================================================================

// ResetDemoUser resets the demo user's content to latest templates.
// SECURITY: This function only operates in development mode.
// In production, the demo user should not exist.
func ResetDemoUser(app *pocketbase.PocketBase) {
	// Only reset demo user in development mode
	if !app.IsDev() {
		return
	}

	demoUser, err := app.FindAuthRecordByEmail("users", "demo@planneer.app")
	if err != nil {
		return // Demo user doesn't exist (expected in production)
	}

	if err := templates.ResetDemoUserContent(app, demoUser.Id); err != nil {
		log.Printf("Warning: Failed to reset demo user content: %v", err)
	} else {
		log.Println("[Dev] Demo user content reset to latest templates")
	}
}

// ============================================================================
// WORKSPACE USAGE HOOKS
// ============================================================================
//
// Workspace stores cached counts and storage usage so the UI can show usage
// information without expensive recalculations on every render.

func registerWorkspaceUsageHooks(app *pocketbase.PocketBase) {

	// Pages: increment on create
	app.OnRecordAfterCreateSuccess("pages").BindFunc(func(e *core.RecordEvent) error {
		workspaceId := e.Record.GetString("workspace")
		incrementWorkspaceCounter(app, workspaceId, "pageCount", 1)
		// Also update storage if files were uploaded
		updateWorkspaceStorageForPage(app, workspaceId, e.Record, nil)
		return e.Next()
	})

	// Pages: decrement on delete
	app.OnRecordAfterDeleteSuccess("pages").BindFunc(func(e *core.RecordEvent) error {
		workspaceId := e.Record.GetString("workspace")
		incrementWorkspaceCounter(app, workspaceId, "pageCount", -1)
		// Subtract storage for deleted files
		updateWorkspaceStorageForPage(app, workspaceId, nil, e.Record)
		return e.Next()
	})

	// Pages: update storage on update (files added/removed)
	app.OnRecordAfterUpdateSuccess("pages").BindFunc(func(e *core.RecordEvent) error {
		workspaceId := e.Record.GetString("workspace")
		updateWorkspaceStorageForPage(app, workspaceId, e.Record, e.Record.Original())
		return e.Next()
	})

	// Tasks: increment on create
	app.OnRecordAfterCreateSuccess("tasks").BindFunc(func(e *core.RecordEvent) error {
		workspaceId := e.Record.GetString("workspace")
		incrementWorkspaceCounter(app, workspaceId, "taskCount", 1)
		return e.Next()
	})

	// Tasks: decrement on delete
	app.OnRecordAfterDeleteSuccess("tasks").BindFunc(func(e *core.RecordEvent) error {
		workspaceId := e.Record.GetString("workspace")
		incrementWorkspaceCounter(app, workspaceId, "taskCount", -1)
		return e.Next()
	})
}

// incrementWorkspaceCounter atomically increments a counter field on a workspace
func incrementWorkspaceCounter(app *pocketbase.PocketBase, workspaceId string, field string, delta int) {
	if workspaceId == "" {
		return
	}

	// CRITICAL-1: Whitelist allowed field names to prevent SQL injection
	allowedFields := map[string]bool{
		"pageCount":   true,
		"taskCount":   true,
		"storageUsed": true,
	}
	if !allowedFields[field] {
		log.Printf("Warning: Attempted to increment disallowed field: %s", field)
		return
	}

	// Use direct SQL for atomic increment (avoids race conditions)
	_, err := app.DB().
		NewQuery("UPDATE workspaces SET " + field + " = COALESCE(" + field + ", 0) + {:delta} WHERE id = {:id}").
		Bind(map[string]any{"delta": delta, "id": workspaceId}).
		Execute()

	if err != nil {
		log.Printf("Warning: Failed to update %s for workspace %s: %v", field, workspaceId, err)
	}
}

// updateWorkspaceStorageForPage updates storage used based on file changes
func updateWorkspaceStorageForPage(app *pocketbase.PocketBase, workspaceId string, newRecord *core.Record, oldRecord *core.Record) {
	if workspaceId == "" {
		return
	}

	var delta int64 = 0

	// Calculate size of new files
	if newRecord != nil {
		delta += calculateRecordFileSize(app, newRecord)
	}

	// Subtract size of old files
	if oldRecord != nil {
		delta -= calculateRecordFileSize(app, oldRecord)
	}

	if delta == 0 {
		return
	}

	// Atomic update
	_, err := app.DB().
		NewQuery("UPDATE workspaces SET storageUsed = COALESCE(storageUsed, 0) + {:delta} WHERE id = {:id}").
		Bind(map[string]any{"delta": delta, "id": workspaceId}).
		Execute()

	if err != nil {
		log.Printf("Warning: Failed to update storageUsed for workspace %s: %v", workspaceId, err)
	}
}

// calculateRecordFileSize calculates the total size of files attached to a record
func calculateRecordFileSize(app *pocketbase.PocketBase, record *core.Record) int64 {
	var total int64 = 0

	// Get the base storage path
	baseDir := filepath.Join(app.DataDir(), "storage", record.Collection().Id, record.Id)

	// Check each file field
	for _, fieldName := range []string{"images", "files", "whiteboardThumbnail"} {
		field := record.Collection().Fields.GetByName(fieldName)
		if field == nil {
			continue
		}

		// Get file names
		var fileNames []string
		if _, ok := field.(*core.FileField); ok {
			val := record.Get(fieldName)
			switch v := val.(type) {
			case string:
				if v != "" {
					fileNames = append(fileNames, v)
				}
			case []string:
				fileNames = v
			case []any:
				for _, f := range v {
					if s, ok := f.(string); ok && s != "" {
						fileNames = append(fileNames, s)
					}
				}
			}
		}

		// Stat each file to get actual size
		for _, fileName := range fileNames {
			filePath := filepath.Join(baseDir, fileName)
			if info, err := os.Stat(filePath); err == nil {
				total += info.Size()
			}
		}
	}

	return total
}

// ============================================================================
// DERIVED PAGE FIELDS HOOK
// ============================================================================

// registerPageDerivedFieldsHook keeps derived page fields up to date.
// It fires before every page create/update and computes bodyText plus a small,
// structured preview payload from the content field so list/card views can
// render rich previews without requiring full note content.
func registerPageDerivedFieldsHook(app *pocketbase.PocketBase) {
	computeAndSet := func(e *core.RecordEvent) error {
		content, _ := e.Record.Get("content").(string)
		derived := pagepreview.Derive(content, 4)
		e.Record.Set("bodyText", derived.BodyText)
		if len(derived.Blocks) == 0 {
			e.Record.Set("previewStructured", nil)
		} else {
			e.Record.Set("previewStructured", derived.Blocks)
		}
		return e.Next()
	}
	app.OnRecordCreate("pages").BindFunc(computeAndSet)
	app.OnRecordUpdate("pages").BindFunc(computeAndSet)
}
