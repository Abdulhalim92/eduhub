# Makefile (полный набор таргетов)

```makefile
SERVICE := {{SERVICE}}
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BUILD_FLAGS := -trimpath -ldflags="-s -w -X main.version=$(VERSION)"

.PHONY: build test lint fmt vet tidy vuln cover run \
        migrate-up migrate-down migrate-create migrate-force \
        docker-build compose-up compose-down ci gen

## Разработка
build:
	go build $(BUILD_FLAGS) -o bin/$(SERVICE) ./cmd/$(SERVICE)

run:
	go run ./cmd/$(SERVICE)

run-local:
	set -a && . ./.env && set +a && go run ./cmd/$(SERVICE)

## Качество кода
fmt:
	go fmt ./...
	goimports -w .

vet:
	go vet ./...

lint:
	golangci-lint run ./...

tidy:
	go mod tidy

vuln:
	govulncheck ./...

## Тесты
test:
	go test ./... -race -count=1

cover:
	go test ./... -race -coverprofile=coverage.out -covermode=atomic
	go tool cover -html=coverage.out -o coverage.html

bench:
	go test -bench=. -benchmem ./...

## Миграции
migrate-up:
	migrate -path migrations -database "$$DATABASE_URL" up

migrate-down:
	migrate -path migrations -database "$$DATABASE_URL" down 1

migrate-create:
	@read -p "Название миграции: " name; \
	migrate create -ext sql -dir migrations -seq $$name

migrate-force:
	@read -p "Версия (номер): " ver; \
	migrate -path migrations -database "$$DATABASE_URL" force $$ver

## Docker
docker-build:
	docker build \
		--platform=linux/amd64 \
		--build-arg VERSION=$(VERSION) \
		-t $(SERVICE):$(VERSION) \
		-t $(SERVICE):latest .

compose-up:
	docker compose up -d

compose-down:
	docker compose down

## Генерация
gen:
	go generate ./...

## CI (агрегатор)
ci: fmt vet lint test vuln build
```
