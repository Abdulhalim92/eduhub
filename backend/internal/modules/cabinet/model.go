package cabinet

import (
	"strconv"
	"strings"
	"time"
)

// Роли сотрудников и их подписи (CTR-STF). Роль «менеджер» центра не используется (ТЗ v2.5).
const (
	RoleTeacher = "teacher"
	RoleAdmin   = "admin"

	StaffActive    = "active"
	StaffDismissed = "dismissed"

	StudentActive  = "active"
	StudentBlocked = "blocked"

	GroupActive   = "active"
	GroupArchived = "archived"
)

var staffRoleLabels = map[string]string{RoleTeacher: "Преподаватель", RoleAdmin: "Администратор"}

// weekDays — подписи дней недели (индексы 0–6 = Пн..Вс).
var weekDays = []string{"Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"}

// schedules — именованные наборы дней (как SCHEDULES в api.js).
var schedules = map[string][]int{
	"Пн, Ср, Пт": {0, 2, 4},
	"Вт, Чт, Сб": {1, 3, 5},
	"Пн, Чт":     {0, 3},
	"Сб, Вс":     {5, 6},
	"Пн–Пт":      {0, 1, 2, 3, 4},
}

var scheduleKeys = []string{"Пн, Ср, Пт", "Вт, Чт, Сб", "Пн, Чт", "Сб, Вс", "Пн–Пт"}

// Статусы награды и области правил coin (CTR-RWD/CIN).
const (
	RewardActive   = "active"
	RewardArchived = "archived"
)

// rewardCategories — категории поощрений (как REWARD_CATEGORIES в api.js).
var rewardCategories = []string{"Скидки", "Мерч", "Канцелярия", "Опыт"}

// coinScopes — области автоправил (как COIN_SCOPES в api.js).
var coinScopes = map[string]string{"academy": "Вся академия", "course": "Курс", "group": "Группа"}

// Reward — поощрение за coin (CTR-RWD).
type Reward struct {
	ID        int64     `gorm:"column:id;primaryKey"`
	CenterID  int64     `gorm:"column:center_id"`
	Name      string    `gorm:"column:name"`
	Category  string    `gorm:"column:category"`
	Price     int       `gorm:"column:price"`
	Status    string    `gorm:"column:status"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Reward) TableName() string { return "rewards" }

// CoinRule — автоправило начисления coin (CTR-CIN).
type CoinRule struct {
	ID        int64     `gorm:"column:id;primaryKey"`
	CenterID  int64     `gorm:"column:center_id"`
	Name      string    `gorm:"column:name"`
	Scope     string    `gorm:"column:scope"`
	Threshold int       `gorm:"column:threshold"`
	Coin      int       `gorm:"column:coin"`
	Active    bool      `gorm:"column:active"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (CoinRule) TableName() string { return "coin_rules" }

// CenterProfile — профиль центра (CTR-PRF).
type CenterProfile struct {
	CenterID    int64     `gorm:"column:center_id;primaryKey"`
	Direction   string    `gorm:"column:direction"`
	Description string    `gorm:"column:description"`
	FoundedYear *int      `gorm:"column:founded_year"`
	Logo        string    `gorm:"column:logo"`
	Banner      string    `gorm:"column:banner"`
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (CenterProfile) TableName() string { return "center_profiles" }

// Staff — сотрудник центра.
type Staff struct {
	ID          int64      `gorm:"column:id;primaryKey"`
	CenterID    int64      `gorm:"column:center_id"`
	Name        string     `gorm:"column:name"`
	Role        string     `gorm:"column:role"`
	Phone       string     `gorm:"column:phone"`
	Status      string     `gorm:"column:status"`
	HiredAt     time.Time  `gorm:"column:hired_at"`
	DismissedAt *time.Time `gorm:"column:dismissed_at"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Staff) TableName() string { return "staff" }

// Group — учебная группа.
type Group struct {
	ID          int64      `gorm:"column:id;primaryKey"`
	CenterID    int64      `gorm:"column:center_id"`
	Name        string     `gorm:"column:name"`
	Course      string     `gorm:"column:course"`
	Branch      string     `gorm:"column:branch"`
	TeacherID   *int64     `gorm:"column:teacher_id"`
	Status      string     `gorm:"column:status"`
	Days        string     `gorm:"column:days"` // "0,2,4"
	StartTime   string     `gorm:"column:start_time"`
	DurationMin int        `gorm:"column:duration_min"`
	HWPoints    int        `gorm:"column:hw_points"`
	VisitPoints int        `gorm:"column:visit_points"`
	ExamDay     int        `gorm:"column:exam_day"`
	ExamPoints  int        `gorm:"column:exam_points"`
	Capacity    int        `gorm:"column:capacity"`
	StartsAt    *time.Time `gorm:"column:starts_at"`
	EndsAt      *time.Time `gorm:"column:ends_at"`
	CreatedAt   time.Time  `gorm:"column:created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Group) TableName() string { return "groups" }

// DayList разбирает CSV дней в срез индексов.
func (g Group) DayList() []int { return parseDays(g.Days) }

// Student — ученик центра.
type Student struct {
	ID        int64     `gorm:"column:id;primaryKey"`
	CenterID  int64     `gorm:"column:center_id"`
	Name      string    `gorm:"column:name"`
	Phone     string    `gorm:"column:phone"`
	Status    string    `gorm:"column:status"`
	GroupID   *int64    `gorm:"column:group_id"`
	JoinedAt  time.Time `gorm:"column:joined_at"`
	Coin      int       `gorm:"column:coin"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Student) TableName() string { return "students" }

func parseDays(csv string) []int {
	csv = strings.TrimSpace(csv)
	if csv == "" {
		return []int{}
	}
	parts := strings.Split(csv, ",")
	out := make([]int, 0, len(parts))
	for _, p := range parts {
		if n, err := strconv.Atoi(strings.TrimSpace(p)); err == nil {
			out = append(out, n)
		}
	}
	return out
}

func daysToCSV(days []int) string {
	parts := make([]string, 0, len(days))
	for _, d := range days {
		parts = append(parts, strconv.Itoa(d))
	}
	return strings.Join(parts, ",")
}
