package templates

import "encoding/json"

// WorkspaceTemplate defines the structure for creating a new workspace
type WorkspaceTemplate struct {
	Name  string
	Slug  string
	Icon  string
	Color string
	Pages []PageTemplate
}

// SectionTemplate defines a kanban section/column
type SectionTemplate struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Color string `json:"color,omitempty"`
}

// PageTemplate defines the structure for creating a new page
type PageTemplate struct {
	Title            string
	Content          string // JSON string for Yoopta content
	Excerpt          string
	Icon             string // Lucide icon name in PascalCase (e.g., "Briefcase", "Home")
	Color            string
	CoverGradient    string // Gradient cover for visual appeal
	CoverImage       string // Image URL for cover
	CoverAttribution string // Attribution for cover image
	Order            int
	ViewMode         string // 'note', 'collection', 'tasks'
	ChildrenViewMode string // 'grid', 'list'
	ParentRef        string // Reference key for parent page (resolved after first pass)
	Sections         []SectionTemplate
	TasksViewMode    string // 'list', 'board'
	TasksGroupBy     string // 'section', 'dueDate', 'priority'
	Tasks            []TaskTemplate
	Children         []PageTemplate
	IsPinned         bool
}

// TaskTemplate defines the structure for creating a new task
type TaskTemplate struct {
	Title       string
	Description string
	Priority    string // "Low", "Medium", "High" or empty for no priority
	DueOffset   int    // Days from today (0=today, 1=tomorrow, -1=yesterday, etc.)
	SectionRef  string // References SectionTemplate.ID
	Recurrence  string // 'daily', 'weekly', 'monthly', etc.
	Subtasks    []SubtaskTemplate
	Tags        []string
}

// SubtaskTemplate defines the structure for subtasks
type SubtaskTemplate struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
}

// GetDefaultWorkspace returns the default workspace template for new users
// NOTE: Icons must be Lucide icon names in PascalCase (e.g., "Briefcase", "Rocket", "BookOpen")
// NOTE: Do NOT create an "Inbox" page - there's already a default inbox fallback
func GetDefaultWorkspace() WorkspaceTemplate {
	return WorkspaceTemplate{
		Name:  "My Workspace",
		Slug:  "my-workspace",
		Icon:  "Home",
		Color: "#6366f1",
		Pages: []PageTemplate{
			// ============================================
			// WORK COLLECTION - Professional Projects
			// ============================================
			{
				Title:            "Work",
				ViewMode:         "collection",
				Icon:             "Briefcase",
				Color:            "#3b82f6",
				CoverImage:       "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80",
				CoverAttribution: "Photo by John Doe on Unsplash",
				Order:            0,
				ChildrenViewMode: "gallery",
				IsPinned:         true,
				Children: []PageTemplate{
					{
						Title:         "Product Launch Q1",
						ViewMode:      "tasks",
						Icon:          "Rocket",
						Color:         "#ef4444",
						CoverGradient: "linear-gradient(135deg, #f12711 0%, #f5af19 100%)",
						Order:         0,
						TasksViewMode: "kanban",
						TasksGroupBy:  "section",
						Sections: []SectionTemplate{
							{ID: "launch-backlog", Title: "Backlog", Color: "#6b7280"},
							{ID: "launch-progress", Title: "In Progress", Color: "#3b82f6"},
							{ID: "launch-review", Title: "In Review", Color: "#f59e0b"},
							{ID: "launch-done", Title: "Done", Color: "#10b981"},
						},
						Tasks: []TaskTemplate{
							{
								Title:       "Finalize product roadmap",
								Description: "Review and finalize the Q1 product roadmap with stakeholders",
								Priority:    "High",
								DueOffset:   3,
								SectionRef:  "launch-progress",
								Tags:        []string{"planning", "high-priority"},
								Subtasks: []SubtaskTemplate{
									{Title: "Gather team input", Completed: true},
									{Title: "Review with PM", Completed: true},
									{Title: "Get stakeholder approval", Completed: false},
									{Title: "Publish to team", Completed: false},
								},
							},
							{
								Title:       "Design landing page mockups",
								Description: "Create high-fidelity mockups for the new landing page",
								Priority:    "High",
								DueOffset:   5,
								SectionRef:  "launch-progress",
								Tags:        []string{"design"},
								Subtasks: []SubtaskTemplate{
									{Title: "Hero section", Completed: true},
									{Title: "Features section", Completed: false},
									{Title: "Pricing section", Completed: false},
									{Title: "Mobile responsive", Completed: false},
								},
							},
							{
								Title:      "Write product announcement",
								Priority:   "Medium",
								DueOffset:  7,
								SectionRef: "launch-backlog",
								Tags:       []string{"marketing", "content"},
							},
							{
								Title:      "Set up analytics tracking",
								Priority:   "High",
								SectionRef: "launch-review",
								Tags:       []string{"tech"},
							},
							{
								Title:      "Create demo video",
								Priority:   "Medium",
								DueOffset:  10,
								SectionRef: "launch-backlog",
								Tags:       []string{"marketing", "video"},
							},
							{
								Title:      "Beta user feedback review",
								Priority:   "High",
								SectionRef: "launch-done",
								Tags:       []string{"research"},
							},
						},
					},
					{
						Title:         "Weekly Planning",
						ViewMode:      "tasks",
						Icon:          "CalendarDays",
						Color:         "#8b5cf6",
						CoverGradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
						Order:         1,
						TasksViewMode: "list",
						TasksGroupBy:  "date",
						Tasks: []TaskTemplate{
							{
								Title:      "Monday standup prep",
								Priority:   "High",
								DueOffset:  1,
								Recurrence: "weekly",
							},
							{
								Title:      "Review team PRs",
								Priority:   "High",
								DueOffset:  0,
								Recurrence: "daily",
								Tags:       []string{"code-review"},
							},
							{
								Title:       "1:1 with manager",
								Description: "Discuss Q1 goals and career development",
								Priority:    "High",
								DueOffset:   2,
								Recurrence:  "weekly",
							},
							{
								Title:      "Update project status",
								Priority:   "Medium",
								DueOffset:  4,
								Recurrence: "weekly",
							},
						},
					},
					{
						Title:      "Project Notes",
						ViewMode:   "note",
						Icon:       "FileText",
						Color:      "#06b6d4",
						CoverImage: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=1400&q=80",
						Content:    projectNotesContent,
						Excerpt:    "Technical documentation and project context",
						Order:      2,
						Children: []PageTemplate{
							{
								Title:    "Architecture",
								ViewMode: "note",
								Icon:     "Layers",
								Color:    "#06b6d4",
								Content:  emptyNoteContent,
								Excerpt:  "System architecture overview",
								Order:    0,
							},
							{
								Title:    "API Specs",
								ViewMode: "note",
								Icon:     "Webhook",
								Color:    "#06b6d4",
								Content:  emptyNoteContent,
								Excerpt:  "Backend API documentation",
								Order:    1,
							},
						},
					},
					{
						Title:         "Design System",
						ViewMode:      "note",
						Icon:          "Palette",
						Color:         "#ec4899",
						CoverGradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
						Order:         3,
						Content:       emptyNoteContent,
						Excerpt:       "Visual design system exploration and wireframes",
					},
				},
			},

			// ============================================
			// PERSONAL COLLECTION - Life & Hobbies
			// ============================================
			{
				Title:            "Personal",
				ViewMode:         "collection",
				Icon:             "Home",
				Color:            "#10b981",
				CoverImage:       "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1400&q=80",
				Order:            1,
				ChildrenViewMode: "list",
				IsPinned:         true,
				Children: []PageTemplate{
					{
						Title:         "Daily Habits",
						ViewMode:      "tasks",
						Icon:          "CheckCircle2",
						Color:         "#22c55e",
						CoverGradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
						Order:         0,
						TasksViewMode: "list",
						Sections: []SectionTemplate{
							{ID: "habits-morning", Title: "Morning", Color: "#f59e0b"},
							{ID: "habits-afternoon", Title: "Afternoon", Color: "#3b82f6"},
							{ID: "habits-evening", Title: "Evening", Color: "#8b5cf6"},
						},
						Tasks: []TaskTemplate{
							{
								Title:      "Morning meditation",
								Priority:   "Medium",
								DueOffset:  1,
								SectionRef: "habits-morning",
								Recurrence: "daily",
								Tags:       []string{"wellness", "mindfulness"},
							},
							{
								Title:      "Exercise 30 min",
								Priority:   "High",
								DueOffset:  0,
								SectionRef: "habits-morning",
								Recurrence: "daily",
								Tags:       []string{"fitness", "health"},
							},
							{
								Title:      "Read for 20 minutes",
								Priority:   "Low",
								DueOffset:  2,
								SectionRef: "habits-evening",
								Recurrence: "daily",
								Tags:       []string{"learning"},
							},
							{
								Title:      "Journal reflection",
								Priority:   "Medium",
								DueOffset:  3,
								SectionRef: "habits-evening",
								Recurrence: "daily",
								Tags:       []string{"mindfulness"},
							},
							{
								Title:      "Walk outside",
								Priority:   "Medium",
								DueOffset:  1,
								SectionRef: "habits-afternoon",
								Recurrence: "daily",
								Tags:       []string{"health", "wellness"},
							},
						},
					},
					{
						Title:         "Shopping List",
						ViewMode:      "tasks",
						Icon:          "ClipboardList",
						Color:         "#f97316",
						CoverGradient: "linear-gradient(135deg, #FAD961 0%, #F76B1C 100%)",
						Order:         1,
						TasksViewMode: "list",
						Sections: []SectionTemplate{
							{ID: "shop-groceries", Title: "Groceries", Color: "#22c55e"},
							{ID: "shop-household", Title: "Household", Color: "#3b82f6"},
							{ID: "shop-other", Title: "Other", Color: "#6b7280"},
						},
						Tasks: []TaskTemplate{
							{
								Title:      "Weekly groceries",
								Priority:   "Medium",
								DueOffset:  2,
								SectionRef: "shop-groceries",
								Subtasks: []SubtaskTemplate{
									{Title: "Milk", Completed: false},
									{Title: "Bread", Completed: false},
									{Title: "Eggs", Completed: true},
									{Title: "Butter", Completed: false},
									{Title: "Vegetables", Completed: false},
								},
							},
							{
								Title:      "Household supplies",
								Priority:   "Low",
								DueOffset:  5,
								SectionRef: "shop-household",
								Subtasks: []SubtaskTemplate{
									{Title: "Paper towels", Completed: false},
									{Title: "Laundry detergent", Completed: false},
								},
							},
						},
					},
					{
						Title:         "2024 Goals",
						ViewMode:      "note",
						Icon:          "Target",
						Color:         "#a855f7",
						CoverGradient: "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",
						Content:       goalsContent,
						Excerpt:       "Personal and professional goals for the year",
						Order:         2,
					},
					{
						Title:            "Reading List",
						ViewMode:         "collection",
						Icon:             "BookOpen",
						Color:            "#6366f1",
						CoverImage:       "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1400&q=80",
						Order:            3,
						ChildrenViewMode: "gallery",
						Children: []PageTemplate{
							{
								Title:         "Atomic Habits",
								ViewMode:      "note",
								Icon:          "Book",
								Color:         "#22c55e",
								CoverGradient: "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)",
								Content:       bookNotesContent,
								Excerpt:       "Notes on building better habits",
								Order:         0,
							},
							{
								Title:         "Deep Work",
								ViewMode:      "note",
								Icon:          "Book",
								Color:         "#3b82f6",
								CoverGradient: "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
								Content:       emptyNoteContent,
								Excerpt:       "Focus and productivity in a distracted world",
								Order:         1,
							},
						},
					},
				},
			},

			// ============================================
			// LEARNING COLLECTION - Skills & Knowledge
			// ============================================
			{
				Title:            "Learning",
				ViewMode:         "collection",
				Icon:             "GraduationCap",
				Color:            "#f59e0b",
				CoverImage:       "https://images.unsplash.com/photo-1462332420958-a05d1e002413?w=1400&q=80",
				Order:            2,
				ChildrenViewMode: "gallery",
				Children: []PageTemplate{
					{
						Title:         "Coding Projects",
						ViewMode:      "tasks",
						Icon:          "Code2",
						Color:         "#0ea5e9",
						CoverGradient: "linear-gradient(135deg, #0093E9 0%, #80D0C7 100%)",
						Order:         0,
						TasksViewMode: "kanban",
						TasksGroupBy:  "section",
						Sections: []SectionTemplate{
							{ID: "code-ideas", Title: "Ideas", Color: "#f59e0b"},
							{ID: "code-learning", Title: "Learning", Color: "#8b5cf6"},
							{ID: "code-building", Title: "Building", Color: "#3b82f6"},
							{ID: "code-shipped", Title: "Shipped", Color: "#10b981"},
						},
						Tasks: []TaskTemplate{
							{
								Title:       "Build a weather dashboard",
								Description: "Practice API integration with a weather app",
								Priority:    "Medium",
								SectionRef:  "code-ideas",
								Tags:        []string{"api", "react"},
							},
							{
								Title:       "Learn TypeScript generics",
								Description: "Deep dive into advanced TypeScript patterns",
								Priority:    "High",
								SectionRef:  "code-learning",
								Tags:        []string{"typescript"},
								Subtasks: []SubtaskTemplate{
									{Title: "Read documentation", Completed: true},
									{Title: "Practice exercises", Completed: false},
									{Title: "Build example project", Completed: false},
								},
							},
							{
								Title:       "Contribute to open source",
								Description: "Find a project and make a meaningful contribution",
								Priority:    "Medium",
								SectionRef:  "code-ideas",
								Tags:        []string{"open-source"},
							},
						},
					},
					{
						Title:         "Course Notes",
						ViewMode:      "note",
						Icon:          "NotebookPen",
						Color:         "#14b8a6",
						CoverGradient: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
						Content:       courseNotesContent,
						Excerpt:       "Notes from online courses and tutorials",
						Order:         1,
					},
					{
						Title:         "Design Inspiration",
						ViewMode:      "note",
						Icon:          "Sparkles",
						Color:         "#d946ef",
						CoverGradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
						Order:         2,
						Content:       emptyNoteContent,
						Excerpt:       "Mood boards and design exploration",
					},
				},
			},

			// ============================================
			// QUICK NOTES COLLECTION
			// ============================================
			{
				Title:            "Quick Notes",
				ViewMode:         "collection",
				Icon:             "FileText",
				Color:            "#10b981",
				CoverImage:       "https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=1400&q=80",
				Order:            3,
				IsPinned:         true,
				ChildrenViewMode: "gallery",
				Children: []PageTemplate{
					{
						Title:         "Meeting Notes Template",
						ViewMode:      "note",
						Icon:          "Users",
						Color:         "#3b82f6",
						CoverGradient: "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
						Content:       meetingNotesContent,
						Excerpt:       "A template for capturing meeting notes effectively",
						Order:         0,
					},
					{
						Title:         "Ideas & Brainstorms",
						ViewMode:      "note",
						Icon:          "Lightbulb",
						Color:         "#f59e0b",
						CoverGradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
						Content:       ideasContent,
						Excerpt:       "Capture your creative ideas here",
						Order:         1,
					},
				},
			},

			// ============================================
			// GETTING STARTED GUIDE
			// ============================================
			{
				Title:      "Getting Started with Planneer",
				ViewMode:   "note",
				Icon:       "Rocket",
				Color:      "#6366f1",
				CoverImage: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1400&q=80",
				Order:      4,
				Content:    gettingStartedContent,
				Excerpt:    "Learn how to make the most of Planneer",
				IsPinned:   true,
				Children: []PageTemplate{
					{
						Title:    "Keyboard Shortcuts",
						ViewMode: "note",
						Icon:     "Keyboard",
						Color:    "#6366f1",
						Content:  keyboardShortcutsContent,
						Excerpt:  "Master Planneer with keyboard shortcuts",
						Order:    0,
					},
					{
						Title:    "Markdown Guide",
						ViewMode: "note",
						Icon:     "FileCode",
						Color:    "#6366f1",
						Content:  markdownGuideContent,
						Excerpt:  "How to use Markdown in the editor",
						Order:    1,
					},
				},
			},
		},
	}
}

// ============================================
// RICH CONTENT TEMPLATES
// ============================================

var gettingStartedContent = mustMarshal(map[string]interface{}{
	"welcome-block": map[string]interface{}{
		"id":   "welcome-block",
		"type": "HeadingOne",
		"value": []map[string]interface{}{
			{
				"id":   "welcome-text",
				"type": "heading-one",
				"children": []map[string]interface{}{
					{"text": "Welcome to Planneer!"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 0, "depth": 0},
	},
	"intro-para": map[string]interface{}{
		"id":   "intro-para",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "intro-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Planneer combines the best of task management, note-taking, and visual thinking in one powerful app. Here's how to get started:"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 1, "depth": 0},
	},
	"features-heading": map[string]interface{}{
		"id":   "features-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "features-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Key Features"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 2, "depth": 0},
	},
	"feature-1": map[string]interface{}{
		"id":   "feature-1",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-1",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Task Management", "bold": true},
					{"text": " - Create task lists with sections, due dates, priorities, and recurring tasks"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 3, "depth": 0},
	},
	"feature-2": map[string]interface{}{
		"id":   "feature-2",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-2",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Rich Notes", "bold": true},
					{"text": " - Write beautiful documents with formatting, checklists, and more"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 4, "depth": 0},
	},
	"feature-3": map[string]interface{}{
		"id":   "feature-3",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-3",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Whiteboards", "bold": true},
					{"text": " - Visualize ideas with infinite canvas drawing"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 5, "depth": 0},
	},
	"feature-4": map[string]interface{}{
		"id":   "feature-4",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-4",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Collections", "bold": true},
					{"text": " - Organize pages hierarchically in folders"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 6, "depth": 0},
	},
	"feature-5": map[string]interface{}{
		"id":   "feature-5",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-5",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Daily Journal", "bold": true},
					{"text": " - Reflect on your day with the daily journal view"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 7, "depth": 0},
	},
	"offline-heading": map[string]interface{}{
		"id":   "offline-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "offline-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Privacy-First & Offline"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 8, "depth": 0},
	},
	"offline-para": map[string]interface{}{
		"id":   "offline-para",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "offline-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Planneer works offline and syncs when you're back online. Your data is stored on European servers with full GDPR compliance. We never share your data with third parties."},
				},
			},
		},
		"meta": map[string]interface{}{"order": 9, "depth": 0},
	},
	"tips-heading": map[string]interface{}{
		"id":   "tips-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "tips-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Pro Tips"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 10, "depth": 0},
	},
	"tip-1": map[string]interface{}{
		"id":   "tip-1",
		"type": "NumberedList",
		"value": []map[string]interface{}{
			{
				"id":   "num-1",
				"type": "numbered-list",
				"children": []map[string]interface{}{
					{"text": "Use "},
					{"text": "Cmd/Ctrl + K", "bold": true},
					{"text": " to quickly search and navigate"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 11, "depth": 0},
	},
	"tip-2": map[string]interface{}{
		"id":   "tip-2",
		"type": "NumberedList",
		"value": []map[string]interface{}{
			{
				"id":   "num-2",
				"type": "numbered-list",
				"children": []map[string]interface{}{
					{"text": "Pin your most-used pages to the sidebar for quick access"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 12, "depth": 0},
	},
	"tip-3": map[string]interface{}{
		"id":   "tip-3",
		"type": "NumberedList",
		"value": []map[string]interface{}{
			{
				"id":   "num-3",
				"type": "numbered-list",
				"children": []map[string]interface{}{
					{"text": "Use sections in task lists to create kanban-style boards"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 13, "depth": 0},
	},
	"tip-4": map[string]interface{}{
		"id":   "tip-4",
		"type": "NumberedList",
		"value": []map[string]interface{}{
			{
				"id":   "num-4",
				"type": "numbered-list",
				"children": []map[string]interface{}{
					{"text": "Set up recurring tasks for habits and regular reviews"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 14, "depth": 0},
	},
})

var meetingNotesContent = mustMarshal(map[string]interface{}{
	"heading": map[string]interface{}{
		"id":   "heading",
		"type": "HeadingOne",
		"value": []map[string]interface{}{
			{
				"id":   "heading-text",
				"type": "heading-one",
				"children": []map[string]interface{}{
					{"text": "Meeting Notes Template"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 0, "depth": 0},
	},
	"date": map[string]interface{}{
		"id":   "date",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "date-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Date: ", "bold": true},
					{"text": "[Add date]"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 1, "depth": 0},
	},
	"attendees": map[string]interface{}{
		"id":   "attendees",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "attendees-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Attendees: ", "bold": true},
					{"text": "[List attendees]"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 2, "depth": 0},
	},
	"agenda-heading": map[string]interface{}{
		"id":   "agenda-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "agenda-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Agenda"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 3, "depth": 0},
	},
	"agenda-item": map[string]interface{}{
		"id":   "agenda-item",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "agenda-bullet",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Topic 1"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 4, "depth": 0},
	},
	"notes-heading": map[string]interface{}{
		"id":   "notes-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "notes-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Notes"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 5, "depth": 0},
	},
	"notes-para": map[string]interface{}{
		"id":   "notes-para",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "notes-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Add your meeting notes here..."},
				},
			},
		},
		"meta": map[string]interface{}{"order": 6, "depth": 0},
	},
	"actions-heading": map[string]interface{}{
		"id":   "actions-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "actions-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Action Items"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 7, "depth": 0},
	},
	"action-item": map[string]interface{}{
		"id":   "action-item",
		"type": "TodoList",
		"value": []map[string]interface{}{
			{
				"id":   "todo-1",
				"type": "todo-list",
				"children": []map[string]interface{}{
					{"text": "Follow up with stakeholders"},
				},
				"props": map[string]interface{}{"checked": false},
			},
		},
		"meta": map[string]interface{}{"order": 8, "depth": 0},
	},
})

var ideasContent = mustMarshal(map[string]interface{}{
	"heading": map[string]interface{}{
		"id":   "heading",
		"type": "HeadingOne",
		"value": []map[string]interface{}{
			{
				"id":   "heading-text",
				"type": "heading-one",
				"children": []map[string]interface{}{
					{"text": "Ideas & Brainstorms"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 0, "depth": 0},
	},
	"intro": map[string]interface{}{
		"id":   "intro",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "intro-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Capture your ideas before they disappear! No idea is too small or too wild."},
				},
			},
		},
		"meta": map[string]interface{}{"order": 1, "depth": 0},
	},
	"ideas-heading": map[string]interface{}{
		"id":   "ideas-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "ideas-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Project Ideas"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 2, "depth": 0},
	},
	"idea-1": map[string]interface{}{
		"id":   "idea-1",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-1",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Build a habit tracker with streaks and rewards"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 3, "depth": 0},
	},
	"idea-2": map[string]interface{}{
		"id":   "idea-2",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-2",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Create a personal knowledge base"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 4, "depth": 0},
	},
	"random-heading": map[string]interface{}{
		"id":   "random-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "random-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Random Thoughts"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 5, "depth": 0},
	},
	"thought-1": map[string]interface{}{
		"id":   "thought-1",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "thought-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "What if productivity apps focused less on tracking and more on reducing friction?"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 6, "depth": 0},
	},
})

var projectNotesContent = mustMarshal(map[string]interface{}{
	"heading": map[string]interface{}{
		"id":   "heading",
		"type": "HeadingOne",
		"value": []map[string]interface{}{
			{
				"id":   "heading-text",
				"type": "heading-one",
				"children": []map[string]interface{}{
					{"text": "Project Notes"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 0, "depth": 0},
	},
	"overview": map[string]interface{}{
		"id":   "overview",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "overview-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Overview"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 1, "depth": 0},
	},
	"overview-content": map[string]interface{}{
		"id":   "overview-content",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "overview-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "This document contains technical notes, decisions, and context for the project."},
				},
			},
		},
		"meta": map[string]interface{}{"order": 2, "depth": 0},
	},
	"decisions-heading": map[string]interface{}{
		"id":   "decisions-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "decisions-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Key Decisions"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 3, "depth": 0},
	},
	"decision-1": map[string]interface{}{
		"id":   "decision-1",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-1",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Using React 19 for frontend - stable, well-supported"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 4, "depth": 0},
	},
	"decision-2": map[string]interface{}{
		"id":   "decision-2",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-2",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "PocketBase for backend - simple, SQLite-based, easy deployment"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 5, "depth": 0},
	},
	"links-heading": map[string]interface{}{
		"id":   "links-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "links-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Resources"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 6, "depth": 0},
	},
	"link-1": map[string]interface{}{
		"id":   "link-1",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "link-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Add relevant links and documentation here..."},
				},
			},
		},
		"meta": map[string]interface{}{"order": 7, "depth": 0},
	},
})

var goalsContent = mustMarshal(map[string]interface{}{
	"heading": map[string]interface{}{
		"id":   "heading",
		"type": "HeadingOne",
		"value": []map[string]interface{}{
			{
				"id":   "heading-text",
				"type": "heading-one",
				"children": []map[string]interface{}{
					{"text": "2024 Goals"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 0, "depth": 0},
	},
	"intro": map[string]interface{}{
		"id":   "intro",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "intro-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "My personal and professional goals for this year."},
				},
			},
		},
		"meta": map[string]interface{}{"order": 1, "depth": 0},
	},
	"career-heading": map[string]interface{}{
		"id":   "career-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "career-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Career"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 2, "depth": 0},
	},
	"career-1": map[string]interface{}{
		"id":   "career-1",
		"type": "TodoList",
		"value": []map[string]interface{}{
			{
				"id":   "todo-1",
				"type": "todo-list",
				"children": []map[string]interface{}{
					{"text": "Lead a major project from start to finish"},
				},
				"props": map[string]interface{}{"checked": false},
			},
		},
		"meta": map[string]interface{}{"order": 3, "depth": 0},
	},
	"career-2": map[string]interface{}{
		"id":   "career-2",
		"type": "TodoList",
		"value": []map[string]interface{}{
			{
				"id":   "todo-2",
				"type": "todo-list",
				"children": []map[string]interface{}{
					{"text": "Improve public speaking skills"},
				},
				"props": map[string]interface{}{"checked": false},
			},
		},
		"meta": map[string]interface{}{"order": 4, "depth": 0},
	},
	"health-heading": map[string]interface{}{
		"id":   "health-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "health-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Health & Fitness"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 5, "depth": 0},
	},
	"health-1": map[string]interface{}{
		"id":   "health-1",
		"type": "TodoList",
		"value": []map[string]interface{}{
			{
				"id":   "todo-3",
				"type": "todo-list",
				"children": []map[string]interface{}{
					{"text": "Exercise 4x per week consistently"},
				},
				"props": map[string]interface{}{"checked": false},
			},
		},
		"meta": map[string]interface{}{"order": 6, "depth": 0},
	},
	"health-2": map[string]interface{}{
		"id":   "health-2",
		"type": "TodoList",
		"value": []map[string]interface{}{
			{
				"id":   "todo-4",
				"type": "todo-list",
				"children": []map[string]interface{}{
					{"text": "Complete a 5K run"},
				},
				"props": map[string]interface{}{"checked": false},
			},
		},
		"meta": map[string]interface{}{"order": 7, "depth": 0},
	},
	"learning-heading": map[string]interface{}{
		"id":   "learning-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "learning-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Learning"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 8, "depth": 0},
	},
	"learning-1": map[string]interface{}{
		"id":   "learning-1",
		"type": "TodoList",
		"value": []map[string]interface{}{
			{
				"id":   "todo-5",
				"type": "todo-list",
				"children": []map[string]interface{}{
					{"text": "Read 24 books"},
				},
				"props": map[string]interface{}{"checked": false},
			},
		},
		"meta": map[string]interface{}{"order": 9, "depth": 0},
	},
	"learning-2": map[string]interface{}{
		"id":   "learning-2",
		"type": "TodoList",
		"value": []map[string]interface{}{
			{
				"id":   "todo-6",
				"type": "todo-list",
				"children": []map[string]interface{}{
					{"text": "Learn a new programming language"},
				},
				"props": map[string]interface{}{"checked": false},
			},
		},
		"meta": map[string]interface{}{"order": 10, "depth": 0},
	},
})

var bookNotesContent = mustMarshal(map[string]interface{}{
	"heading": map[string]interface{}{
		"id":   "heading",
		"type": "HeadingOne",
		"value": []map[string]interface{}{
			{
				"id":   "heading-text",
				"type": "heading-one",
				"children": []map[string]interface{}{
					{"text": "Atomic Habits"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 0, "depth": 0},
	},
	"author": map[string]interface{}{
		"id":   "author",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "author-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "By James Clear", "italic": true},
				},
			},
		},
		"meta": map[string]interface{}{"order": 1, "depth": 0},
	},
	"summary-heading": map[string]interface{}{
		"id":   "summary-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "summary-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Key Takeaways"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 2, "depth": 0},
	},
	"takeaway-1": map[string]interface{}{
		"id":   "takeaway-1",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-1",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Habits are the compound interest of self-improvement", "bold": true},
				},
			},
		},
		"meta": map[string]interface{}{"order": 3, "depth": 0},
	},
	"takeaway-2": map[string]interface{}{
		"id":   "takeaway-2",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-2",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Focus on systems, not goals"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 4, "depth": 0},
	},
	"takeaway-3": map[string]interface{}{
		"id":   "takeaway-3",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-3",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "The four laws: Make it obvious, attractive, easy, and satisfying"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 5, "depth": 0},
	},
	"quote-heading": map[string]interface{}{
		"id":   "quote-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "quote-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Favorite Quote"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 6, "depth": 0},
	},
	"quote": map[string]interface{}{
		"id":   "quote",
		"type": "Blockquote",
		"value": []map[string]interface{}{
			{
				"id":   "quote-text",
				"type": "blockquote",
				"children": []map[string]interface{}{
					{"text": "You do not rise to the level of your goals. You fall to the level of your systems."},
				},
			},
		},
		"meta": map[string]interface{}{"order": 7, "depth": 0},
	},
})

var courseNotesContent = mustMarshal(map[string]interface{}{
	"heading": map[string]interface{}{
		"id":   "heading",
		"type": "HeadingOne",
		"value": []map[string]interface{}{
			{
				"id":   "heading-text",
				"type": "heading-one",
				"children": []map[string]interface{}{
					{"text": "Course Notes"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 0, "depth": 0},
	},
	"intro": map[string]interface{}{
		"id":   "intro",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "intro-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Notes from online courses, tutorials, and learning resources."},
				},
			},
		},
		"meta": map[string]interface{}{"order": 1, "depth": 0},
	},
	"course-heading": map[string]interface{}{
		"id":   "course-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "course-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Current Course: [Course Name]"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 2, "depth": 0},
	},
	"progress": map[string]interface{}{
		"id":   "progress",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "progress-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Progress: ", "bold": true},
					{"text": "Module 1 of 10"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 3, "depth": 0},
	},
	"notes-heading": map[string]interface{}{
		"id":   "notes-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "notes-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Notes"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 4, "depth": 0},
	},
	"notes-content": map[string]interface{}{
		"id":   "notes-content",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "notes-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Add your course notes here as you learn..."},
				},
			},
		},
		"meta": map[string]interface{}{"order": 5, "depth": 0},
	},
})

var emptyNoteContent = mustMarshal(map[string]interface{}{
	"paragraph": map[string]interface{}{
		"id":   "paragraph",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": ""},
				},
			},
		},
		"meta": map[string]interface{}{"order": 0, "depth": 0},
	},
})


var keyboardShortcutsContent = mustMarshal(map[string]interface{}{
	"heading": map[string]interface{}{
		"id":   "heading",
		"type": "HeadingOne",
		"value": []map[string]interface{}{
			{
				"id":   "heading-text",
				"type": "heading-one",
				"children": []map[string]interface{}{
					{"text": "Keyboard Shortcuts"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 0, "depth": 0},
	},
	"intro": map[string]interface{}{
		"id":   "intro",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "intro-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Master Planneer with these essential keyboard shortcuts:"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 1, "depth": 0},
	},
	"general-heading": map[string]interface{}{
		"id":   "general-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "general-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "General"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 2, "depth": 0},
	},
	"shortcut-1": map[string]interface{}{
		"id":   "shortcut-1",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-1",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Cmd/Ctrl + K", "bold": true},
					{"text": " - Open Command Palette / Search"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 3, "depth": 0},
	},
	"shortcut-2": map[string]interface{}{
		"id":   "shortcut-2",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-2",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Cmd/Ctrl + /", "bold": true},
					{"text": " - Toggle Sidebar"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 4, "depth": 0},
	},
	"shortcut-3": map[string]interface{}{
		"id":   "shortcut-3",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-3",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Cmd/Ctrl + Alt + N", "bold": true},
					{"text": " - Create New Note"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 5, "depth": 0},
	},
	"editor-heading": map[string]interface{}{
		"id":   "editor-heading",
		"type": "HeadingTwo",
		"value": []map[string]interface{}{
			{
				"id":   "editor-title",
				"type": "heading-two",
				"children": []map[string]interface{}{
					{"text": "Editor"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 6, "depth": 0},
	},
	"shortcut-4": map[string]interface{}{
		"id":   "shortcut-4",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-4",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "/", "bold": true},
					{"text": " - Open Slash Command Menu"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 7, "depth": 0},
	},
	"shortcut-5": map[string]interface{}{
		"id":   "shortcut-5",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-5",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Cmd/Ctrl + B", "bold": true},
					{"text": " - Bold Text"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 8, "depth": 0},
	},
	"shortcut-6": map[string]interface{}{
		"id":   "shortcut-6",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-6",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "Cmd/Ctrl + I", "bold": true},
					{"text": " - Italic Text"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 9, "depth": 0},
	},
})

var markdownGuideContent = mustMarshal(map[string]interface{}{
	"heading": map[string]interface{}{
		"id":   "heading",
		"type": "HeadingOne",
		"value": []map[string]interface{}{
			{
				"id":   "heading-text",
				"type": "heading-one",
				"children": []map[string]interface{}{
					{"text": "Markdown Guide"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 0, "depth": 0},
	},
	"intro": map[string]interface{}{
		"id":   "intro",
		"type": "Paragraph",
		"value": []map[string]interface{}{
			{
				"id":   "intro-text",
				"type": "paragraph",
				"children": []map[string]interface{}{
					{"text": "Planneer supports standard Markdown shortcuts for fast writing:"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 1, "depth": 0},
	},
	"md-1": map[string]interface{}{
		"id":   "md-1",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-1",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "# ", "bold": true},
					{"text": " - Heading 1"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 2, "depth": 0},
	},
	"md-2": map[string]interface{}{
		"id":   "md-2",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-2",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "## ", "bold": true},
					{"text": " - Heading 2"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 3, "depth": 0},
	},
	"md-3": map[string]interface{}{
		"id":   "md-3",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-3",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "### ", "bold": true},
					{"text": " - Heading 3"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 4, "depth": 0},
	},
	"md-4": map[string]interface{}{
		"id":   "md-4",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-4",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "- ", "bold": true},
					{"text": " or "},
					{"text": "* ", "bold": true},
					{"text": " - Bullet List"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 5, "depth": 0},
	},
	"md-5": map[string]interface{}{
		"id":   "md-5",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-5",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "1. ", "bold": true},
					{"text": " - Numbered List"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 6, "depth": 0},
	},
	"md-6": map[string]interface{}{
		"id":   "md-6",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-6",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "[] ", "bold": true},
					{"text": " - Todo List"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 7, "depth": 0},
	},
	"md-7": map[string]interface{}{
		"id":   "md-7",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-7",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "> ", "bold": true},
					{"text": " - Blockquote"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 8, "depth": 0},
	},
	"md-8": map[string]interface{}{
		"id":   "md-8",
		"type": "BulletedList",
		"value": []map[string]interface{}{
			{
				"id":   "bullet-8",
				"type": "bulleted-list",
				"children": []map[string]interface{}{
					{"text": "---", "bold": true},
					{"text": " - Divider"},
				},
			},
		},
		"meta": map[string]interface{}{"order": 9, "depth": 0},
	},
})

// mustMarshal marshals the content and panics on error (for static initialization)
func mustMarshal(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return string(b)
}
