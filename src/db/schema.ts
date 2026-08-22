import { pgTable, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";

/**
 * 1. Admins Table: Stores owner accounts with scrypt password hashes (zero plaintext)
 */
export const admins = pgTable("admins", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 2. Admin Sessions Table: Stores SHA-256 hashes of session tokens (zero raw bearer tokens stored)
 */
export const adminSessions = pgTable("admin_sessions", {
  id: text("id").primaryKey(), // SHA-256 hex hash of the raw session token
  adminId: text("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * 3. Orders Table: Complete order lifecycle with minimal, non-sensitive payment reconciliation fields
 */
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  cashfreeOrderId: text("cashfree_order_id").notNull().unique(),
  cashfreePaymentId: text("cashfree_payment_id"),

  // Customer Contact & Shipping Details
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  shippingAddress: text("shipping_address").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  pincode: text("pincode").notNull(),

  // Item & Pricing Breakdown
  productName: text("product_name").notNull().default("Raw Makhana"),
  packSize: text("pack_size").notNull(),
  quantity: integer("quantity").notNull().default(1),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingAmount: numeric("shipping_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),

  // Payment & Fulfillment State
  paymentStatus: text("payment_status").notNull().default("PENDING"),
  orderStatus: text("order_status").notNull().default("UNPAID"),
  shiprocketStatus: text("shiprocket_status").default("PENDING_SHIPMENT"),
  shiprocketAwb: text("shiprocket_awb"),

  // Minimal Non-Sensitive Reconciliation Fields (Zero card/UPI credentials)
  paymentMethod: text("payment_method"),           // e.g. "upi", "card", "netbanking"
  bankReference: text("bank_reference"),           // Gateway bank reference ID
  paymentCompletionTime: text("payment_completion_time"), // Gateway completion timestamp
  paymentMessage: text("payment_message"),         // Gateway status description

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});



