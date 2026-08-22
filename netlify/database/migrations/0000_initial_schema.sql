-- PostgreSQL Initial Schema Migration for Saatvik Anna Foods

CREATE TABLE IF NOT EXISTS "admins" (
  "id" text PRIMARY KEY NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "role" text DEFAULT 'owner' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" text PRIMARY KEY NOT NULL, -- SHA-256 hash of the session token
  "admin_id" text NOT NULL REFERENCES "admins"("id") ON DELETE CASCADE,
  "email" text NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "orders" (
  "id" text PRIMARY KEY NOT NULL,
  "order_number" text NOT NULL UNIQUE,
  "cashfree_order_id" text NOT NULL UNIQUE,
  "cashfree_payment_id" text,
  "customer_name" text NOT NULL,
  "customer_phone" text NOT NULL,
  "customer_email" text,
  "shipping_address" text NOT NULL,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "pincode" text NOT NULL,
  "product_name" text DEFAULT 'Raw Makhana' NOT NULL,
  "pack_size" text NOT NULL,
  "quantity" integer DEFAULT 1 NOT NULL,
  "subtotal" numeric(10, 2) NOT NULL,
  "shipping_amount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
  "discount" numeric(10, 2) DEFAULT '0.00' NOT NULL,
  "total_amount" numeric(10, 2) NOT NULL,
  "payment_status" text DEFAULT 'PENDING' NOT NULL,
  "order_status" text DEFAULT 'UNPAID' NOT NULL,
  "shiprocket_status" text DEFAULT 'PENDING_SHIPMENT',
  "shiprocket_awb" text,
  "payment_method" text,
  "bank_reference" text,
  "payment_completion_time" text,
  "payment_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_orders_cashfree_order_id" ON "orders" ("cashfree_order_id");
CREATE INDEX IF NOT EXISTS "idx_orders_payment_status" ON "orders" ("payment_status");
CREATE INDEX IF NOT EXISTS "idx_orders_created_at" ON "orders" ("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_admin_sessions_expires_at" ON "admin_sessions" ("expires_at");

