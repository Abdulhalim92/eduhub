// Command seed наполняет БД демо-данными прототипа (тарифы, менеджеры, 29 центров,
// суперадмин). Только для разработки; идемпотентен (повторный запуск не дублирует).
// Данные повторяют mock-слой src/js/core/api.js, чтобы прототип работал против бэкенда.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"time"

	"github.com/line/eduhub-backend/internal/auth"
	"github.com/line/eduhub-backend/internal/config"
	"github.com/line/eduhub-backend/internal/database"
	"github.com/line/eduhub-backend/internal/ledger"
	"github.com/line/eduhub-backend/internal/migrate"
	"github.com/line/eduhub-backend/internal/modules/billing"
	"github.com/line/eduhub-backend/internal/modules/cabinet"
	"github.com/line/eduhub-backend/internal/modules/centers"
	"github.com/line/eduhub-backend/internal/modules/marketplace"
	"github.com/line/eduhub-backend/internal/modules/moderation"
	"github.com/line/eduhub-backend/internal/modules/plans"
	"github.com/line/eduhub-backend/internal/modules/sms"
	"github.com/line/eduhub-backend/pkg/money"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("seed failed", "error", err)
		os.Exit(1)
	}
	slog.Info("seed done")
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	if err := migrate.Up(cfg.DatabaseURL); err != nil {
		return err
	}
	ctx := context.Background()
	db, err := database.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer func() { _ = database.Close(db) }()

	if err := seedPlans(ctx, db); err != nil {
		return err
	}
	managerIDs, err := seedManagers(ctx, db)
	if err != nil {
		return err
	}
	if err := seedCenters(ctx, db, managerIDs); err != nil {
		return err
	}
	if err := seedBilling(ctx, db); err != nil {
		return err
	}
	if err := seedMarketplace(ctx, db); err != nil {
		return err
	}
	if err := seedSMS(ctx, db); err != nil {
		return err
	}
	if err := seedModeration(ctx, db); err != nil {
		return err
	}
	if err := seedCabinet(ctx, db); err != nil {
		return err
	}
	if err := seedSuperAdmin(ctx, db, cfg.BcryptCost); err != nil {
		return err
	}
	if err := seedCenterAdmin(ctx, db, cfg.BcryptCost); err != nil {
		return err
	}
	return seedMobileDemo(ctx, db)
}

// seedMobileDemo привязывает одного демо-ученика центра 1 к аккаунту по известному телефону,
// чтобы работал вход по OTP и кабинет ученика в ручном прогоне (мобильный контур ТЗ v2.5).
func seedMobileDemo(ctx context.Context, db *gorm.DB) error {
	const phone = "+992900000001"
	var studentID int64
	if err := db.WithContext(ctx).Raw(
		"SELECT id FROM students WHERE center_id = 1 AND status = 'active' ORDER BY id LIMIT 1").
		Scan(&studentID).Error; err != nil {
		return err
	}
	if studentID == 0 {
		slog.Info("mobile demo skipped (no active student in center 1)")
		return nil
	}
	var accountID int64
	if err := db.WithContext(ctx).Raw(`
		INSERT INTO accounts (phone, display_name, locale, status)
		VALUES (?, 'Демо Ученик', 'ru', 'active')
		ON CONFLICT (phone) DO UPDATE SET updated_at = now()
		RETURNING id`, phone).Scan(&accountID).Error; err != nil {
		return err
	}
	if err := db.WithContext(ctx).Exec(
		"UPDATE students SET phone = ?, account_id = ?, updated_at = now() WHERE id = ?",
		phone, accountID, studentID).Error; err != nil {
		return err
	}
	if err := db.WithContext(ctx).Exec(`
		INSERT INTO memberships (account_id, tenant_id, role, status, created_by)
		VALUES (?, 1, 'student', 'active', 'seed')
		ON CONFLICT (account_id, tenant_id, role) DO NOTHING`, accountID).Error; err != nil {
		return err
	}
	slog.Info("mobile demo student linked", "phone", phone, "studentId", studentID, "accountId", accountID)

	// Демо-родитель, привязанный к тому же ученику (кабинет родителя).
	const parentPhone = "+992900000002"
	var parentAccID int64
	if err := db.WithContext(ctx).Raw(`
		INSERT INTO accounts (phone, display_name, locale, status)
		VALUES (?, 'Демо Родитель', 'ru', 'active')
		ON CONFLICT (phone) DO UPDATE SET updated_at = now()
		RETURNING id`, parentPhone).Scan(&parentAccID).Error; err != nil {
		return err
	}
	if err := db.WithContext(ctx).Exec(`
		INSERT INTO memberships (account_id, tenant_id, role, status, created_by)
		VALUES (?, 1, 'parent', 'active', 'seed')
		ON CONFLICT (account_id, tenant_id, role) DO NOTHING`, parentAccID).Error; err != nil {
		return err
	}
	if err := db.WithContext(ctx).Exec(`
		INSERT INTO student_guardians (tenant_id, student_id, account_id, relation, status, created_by)
		VALUES (1, ?, ?, 'Родитель', 'active', 'seed')
		ON CONFLICT (student_id, account_id) DO NOTHING`, studentID, parentAccID).Error; err != nil {
		return err
	}
	slog.Info("mobile demo parent linked", "phone", parentPhone, "accountId", parentAccID, "childStudentId", studentID)
	return nil
}

var staffFirst = []string{"Рустам", "Дилшод", "Фарход", "Зафар", "Бахтиёр", "Умед", "Парвиз", "Мансур", "Фарида", "Нигора", "Мадина", "Ситора", "Гулнора", "Лайло", "Мехрона", "Дильбар"}
var staffLast = []string{"Хакимов", "Азизов", "Рахимов", "Шарипов", "Умаров", "Исмоилов", "Назаров", "Каримов", "Саидов", "Юсупов"}
var directionsList = []string{"Математика", "Английский язык", "Программирование", "Робототехника", "Подготовка к НЦТ", "Творчество", "Шахматы", "Музыка"}
var groupCourses = []string{"Базовый курс", "Интенсив", "Подготовка к экзаменам", "Разговорный клуб"}
var seedSchedules = []string{"0,2,4", "1,3,5", "0,3", "5,6"}

func staffFullName(centerID int64, i int) string {
	f := staffFirst[int(centerID*5+int64(i*7))%len(staffFirst)]
	l := staffLast[int(centerID*3+int64(i*11))%len(staffLast)]
	return f + " " + l
}

// seedCabinet наполняет профили и сотрудников всех центров, группы и учеников демо-центров 1–9.
func seedCabinet(ctx context.Context, db *gorm.DB) error {
	var n int64
	if err := db.WithContext(ctx).Table("center_profiles").Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		slog.Info("cabinet seed skipped (profiles exist)")
		return nil
	}
	year := time.Now().Year()
	for _, s := range centerData() {
		dir := directionsList[s.id%int64(len(directionsList))]
		fy := year - 3 - int(s.id%8)
		prof := cabinet.CenterProfile{
			CenterID: s.id, Direction: dir, Description: "Учебный центр «" + s.name + "»: " + dir + " и смежные направления.",
			FoundedYear: &fy, Logo: fmt.Sprintf("src/assets/centers/logo-%d.svg", s.id), Banner: "src/assets/centers/banner-school.jpg",
		}
		if err := db.WithContext(ctx).Create(&prof).Error; err != nil {
			return err
		}
		// Сотрудники = staff_used: 1 администратор (если ≥2), остальные — преподаватели.
		// Роль «менеджер» центра не используется (ТЗ v2.5).
		used := s.staff
		if used == 0 {
			continue
		}
		admins := 0
		if used >= 2 {
			admins = 1
		}
		teachers := used - admins
		staffRows := make([]cabinet.Staff, 0, used)
		idx := 0
		add := func(role string, k int) {
			for j := 0; j < k; j++ {
				staffRows = append(staffRows, cabinet.Staff{
					CenterID: s.id, Name: staffFullName(s.id, idx), Role: role, Phone: fmt.Sprintf("+992 9%d %03d %02d %02d", s.id%10, 100+idx*7, 10+idx, 20+idx),
					Status: "active", HiredAt: time.Now().UTC().AddDate(0, 0, -(30 + idx*17)),
				})
				idx++
			}
		}
		add("teacher", teachers)
		add("admin", admins)
		if err := db.WithContext(ctx).Create(&staffRows).Error; err != nil {
			return err
		}
	}
	if err := bumpSequence(ctx, db, "staff"); err != nil {
		return err
	}

	// Группы и ученики для демо-центров 1–9.
	for cid := int64(1); cid <= 9; cid++ {
		var teacherIDs []int64
		if err := db.WithContext(ctx).Table("staff").Where("center_id = ? AND role = 'teacher' AND status = 'active'", cid).Order("id").Pluck("id", &teacherIDs).Error; err != nil {
			return err
		}
		if len(teacherIDs) == 0 {
			continue
		}
		groupCount := 2
		if len(teacherIDs) < 2 {
			groupCount = 1
		}
		for g := 0; g < groupCount; g++ {
			tid := teacherIDs[g%len(teacherIDs)]
			startsAt := time.Now().UTC().AddDate(0, 0, -60)
			endsAt := time.Now().UTC().AddDate(0, 0, 90)
			grp := cabinet.Group{
				CenterID: cid, Name: groupCourses[g%len(groupCourses)] + " · группа " + strconv.Itoa(g+1), Course: groupCourses[g%len(groupCourses)],
				Branch: "Главный филиал", TeacherID: &tid, Status: "active", Days: seedSchedules[g%len(seedSchedules)],
				StartTime: fmt.Sprintf("%02d:00", 9+g*2), DurationMin: 90, HWPoints: 5, VisitPoints: 1, ExamDay: 5, ExamPoints: 50,
				Capacity: 16, StartsAt: &startsAt, EndsAt: &endsAt,
			}
			if err := db.WithContext(ctx).Create(&grp).Error; err != nil {
				return err
			}
			students := make([]cabinet.Student, 0, 12)
			for i := 0; i < 12; i++ {
				gid := grp.ID
				st := cabinet.Student{
					CenterID: cid, Name: staffFullName(cid*7+int64(g), i), Phone: fmt.Sprintf("+992 9%d %03d %02d %02d", cid%10, 200+i*3, 30+i, 40+i),
					Status: "active", GroupID: &gid, JoinedAt: time.Now().UTC().AddDate(0, 0, -(10 + i*3)), Coin: 50 + i*10,
				}
				if i%13 == 5 {
					st.Status = "blocked"
				}
				students = append(students, st)
			}
			if err := db.WithContext(ctx).Create(&students).Error; err != nil {
				return err
			}
		}
	}
	if err := bumpSequence(ctx, db, "groups"); err != nil {
		return err
	}
	if err := bumpSequence(ctx, db, "students"); err != nil {
		return err
	}

	// Награды и автоправила coin для демо-центров 1–9.
	for cid := int64(1); cid <= 9; cid++ {
		rewards := []cabinet.Reward{
			{CenterID: cid, Name: "Скидка 10% на курс", Category: "Скидки", Price: 500, Status: "active"},
			{CenterID: cid, Name: "Фирменная футболка", Category: "Мерч", Price: 800, Status: "active"},
			{CenterID: cid, Name: "Тетрадь и ручка", Category: "Канцелярия", Price: 150, Status: "active"},
			{CenterID: cid, Name: "Экскурсия в лабораторию", Category: "Опыт", Price: 1200, Status: "archived"},
		}
		if err := db.WithContext(ctx).Create(&rewards).Error; err != nil {
			return err
		}
		rules := []cabinet.CoinRule{
			{CenterID: cid, Name: "Отличная посещаемость", Scope: "academy", Threshold: 90, Coin: 30, Active: true},
			{CenterID: cid, Name: "Отличная успеваемость по курсу", Scope: "course", Threshold: 80, Coin: 50, Active: false},
		}
		if err := db.WithContext(ctx).Create(&rules).Error; err != nil {
			return err
		}
	}
	if err := bumpSequence(ctx, db, "rewards"); err != nil {
		return err
	}
	if err := bumpSequence(ctx, db, "coin_rules"); err != nil {
		return err
	}
	slog.Info("cabinet seed done")
	return nil
}

func seedModeration(ctx context.Context, db *gorm.DB) error {
	var n int64
	if err := db.WithContext(ctx).Table("branch_submissions").Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		slog.Info("moderation seed skipped (submissions exist)")
		return nil
	}
	subs := []moderation.Submission{
		{
			ID: 1, CenterID: 1, Branch: "Филиал «Сино»", City: "Душанбе", District: "Сино", Address: "ул. Рудаки, 98", Phone: "+992 90 100 10 01",
			GPSLat: 38.5601, GPSLng: 68.7794, GeoLat: 38.5603, GeoLng: 68.7791, Status: "pending", SubmittedBy: "Анна Смирнова", SubmittedAt: time.Now().UTC(),
			DescRU: "Центр «Перспектива» — подготовка к НЦТ, математика и английский для школьников 7–17 лет. Малые группы до 10 человек.",
			DescTJ: "Маркази «Перспектива» — омодагӣ ба НЦТ, математика ва забони англисӣ барои хонандагони 7–17 сола.",
		},
		{
			ID: 2, CenterID: 7, Branch: "Филиал «Фирдавси»", City: "Душанбе", District: "Фирдавси", Address: "пр. Айни, 24", Phone: "+992 90 100 10 07",
			GPSLat: 38.5530, GPSLng: 68.7960, GeoLat: 38.5568, GeoLng: 68.7955, Status: "pending", SubmittedBy: "Ситора Назарова", SubmittedAt: time.Now().UTC(),
			DescRU: "Sitora Kids — развивающие занятия для детей 4–10 лет: рисование, шахматы, подготовка к школе и английский в игровой форме.",
			DescTJ: "Sitora Kids — машғулотҳои рушддиҳанда барои кӯдакони 4–10 сола: наққошӣ, шоҳмот, омодагӣ ба мактаб.",
			DescEN: "Sitora Kids offers developmental classes for children aged 4–10.",
		},
		{
			ID: 3, CenterID: 4, Branch: "Главный филиал", City: "Худжанд", District: "Центр", Address: "ул. Мавлонбекова, 15", Phone: "+992 92 200 20 04",
			GPSLat: 40.2826, GPSLng: 69.6220, GeoLat: 40.2828, GeoLng: 69.6224, Status: "pending", SubmittedBy: "Шахноза Юсупова", SubmittedAt: time.Now().UTC(),
			DescRU: "Дониш — программирование и робототехника для подростков. Собственная лаборатория, проектная работа, участие в олимпиадах.",
			DescEN: "Donish teaches programming and robotics to teenagers.",
		},
		{
			ID: 4, CenterID: 8, Branch: "Филиал «Центр»", City: "Худжанд", District: "Центр", Address: "ул. Исмоили Сомони, 7", Phone: "+992 92 200 20 08",
			GPSLat: 40.2790, GPSLng: 69.6180, GeoLat: 40.2791, GeoLng: 69.6183, Status: "pending", SubmittedBy: "Зебо Каримова", SubmittedAt: time.Now().UTC(),
			DescRU: "Zebo Lingua — языковая студия: английский, русский, турецкий. Группы по уровням, разговорные клубы, подготовка к IELTS.",
			DescTJ: "Zebo Lingua — студияи забонҳо: англисӣ, русӣ, туркӣ. Гурӯҳҳо аз рӯи сатҳ, клубҳои гуфтугӯӣ.",
			DescEN: "Zebo Lingua is a language studio: English, Russian, Turkish.",
		},
	}
	if err := db.WithContext(ctx).Create(&subs).Error; err != nil {
		return err
	}
	if err := bumpSequence(ctx, db, "branch_submissions"); err != nil {
		return err
	}
	slog.Info("moderation seed done", "submissions", len(subs))
	return nil
}

func seedSMS(ctx context.Context, db *gorm.DB) error {
	var n int64
	if err := db.WithContext(ctx).Table("sms_packages").Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		slog.Info("sms seed skipped (packages exist)")
		return nil
	}
	packages := []sms.Package{
		{ID: "sms500", SMS: 500, PriceDiram: som(120), Description: "Базовый пакет для небольших центров", Active: true},
		{ID: "sms1000", SMS: 1000, PriceDiram: som(210), Description: "Популярный пакет для активных групп", Active: true},
		{ID: "sms5000", SMS: 5000, PriceDiram: som(900), Description: "Выгодный пакет для крупных сетей", Active: true},
	}
	if err := db.WithContext(ctx).Create(&packages).Error; err != nil {
		return err
	}
	pkgPrice := map[string]int64{"sms500": 120, "sms1000": 210, "sms5000": 900}
	pkgCount := map[string]int{"sms500": 500, "sms1000": 1000, "sms5000": 5000}
	type saleSeed struct {
		centerID             int64
		packageID            string
		remaining, days      int
		method, reference    string
	}
	seeds := []saleSeed{
		{1, "sms1000", 820, 6, "Списание с баланса на платформе", "Подписка"},
		{3, "sms5000", 3400, 11, "Безнал (Р/С)", "ПП № 211"},
		{2, "sms500", 45, 3, "Перевод на карту", "4821"},
		{4, "sms1000", 950, 19, "Безнал (Р/С)", "ПП № 198"},
		{5, "sms500", 310, 8, "Наличные", "ПКО № 31"},
		{6, "sms1000", 130, 14, "Безнал (Р/С)", "ПП № 187"},
		{18, "sms500", 500, 2, "Списание с баланса на платформе", "SMS-пакет 500"},
		{20, "sms5000", 4700, 5, "Безнал (Р/С)", "ПП № 230"},
		{26, "sms5000", 1200, 24, "Безнал (Р/С)", "ПП № 176"},
		{27, "sms1000", 60, 21, "Наличные", "ПКО № 28"},
	}
	sales := make([]sms.Sale, 0, len(seeds))
	for i, s := range seeds {
		sales = append(sales, sms.Sale{
			ID: fmt.Sprintf("SMS-%d", 2040+i), CenterID: s.centerID, PackageID: s.packageID, SMS: pkgCount[s.packageID],
			Remaining: s.remaining, PriceDiram: som(pkgPrice[s.packageID]), BoughtAt: time.Now().UTC().AddDate(0, 0, -s.days),
			Status: "paid", Method: s.method, Reference: s.reference, ActorName: "Алексей К.",
		})
	}
	if err := db.WithContext(ctx).Create(&sales).Error; err != nil {
		return err
	}
	slog.Info("sms seed done", "packages", len(packages), "sales", len(sales))
	return nil
}

func ptrStr(s string) *string { return &s }
func ptrI64(n int64) *int64   { return &n }

// seedBilling добавляет демо-счета и проводки по балансу (как в api.js). Идемпотентно:
// если счета уже есть — пропускает.
func seedBilling(ctx context.Context, db *gorm.DB) error {
	var n int64
	if err := db.WithContext(ctx).Table("invoices").Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		slog.Info("billing seed skipped (invoices exist)")
		return nil
	}
	ago := func(d int) time.Time { return time.Now().UTC().AddDate(0, 0, -d) }
	admin := billing.ActorRef{Name: "Алексей К.", Role: "SuperAdmin"}

	due1042, paid1042 := ago(-2), ago(3)
	due1043, reminded1043 := ago(2), ago(4)
	invoices := []billing.Invoice{
		{
			ID: "INV-1042", CenterID: 1, Kind: billing.KindRenewal, Purpose: "Подписка Бизнес (1 мес)",
			AmountDiram: som(1800), Status: billing.StatusPaid, IssuedAt: ago(5), DueAt: &due1042, PaidAt: &paid1042,
			PaidVia: ptrStr("manual"), Method: ptrStr("Безнал (Р/С)"), Channel: ptrStr("bank"), Reference: "ПП № 18",
			Payment: &billing.Payment{Channel: "bank", Method: "Безнал (Р/С)", Reference: "ПП № 18", ReceivedAmount: 1800, ReceivedOn: ago(3).Format("2006-01-02"), Via: "manual", ConfirmedBy: admin},
		},
		{
			ID: "INV-1043", CenterID: 3, Kind: billing.KindCourse, CourseID: ptrI64(2), Purpose: "Курс: Подготовка к НЦТ",
			AmountDiram: som(1500), Status: billing.StatusPending, IssuedAt: ago(9), DueAt: &due1043, RemindedAt: &reminded1043,
		},
		{
			ID: "INV-1044", CenterID: 2, Kind: billing.KindTrial, Purpose: "Триал: Бизнес (30 дней)",
			AmountDiram: som(0), Status: billing.StatusTrial, IssuedAt: ago(10), Method: ptrStr("Промокод START30"), Channel: ptrStr("promo"),
		},
	}
	if err := db.WithContext(ctx).Create(&invoices).Error; err != nil {
		return err
	}

	events := []billing.Event{
		{InvoiceID: "INV-1042", At: ago(5), Type: "issued", ActorName: admin.Name, ActorRole: admin.Role, Text: "Счёт выставлен"},
		{InvoiceID: "INV-1042", At: ago(3), Type: "paid", ActorName: admin.Name, ActorRole: admin.Role, Text: "Оплата подтверждена вручную: Безнал (Р/С) · ПП № 18"},
		{InvoiceID: "INV-1042", At: ago(3), Type: "applied", ActorName: admin.Name, ActorRole: admin.Role, Text: "Подписка продлена на 30 дней"},
		{InvoiceID: "INV-1043", At: ago(9), Type: "issued", ActorName: admin.Name, ActorRole: admin.Role, Text: "Счёт выставлен"},
		{InvoiceID: "INV-1043", At: ago(4), Type: "reminded", ActorName: admin.Name, ActorRole: admin.Role, Text: "Напоминание отправлено владельцу центра"},
		{InvoiceID: "INV-1044", At: ago(10), Type: "issued", ActorName: admin.Name, ActorRole: admin.Role, Text: "Триал активирован по промокоду START30"},
	}
	if err := db.WithContext(ctx).Create(&events).Error; err != nil {
		return err
	}

	// По две проводки на центр (пополнение и списание), итог = текущий баланс (как в api.js).
	var entries []ledger.Entry
	for _, s := range centerData() {
		top := s.balance
		if top < 0 {
			top = 0
		}
		top += 200
		charge := top - s.balance
		entries = append(entries,
			ledger.Entry{CenterID: s.id, At: ago(20), Type: "topup", AmountDiram: som(top), BalanceAfterDiram: som(top), Method: "Безнал (Р/С)", Reference: "ПП № " + strconv.FormatInt(100+s.id, 10), ActorName: admin.Name},
			ledger.Entry{CenterID: s.id, At: ago(12), Type: "charge", AmountDiram: som(-charge), BalanceAfterDiram: som(s.balance), Method: "Списание с баланса на платформе", Reference: "Подписка (1 мес)", ActorName: admin.Name},
		)
	}
	if err := db.WithContext(ctx).Create(&entries).Error; err != nil {
		return err
	}
	slog.Info("billing seed done", "invoices", len(invoices), "ledger", len(entries))
	return nil
}

func som(v int64) money.Diram { return money.FromSomoni(v) }

func seedPlans(ctx context.Context, db *gorm.DB) error {
	rows := []plans.Plan{
		{ID: "start", Name: "Старт", PriceDiram: som(0), LimitStaff: 5, LimitStorageGB: 2, LimitBranches: 2, ModuleGeo: true, Active: true},
		{ID: "basic", Name: "Базовый", PriceDiram: som(400), LimitStaff: 10, LimitStorageGB: 10, LimitBranches: 3, ModulePayroll: true, ModuleGeo: true, Active: true},
		{ID: "pro", Name: "Про", PriceDiram: som(900), LimitStaff: 50, LimitStorageGB: 50, LimitBranches: 10, ModulePayroll: true, ModuleInventory: true, ModuleGeo: true, Active: true},
		{ID: "business", Name: "Бизнес", PriceDiram: som(1800), LimitStaff: 100, LimitStorageGB: 200, LimitBranches: 25, ModulePayroll: true, ModuleInventory: true, ModuleCRM: true, ModuleGeo: true, Active: true},
	}
	return db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}

func seedManagers(ctx context.Context, db *gorm.DB) (map[string]int64, error) {
	names := []string{"Нигора Р.", "Фарход С.", "Мадина Т."}
	for _, n := range names {
		m := centers.Manager{Name: n, Active: true}
		if err := db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&m).Error; err != nil {
			return nil, err
		}
	}
	if err := bumpSequence(ctx, db, "managers"); err != nil {
		return nil, err
	}
	var all []centers.Manager
	if err := db.WithContext(ctx).Find(&all).Error; err != nil {
		return nil, err
	}
	ids := map[string]int64{}
	for _, m := range all {
		ids[m.Name] = m.ID
	}
	return ids, nil
}

// centerSeed повторяет данные центров из api.js (id, тариф, нагрузка, финансы).
type centerSeed struct {
	id                             int64
	name, city, owner, phone, plan string
	staff, storage, branches       int
	loginDays, lessons7d           int
	status                         string
	expiresIn                      *int // дней до конца подписки; nil — не истекает
	balance, overdraft             int64
	manager                        string
}

func seedCenters(ctx context.Context, db *gorm.DB, managerIDs map[string]int64) error {
	planID := map[string]string{"Старт": "start", "Базовый": "basic", "Про": "pro", "Бизнес": "business"}
	now := time.Now().UTC()
	for _, s := range centerData() {
		var lastLogin *time.Time
		t := now.AddDate(0, 0, -s.loginDays)
		lastLogin = &t
		var expires *time.Time
		if s.expiresIn != nil {
			e := now.AddDate(0, 0, *s.expiresIn)
			expires = &e
		}
		var managerID *int64
		if s.manager != "" {
			if id, ok := managerIDs[s.manager]; ok {
				managerID = &id
			}
		}
		c := centers.Center{
			ID:                  s.id,
			Name:                s.name,
			City:                s.city,
			Owner:               s.owner,
			Phone:               s.phone,
			PlanID:              planID[s.plan],
			BalanceDiram:        som(s.balance),
			OverdraftLimitDiram: som(s.overdraft),
			StaffUsed:           s.staff,
			StorageUsedGB:       s.storage,
			BranchesUsed:        s.branches,
			LastLoginAt:         lastLogin,
			Lessons7d:           s.lessons7d,
			Status:              s.status,
			ExpiresAt:           expires,
			ManagerID:           managerID,
		}
		if err := db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&c).Error; err != nil {
			return err
		}
	}
	return bumpSequence(ctx, db, "centers")
}

// courseDemo — данные демо-курса (как db.courses в api.js).
type courseDemo struct {
	id                       int64
	title, direction, note   string
	lessons, tests           int
	status                   string
	price                    int64
	buyersOther              int
	description              string
}

func seedMarketplace(ctx context.Context, db *gorm.DB) error {
	var n int64
	if err := db.WithContext(ctx).Table("courses").Count(&n).Error; err != nil {
		return err
	}
	if n > 0 {
		slog.Info("marketplace seed skipped (courses exist)")
		return nil
	}
	demos := []courseDemo{
		{1, "Английский язык · Уровень B1", "Языки", "PDF-планы", 36, 12, "published", 1200, 15, "Курс общего английского уровня B1: грамматика, лексика по темам, аудирование и письмо."},
		{2, "Подготовка к НЦТ · Математика", "Подготовка к НЦТ", "Автопроверка", 48, 24, "published", 1500, 26, "Системная подготовка к национальному централизованному тестированию по математике."},
		{3, "Python для школьников · Старт", "IT и программирование", "Практикум", 24, 0, "draft", 950, 0, "Первое знакомство школьников с программированием на Python."},
		{4, "Таджикский язык · Базовый курс", "Языки", "Аудиоматериалы", 30, 10, "published", 800, 10, "Базовый курс таджикского языка для детей и взрослых."},
		{5, "Ментальная арифметика · Уровень 1", "Математика", "Карточки и игры", 20, 8, "published", 700, 6, "Ментальная арифметика, уровень 1: счёты, формулы, игры."},
		{6, "Scratch и основы алгоритмов", "IT и программирование", "Проекты", 18, 6, "draft", 600, 0, "Алгоритмическое мышление через визуальное программирование в Scratch."},
	}
	for _, d := range demos {
		content, seq := genContent(d.lessons, d.tests)
		c := marketplace.Course{
			ID: d.id, Title: d.title, Direction: d.direction, Description: d.description, Note: d.note,
			Status: d.status, PriceDiram: som(d.price), Lessons: d.lessons, Tests: d.tests, BuyersOther: d.buyersOther,
			Content: content, ContentSeq: seq,
		}
		if err := db.WithContext(ctx).Create(&c).Error; err != nil {
			return err
		}
	}
	if err := bumpSequence(ctx, db, "courses"); err != nil {
		return err
	}

	// Выданные доступы: [centerId, courseId, source, invoiceId, daysAgo].
	type accSeed struct {
		centerID, courseID int64
		source, invoiceID  string
		days               int
	}
	lessonsTests := map[int64][2]int{}
	for _, d := range demos {
		lessonsTests[d.id] = [2]int{d.lessons, d.tests}
	}
	accesses := []accSeed{
		{1, 1, "invoice", "INV-1030", 34}, {1, 2, "invoice", "INV-1031", 30}, {2, 2, "invoice", "INV-1032", 21},
		{4, 1, "bonus", "", 9}, {18, 4, "invoice", "INV-1038", 4}, {5, 5, "invoice", "INV-1035", 12},
	}
	for _, a := range accesses {
		vt := lessonsTests[a.courseID]
		acc := marketplace.Access{
			CenterID: a.centerID, CourseID: a.courseID, Source: a.source, GrantedAt: time.Now().UTC().AddDate(0, 0, -a.days),
			Status: "active", VersionLessons: vt[0], VersionTests: vt[1],
		}
		if a.invoiceID != "" {
			acc.InvoiceID = ptrStr(a.invoiceID)
		}
		if a.source == "bonus" {
			acc.Reason = "Бонус за долгое сотрудничество"
		}
		if err := db.WithContext(ctx).Create(&acc).Error; err != nil {
			return err
		}
	}

	// Заявки центров.
	reqs := []marketplace.Request{
		{ID: 1, CenterID: 2, CourseID: 4, Status: "new", Note: "Нужен для новой группы таджикского языка", CreatedAt: time.Now().UTC().AddDate(0, 0, -1)},
		{ID: 2, CenterID: 18, CourseID: 2, Status: "new", CreatedAt: time.Now().UTC().Add(-5 * time.Hour)},
		{ID: 3, CenterID: 5, CourseID: 1, Status: "rejected", Reason: "Центр уже получил курс другим способом", CreatedAt: time.Now().UTC().AddDate(0, 0, -6), DecidedAt: ptrTime(time.Now().UTC().AddDate(0, 0, -5))},
	}
	if err := db.WithContext(ctx).Create(&reqs).Error; err != nil {
		return err
	}
	if err := bumpSequence(ctx, db, "course_requests"); err != nil {
		return err
	}
	slog.Info("marketplace seed done", "courses", len(demos), "accesses", len(accesses), "requests", len(reqs))
	return nil
}

// genContent строит программу с ровно nLessons уроками и nTests тестами (по образцу genContent из api.js).
func genContent(nLessons, nTests int) (marketplace.Program, int64) {
	var seq int64 = 1
	next := func() int64 { id := seq; seq++; return id }
	modules := []marketplace.Module{}
	for i := 0; i < nLessons; i++ {
		m := i / 6
		if len(modules) == m {
			modules = append(modules, marketplace.Module{ID: next(), Title: fmt.Sprintf("Модуль %d", m+1), Lessons: []marketplace.Lesson{}})
		}
		lesson := marketplace.Lesson{ID: next(), Title: fmt.Sprintf("Урок %d.%d", m+1, i%6+1), Materials: []marketplace.Material{}}
		lesson.Materials = append(lesson.Materials, marketplace.Material{ID: next(), Type: "plan", Name: fmt.Sprintf("План урока %d.%d.pdf", m+1, i%6+1), Size: "1,2 МБ"})
		if i < nTests {
			lesson.Materials = append(lesson.Materials, marketplace.Material{ID: next(), Type: "test", Name: fmt.Sprintf("Тест %d", i+1), Size: "10 вопросов"})
		}
		modules[m].Lessons = append(modules[m].Lessons, lesson)
	}
	return marketplace.Program{Modules: modules}, seq
}

func ptrTime(t time.Time) *time.Time { return &t }

// seedCenterAdmin создаёт администратора центра 1 (дев-доступ к кабинетным эндпоинтам).
func seedCenterAdmin(ctx context.Context, db *gorm.DB, bcryptCost int) error {
	login := envDefault("SEED_CENTER_ADMIN_LOGIN", "center1")
	password := envDefault("SEED_CENTER_ADMIN_PASSWORD", "center12345")
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return err
	}
	tenant := int64(1)
	u := auth.User{
		Login: login, PasswordHash: string(hash), Role: auth.RoleCenterAdmin, Name: "Анна Смирнова",
		TenantID: &tenant, MustChangePassword: true, Active: true,
	}
	res := db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&u)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected > 0 {
		slog.Info("center admin created", "login", login, "password", password, "centerId", tenant)
	}
	return nil
}

func seedSuperAdmin(ctx context.Context, db *gorm.DB, bcryptCost int) error {
	login := envDefault("SEED_ADMIN_LOGIN", "admin")
	password := envDefault("SEED_ADMIN_PASSWORD", "admin12345")
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return err
	}
	u := auth.User{
		Login:              login,
		PasswordHash:       string(hash),
		Role:               auth.RoleSuperAdmin,
		Name:               "Алексей К.",
		MustChangePassword: true,
		Active:             true,
	}
	res := db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&u)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected > 0 {
		slog.Info("superadmin created", "login", login, "password", password)
	} else {
		slog.Info("superadmin already exists", "login", login)
	}
	return nil
}

func bumpSequence(ctx context.Context, db *gorm.DB, table string) error {
	// Явные id не двигают IDENTITY-последовательность: выставим её на max(id).
	q := `SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE((SELECT MAX(id) FROM ` + table + `), 1))`
	return db.WithContext(ctx).Exec(q, table).Error
}

func envDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func ptrInt(v int) *int { return &v }

func centerData() []centerSeed {
	return []centerSeed{
		{1, "Центр Перспектива", "Душанбе", "Анна Смирнова", "+992 90 100 10 01", "Бизнес", 14, 45, 4, 0, 84, "active", ptrInt(41), 2400, 2000, ""},
		{2, "Indigo Academy", "Душанбе", "Рустам Хакимов", "+992 90 100 10 02", "Бизнес", 17, 40, 6, 0, 120, "active", ptrInt(6), 850, 2000, ""},
		{3, "Alpha School", "Душанбе", "Дилшод Азизов", "+992 90 100 10 03", "Про", 28, 20, 3, 11, 0, "active", ptrInt(52), 120, 800, "Нигора Р."},
		{4, "Дониш", "Худжанд", "Шахноза Юсупова", "+992 92 200 20 04", "Про", 22, 44, 4, 0, 66, "active", ptrInt(3), 310, 800, ""},
		{5, "Умед Плюс", "Душанбе", "Фарида Рахимова", "+992 90 100 10 05", "Базовый", 9, 7, 2, 13, 3, "active", ptrInt(9), -150, 300, ""},
		{6, "Рушд", "Бохтар", "Мансур Шарипов", "+992 93 300 30 06", "Базовый", 3, 2, 1, 16, 0, "active", ptrInt(12), 0, 300, ""},
		{7, "Sitora Kids", "Душанбе", "Ситора Назарова", "+992 90 100 10 07", "Про", 19, 12, 9, 1, 41, "active", ptrInt(5), 1200, 800, ""},
		{8, "Zebo Lingua", "Худжанд", "Зебо Каримова", "+992 92 200 20 08", "Базовый", 7, 9, 3, 0, 30, "active", ptrInt(2), 45, 300, ""},
		{9, "Math Lab", "Душанбе", "Парвиз Исмоилов", "+992 90 100 10 09", "Старт", 4, 1, 2, 2, 12, "active", nil, 0, 0, ""},
		{10, "English Hub", "Куляб", "Нодира Ахмедова", "+992 98 400 40 10", "Про", 12, 8, 2, 12, 2, "active", ptrInt(20), -420, 500, ""},
		{11, "Бахор", "Турсунзода", "Гулнора Саидова", "+992 90 100 10 11", "Базовый", 6, 4, 1, 0, 27, "active", ptrInt(-2), 30, 300, ""},
		{12, "Navigator", "Душанбе", "Бахтиёр Умаров", "+992 90 100 10 12", "Про", 31, 30, 5, 0, 98, "active", ptrInt(60), 3900, 800, ""},
		{13, "Огни знаний", "Худжанд", "Ойниса Мирзоева", "+992 92 200 20 13", "Бизнес", 16, 40, 8, 1, 74, "active", ptrInt(85), 1500, 2000, ""},
		{14, "Pamir Coding", "Хорог", "Алишер Назаров", "+992 93 300 30 14", "Базовый", 6, 3, 1, 15, 1, "active", ptrInt(27), -80, 300, ""},
		{15, "Kids Planet", "Душанбе", "Мехрангез Олимова", "+992 90 100 10 15", "Базовый", 8, 5, 2, 0, 44, "active", ptrInt(120), 600, 300, ""},
		{16, "Лидер", "Исфара", "Карим Тураев", "+992 92 200 20 16", "Базовый", 5, 6, 2, 5, 9, "active", ptrInt(45), 90, 300, ""},
		{17, "Школа будущего", "Душанбе", "Саидаъзам Р.", "+992 90 100 10 17", "Базовый", 0, 0, 1, 40, 0, "blocked", ptrInt(-30), -250, 300, ""},
		{18, "Дониёр Лингва", "Худжанд", "Дониёр Рахмонов", "+992 92 200 20 18", "Старт", 2, 1, 1, 0, 22, "active", nil, 3500, 0, ""},
		{19, "Тарона Скилс", "Душанбе", "Тарона Бобоева", "+992 90 100 10 19", "Старт", 3, 1, 1, 1, 31, "active", nil, 1000, 0, ""},
		{20, "Нур Академия", "Бохтар", "Нурулло Кароматов", "+992 93 300 30 20", "Старт", 1, 1, 1, 0, 12, "active", nil, 5000, 0, ""},
		{21, "Эврика", "Душанбе", "Эмина Саидова", "+992 90 100 10 21", "Базовый", 4, 1, 2, 0, 48, "active", ptrInt(70), 4200, 300, ""},
		{22, "Сармад", "Худжанд", "Сарвар Мирзоев", "+992 92 200 20 22", "Базовый", 6, 6, 2, 2, 57, "active", ptrInt(65), 2600, 300, ""},
		{23, "Фаро", "Куляб", "Фарход Давлатов", "+992 98 400 40 23", "Базовый", 3, 2, 1, 1, 25, "active", ptrInt(55), 800, 300, ""},
		{24, "Паёмбар IT", "Душанбе", "Пайомбар Одинаев", "+992 90 100 10 24", "Про", 6, 4, 2, 0, 64, "active", ptrInt(90), 6000, 800, ""},
		{25, "Дидор", "Исфара", "Дилором Шарипова", "+992 92 200 20 25", "Про", 4, 1, 1, 3, 36, "active", ptrInt(80), 3000, 800, ""},
		{26, "Лидерс Хаб", "Душанбе", "Леонид Исмоилов", "+992 90 100 10 26", "Бизнес", 9, 8, 3, 0, 91, "active", ptrInt(100), 9000, 2000, ""},
		{27, "Мактаби Нав", "Худжанд", "Мастура Каримова", "+992 92 200 20 27", "Бизнес", 3, 1, 1, 1, 40, "active", ptrInt(110), 7500, 2000, ""},
		{28, "Ситораи Шарқ", "Хорог", "Ситора Назарова", "+992 93 300 30 28", "Базовый", 5, 3, 2, 2, 33, "active", ptrInt(60), 1500, 300, ""},
		{29, "Бахт Эдьюкейшн", "Турсунзода", "Бахтиёр Назаров", "+992 90 100 10 29", "Про", 7, 12, 4, 1, 52, "active", ptrInt(75), 450, 800, ""},
	}
}
