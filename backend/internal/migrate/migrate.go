// Package migrate применяет версионированные SQL-миграции из встроенной FS
// через golang-migrate (режим библиотеки, без установки CLI). UP/DOWN лежат в
// backend/migrations; правила — .claude/rules/migrations.md.
package migrate

import (
	"embed"
	"errors"
	"fmt"
	"log/slog"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres" // драйвер postgres
	"github.com/golang-migrate/migrate/v4/source/iofs"
)

//go:embed migrations/*.sql
var files embed.FS

func instance(dsn string) (*migrate.Migrate, error) {
	src, err := iofs.New(files, "migrations")
	if err != nil {
		return nil, fmt.Errorf("migrate: source: %w", err)
	}
	m, err := migrate.NewWithSourceInstance("iofs", src, dsn)
	if err != nil {
		return nil, fmt.Errorf("migrate: init: %w", err)
	}
	return m, nil
}

// Up применяет все невыполненные миграции.
func Up(dsn string) error {
	m, err := instance(dsn)
	if err != nil {
		return err
	}
	defer func() { _, _ = m.Close() }()
	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate: up: %w", err)
	}
	slog.Info("migrations applied")
	return nil
}

// Down откатывает все миграции (используется в тестах/локально).
func Down(dsn string) error {
	m, err := instance(dsn)
	if err != nil {
		return err
	}
	defer func() { _, _ = m.Close() }()
	if err := m.Down(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("migrate: down: %w", err)
	}
	return nil
}
