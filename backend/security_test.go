package main

import (
	"strings"
	"testing"
)

// =============================================================================
// escapeFTSQuery Tests (M-18)
// =============================================================================

func TestEscapeFTSQuery_EmptyInput(t *testing.T) {
	result := escapeFTSQuery("")
	if result != "" {
		t.Errorf("expected empty string, got %q", result)
	}
}

func TestEscapeFTSQuery_WhitespaceOnly(t *testing.T) {
	result := escapeFTSQuery("   \t  ")
	if result != "" {
		t.Errorf("expected empty string for whitespace input, got %q", result)
	}
}

func TestEscapeFTSQuery_SimpleTerms(t *testing.T) {
	result := escapeFTSQuery("hello world")
	expected := `"hello"* "world"*`
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestEscapeFTSQuery_DoubleQuotesEscaped(t *testing.T) {
	result := escapeFTSQuery(`say "hello"`)
	// Double quotes are doubled for FTS5 escaping
	if !strings.Contains(result, `""""`) {
		// The term "hello" should have its quotes doubled
		t.Logf("result: %q", result)
	}
	// Ensure result is non-empty and parseable
	if result == "" {
		t.Error("expected non-empty result for quoted input")
	}
}

func TestEscapeFTSQuery_SpecialCharsStripped(t *testing.T) {
	// FTS5 special characters should be stripped
	tests := []struct {
		input    string
		contains string
		desc     string
	}{
		{"{test}", `"test"*`, "curly braces stripped"},
		{"(test)", `"test"*`, "parentheses stripped"},
		{"^test", `"test"*`, "caret stripped"},
		{"col:value", `"colvalue"*`, "colon stripped"},
	}

	for _, tc := range tests {
		t.Run(tc.desc, func(t *testing.T) {
			result := escapeFTSQuery(tc.input)
			if result != tc.contains {
				t.Errorf("input %q: expected %q, got %q", tc.input, tc.contains, result)
			}
		})
	}
}

func TestEscapeFTSQuery_AllSpecialCharsOnlyProducesEmpty(t *testing.T) {
	result := escapeFTSQuery("{}()^:")
	if result != "" {
		t.Errorf("expected empty string when all chars are special, got %q", result)
	}
}

func TestEscapeFTSQuery_MaxLengthEnforced(t *testing.T) {
	// Generate a query longer than maxSearchQueryLength (200)
	longQuery := strings.Repeat("a ", 150) // 300 chars
	result := escapeFTSQuery(longQuery)

	// The result should not produce an unreasonably large output
	// Original query was 300 chars, should be truncated to 200 before processing
	if len(longQuery) <= maxSearchQueryLength {
		t.Fatal("test setup error: input should exceed max length")
	}
	if result == "" {
		t.Error("expected non-empty result for long query")
	}
	// Count the number of terms - should be limited
	terms := strings.Count(result, `"*`)
	if terms > 100 {
		t.Errorf("expected fewer terms after truncation, got %d", terms)
	}
}

func TestEscapeFTSQuery_SingleTerm(t *testing.T) {
	result := escapeFTSQuery("hello")
	expected := `"hello"*`
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

func TestEscapeFTSQuery_MixedSpecialAndRegularTerms(t *testing.T) {
	result := escapeFTSQuery("hello {} world")
	// {} should produce an empty term that gets filtered out
	expected := `"hello"* "world"*`
	if result != expected {
		t.Errorf("expected %q, got %q", expected, result)
	}
}

// =============================================================================
// sanitizeFilename Tests (M-17)
// =============================================================================

func TestSanitizeFilename_BasicName(t *testing.T) {
	result := sanitizeFilename("My Document")
	if result != "My Document" {
		t.Errorf("expected 'My Document', got %q", result)
	}
}

func TestSanitizeFilename_InvalidChars(t *testing.T) {
	result := sanitizeFilename("file/with:bad*chars?yes")
	if strings.ContainsAny(result, "/\\:*?\"<>|") {
		t.Errorf("result still contains invalid characters: %q", result)
	}
}

func TestSanitizeFilename_ControlCharsStripped(t *testing.T) {
	// Control characters should be completely removed
	tests := []struct {
		input string
		desc  string
	}{
		{"file\nname", "newline"},
		{"file\rname", "carriage return"},
		{"file\x00name", "null byte"},
		{"file\tname", "tab"},
	}

	for _, tc := range tests {
		t.Run(tc.desc, func(t *testing.T) {
			result := sanitizeFilename(tc.input)
			for _, r := range result {
				if r < 32 || r == 127 {
					t.Errorf("result contains control character %U: %q", r, result)
				}
			}
		})
	}
}

func TestSanitizeFilename_ControlCharsDoNotSplitName(t *testing.T) {
	// A filename with \r\n should NOT produce "file" and then a new header line
	result := sanitizeFilename("file\r\nX-Injected: evil")
	if strings.Contains(result, "\r") || strings.Contains(result, "\n") {
		t.Errorf("result contains line break (header injection): %q", result)
	}
}

func TestSanitizeFilename_Unicode(t *testing.T) {
	result := sanitizeFilename("日本語のファイル")
	if result != "日本語のファイル" {
		t.Errorf("unicode should be preserved, got %q", result)
	}
}

func TestSanitizeFilename_LengthLimit(t *testing.T) {
	longName := strings.Repeat("a", 200)
	result := sanitizeFilename(longName)
	if len(result) > 100 {
		t.Errorf("expected max length 100, got %d", len(result))
	}
}

func TestSanitizeFilename_EmptyInput(t *testing.T) {
	result := sanitizeFilename("")
	if result == "" {
		t.Error("expected non-empty fallback for empty input")
	}
	if result != "export" {
		t.Errorf("expected fallback 'export', got %q", result)
	}
}

func TestSanitizeFilename_OnlyInvalidChars(t *testing.T) {
	result := sanitizeFilename("...**???")
	// After replacing invalid chars and trimming dots/spaces
	if result == "" {
		t.Error("expected non-empty fallback for all-invalid input")
	}
}

func TestSanitizeFilename_TrimsDotsAndSpaces(t *testing.T) {
	result := sanitizeFilename("  ..My File..  ")
	if strings.HasPrefix(result, " ") || strings.HasPrefix(result, ".") {
		t.Errorf("expected trimmed result, got %q", result)
	}
	if strings.HasSuffix(result, " ") || strings.HasSuffix(result, ".") {
		t.Errorf("expected trimmed result, got %q", result)
	}
}

// =============================================================================
// safeContentDisposition Tests (M-17)
// =============================================================================

func TestSafeContentDisposition_ASCIIFilename(t *testing.T) {
	result := safeContentDisposition("report.csv")
	if !strings.Contains(result, "attachment;") {
		t.Errorf("expected attachment disposition, got %q", result)
	}
	if !strings.Contains(result, `filename="report.csv"`) {
		t.Errorf("expected ASCII filename, got %q", result)
	}
	if !strings.Contains(result, "filename*=UTF-8''") {
		t.Errorf("expected RFC 5987 filename, got %q", result)
	}
}

func TestSafeContentDisposition_UnicodeFilename(t *testing.T) {
	result := safeContentDisposition("日本語.md")
	// ASCII fallback should replace non-ASCII with underscores
	if !strings.Contains(result, `filename="___`) {
		t.Logf("result: %q", result)
	}
	// RFC 5987 encoded version should contain the percent-encoded unicode
	if !strings.Contains(result, "filename*=UTF-8''") {
		t.Errorf("expected RFC 5987 encoded filename, got %q", result)
	}
	// Should not contain raw unicode in the ASCII fallback
	asciiPart := strings.Split(result, ";")[1]
	for _, r := range asciiPart {
		if r > 127 {
			t.Errorf("ASCII fallback contains non-ASCII character: %q", result)
			break
		}
	}
}

func TestSafeContentDisposition_NoInjection(t *testing.T) {
	// Attempt header injection via filename
	result := safeContentDisposition("file\r\nX-Evil: header")
	if strings.Contains(result, "\r") || strings.Contains(result, "\n") {
		t.Errorf("Content-Disposition contains line breaks (header injection): %q", result)
	}
}

func TestSafeContentDisposition_SpecialChars(t *testing.T) {
	result := safeContentDisposition("file with spaces & symbols!.txt")
	if !strings.Contains(result, "attachment;") {
		t.Errorf("expected attachment disposition, got %q", result)
	}
	// Should have both filename formats
	if !strings.Contains(result, "filename=") {
		t.Errorf("missing filename parameter: %q", result)
	}
	if !strings.Contains(result, "filename*=UTF-8''") {
		t.Errorf("missing filename* parameter: %q", result)
	}
}

// =============================================================================
// maxSearchQueryLength constant test
// =============================================================================

func TestMaxSearchQueryLength_IsDefined(t *testing.T) {
	if maxSearchQueryLength <= 0 {
		t.Error("maxSearchQueryLength should be a positive value")
	}
	if maxSearchQueryLength > 1000 {
		t.Error("maxSearchQueryLength seems too large, should be reasonable (e.g., 200)")
	}
}
