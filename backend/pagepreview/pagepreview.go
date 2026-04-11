package pagepreview

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
)

type Leaf struct {
	Text      string `json:"text"`
	Bold      bool   `json:"bold,omitempty"`
	Italic    bool   `json:"italic,omitempty"`
	Underline bool   `json:"underline,omitempty"`
	Strike    bool   `json:"strike,omitempty"`
	Code      bool   `json:"code,omitempty"`
	Highlight any    `json:"highlight,omitempty"`
	Href      string `json:"href,omitempty"`
}

type Block struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Depth    int    `json:"depth"`
	Checked  bool   `json:"checked,omitempty"`
	Children []Leaf `json:"children"`
}

type Derived struct {
	BodyText string
	Blocks   []Block
	Valid    bool
}

type rawBlock struct {
	ID    string       `json:"id"`
	Type  string       `json:"type"`
	Meta  rawMeta      `json:"meta"`
	Value []rawElement `json:"value"`
}

type rawMeta struct {
	Order int `json:"order"`
	Depth int `json:"depth"`
}

type rawElement struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Props    map[string]any `json:"props"`
	Checked  bool           `json:"checked"`
	Children []any          `json:"children"`
}

func Derive(content string, maxBlocks int) Derived {
	orderedBlocks, ok := parseContent(content)
	if !ok {
		return Derived{}
	}

	previewBlocks := make([]Block, 0, min(maxBlocks, len(orderedBlocks)))
	var bodyBuilder strings.Builder

	for _, block := range orderedBlocks {
		blockType := normalizeBlockType(block.Type, "")
		depth := block.Meta.Depth

		if blockType == "divider" && maxBlocks > 0 && len(previewBlocks) < maxBlocks {
			previewBlocks = append(previewBlocks, Block{
				ID:       blockID(block.ID, "divider", len(previewBlocks)),
				Type:     "divider",
				Depth:    depth,
				Children: []Leaf{},
			})
			continue
		}

		for index, element := range block.Value {
			leaves := extractLeaves(element.Children, "")
			hasText := false
			for _, leaf := range leaves {
				text := strings.TrimSpace(leaf.Text)
				if text == "" {
					continue
				}
				hasText = true
				if bodyBuilder.Len() > 0 {
					bodyBuilder.WriteByte(' ')
				}
				bodyBuilder.WriteString(text)
			}

			if maxBlocks <= 0 || len(previewBlocks) >= maxBlocks {
				continue
			}
			elementType := normalizeBlockType(block.Type, element.Type)
			if !hasText && elementType != "todo-list" {
				continue
			}

			checked := element.Checked
			if checkedValue, ok := element.Props["checked"].(bool); ok {
				checked = checkedValue
			}

			previewBlocks = append(previewBlocks, Block{
				ID:       blockID(element.ID, block.ID, index),
				Type:     elementType,
				Depth:    depth,
				Checked:  checked,
				Children: leaves,
			})
		}
	}

	if len(previewBlocks) == 0 {
		previewBlocks = nil
	}

	return Derived{
		BodyText: bodyBuilder.String(),
		Blocks:   previewBlocks,
		Valid:    true,
	}
}

func ExtractBodyText(content string) string {
	return Derive(content, 0).BodyText
}

func ExtractBlocks(content string, maxBlocks int) []Block {
	return Derive(content, maxBlocks).Blocks
}

func parseContent(content string) ([]rawBlock, bool) {
	if content == "" {
		return nil, false
	}

	var parsed map[string]rawBlock
	if err := json.Unmarshal([]byte(content), &parsed); err != nil {
		return nil, false
	}

	orderedBlocks := make([]rawBlock, 0, len(parsed))

	for key, block := range parsed {
		if key == "__rowLayout" {
			continue
		}
		if block.ID == "" {
			block.ID = key
		}
		orderedBlocks = append(orderedBlocks, block)
	}

	sort.Slice(orderedBlocks, func(i, j int) bool {
		return orderedBlocks[i].Meta.Order < orderedBlocks[j].Meta.Order
	})

	return orderedBlocks, true
}

func extractLeaves(nodes []any, inheritedHref string) []Leaf {
	if len(nodes) == 0 {
		return nil
	}

	leaves := make([]Leaf, 0, len(nodes))
	for _, node := range nodes {
		record, ok := node.(map[string]any)
		if !ok {
			continue
		}

		nextHref := inheritedHref
		for _, key := range []string{"href", "url", "link"} {
			if value, ok := record[key].(string); ok && value != "" {
				nextHref = value
				break
			}
		}

		if text, ok := record["text"].(string); ok {
			leaf := Leaf{Text: text, Href: nextHref}
			leaf.Bold = readBool(record, "bold")
			leaf.Italic = readBool(record, "italic")
			leaf.Underline = readBool(record, "underline")
			leaf.Strike = readBool(record, "strike")
			leaf.Code = readBool(record, "code")
			if highlight, ok := record["highlight"]; ok {
				leaf.Highlight = highlight
			}
			leaves = append(leaves, leaf)
			continue
		}

		if children, ok := record["children"].([]any); ok {
			leaves = append(leaves, extractLeaves(children, nextHref)...)
		}
	}

	if len(leaves) == 0 {
		return nil
	}

	return leaves
}

func normalizeBlockType(blockType string, elementType string) string {
	source := strings.ToLower(blockType + " " + elementType)

	switch {
	case strings.Contains(source, "headingone"), strings.Contains(source, "heading-one"):
		return "heading-one"
	case strings.Contains(source, "headingtwo"), strings.Contains(source, "heading-two"):
		return "heading-two"
	case strings.Contains(source, "headingthree"), strings.Contains(source, "heading-three"):
		return "heading-three"
	case strings.Contains(source, "blockquote"):
		return "blockquote"
	case strings.Contains(source, "callout"):
		return "callout"
	case strings.Contains(source, "code"):
		return "code"
	case strings.Contains(source, "divider"):
		return "divider"
	case strings.Contains(source, "bulleted"):
		return "bulleted-list"
	case strings.Contains(source, "numbered"):
		return "numbered-list"
	case strings.Contains(source, "todo"):
		return "todo-list"
	default:
		return "paragraph"
	}
}

func readBool(record map[string]any, key string) bool {
	value, ok := record[key].(bool)
	return ok && value
}

func blockID(primary string, fallback string, index int) string {
	if primary != "" {
		return primary
	}
	if fallback == "" {
		fallback = "preview"
	}
	return fmt.Sprintf("%s-preview-%d", fallback, index)
}

func min(a int, b int) int {
	if a < b {
		return a
	}
	return b
}
