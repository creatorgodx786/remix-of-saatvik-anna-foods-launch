import React, { useState, useEffect, useCallback } from "react";
import {
  Package,
  Search,
  RefreshCw,
  LogOut,
  Settings,
  TrendingUp,
  CreditCard,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  ShieldCheck,
  Filter,
} from "lucide-react";
import { BRAND } from "@/data/site";
import { OrderDetailModal, Order } from "./OrderDetailModal";
import { AdminSettingsModal } from "./AdminSettingsModal";

interface Metrics {
  totalOrders: number;
  totalRevenue: number;
  paidOrders: number;
  pendingOrders: number;
  failedOrders: number;
  pendingShipments: number;
}

interface AdminDashboardProps {
  admin: { id: string; email: string; role: string };
  onLogout: () => void;
}

export function AdminDashboard({ admin, onLogout }: AdminDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    totalOrders: 0,
    totalRevenue: 0,
    paidOrders: 0,
    pendingOrders: 0,
    failedOrders: 0,
    pendingShipments: 0,
  });

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [orderFilter, setOrderFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: "15",
      });

      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (paymentFilter !== "ALL") params.set("paymentStatus", paymentFilter);
      if (orderFilter !== "ALL") params.set("orderStatus", orderFilter);

      const res = await fetch(`/.netlify/functions/admin-orders?${params.toString()}`);
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.orders) {
        setOrders(data.orders);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalRecords(data.pagination.total || 0);
        }
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error("Fetch orders error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchQuery, paymentFilter, orderFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleOrderUpdated = (updatedOrder: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
    );
    if (selectedOrder && selectedOrder.id === updatedOrder.id) {
      setSelectedOrder(updatedOrder);
    }
    fetchOrders();
  };

  const getPaymentBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "SUCCESS":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            PAID
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            PENDING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
            <AlertCircle className="h-3 w-3" />
            {status.toUpperCase()}
          </span>
        );
    }
  };

  const getOrderBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "PAID":
        return (
          <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            PAID
          </span>
        );
      case "PROCESSING":
        return (
          <span className="rounded-md border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-400">
            PROCESSING
          </span>
        );
      case "SHIPPED":
        return (
          <span className="rounded-md border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400">
            SHIPPED
          </span>
        );
      case "DELIVERED":
        return (
          <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            DELIVERED
          </span>
        );
      default:
        return (
          <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-mist text-foreground">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <ShieldCheck className="h-5 w-5 text-accent" />
            </div>
            <div>
              <h1 className="font-display text-lg font-bold tracking-tight text-primary">
                {BRAND.name}
              </h1>
              <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                Owner Admin Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground sm:flex">
              <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span>{admin.email}</span>
            </div>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
              title="Admin Settings / Change Password"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive transition hover:bg-destructive/20"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Revenue */}
          <div className="rounded-2xl border border-primary/10 bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Total Revenue
              </span>
              <div className="rounded-xl bg-accent/20 p-2 text-primary">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              ₹{Number(metrics.totalRevenue).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">From paid customer orders</p>
          </div>

          {/* Paid Orders */}
          <div className="rounded-2xl border border-primary/10 bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Paid Orders
              </span>
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {metrics.paidOrders}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Successful transactions</p>
          </div>

          {/* Pending Shipments */}
          <div className="rounded-2xl border border-primary/10 bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Pending Shipments
              </span>
              <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
                <Truck className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {metrics.pendingShipments}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Paid & awaiting dispatch</p>
          </div>

          {/* Total Orders */}
          <div className="rounded-2xl border border-primary/10 bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Total Orders
              </span>
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Package className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {metrics.totalOrders}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">All time order attempts</p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by order #, customer name, phone, or Cashfree ID..."
                className="w-full rounded-xl border border-input bg-background py-2 pr-4 pl-10 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Dropdowns & Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={paymentFilter}
                  onChange={(e) => {
                    setPaymentFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="ALL">All Payments</option>
                  <option value="SUCCESS">Paid / Success</option>
                  <option value="PENDING">Pending</option>
                  <option value="FAILED">Failed / Dropped</option>
                </select>
              </div>

              <select
                value={orderFilter}
                onChange={(e) => {
                  setOrderFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none"
              >
                <option value="ALL">All Fulfillment States</option>
                <option value="PAID">PAID</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
                <option value="UNPAID">UNPAID</option>
              </select>

              <button
                onClick={fetchOrders}
                className="flex items-center gap-1.5 rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
                title="Refresh Table"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-primary" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/50 text-[11px] font-bold tracking-wider text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-3.5">Order #</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5">Item & Pack</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Payment</th>
                  <th className="px-5 py-3.5">Order Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      {loading ? "Loading orders..." : "No orders found matching your filters."}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-4 font-mono font-bold text-foreground">
                        {order.orderNumber}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground whitespace-nowrap">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-foreground">{order.customerName}</p>
                        <p className="text-[11px] text-muted-foreground">+91 {order.customerPhone}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-foreground">{order.packSize}</p>
                        <p className="text-[11px] text-muted-foreground">Qty: {order.quantity}</p>
                      </td>
                      <td className="px-5 py-4 font-bold text-foreground">
                        ₹{Number(order.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getPaymentBadge(order.paymentStatus)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        {getOrderBadge(order.orderStatus)}
                        {order.shippingAwb && (
                          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                            AWB: {order.shippingAwb}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDetailOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-semibold text-foreground">{orders.length}</span> of{" "}
              <span className="font-semibold text-foreground">{totalRecords}</span> orders
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1 || loading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-1 font-medium text-foreground hover:bg-muted disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </button>
              <span className="text-xs font-semibold text-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages || loading}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 rounded-lg border border-input bg-background px-2.5 py-1 font-medium text-foreground hover:bg-muted disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Order Detail Modal */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedOrder(null);
        }}
        onOrderUpdated={handleOrderUpdated}
      />

      {/* Admin Settings / Password Rotation Modal */}
      <AdminSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        adminEmail={admin.email}
      />
    </div>
  );
}




