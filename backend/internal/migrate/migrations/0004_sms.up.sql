-- 0004_sms — биллинг SMS-пакетов (PLT-SMS): каталог пакетов и история продаж/начислений.
-- Деньги: BIGINT в дирамах. Цена хранится в строке продажи (BR-020 — смена цены пакета
-- действует только на новые продажи). Таблицы создаются пустыми — обычный CREATE INDEX.

CREATE TABLE sms_packages (
    id          TEXT PRIMARY KEY,
    sms         INTEGER NOT NULL CHECK (sms > 0),
    price_diram BIGINT NOT NULL CHECK (price_diram >= 0),
    description TEXT NOT NULL DEFAULT '',
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE sms_sale_seq START 2050;

CREATE TABLE sms_sales (
    id          TEXT PRIMARY KEY,
    center_id   BIGINT NOT NULL REFERENCES centers(id),
    package_id  TEXT NOT NULL REFERENCES sms_packages(id),
    sms         INTEGER NOT NULL,
    remaining   INTEGER NOT NULL CHECK (remaining >= 0),
    price_diram BIGINT NOT NULL,
    bought_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    status      TEXT NOT NULL CHECK (status IN ('paid', 'bonus')),
    method      TEXT NOT NULL DEFAULT '',
    reference   TEXT NOT NULL DEFAULT '',
    reason      TEXT NOT NULL DEFAULT '',
    actor_name  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_sms_sales_center ON sms_sales (center_id);
CREATE INDEX idx_sms_sales_package ON sms_sales (package_id);
CREATE INDEX idx_sms_sales_status ON sms_sales (status);
