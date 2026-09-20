// Shared by the customer, kitchen and administration. The database remains the
// authority for permitted transitions; these rules describe the same state to UI.
"use strict";
const OrderRules = (() => {
  const labels = Object.freeze({
    pending: "بانتظار رد المطبخ",
    discussing: "تم قبول الطلب — تواصلوا للاتفاق",
    proposed: "تفاصيل سابقة — تحتاج متابعة",
    accepted: "تم الاتفاق",
    preparing: "قيد التحضير",
    ready: "جاهز للاستلام أو التوصيل",
    delivered: "المطبخ أعلن التسليم",
    rejected: "اعتذر المطبخ",
    cancelled: "ملغى",
    expired: "فات موعد الطلب",
  });
  const active = new Set([
    "pending",
    "discussing",
    "proposed",
    "accepted",
    "preparing",
    "ready",
  ]);
  function requestDeadline(order) {
    return Date.parse(order.agreed_at || order.requested_at);
  }
  function isOverdue(order, now = Date.now()) {
    return (
      !order.received_at &&
      active.has(order.status) &&
      requestDeadline(order) <= now
    );
  }
  function pendingExpired(order, now = Date.now()) {
    const deadline = order.request_v2 ? order.requested_at : order.order_until;
    return (
      order.status === "pending" &&
      !order.received_at &&
      Date.parse(deadline) <= now
    );
  }
  function effectiveStatus(order, now = Date.now()) {
    return pendingExpired(order, now) ? "expired" : order.status;
  }
  function statusLabel(order) {
    if (order.received_at) return "الاستلام مؤكد من الزبون";
    return labels[effectiveStatus(order)] || order.status;
  }
  function money(value) {
    if (value == null || value === "") return "غير محدد";
    const cents = Math.round(Number(value) * 100);
    if (!Number.isFinite(cents)) return "غير محدد";
    const whole = Math.trunc(cents / 100),
      part = Math.abs(cents % 100);
    return `${whole} ${Math.abs(whole) >= 3 && Math.abs(whole) <= 10 ? "دراهم" : "درهمًا"}${part ? ` و${part} سنتيمًا` : ""}`;
  }
  function date(value, empty = "حسب الاتفاق") {
    if (!value || !Number.isFinite(Date.parse(value))) return empty;
    return new Intl.DateTimeFormat("ar-MA", {
      timeZone: "Africa/Casablanca",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }
  function people(n) {
    return Number(n) === 1
      ? "شخصًا واحدًا"
      : Number(n) === 2
        ? "شخصين"
        : `${n} ${Number(n) <= 10 ? "أشخاص" : "شخصًا"}`;
  }
  return Object.freeze({
    labels,
    requestDeadline,
    isOverdue,
    pendingExpired,
    effectiveStatus,
    statusLabel,
    money,
    date,
    people,
  });
})();
