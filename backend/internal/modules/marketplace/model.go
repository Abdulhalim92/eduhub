package marketplace

import (
	"time"

	"github.com/line/eduhub-backend/pkg/money"
)

// Статусы курса, доступа, заявки и источники доступа (PLT-MKT, 85-states.md).
const (
	StatusDraft     = "draft"
	StatusPublished = "published"
	StatusPrivate   = "private" // собственный курс центра (BR-016)

	AccessActive  = "active"
	AccessRevoked = "revoked"

	ReqNew       = "new"
	ReqInvoiced  = "invoiced"
	ReqFulfilled = "fulfilled"
	ReqRejected  = "rejected"

	SourceInvoice = "invoice"
	SourceBalance = "balance"
	SourceBonus   = "bonus"
)

// Типы материалов урока.
var materialTypes = map[string]bool{"plan": true, "video": true, "pdf": true, "slides": true, "test": true}

// Material — единица контента урока (файл имитируется: тип, имя, размер).
type Material struct {
	ID   int64  `json:"id"`
	Type string `json:"type"`
	Name string `json:"name"`
	Size string `json:"size"`
}

// Lesson — урок с материалами.
type Lesson struct {
	ID        int64      `json:"id"`
	Title     string     `json:"title"`
	Materials []Material `json:"materials"`
}

// Module — модуль программы с уроками.
type Module struct {
	ID      int64    `json:"id"`
	Title   string   `json:"title"`
	Lessons []Lesson `json:"lessons"`
}

// Program — программа курса (дерево модули→уроки→материалы), хранится как JSONB.
type Program struct {
	Modules []Module `json:"modules"`
}

// Course — методика: курс платформы (owner_center_id NULL) или собственный курс центра.
type Course struct {
	ID            int64       `gorm:"column:id;primaryKey"`
	Title         string      `gorm:"column:title"`
	Direction     string      `gorm:"column:direction"`
	Description   string      `gorm:"column:description"`
	Note          string      `gorm:"column:note"`
	Status        string      `gorm:"column:status"`
	PriceDiram    money.Diram `gorm:"column:price_diram"`
	OwnerCenterID *int64      `gorm:"column:owner_center_id"`
	Lessons       int         `gorm:"column:lessons"`
	Tests         int         `gorm:"column:tests"`
	BuyersOther   int         `gorm:"column:buyers_other"`
	Content       Program     `gorm:"column:content;type:jsonb;serializer:json"`
	ContentSeq    int64       `gorm:"column:content_seq"`
	CreatedAt     time.Time   `gorm:"column:created_at"`
	UpdatedAt     time.Time   `gorm:"column:updated_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Course) TableName() string { return "courses" }

// IsPlatform сообщает, что это курс платформы (а не собственный курс центра).
func (c Course) IsPlatform() bool { return c.OwnerCenterID == nil }

// Access — доступ центра к курсу (передача методики). Версия фиксируется при выдаче (BR-015).
type Access struct {
	ID             int64      `gorm:"column:id;primaryKey"`
	CenterID       int64      `gorm:"column:center_id"`
	CourseID       int64      `gorm:"column:course_id"`
	Source         string     `gorm:"column:source"`
	InvoiceID      *string    `gorm:"column:invoice_id"`
	Reason         string     `gorm:"column:reason"`
	GrantedAt      time.Time  `gorm:"column:granted_at"`
	Status         string     `gorm:"column:status"`
	RevokedAt      *time.Time `gorm:"column:revoked_at"`
	RevokeReason   string     `gorm:"column:revoke_reason"`
	VersionLessons int        `gorm:"column:version_lessons"`
	VersionTests   int        `gorm:"column:version_tests"`
}

// TableName задаёт имя таблицы для GORM.
func (Access) TableName() string { return "course_access" }

// Request — заявка центра на курс (PLT-MKT-060).
type Request struct {
	ID        int64      `gorm:"column:id;primaryKey"`
	CenterID  int64      `gorm:"column:center_id"`
	CourseID  int64      `gorm:"column:course_id"`
	Status    string     `gorm:"column:status"`
	Note      string     `gorm:"column:note"`
	CreatedAt time.Time  `gorm:"column:created_at"`
	InvoiceID *string    `gorm:"column:invoice_id"`
	Reason    string     `gorm:"column:reason"`
	DecidedAt *time.Time `gorm:"column:decided_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Request) TableName() string { return "course_requests" }
