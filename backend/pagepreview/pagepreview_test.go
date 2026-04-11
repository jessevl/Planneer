package pagepreview

import "testing"

func TestExtractBlocksPreservesFormatting(t *testing.T) {
	content := `{
		"block-1": {
			"id": "block-1",
			"type": "HeadingOne",
			"meta": { "order": 0, "depth": 0 },
			"value": [
				{
					"id": "heading-1",
					"type": "heading-one",
					"children": [
						{ "text": "Important", "bold": true },
						{ "text": " title" }
					]
				}
			]
		},
		"block-2": {
			"id": "block-2",
			"type": "TodoList",
			"meta": { "order": 1, "depth": 1 },
			"value": [
				{
					"id": "todo-1",
					"type": "todo-list",
					"props": { "checked": true },
					"children": [{ "text": "Ship preview field" }]
				}
			]
		}
	}`

	blocks := ExtractBlocks(content, 4)
	if len(blocks) != 2 {
		t.Fatalf("expected 2 preview blocks, got %d", len(blocks))
	}
	if blocks[0].Type != "heading-one" {
		t.Fatalf("expected heading-one, got %s", blocks[0].Type)
	}
	if !blocks[0].Children[0].Bold {
		t.Fatal("expected first heading leaf to preserve bold formatting")
	}
	if blocks[1].Type != "todo-list" || !blocks[1].Checked {
		t.Fatal("expected checked todo preview block")
	}
}

func TestExtractBodyTextConcatenatesDocumentOrder(t *testing.T) {
	content := `{
		"b": {
			"id": "b",
			"type": "Paragraph",
			"meta": { "order": 1 },
			"value": [{ "children": [{ "text": "Second" }] }]
		},
		"a": {
			"id": "a",
			"type": "Paragraph",
			"meta": { "order": 0 },
			"value": [{ "children": [{ "text": "First" }] }]
		}
	}`

	if got := ExtractBodyText(content); got != "First Second" {
		t.Fatalf("expected ordered body text, got %q", got)
	}
}
