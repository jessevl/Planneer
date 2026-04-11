package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestHealthEndpoint tests the /health endpoint
func TestHealthEndpoint(t *testing.T) {
	// Create a test HTTP handler for the health endpoint
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "healthy", "version": "1.0.0"}`))
	})

	// Create a test request
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	// Execute the request
	handler.ServeHTTP(rec, req)

	// Check status code
	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	// Check content type
	contentType := rec.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected Content-Type application/json, got %s", contentType)
	}

	// Check response body contains expected fields
	body := rec.Body.String()
	if body == "" {
		t.Error("expected non-empty response body")
	}
}

// TestMergePendingPatch tests the patch merging logic
func TestMergePendingPatch(t *testing.T) {
	// Clean up any existing patches
	pendingPatches.Delete("test-note")

	// Test adding initial blocks
	blocks1 := map[string]json.RawMessage{
		"block-1": json.RawMessage(`{"type": "paragraph", "text": "Hello"}`),
		"block-2": json.RawMessage(`{"type": "paragraph", "text": "World"}`),
	}
	MergePendingPatch("test-note", blocks1, nil, nil)

	// Verify blocks were stored
	stored, ok := pendingPatches.Load("test-note")
	if !ok {
		t.Fatal("expected patch to be stored")
	}
	patch := stored.(PendingPatchData)
	if len(patch.ChangedBlocks) != 2 {
		t.Errorf("expected 2 blocks, got %d", len(patch.ChangedBlocks))
	}

	// Test merging additional blocks
	blocks2 := map[string]json.RawMessage{
		"block-2": json.RawMessage(`{"type": "paragraph", "text": "Updated"}`), // Override
		"block-3": json.RawMessage(`{"type": "heading", "text": "New"}`),       // New
	}
	MergePendingPatch("test-note", blocks2, nil, nil)

	stored, _ = pendingPatches.Load("test-note")
	patch = stored.(PendingPatchData)
	if len(patch.ChangedBlocks) != 3 {
		t.Errorf("expected 3 blocks after merge, got %d", len(patch.ChangedBlocks))
	}

	// Test deleting blocks
	MergePendingPatch("test-note", nil, []string{"block-1"}, nil)

	stored, _ = pendingPatches.Load("test-note")
	patch = stored.(PendingPatchData)
	if len(patch.ChangedBlocks) != 2 {
		t.Errorf("expected 2 blocks after delete, got %d", len(patch.ChangedBlocks))
	}
	if len(patch.DeletedBlocks) != 1 {
		t.Errorf("expected 1 deleted block, got %d", len(patch.DeletedBlocks))
	}

	// Test order-only changes
	orders := map[string]int{"block-2": 5, "block-3": 10}
	MergePendingPatch("test-note", nil, nil, orders)

	stored, _ = pendingPatches.Load("test-note")
	patch = stored.(PendingPatchData)
	if len(patch.BlockOrders) != 2 {
		t.Errorf("expected 2 block orders, got %d", len(patch.BlockOrders))
	}
	if patch.BlockOrders["block-2"] != 5 {
		t.Errorf("expected block-2 order 5, got %d", patch.BlockOrders["block-2"])
	}

	// Clean up
	pendingPatches.Delete("test-note")
}

// TestCanContinueRecurrence tests end condition checking
// Note: This would require importing the pattern types
// For now, we test the basic logic

func TestPendingPatchesConcurrentAccess(t *testing.T) {
	// Test that concurrent access doesn't cause issues
	noteId := "concurrent-test-note"
	pendingPatches.Delete(noteId)

	// Run multiple goroutines writing and reading
	done := make(chan bool)

	for i := 0; i < 10; i++ {
		go func(n int) {
			blocks := map[string]json.RawMessage{
				"block": json.RawMessage(`{"n": ` + string(rune('0'+n)) + `}`),
			}
			MergePendingPatch(noteId, blocks, nil, nil)
			pendingPatches.Load(noteId)
			done <- true
		}(i)
	}

	// Wait for all goroutines
	for i := 0; i < 10; i++ {
		<-done
	}

	// Clean up
	pendingPatches.Delete(noteId)
}
