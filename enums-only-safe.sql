-- ============================================
-- Safe Migration - Skips Already Existing Objects
-- ============================================

-- =============================================================
-- ENUMS (Skip if already exist)
-- =============================================================
DO $$ BEGIN
  create type public.app_role as enum ('admin', 'customer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  create type public.order_status as enum ('pending','submitted','verified','processing','delivered','completed','cancelled','refunded','disputed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  create type public.payment_status as enum ('pending','submitted','approved','rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  create type public.delivery_type as enum ('auto','manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  create type public.payment_method as enum ('binance','baridimob','ccp');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  create type public.coupon_type as enum ('percent','fixed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
