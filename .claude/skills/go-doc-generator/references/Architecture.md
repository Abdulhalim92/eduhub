# Architecture

> **Назначение:** описание архитектурного подхода, слоёв приложения, структуры папок и правил зависимостей между модулями.
> **Связано с:** [Stack.md](./Stack.md), [Database.md](./Database.md)
> **Обновлено:** YYYY-MM

---

## Архитектурный подход

Проект построен по принципам **[Clean Architecture / Hexagonal / Layered / DDD / другое]**.

**Почему этот подход:**
- [причина 1, например: изолируем бизнес-логику от инфраструктуры]
- [причина 2, например: упрощает тестирование]
- [причина 3]

---

## Слои

```
┌─────────────────────────────────────────┐
│         Presentation (HTTP/gRPC)         │  ← контроллеры, DTO, валидация запросов
├─────────────────────────────────────────┤
│         Application (Use Cases)          │  ← оркестрация бизнес-логики
├─────────────────────────────────────────┤
│         Domain (Business Logic)          │  ← сущности, доменные сервисы, правила
├─────────────────────────────────────────┤
│      Infrastructure (DB, External)       │  ← репозитории, внешние API, очереди
└─────────────────────────────────────────┘
```

### Правила зависимостей

- **Зависимости направлены внутрь:** Presentation → Application → Domain. Infrastructure реализует интерфейсы Domain.
- **Domain не знает ничего о внешнем мире:** ни про HTTP, ни про БД, ни про сторонние сервисы.
- **Между слоями общаемся через DTO/интерфейсы**, не через сущности напрямую (кроме Domain ↔ Application).

### Что можно и нельзя

| Откуда | Куда | Можно? |
|--------|------|--------|
| Presentation | Application | ✅ |
| Application | Domain | ✅ |
| Application | Infrastructure (через интерфейс) | ✅ |
| Domain | Infrastructure | ❌ |
| Infrastructure | Domain (имплементация) | ✅ |
| Presentation | Domain напрямую | ❌ |

---

## Структура папок

```
src/
├── presentation/          # HTTP/gRPC контроллеры
│   ├── http/
│   │   ├── controllers/
│   │   ├── middlewares/
│   │   └── dto/
│   └── grpc/
│
├── application/           # Use cases, оркестрация
│   ├── use-cases/
│   │   ├── orders/
│   │   └── users/
│   └── services/
│
├── domain/                # Бизнес-логика (чистая)
│   ├── entities/
│   ├── value-objects/
│   ├── services/
│   └── interfaces/        # Контракты для Infrastructure
│
├── infrastructure/        # Реализация инфраструктуры
│   ├── persistence/       # Репозитории, ORM
│   ├── external/          # Клиенты к внешним API
│   ├── messaging/         # Очереди, брокеры
│   └── config/
│
└── shared/                # Общие утилиты, типы, ошибки
    ├── errors/
    ├── types/
    └── utils/

tests/
├── unit/
├── integration/
└── e2e/
```

---

## Потоки данных

### Типичный HTTP-запрос

```
Client → HTTP Controller → DTO validation → Use Case → Domain Service
                                                     ↓
                                              Repository (interface)
                                                     ↓
                                              ORM/SQL (Infrastructure)
                                                     ↓
                                                 Database
```

Подробнее про конкретные процессы — в [Workflows/](./Workflows/).

---

## Сквозные практики

### Обработка ошибок
- Доменные ошибки → классы-наследники `DomainError` в `shared/errors/`.
- Маппинг доменных ошибок в HTTP-коды — на уровне Presentation (через `ErrorHandler` middleware).
- Никаких `throw new Error('что-то пошло не так')` — только типизированные ошибки.

### Логирование
- Структурированные логи (JSON).
- На входе/выходе use case — `info` с `correlationId`.
- Ошибки — `error` с полным контекстом.

### Транзакции
- Управляются на уровне Application (Use Case), не Domain.
- Паттерн Unit of Work для сложных сценариев.

---

## Архитектурные решения (ADR)

Ключевые решения и их обоснование:

- [решение 1, например: "Почему отказались от микросервисов на старте"]
- [решение 2, например: "Почему выбрали event sourcing для модуля X"]

> Большие изменения архитектуры обсуждаются в PR с тегом `architecture` и требуют апрува от Tech Lead.
