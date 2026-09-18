-- ============================================================
-- Cloth Store - Cloudflare D1 schema + sample catalog
-- Apply with:  wrangler d1 execute cloth-store-db --file=./schema.sql
-- Re-running this RESETS the product catalog to the samples.
-- Orders and settings are preserved on re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  price       INTEGER NOT NULL,              -- amount in paise (INR)
  category    TEXT NOT NULL DEFAULT 'Tees',
  sizes       TEXT NOT NULL DEFAULT '[]',    -- JSON array
  colors      TEXT NOT NULL DEFAULT '[]',    -- JSON array
  description TEXT NOT NULL DEFAULT '',
  stock       INTEGER NOT NULL DEFAULT 0,
  images      TEXT NOT NULL DEFAULT '[]',    -- JSON array of URLs
  featured    INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id            TEXT NOT NULL,
  items               TEXT NOT NULL DEFAULT '[]',   -- JSON array of line items
  customer            TEXT NOT NULL DEFAULT '{}',   -- JSON object
  amount              INTEGER NOT NULL,             -- paise
  currency            TEXT NOT NULL DEFAULT 'INR',
  status              TEXT NOT NULL DEFAULT 'created',  -- created | paid | shipped | delivered | cancelled
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_rzp_order ON orders (razorpay_order_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('brand',         'Your Brand'),
  ('announcement',  'Complimentary shipping on orders over ₹2,999'),
  ('currency',      'INR'),
  ('heroTitle',     'Quietly exceptional essentials'),
  ('heroSub',       'Considered wardrobe staples, crafted from natural fibres and made to be lived in.'),
  ('heroImage',     '/assets/hero.svg'),
  ('supportPhone',  '+91 98765 43210'),
  ('footerText',    'Crafted with care in India.');

-- ------------------------------------------------------------
-- Sample catalog (reset on re-run)
-- ------------------------------------------------------------
DELETE FROM products;

INSERT INTO products (name, slug, price, category, sizes, colors, description, stock, images, featured) VALUES
('Classic Cotton Tee',        'classic-cotton-tee',          79900,  'Tees',       '["S","M","L","XL","XXL"]',  '["White","Black","Navy"]', 'Super-soft 200 GSM combed cotton. The tee you reach for every day. Pre-shrunk and breathable.', 50, '["/assets/p/classic-cotton-tee.svg"]', 1),
('Vintage Logo Tee',          'vintage-logo-tee',            99900,  'Tees',       '["S","M","L","XL","XXL"]',  '["Black","Maroon","Forest"]', 'Faded graphic print on heavyweight cotton with a broken-in vintage feel.', 40, '["/assets/p/vintage-logo-tee.svg"]', 0),
('Oversized Graphic Tee',     'oversized-graphic-tee',      119900,  'Tees',       '["S","M","L","XL"]',       '["White","Black"]', 'Relaxed boxy fit with a bold front print. Cut slightly longer with dropped shoulders.', 35, '["/assets/p/oversized-graphic-tee.svg"]', 0),
('Striped Crew Tee',          'striped-crew-tee',            84900,  'Tees',       '["S","M","L","XL","XXL"]',  '["Navy White","Black White"]', 'Classic Breton stripes knit in soft pima cotton. A smart casual staple.', 45, '["/assets/p/striped-crew-tee.svg"]', 1),
('Pocket Basic Tee',          'pocket-basic-tee',            74900,  'Tees',       '["S","M","L","XL","XXL"]',  '["White","Grey","Olive"]', 'Minimal chest pocket tee in breathable combed cotton. Clean lines, endless styling.', 60, '["/assets/p/pocket-basic-tee.svg"]', 0),
('Essential Hoodie',          'essential-hoodie',           199900,  'Hoodies',    '["S","M","L","XL","XXL"]',  '["Heather Grey","Black","Maroon"]', 'Brushed-back fleece hoodie with a double-layer hood and kangaroo pocket.', 30, '["/assets/p/essential-hoodie.svg"]', 1),
('Pullover Fleece Hoodie',    'pullover-fleece-hoodie',      249900, 'Hoodies',    '["S","M","L","XL","XXL"]',  '["Black","Cream"]', 'Premium 380 GSM fleece with embroidered logo and ribbed cuffs that hold their shape.', 25, '["/assets/p/pullover-fleece-hoodie.svg"]', 0),
('Zip-Up Hoodie',             'zip-up-hoodie',              279900,  'Hoodies',    '["S","M","L","XL","XXL"]',  '["Navy","Black","Burgundy"]', 'Full-zip hoodie with matte metal hardware and lined pockets for cold-weather warmth.', 20, '["/assets/p/zip-up-hoodie.svg"]', 1),
('Heavyweight Oversized Hoodie', 'heavyweight-oversized-hoodie', 299900, 'Hoodies', '["S","M","L","XL"]',      '["Black","Stone","Moss"]', '420 GSM boxy oversized fit. Heavy drape, drop shoulders, made to layer.', 18, '["/assets/p/heavyweight-oversized-hoodie.svg"]', 0),
('Cropped Hoodie',            'cropped-hoodie',             219900,  'Hoodies',    '["S","M","L"]',            '["White","Lavender","Black"]', 'Cropped silhouette fleece hoodie with a fitted band. Trend-led and versatile.', 22, '["/assets/p/cropped-hoodie.svg"]', 0),
('Oxford Button-Down Shirt',  'oxford-button-down-shirt',    149900, 'Shirts',     '["S","M","L","XL","XXL"]',  '["Sky Blue","White","Pink"]', 'Soft-brushed oxford cotton with a classic button-down collar. Office to weekend.', 28, '["/assets/p/oxford-button-down-shirt.svg"]', 0),
('Linen Casual Shirt',        'linen-casual-shirt',         139900,  'Shirts',     '["S","M","L","XL","XXL"]',  '["Sand","White","Olive"]', 'Airy European linen blend, perfect for humid days. Garment washed for softness.', 32, '["/assets/p/linen-casual-shirt.svg"]', 1),
('Flannel Check Shirt',       'flannel-check-shirt',        159900,  'Shirts',     '["S","M","L","XL","XXL"]',  '["Red Black","Forest"]', 'Brushed flannel with a soft hand feel. Roll the sleeves and live in it.', 26, '["/assets/p/flannel-check-shirt.svg"]', 0),
('Denim Work Shirt',          'denim-work-shirt',           179900,  'Shirts',     '["S","M","L","XL","XXL"]',  '["Indigo","Black"]', 'Heavyweight denim overshirt in a classic workwear cut. Ages beautifully.', 20, '["/assets/p/denim-work-shirt.svg"]', 0),
('Poplin Everyday Shirt',     'poplin-everyday-shirt',      129900,  'Shirts',     '["S","M","L","XL","XXL"]',  '["White","Light Blue"]', 'Crisp poplin with a breathable weave. Wrinkle resistant and easy to care for.', 38, '["/assets/p/poplin-everyday-shirt.svg"]', 0),
('Bomber Jacket',             'bomber-jacket',              349900,  'Jackets',    '["S","M","L","XL","XXL"]',  '["Black","Khaki","Burgundy"]', 'Satin bomber with ribbed collar, cuffs and hem. Lightweight with a relaxed finish.', 15, '["/assets/p/bomber-jacket.svg"]', 1),
('Denim Trucker Jacket',      'denim-trucker-jacket',       329900,  'Jackets',    '["S","M","L","XL","XXL"]',  '["Light Wash","Mid Wash"]', 'Authentic trucker styling in rigid denim with brass buttons and chest patch pockets.', 12, '["/assets/p/denim-trucker-jacket.svg"]', 0),
('Puffer Jacket',             'puffer-jacket',              399900,  'Jackets',    '["S","M","L","XL","XXL"]',  '["Black","Navy","Rust"]', 'Quilted warmth with a water-repellent shell. Packs into its own pocket for travel.', 10, '["/assets/p/puffer-jacket.svg"]', 0),
('Leather Biker Jacket',      'leather-biker-jacket',       599900,  'Jackets',    '["S","M","L","XL"]',       '["Black","Brown"]', 'Genuine leather with asymmetric zip, belt and quilted shoulders. A forever piece.', 6,  '["/assets/p/leather-biker-jacket.svg"]', 0),
('Windbreaker',               'windbreaker',                219900,  'Jackets',    '["S","M","L","XL","XXL"]',  '["Cobalt","Black","Orange"]', 'Featherlight packable shell that blocks wind and spits. High-vis retro colourways.', 18, '["/assets/p/windbreaker.svg"]', 0),
('Relaxed Fit Joggers',       'relaxed-fit-joggers',        129900,  'Bottoms',    '["S","M","L","XL","XXL"]',  '["Black","Grey","Navy"]', 'Brushed-back joggers with a tapered leg and zipped pockets. Lounge and beyond.', 40, '["/assets/p/relaxed-fit-joggers.svg"]', 1),
('Stretch Slim Cargo Pants',  'stretch-slim-cargo-pants',   179900,  'Bottoms',    '["28","30","32","34","36"]', '["Olive","Black","Sand"]', 'Slim cargo with stretch twill and six roomy pockets. Utility that actually works.', 24, '["/assets/p/stretch-slim-cargo-pants.svg"]', 0),
('Classic Chino Pants',       'classic-chino-pants',        169900,  'Bottoms',    '["28","30","32","34","36"]', '["Beige","Navy","Black"]', 'Comfort-stretch chinos with a clean taper. Dress them up or down.', 30, '["/assets/p/classic-chino-pants.svg"]', 0),
('Denim Jeans Straight Fit',  'denim-jeans-straight-fit',   189900,  'Bottoms',    '["28","30","32","34","36"]', '["Mid Blue","Black"]', 'Straight-leg denim in durable 12 oz cotton with a touch of stretch for comfort.', 27, '["/assets/p/denim-jeans-straight-fit.svg"]', 0),
('Bucket Hat',                'bucket-hat',                  49900,  'Accessories', '["One Size"]',              '["Black","Khaki","Olive"]', 'Unlined ripstop bucket hat that folds flat. Your summer sun saviour.', 80, '["/assets/p/bucket-hat.svg"]', 0),
('Logo Cap',                  'logo-cap',                    59900,  'Accessories', '["One Size"]',              '["Black","White","Cream"]', 'Six-panel structured cap with embroidered brand mark and adjustable strap.', 70, '["/assets/p/logo-cap.svg"]', 1),
('Cotton Toque',              'cotton-toque',                44900,  'Accessories', '["One Size"]',              '["Charcoal","Maroon","Mustard"]', 'Chunky rib-knit beanie knitted from soft combed cotton. Warmth without the itch.', 65, '["/assets/p/cotton-toque.svg"]', 0),
('Canvas Tote Bag',           'canvas-tote-bag',             69900,  'Accessories', '["One Size"]',              '["Natural","Black"]', 'Heavy 12 oz canvas tote with an inner pocket. Carries everything, folds to nothing.', 90, '["/assets/p/canvas-tote-bag.svg"]', 0),
('Unisex Socks 3 Pack',       'unisex-socks-3-pack',         39900,  'Accessories', '["One Size"]',              '["Mixed"]', 'Combed cotton crew socks, three colourways per pack. Cushioned sole and reinforced heel.', 100, '["/assets/p/unisex-socks-3-pack.svg"]', 0);