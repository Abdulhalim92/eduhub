-- Откат 0002_billing.
DROP TRIGGER IF EXISTS trg_ledger_no_update ON ledger;
DROP FUNCTION IF EXISTS ledger_immutable();
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS invoice_events;
DROP TABLE IF EXISTS ledger;
DROP TABLE IF EXISTS invoices;
DROP SEQUENCE IF EXISTS invoice_number_seq;
