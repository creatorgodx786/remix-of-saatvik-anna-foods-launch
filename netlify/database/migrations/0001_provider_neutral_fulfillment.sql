-- PostgreSQL Provider-Neutral Fulfillment & NimbusPost Migration for Saatvik Anna Foods
-- Date: 2026-08-25

-- 1. Provider-Neutral Shipping Fields
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_provider" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_order_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_shipment_id" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_awb" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_courier" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_status" text DEFAULT 'PENDING_SHIPMENT';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_label_url" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_manifest_url" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_invoice_url" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_url" text;

-- 2. Actual Packed Parcel Specifications
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "parcel_weight" numeric(10, 2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "parcel_length" numeric(10, 2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "parcel_breadth" numeric(10, 2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "parcel_height" numeric(10, 2);

-- 3. Webhook Deduplication Table
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "event_type" text NOT NULL,
  "payload_hash" text NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. Indexes for Rapid Status & Webhook Queries
CREATE INDEX IF NOT EXISTS "idx_orders_shipping_awb" ON "orders" ("shipping_awb");
CREATE INDEX IF NOT EXISTS "idx_orders_shipping_status" ON "orders" ("shipping_status");
CREATE INDEX IF NOT EXISTS "idx_orders_shipping_provider" ON "orders" ("shipping_provider");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_provider" ON "webhook_events" ("provider");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_processed_at" ON "webhook_events" ("processed_at" DESC);
