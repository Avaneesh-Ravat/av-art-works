CREATE TABLE IF NOT EXISTS payments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID NOT NULL,
    user_id           UUID NOT NULL,
    gateway           TEXT NOT NULL CHECK (gateway IN ('razorpay','cod')),
    gateway_order_id  TEXT,
    gateway_payment_id TEXT,
    amount_paise      BIGINT NOT NULL CHECK (amount_paise >= 0),
    status            TEXT NOT NULL DEFAULT 'created'
                      CHECK (status IN ('created','authorized','captured','failed','refunded')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

CREATE TABLE IF NOT EXISTS refunds (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id   UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    gateway_refund_id TEXT,
    amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
    status       TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('pending','processed','failed')),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);

-- Webhook event log for idempotency / auditing.
CREATE TABLE IF NOT EXISTS payment_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id   TEXT UNIQUE,
    type       TEXT NOT NULL,
    payload    JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
