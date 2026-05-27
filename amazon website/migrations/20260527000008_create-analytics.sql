-- Analytics Events
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  page_url TEXT,
  referrer TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS analytics_event_idx ON public.analytics_events(event, created_at);
CREATE INDEX IF NOT EXISTS analytics_user_idx ON public.analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);
CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders(user_id, created_at);
CREATE INDEX IF NOT EXISTS notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS reviews_product_idx ON public.reviews(product_id, is_approved);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "analytics_insert" ON public.analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "analytics_user_read" ON public.analytics_events FOR SELECT USING (auth.uid() = user_id);
