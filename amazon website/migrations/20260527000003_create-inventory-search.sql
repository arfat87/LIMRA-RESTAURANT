-- Inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0,
  reserved INT NOT NULL DEFAULT 0,
  warehouse TEXT DEFAULT 'main',
  low_stock_threshold INT DEFAULT 10,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, variant_id, warehouse)
);

-- Add full-text search to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;

CREATE OR REPLACE FUNCTION public.update_product_search()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.title,'') || ' ' ||
    coalesce(NEW.short_description,'') || ' ' ||
    coalesce(array_to_string(NEW.tags,' '),'')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_search_update ON public.products;
CREATE TRIGGER products_search_update
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_product_search();

CREATE INDEX IF NOT EXISTS products_search_idx ON public.products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products(category_id);
CREATE INDEX IF NOT EXISTS products_seller_idx ON public.products(seller_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON public.products(status);
CREATE INDEX IF NOT EXISTS products_featured_idx ON public.products(is_featured) WHERE is_featured = TRUE;

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory_public_read" ON public.inventory FOR SELECT USING (true);
