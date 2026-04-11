package migrations

import (
	"github.com/pocketbase/pocketbase/core"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(app core.App) error {
		users, err := app.FindCollectionByNameOrId("users")
		if err != nil {
			return nil
		}

		planField := users.Fields.GetByName("plan")
		if planField == nil {
			return nil
		}

		users.Fields.RemoveById(planField.GetId())
		return app.Save(users)
	}, nil)
}