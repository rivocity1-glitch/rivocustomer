-- RivoCity expanded top-level product categories.
-- Existing UUIDs and product category_id relationships are preserved.
-- New categories are inserted only when the same name does not already exist.
WITH proposed(name, display_order, requires_drug_license) AS (
  VALUES
    ('Grocery & Supermarket', 1, false),
    ('Fruits & Vegetables', 2, false),
    ('Dairy', 3, false),
    ('Bakery', 4, false),
    ('Meat', 5, false),
    ('Seafood', 6, false),
    ('Restaurants & Food', 7, false),
    ('Beverages', 8, false),
    ('Medical', 9, true),
    ('Personal Care', 10, false),
    ('Perfumes & Fragrances', 11, false),
    ('Fashion & Clothing', 12, false),
    ('Jewellery & Accessories', 13, false),
    ('Home & Kitchen', 14, false),
    ('Furniture & Home Decor', 15, false),
    ('Electronics', 16, false),
    ('Automotive', 17, false),
    ('Car & Bike Care', 18, false),
    ('Hardware & Building Materials', 19, false),
    ('Stationery & Books', 20, false),
    ('Toys & Sports', 21, false),
    ('Pet Supplies', 22, false),
    ('Other', 23, false)
)
INSERT INTO public.product_categories (name, status, display_order, requires_drug_license)
SELECT p.name, 'active', p.display_order, p.requires_drug_license
FROM proposed p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.product_categories existing
  WHERE lower(trim(existing.name)) = lower(trim(p.name))
);

-- Activate new categories and normalize display order only for the proposed set.
WITH proposed(name, display_order, requires_drug_license) AS (
  VALUES
    ('Grocery & Supermarket', 1, false),
    ('Fruits & Vegetables', 2, false),
    ('Dairy', 3, false),
    ('Bakery', 4, false),
    ('Meat', 5, false),
    ('Seafood', 6, false),
    ('Restaurants & Food', 7, false),
    ('Beverages', 8, false),
    ('Medical', 9, true),
    ('Personal Care', 10, false),
    ('Perfumes & Fragrances', 11, false),
    ('Fashion & Clothing', 12, false),
    ('Jewellery & Accessories', 13, false),
    ('Home & Kitchen', 14, false),
    ('Furniture & Home Decor', 15, false),
    ('Electronics', 16, false),
    ('Automotive', 17, false),
    ('Car & Bike Care', 18, false),
    ('Hardware & Building Materials', 19, false),
    ('Stationery & Books', 20, false),
    ('Toys & Sports', 21, false),
    ('Pet Supplies', 22, false),
    ('Other', 23, false)
)
UPDATE public.product_categories c
SET status = 'active',
    display_order = p.display_order,
    requires_drug_license = p.requires_drug_license,
    updated_at = now()
FROM proposed p
WHERE lower(trim(c.name)) = lower(trim(p.name));

SELECT id, name, status, display_order, requires_drug_license
FROM public.product_categories
ORDER BY display_order, name;
