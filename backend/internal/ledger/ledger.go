// Package ledger — единственное место изменения баланса центра. Любое списание/пополнение
// идёт в транзакции вызова, под блокировкой строки центра (FOR UPDATE), с записью проводки.
// Баланс центра (centers.balance_diram) — проверяемый кэш; источник истины — сумма проводок.
// См. .claude/rules/money.md (BR-005, атомарность, append-only).
package ledger

import (
	"context"
	"fmt"
	"time"

	"github.com/line/eduhub-backend/pkg/apierr"
	"github.com/line/eduhub-backend/pkg/money"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Entry — проводка по балансу (таблица ledger, только добавление).
type Entry struct {
	ID                int64       `gorm:"column:id;primaryKey"`
	CenterID          int64       `gorm:"column:center_id"`
	At                time.Time   `gorm:"column:at"`
	Type              string      `gorm:"column:type"` // topup | charge
	AmountDiram       money.Diram `gorm:"column:amount_diram"`
	BalanceAfterDiram money.Diram `gorm:"column:balance_after_diram"`
	Method            string      `gorm:"column:method"`
	Reference         string      `gorm:"column:reference"`
	InvoiceID         *string     `gorm:"column:invoice_id"`
	ActorName         string      `gorm:"column:actor_name"`
	Comment           string      `gorm:"column:comment"`
}

// TableName задаёт имя таблицы для GORM.
func (Entry) TableName() string { return "ledger" }

// Meta — реквизиты проводки (способ, документ, счёт, кто, комментарий).
type Meta struct {
	Method    string
	Reference string
	InvoiceID *string
	ActorName string
	Comment   string
}

type lockRow struct {
	BalanceDiram        money.Diram `gorm:"column:balance_diram"`
	OverdraftLimitDiram money.Diram `gorm:"column:overdraft_limit_diram"`
	Status              string      `gorm:"column:status"`
}

// lockCenter блокирует строку центра (FOR UPDATE) и читает баланс/овердрафт/статус.
func lockCenter(ctx context.Context, tx *gorm.DB, centerID int64) (lockRow, error) {
	var row lockRow
	res := tx.WithContext(ctx).Clauses(clause.Locking{Strength: "UPDATE"}).
		Table("centers").
		Select("balance_diram", "overdraft_limit_diram", "status").
		Where("id = ?", centerID).
		Scan(&row)
	if res.Error != nil {
		return lockRow{}, fmt.Errorf("ledger: lock center: %w", res.Error)
	}
	if res.RowsAffected == 0 {
		return lockRow{}, apierr.NotFound("Центр не найден")
	}
	return row, nil
}

func write(ctx context.Context, tx *gorm.DB, centerID int64, newBalance money.Diram, entryType string, amount money.Diram, m Meta) error {
	if err := tx.WithContext(ctx).Exec(
		"UPDATE centers SET balance_diram = ?, updated_at = now() WHERE id = ?", int64(newBalance), centerID,
	).Error; err != nil {
		return fmt.Errorf("ledger: update balance: %w", err)
	}
	entry := Entry{
		CenterID:          centerID,
		At:                time.Now().UTC(),
		Type:              entryType,
		AmountDiram:       amount,
		BalanceAfterDiram: newBalance,
		Method:            m.Method,
		Reference:         m.Reference,
		InvoiceID:         m.InvoiceID,
		ActorName:         m.ActorName,
		Comment:           m.Comment,
	}
	if err := tx.WithContext(ctx).Create(&entry).Error; err != nil {
		return fmt.Errorf("ledger: insert entry: %w", err)
	}
	return nil
}

// Charge списывает сумму с баланса в пределах «баланс + овердрафт» (BR-005).
// Вызывается внутри транзакции; возвращает остаток после списания.
func Charge(ctx context.Context, tx *gorm.DB, centerID int64, amount money.Diram, m Meta) (money.Diram, error) {
	if amount <= 0 {
		return 0, apierr.Validation("Сумма списания должна быть положительной", nil)
	}
	row, err := lockCenter(ctx, tx, centerID)
	if err != nil {
		return 0, err
	}
	if row.BalanceDiram+row.OverdraftLimitDiram < amount {
		return 0, apierr.Field(
			fmt.Sprintf("Недостаточно средств на балансе на платформе: доступно %d, нужно %d сомони",
				(row.BalanceDiram+row.OverdraftLimitDiram).Somoni(), amount.Somoni()),
			"balance", "Пополните баланс или увеличьте лимит овердрафта")
	}
	newBalance := row.BalanceDiram - amount
	if err := write(ctx, tx, centerID, newBalance, "charge", -amount, m); err != nil {
		return 0, err
	}
	return newBalance, nil
}

// TopUp пополняет баланс. Вызывается внутри транзакции; возвращает новый остаток.
func TopUp(ctx context.Context, tx *gorm.DB, centerID int64, amount money.Diram, m Meta) (money.Diram, error) {
	if amount <= 0 {
		return 0, apierr.Validation("Сумма пополнения должна быть положительной", nil)
	}
	row, err := lockCenter(ctx, tx, centerID)
	if err != nil {
		return 0, err
	}
	newBalance := row.BalanceDiram + amount
	if err := write(ctx, tx, centerID, newBalance, "topup", amount, m); err != nil {
		return 0, err
	}
	return newBalance, nil
}
