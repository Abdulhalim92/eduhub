# Бэкенд «Линия». На Windows без make используйте команды из README (эквиваленты в PowerShell).
export DATABASE_URL ?= postgres://eduhub:eduhub@127.0.0.1:5433/eduhub?sslmode=disable

.PHONY: db-up db-down build run seed test lint vet vuln migrate-down check

db-up:          ## поднять Postgres в docker
	docker compose up -d

db-down:        ## остановить Postgres
	docker compose down

build:
	go build ./...

run:
	go run ./cmd/api

seed:           ## наполнить БД демо-данными (миграции применяются автоматически)
	go run ./cmd/seed

test:
	go test ./... -race -count=1

vet:
	go vet ./...

lint:
	golangci-lint run

vuln:
	govulncheck ./...

check: build vet test lint vuln   ## полный набор проверок перед «готово»
