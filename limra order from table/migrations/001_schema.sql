-- ================================================================
-- LIMRA RESTAURANT MANAGEMENT SYSTEM
-- Migration 001: Core Schema
-- ================================================================

-- ── Floor Areas ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS floor_areas (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

-- ── Restaurant Tables ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number INT  NOT NULL UNIQUE,
  area_id      INT  NOT NULL REFERENCES floor_areas(id) ON DELETE RESTRICT,
  qr_url       TEXT,
  status       TEXT NOT NULL DEFAULT 'available'
                CHECK (status IN ('available','occupied','ordering','preparing','served','billing_requested','closed')),
  capacity     INT  NOT NULL DEFAULT 4,
  is_active    BOOL NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── User Roles ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('admin','manager','kitchen','cashier','waiter')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ── Menu Categories ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  image_url  TEXT,
  image_key  TEXT,
  sort_order INT  NOT NULL DEFAULT 0,
  is_active  BOOL NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Menu Items ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS menu_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id      UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  price            NUMERIC(10,2) NOT NULL CHECK (price >= 0),
  discount_price   NUMERIC(10,2) CHECK (discount_price >= 0),
  image_url        TEXT,
  image_key        TEXT,
  preparation_time INT  DEFAULT 15,
  is_available     BOOL NOT NULL DEFAULT true,
  is_featured      BOOL NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Orders ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number   TEXT NOT NULL UNIQUE,
  table_id       UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
  area_id        INT  NOT NULL REFERENCES floor_areas(id) ON DELETE RESTRICT,
  subtotal       NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax            NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  grand_total    NUMERIC(10,2) NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','accepted','preparing','ready','served','completed','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid'
                 CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Order Items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id        UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  quantity            INT  NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC(10,2) NOT NULL,
  total_price         NUMERIC(10,2) NOT NULL,
  special_instruction TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Payments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','upi','phonepe','gpay','paytm','razorpay','card')),
  transaction_id TEXT,
  amount         NUMERIC(10,2) NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','completed','failed','refunded')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Waiter Calls ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS waiter_calls (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id     UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','acknowledged','resolved')),
  responded_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Bill Requests ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bill_requests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id   UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  order_id   UUID REFERENCES orders(id) ON DELETE SET NULL,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','processing','completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Customer Feedback ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_feedback (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  rating     INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  feedback   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Order Number Sequence Function ───────────────────────────────
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  seq_part  TEXT;
BEGIN
  year_part := EXTRACT(YEAR FROM now())::TEXT;
  seq_part  := LPAD(nextval('order_number_seq')::TEXT, 4, '0');
  RETURN 'LIM-' || year_part || '-' || seq_part;
END;
$$ LANGUAGE plpgsql;

-- ── Indexes for performance ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_table_id     ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_status       ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at   ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_waiter_calls_table  ON waiter_calls(table_id);
CREATE INDEX IF NOT EXISTS idx_bill_requests_table ON bill_requests(table_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user     ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_tables_status       ON restaurant_tables(status);
