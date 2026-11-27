// Package audit пишет неизменяемый журнал аудита (BR-010, NFR-SEC-020):
// денежные, тарифные и правовые действия фиксируются с «было → стало» и причиной.
// Запись идёт в переданный *gorm.DB — для денежных операций это транзакция вызова (money.md).
package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// Entry — строка журнала аудита (таблица audit_log, только добавление).
type Entry struct {
	ID         int64           `gorm:"column:id;primaryKey"`
	At         time.Time       `gorm:"column:at"`
	ActorName  string          `gorm:"column:actor_name"`
	ActorRole  string          `gorm:"column:actor_role"`
	IP         *string         `gorm:"column:ip"`
	Device     *string         `gorm:"column:device"`
	Action     string          `gorm:"column:action"`
	EntityType string          `gorm:"column:entity_type"`
	EntityID   *string         `gorm:"column:entity_id"`
	EntityName *string         `gorm:"column:entity_name"`
	Before     json.RawMessage `gorm:"column:before;type:jsonb"`
	After      json.RawMessage `gorm:"column:after;type:jsonb"`
	Reason     *string         `gorm:"column:reason"`
}

// TableName задаёт имя таблицы для GORM.
func (Entry) TableName() string { return "audit_log" }

// Actor — кто совершил действие (ФИО, роль, IP, устройство).
type Actor struct {
	Name   string
	Role   string
	IP     string
	Device string
}

// Event — описание аудируемого действия.
type Event struct {
	Actor      Actor
	Action     string // напр. plan.created, plan.updated, center.manager_changed
	EntityType string // plan | center | user
	EntityID   string
	EntityName string
	Before     any
	After       any
	Reason     string
}

// Recorder пишет события в журнал.
type Recorder struct{}

// New создаёт Recorder.
func New() *Recorder { return &Recorder{} }

// Log добавляет запись в журнал. db может быть транзакцией вызывающей операции.
func (r *Recorder) Log(ctx context.Context, db *gorm.DB, ev Event) error {
	before, err := marshal(ev.Before)
	if err != nil {
		return fmt.Errorf("audit: before: %w", err)
	}
	after, err := marshal(ev.After)
	if err != nil {
		return fmt.Errorf("audit: after: %w", err)
	}
	entry := Entry{
		At:         time.Now().UTC(),
		ActorName:  ev.Actor.Name,
		ActorRole:  ev.Actor.Role,
		IP:         ptr(ev.Actor.IP),
		Device:     ptr(ev.Actor.Device),
		Action:     ev.Action,
		EntityType: ev.EntityType,
		EntityID:   ptr(ev.EntityID),
		EntityName: ptr(ev.EntityName),
		Before:     before,
		After:      after,
		Reason:     ptr(ev.Reason),
	}
	if err := db.WithContext(ctx).Create(&entry).Error; err != nil {
		return fmt.Errorf("audit: insert: %w", err)
	}
	return nil
}

func marshal(v any) (json.RawMessage, error) {
	if v == nil {
		return nil, nil
	}
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	return b, nil
}

func ptr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
