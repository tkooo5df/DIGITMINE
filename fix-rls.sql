-- Fix RLS Policies (Allow website to read products and categories)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read visible products" ON products;
CREATE POLICY "public read visible products" ON products FOR SELECT USING (true);

ALTER TABLE product_offers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read active offers" ON product_offers;
CREATE POLICY "public read active offers" ON product_offers FOR SELECT USING (true);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public read visible categories" ON categories;
CREATE POLICY "public read visible categories" ON categories FOR SELECT USING (true);

-- Allow creating orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users create own orders" ON orders;
CREATE POLICY "users create own orders" ON orders FOR INSERT WITH CHECK (true);

-- Fix Missing Telegram Table
CREATE TABLE IF NOT EXISTS telegram_processed_updates (
    update_id BIGINT PRIMARY KEY,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
