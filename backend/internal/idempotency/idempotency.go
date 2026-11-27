// Package idempotency обеспечивает безопасный повтор денежных мутаций: запрос с тем же
// Idempotency-Key возвращает прежний результат, а не применяет операцию второй раз (money.md).
// Claim захватывает ключ внутри транзакции операции (атомарно с проводкой), Complete пишет ответ.
package idempotency

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/line/eduhub-backend/pkg/apierr"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrInProgress — ключ захвачен, но результат ещё не записан (параллельный запрос).
var ErrInProgress = errors.New("idempotency: операция с этим ключом ещё выполняется")

// errReplay — внутренний сигнал: ключ уже захвачен, нужно вернуть сохранённый ответ.
var errReplay = errors.New("idempotency: replay")

// Record — сохранённый ответ по ключу.
type Record struct {
	Endpoint   string          `gorm:"column:endpoint"`
	Key        string          `gorm:"column:key"`
	StatusCode int             `gorm:"column:status_code"`
	Response   json.RawMessage `gorm:"column:response"`
	CreatedAt  time.Time       `gorm:"column:created_at"`
}

// TableName задаёт имя таблицы для GORM.
func (Record) TableName() string { return "idempotency_keys" }

// Store работает с таблицей idempotency_keys.
type Store struct{ db *gorm.DB }

// New создаёт Store.
func New(db *gorm.DB) *Store { return &Store{db: db} }

// Stored возвращает завершённый результат по ключу (status_code != 0).
func (s *Store) Stored(ctx context.Context, endpoint, key string) (*Record, bool, error) {
	var rec Record
	err := s.db.WithContext(ctx).First(&rec, "endpoint = ? AND key = ?", endpoint, key).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, fmt.Errorf("idempotency: lookup: %w", err)
	}
	if rec.StatusCode == 0 {
		return nil, false, ErrInProgress
	}
	return &rec, true, nil
}

// Claim захватывает ключ внутри транзакции tx. Возвращает true, если ключ свободен и захвачен.
// false — ключ уже кем-то занят (ответ смотреть через Stored).
func (s *Store) Claim(ctx context.Context, tx *gorm.DB, endpoint, key string) (bool, error) {
	rec := Record{Endpoint: endpoint, Key: key, StatusCode: 0, Response: json.RawMessage("null")}
	res := tx.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&rec)
	if res.Error != nil {
		return false, fmt.Errorf("idempotency: claim: %w", res.Error)
	}
	return res.RowsAffected == 1, nil
}

// Complete записывает финальный ответ по захваченному ключу (в той же транзакции).
func (s *Store) Complete(ctx context.Context, tx *gorm.DB, endpoint, key string, statusCode int, body any) error {
	resp, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("idempotency: marshal: %w", err)
	}
	err = tx.WithContext(ctx).Model(&Record{}).
		Where("endpoint = ? AND key = ?", endpoint, key).
		Updates(map[string]any{"status_code": statusCode, "response": json.RawMessage(resp)}).Error
	if err != nil {
		return fmt.Errorf("idempotency: complete: %w", err)
	}
	return nil
}

// Do выполняет денежную мутацию идемпотентно. Если key пуст — просто выполняет fn в транзакции.
// Повтор с тем же ключом возвращает прежний результат, а не применяет операцию снова (money.md).
// Захват ключа, работа fn и запись ответа коммитятся одной транзакцией — атомарно с проводкой.
func Do[T any](ctx context.Context, db *gorm.DB, store *Store, endpoint, key string, fn func(tx *gorm.DB) (T, error)) (T, error) {
	var zero T
	if key != "" {
		if replay, ok, err := lookupReplay[T](ctx, store, endpoint, key); err != nil {
			return zero, err
		} else if ok {
			return replay, nil
		}
	}

	var out T
	err := db.Transaction(func(tx *gorm.DB) error {
		if key != "" {
			claimed, e := store.Claim(ctx, tx, endpoint, key)
			if e != nil {
				return e
			}
			if !claimed {
				return errReplay
			}
		}
		r, e := fn(tx)
		if e != nil {
			return e
		}
		out = r
		if key != "" {
			return store.Complete(ctx, tx, endpoint, key, 200, r)
		}
		return nil
	})
	if errors.Is(err, errReplay) {
		replay, ok, e := lookupReplay[T](ctx, store, endpoint, key)
		if e != nil {
			return zero, e
		}
		if ok {
			return replay, nil
		}
		return zero, apierr.Conflict("Повторная операция ещё выполняется, повторите позже")
	}
	if err != nil {
		return zero, err
	}
	return out, nil
}

func lookupReplay[T any](ctx context.Context, store *Store, endpoint, key string) (T, bool, error) {
	var zero T
	rec, ok, err := store.Stored(ctx, endpoint, key)
	if err != nil {
		if errors.Is(err, ErrInProgress) {
			return zero, false, apierr.Conflict("Операция с этим ключом ещё выполняется, повторите позже")
		}
		return zero, false, err
	}
	if !ok {
		return zero, false, nil
	}
	var out T
	if e := json.Unmarshal(rec.Response, &out); e != nil {
		return zero, false, fmt.Errorf("idempotency: unmarshal stored: %w", e)
	}
	return out, true, nil
}
