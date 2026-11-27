package integration_test

import (
	"context"
	"testing"

	"github.com/line/eduhub-backend/internal/audit"
	"github.com/line/eduhub-backend/internal/modules/catalog"
	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
)

func newCatalog(db *gorm.DB) *catalog.Service {
	return catalog.NewService(catalog.NewRepository(db), audit.New())
}

// publishBranch добавляет опубликованный филиал центра и его направление.
func publishBranch(t *testing.T, db *gorm.DB, centerID int64, branch, city, district string, lat, lng float64, direction string) {
	t.Helper()
	err := db.Exec(`INSERT INTO branch_submissions
		(center_id, branch, city, district, address, phone, gps_lat, gps_lng, geo_lat, geo_lng, desc_ru, desc_tj, desc_en, status)
		VALUES (?, ?, ?, ?, 'ул. Тест, 1', '+992 90 000 00 00', ?, ?, ?, ?, 'Описание', 'Тавсиф', '', 'published')`,
		centerID, branch, city, district, lat, lng, lat, lng).Error
	if err != nil {
		t.Fatalf("публикация филиала: %v", err)
	}
	if direction != "" {
		if err := db.Exec(`INSERT INTO center_profiles (center_id, direction) VALUES (?, ?)
			ON CONFLICT (center_id) DO UPDATE SET direction = excluded.direction`, centerID, direction).Error; err != nil {
			t.Fatalf("профиль центра: %v", err)
		}
	}
}

func TestCatalogBranchesFilterAndDistance(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	near := makeCenter(t, db, "pro", 0, 0, 0)  // Душанбе
	far := makeCenter(t, db, "pro", 0, 0, 0)    // Худжанд
	publishBranch(t, db, near, "Центральный", "Душанбе", "Сино", 38.5600, 68.7900, "Математика")
	publishBranch(t, db, far, "Главный", "Худжанд", "Центр", 40.2800, 69.6200, "Английский язык")
	// Неопубликованный филиал в каталог не попадает.
	hidden := makeCenter(t, db, "pro", 0, 0, 0)
	if err := db.Exec(`INSERT INTO branch_submissions
		(center_id, branch, city, district, address, gps_lat, gps_lng, geo_lat, geo_lng, status)
		VALUES (?, 'Черновик', 'Душанбе', 'Сино', 'ул. 2', 38.5, 68.7, 38.5, 68.7, 'pending')`, hidden).Error; err != nil {
		t.Fatal(err)
	}
	svc := newCatalog(db)
	ctx := context.Background()

	all, err := svc.Branches(ctx, nil, nil, catalog.BranchFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 2 {
		t.Fatalf("в каталоге должно быть 2 опубликованных филиала, got %d", len(all))
	}

	// Фильтр по городу.
	dush, err := svc.Branches(ctx, nil, nil, catalog.BranchFilter{City: "Душанбе"})
	if err != nil || len(dush) != 1 || dush[0].CenterID != near {
		t.Fatalf("фильтр по городу: %+v / %v", dush, err)
	}

	// Сортировка по удалённости от точки в Душанбе: ближний центр первым.
	lat, lng := 38.56, 68.79
	sorted, err := svc.Branches(ctx, &lat, &lng, catalog.BranchFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if sorted[0].CenterID != near || sorted[0].DistanceKm == nil || *sorted[0].DistanceKm > *sorted[1].DistanceKm {
		t.Fatalf("ожидалась сортировка по удалённости (ближний первым): %+v", sorted)
	}
}

func TestCatalogLeadCreateAndManage(t *testing.T) {
	db, _ := freshDB(t)
	seedProPlan(t, db)
	center := makeCenter(t, db, "pro", 0, 0, 0)
	publishBranch(t, db, center, "Центральный", "Душанбе", "Сино", 38.56, 68.79, "Математика")
	svc := newCatalog(db)
	ctx := context.Background()

	// Валидация: имя/телефон обязательны.
	if _, err := svc.CreateLead(ctx, catalog.CreateLeadInput{TenantID: center, Name: "", Phone: "+992 90 1"}); asAPIError(t, err).Code != apierr.CodeValidation {
		t.Fatal("пустое имя должно отклоняться")
	}
	// Неопубликованный центр — конфликт.
	unpublished := makeCenter(t, db, "pro", 0, 0, 0)
	if _, err := svc.CreateLead(ctx, catalog.CreateLeadInput{TenantID: unpublished, Name: "Тест", Phone: "+992901112233"}); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("заявка к неопубликованному центру должна отклоняться")
	}
	// Успешная заявка.
	lead, err := svc.CreateLead(ctx, catalog.CreateLeadInput{TenantID: center, Name: "Родитель", Phone: "+992 90 111 22 33", Note: "пробный"})
	if err != nil || lead.Status != catalog.LeadNew || lead.Phone != "+992901112233" {
		t.Fatalf("создание заявки: %+v / %v", lead, err)
	}

	// Список центра содержит заявку; у другого центра — пусто (изоляция BR-022).
	list, err := svc.Leads(ctx, center, "")
	if err != nil || len(list) != 1 {
		t.Fatalf("список заявок: %+v / %v", list, err)
	}
	other, _ := svc.Leads(ctx, unpublished, "")
	if len(other) != 0 {
		t.Fatal("заявки не должны видеться другим центром")
	}

	// Переходы статуса: trial → enroll (конечный) → повтор запрещён.
	if _, err := svc.Transition(ctx, actor(), center, lead.ID, "trial"); err != nil {
		t.Fatalf("переход trial: %v", err)
	}
	if _, err := svc.Transition(ctx, actor(), center, lead.ID, "enroll"); err != nil {
		t.Fatalf("переход enroll: %v", err)
	}
	if _, err := svc.Transition(ctx, actor(), center, lead.ID, "decline"); asAPIError(t, err).Code != apierr.CodeConflict {
		t.Fatal("заявка в конечном статусе не меняется")
	}
	// Чужой центр не может трогать заявку (NOT_FOUND).
	if _, err := svc.Transition(ctx, actor(), unpublished, lead.ID, "trial"); asAPIError(t, err).Code != apierr.CodeNotFound {
		t.Fatal("заявка другого центра недоступна")
	}
}
