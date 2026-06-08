-- ================================================================
-- LIMRA RLS + Helper Functions (split-safe version)
-- ================================================================

-- Enable RLS (already done, safe to re-run)
ALTER TABLE floor_areas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiter_calls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_feedback   ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "floor_areas_public_read" ON floor_areas FOR SELECT USING (true);
CREATE POLICY "tables_public_read" ON restaurant_tables FOR SELECT USING (true);
CREATE POLICY "categories_public_read" ON menu_categories FOR SELECT USING (true);
CREATE POLICY "items_public_read" ON menu_items FOR SELECT USING (true);
CREATE POLICY "orders_public_read" ON orders FOR SELECT USING (true);
CREATE POLICY "order_items_public_read" ON order_items FOR SELECT USING (true);

-- Anon insert policies (customer actions — no auth needed)
CREATE POLICY "orders_anon_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "order_items_anon_insert" ON order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "waiter_calls_anon_insert" ON waiter_calls FOR INSERT WITH CHECK (true);
CREATE POLICY "bill_requests_anon_insert" ON bill_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "feedback_anon_insert" ON customer_feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "payments_anon_insert" ON payments FOR INSERT WITH CHECK (true);

-- Authenticated staff: update orders
CREATE POLICY "orders_auth_update" ON orders FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "tables_auth_update" ON restaurant_tables FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "waiter_calls_auth_read" ON waiter_calls FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "waiter_calls_auth_update" ON waiter_calls FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "bill_requests_auth_read" ON bill_requests FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "bill_requests_auth_update" ON bill_requests FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "payments_auth_all" ON payments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "feedback_auth_read" ON customer_feedback FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "user_roles_auth_read" ON user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user_roles_auth_write" ON user_roles FOR ALL USING (auth.uid() IS NOT NULL);
