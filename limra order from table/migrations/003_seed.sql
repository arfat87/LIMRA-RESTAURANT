-- ================================================================
-- LIMRA RESTAURANT MANAGEMENT SYSTEM
-- Migration 003: Seed Data
-- ================================================================

-- ── Floor Areas ──────────────────────────────────────────────────
INSERT INTO floor_areas (id, name) VALUES
  (1, 'Indoor'),
  (2, 'Outdoor')
ON CONFLICT (name) DO NOTHING;

-- ── Restaurant Tables (19 total) ─────────────────────────────────
-- INDOOR: Tables 1–9 (area_id=1)
-- Layout:
--   Top Row:    4  5
--   Middle:     3  6  9
--   Lower:      2  7  8
--   Bottom:     1
INSERT INTO restaurant_tables (table_number, area_id, qr_url, capacity) VALUES
  (1,  1, 'https://limraresturent.in/table/1',  4),
  (2,  1, 'https://limraresturent.in/table/2',  4),
  (3,  1, 'https://limraresturent.in/table/3',  4),
  (4,  1, 'https://limraresturent.in/table/4',  4),
  (5,  1, 'https://limraresturent.in/table/5',  4),
  (6,  1, 'https://limraresturent.in/table/6',  4),
  (7,  1, 'https://limraresturent.in/table/7',  4),
  (8,  1, 'https://limraresturent.in/table/8',  4),
  (9,  1, 'https://limraresturent.in/table/9',  6)
ON CONFLICT (table_number) DO NOTHING;

-- OUTDOOR: Tables 10–19 (area_id=2)
-- Layout:
--   Top:              12
--   Left Column:  11, 10, 16
--   Right Column: 13, 14, 15
--   Bottom:       17, 18, 19
INSERT INTO restaurant_tables (table_number, area_id, qr_url, capacity) VALUES
  (10, 2, 'https://limraresturent.in/table/10', 4),
  (11, 2, 'https://limraresturent.in/table/11', 4),
  (12, 2, 'https://limraresturent.in/table/12', 4),
  (13, 2, 'https://limraresturent.in/table/13', 4),
  (14, 2, 'https://limraresturent.in/table/14', 4),
  (15, 2, 'https://limraresturent.in/table/15', 4),
  (16, 2, 'https://limraresturent.in/table/16', 6),
  (17, 2, 'https://limraresturent.in/table/17', 6),
  (18, 2, 'https://limraresturent.in/table/18', 6),
  (19, 2, 'https://limraresturent.in/table/19', 8)
ON CONFLICT (table_number) DO NOTHING;

-- ── Menu Categories ───────────────────────────────────────────────
INSERT INTO menu_categories (id, name, sort_order, is_active) VALUES
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Biryani',         1, true),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Tandoori',        2, true),
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Kababs',          3, true),
  ('a1b2c3d4-0004-0000-0000-000000000004', 'Starters',        4, true),
  ('a1b2c3d4-0005-0000-0000-000000000005', 'Gravies',         5, true),
  ('a1b2c3d4-0006-0000-0000-000000000006', 'Chinese',         6, true),
  ('a1b2c3d4-0007-0000-0000-000000000007', 'Breads',          7, true),
  ('a1b2c3d4-0008-0000-0000-000000000008', 'Rice & Noodles',  8, true),
  ('a1b2c3d4-0009-0000-0000-000000000009', 'Beverages',       9, true),
  ('a1b2c3d4-0010-0000-0000-000000000010', 'Desserts',       10, true)
ON CONFLICT (id) DO NOTHING;

-- ── Sample Menu Items ──────────────────────────────────────────────
INSERT INTO menu_items (category_id, name, description, price, preparation_time, is_available, is_featured) VALUES
  -- Biryani
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Chicken Biryani',        'Hyderabadi style fragrant basmati rice with tender chicken',    180, 20, true, true),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Mutton Biryani',         'Slow-cooked mutton with aromatic spices and saffron rice',       220, 25, true, true),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Egg Biryani',            'Classic biryani with boiled eggs and caramelized onions',        140, 15, true, false),
  ('a1b2c3d4-0001-0000-0000-000000000001', 'Veg Biryani',            'Garden vegetables with fragrant basmati rice',                  130, 15, true, false),
  -- Tandoori
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Tandoori Chicken (Half)','Marinated chicken grilled in traditional clay oven',            200, 25, true, true),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Tandoori Chicken (Full)','Full tandoori chicken — perfectly charred and juicy',           360, 30, true, false),
  ('a1b2c3d4-0002-0000-0000-000000000002', 'Chicken Tikka',          'Boneless chicken pieces marinated in yogurt & spices',          180, 20, true, true),
  -- Kababs
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Irani Kabab',            'Authentic Irani-style minced meat kabab on skewer',             160, 20, true, true),
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Seekh Kabab',            'Spiced minced mutton on skewers, grilled to perfection',        180, 20, true, false),
  ('a1b2c3d4-0003-0000-0000-000000000003', 'Shami Kabab',            'Soft & spicy patties with chana dal and mint chutney',          120, 15, true, false),
  -- Starters
  ('a1b2c3d4-0004-0000-0000-000000000004', 'Chicken Lollipop',       'Crispy fried chicken wings with spicy dipping sauce',           160, 15, true, true),
  ('a1b2c3d4-0004-0000-0000-000000000004', 'Fish Fry',               'Fresh fish marinated in spices, shallow fried golden',          180, 20, true, false),
  ('a1b2c3d4-0004-0000-0000-000000000004', 'Paneer Tikka',           'Cottage cheese marinated in spices, grilled in tandoor',        150, 15, true, false),
  -- Gravies
  ('a1b2c3d4-0005-0000-0000-000000000005', 'Butter Chicken',         'Creamy tomato-based curry with tender chicken pieces',           200, 20, true, true),
  ('a1b2c3d4-0005-0000-0000-000000000005', 'Mutton Rogan Josh',      'Slow-cooked mutton in aromatic Kashmiri spices',                240, 25, true, false),
  ('a1b2c3d4-0005-0000-0000-000000000005', 'Paneer Butter Masala',   'Rich creamy paneer in buttery tomato gravy',                    160, 15, true, false),
  ('a1b2c3d4-0005-0000-0000-000000000005', 'Dal Makhani',            'Black lentils slow-cooked with cream and butter',               120, 20, true, false),
  -- Chinese
  ('a1b2c3d4-0006-0000-0000-000000000006', 'Chilli Chicken (Dry)',   'Crispy chicken tossed in spicy chilli sauce',                   160, 15, true, true),
  ('a1b2c3d4-0006-0000-0000-000000000006', 'Chicken Fried Rice',     'Wok-tossed rice with egg and vegetables',                       120, 12, true, false),
  ('a1b2c3d4-0006-0000-0000-000000000006', 'Veg Hakka Noodles',      'Stir-fried noodles with crispy vegetables',                     100, 12, true, false),
  -- Breads
  ('a1b2c3d4-0007-0000-0000-000000000007', 'Butter Naan',            'Soft leavened bread brushed with butter, baked in tandoor',      30, 8, true, false),
  ('a1b2c3d4-0007-0000-0000-000000000007', 'Garlic Naan',            'Naan topped with garlic and coriander butter',                   40, 8, true, true),
  ('a1b2c3d4-0007-0000-0000-000000000007', 'Tandoori Roti',          'Whole wheat bread from the clay oven',                          20, 6, true, false),
  -- Beverages
  ('a1b2c3d4-0009-0000-0000-000000000009', 'Lassi (Sweet)',          'Chilled yogurt drink — sweet and refreshing',                   60, 3, true, false),
  ('a1b2c3d4-0009-0000-0000-000000000009', 'Cold Drink',             'Assorted cold beverages — Coke, Sprite, etc.',                  40, 2, true, false),
  ('a1b2c3d4-0009-0000-0000-000000000009', 'Mineral Water',          'Packaged drinking water (500ml)',                               20, 1, true, false),
  -- Desserts
  ('a1b2c3d4-0010-0000-0000-000000000010', 'Gulab Jamun',            'Soft milk dumplings soaked in rose-flavored sugar syrup',        60, 5, true, false),
  ('a1b2c3d4-0010-0000-0000-000000000010', 'Phirni',                 'Creamy rice pudding with saffron and cardamom',                  70, 5, true, false)
ON CONFLICT DO NOTHING;
