-- Seed categories
INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('Electronics', 'electronics', '💻', 1),
  ('Clothing & Fashion', 'clothing-fashion', '👗', 2),
  ('Home & Kitchen', 'home-kitchen', '🏠', 3),
  ('Books', 'books', '📚', 4),
  ('Sports & Outdoors', 'sports-outdoors', '⚽', 5),
  ('Beauty & Personal Care', 'beauty-personal-care', '💄', 6),
  ('Toys & Games', 'toys-games', '🎮', 7),
  ('Automotive', 'automotive', '🚗', 8)
ON CONFLICT (slug) DO NOTHING;

-- Seed brands
INSERT INTO public.brands (name, slug, is_verified) VALUES
  ('Apple', 'apple', TRUE),
  ('Samsung', 'samsung', TRUE),
  ('Nike', 'nike', TRUE),
  ('Adidas', 'adidas', TRUE),
  ('Sony', 'sony', TRUE),
  ('Amazon Basics', 'amazon-basics', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- Create a search RPC for full-text search
CREATE OR REPLACE FUNCTION public.search_products(query TEXT, page_size INT DEFAULT 20, page_offset INT DEFAULT 0)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  price DECIMAL,
  compare_price DECIMAL,
  rating DECIMAL,
  review_count INT,
  status TEXT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.title, p.slug, p.price, p.compare_price, p.rating, p.review_count, p.status
  FROM public.products p
  WHERE p.status = 'active'
    AND (query = '' OR p.search_vector @@ plainto_tsquery('english', query))
  ORDER BY
    CASE WHEN query = '' THEN 0 ELSE ts_rank(p.search_vector, plainto_tsquery('english', query)) END DESC,
    p.sold_count DESC
  LIMIT page_size OFFSET page_offset;
END;
$$;
