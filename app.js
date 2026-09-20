const SUPABASE_URL = "https://qgblrockjswicegfldzm.supabase.co";
const SUPABASE_KEY = "sb_publishable__by9VCo0-kgc7x5msoXB4A_P5r-UoQQ";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const citySelect = document.getElementById("citySelect"),
  comingModal = document.getElementById("comingModal"),
  orderModal = document.getElementById("orderModal"),
  joinModal = document.getElementById("joinModal"),
  toast = document.getElementById("toast");
let chefsCache = [],
  activeChef = null,
  activeDish = null,
  joinGender = "",
  currentChefId = null,
  currentChefName = "",
  currentChefArea = "",
  currentChefGender = "f";
function prefix(g) {
  return ["m", "male", "ذكر"].includes(String(g || "").toLowerCase())
    ? "عمّي"
    : "أمّي";
}
function cleanName(v) {
  return (v || "")
    .replace(/^(أمّي|أمي|امي|عمّي|عمي|Ommi|Oncle)\s*/i, "")
    .trim();
}
const editBaselines = new WeakMap();
function editSnapshot(root) {
  return JSON.stringify(
    [...(root.elements || root.querySelectorAll("input,select,textarea"))]
      .filter((el) => !el.readOnly && !["submit", "button"].includes(el.type))
      .map((el) => [
        el.name || el.id,
        el.type === "file"
          ? [...el.files].map((f) => [f.name, f.size, f.lastModified])
          : el.type === "checkbox" || el.type === "radio"
            ? el.checked
            : el.value,
      ]),
  );
}
function editScopes(root) {
  return [
    ...root.querySelectorAll("form"),
    ...(root.matches(".modal") && !root.querySelector("form") ? [root] : []),
  ];
}
function markFormSaved(root) {
  if (root) editBaselines.set(root, editSnapshot(root));
}
function watchEdits(root) {
  editScopes(root).forEach(markFormSaved);
}
function visibleEdits() {
  return [
    ...document.querySelectorAll(
      ".screen.active form,.modal.open form,.modal.open",
    ),
  ].filter(
    (root) =>
      editBaselines.has(root) && editSnapshot(root) !== editBaselines.get(root),
  );
}
function allowDiscardEdits() {
  const dirty = visibleEdits();
  if (!dirty.length) return true;
  if (
    !window.confirm(
      "لديك تعديلات لم تُحفظ. هل تريد المغادرة دون حفظ؟ اختر إلغاء للبقاء وإكمالها.",
    )
  )
    return false;
  dirty.forEach(markFormSaved);
  return true;
}
document.addEventListener("focusin", (event) => {
  const root = event.target.form || event.target.closest("form,.modal");
  if (root && !editBaselines.has(root)) markFormSaved(root);
});
window.addEventListener("beforeunload", (event) => {
  if (visibleEdits().length) {
    event.preventDefault();
    event.returnValue = "";
  }
});
function prepareNavigation(root) {
  root.querySelectorAll(".topbar").forEach((header) => {
    const back = header.querySelector(".back");
    if (back) {
      back.type = "button";
      back.textContent = "→ رجوع";
      back.setAttribute("aria-label", "الرجوع إلى الصفحة السابقة");
    }
    let logo = header.querySelector(".mini-logo");
    if (!logo || logo.tagName !== "BUTTON") {
      const button = document.createElement("button");
      button.className = "mini-logo brand-home";
      if (logo) logo.replaceWith(button);
      else header.append(button);
      logo = button;
    }
    logo.type = "button";
    logo.textContent = "Ommi Food";
    logo.dataset.home = "";
    logo.setAttribute("aria-label", "العودة إلى الرئيسية");
  });
}

document.addEventListener(
  "click",
  (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.matches("[data-home]")) {
      if (!allowDiscardEdits()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelectorAll(".modal.open").forEach(closeModal);
      showScreen("home");
    } else if (button.matches(".topbar .back,.close,[data-close]")) {
      if (!allowDiscardEdits()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      const modal = button.closest(".modal");
      if (modal) closeModal(modal);
      else navigateBack();
    }
  },
  true,
);
function showToast(t) {
  toast.textContent = t;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}
function openModal(e) {
  if (e === joinModal) {
    joinGender = "";
    e.querySelectorAll(".gender").forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
  }
  if (e.id === "joinModal" || e.id === "chefLoginModal") {
    const card = e.querySelector(".modal-card");
    if (card && !card.querySelector(".topbar")) {
      const header = document.createElement("header");
      header.className = "topbar";
      header.innerHTML = '<button type="button" class="back">→ رجوع</button>';
      card.prepend(header);
      card.querySelector(".close").hidden = true;
    }
    prepareNavigation(e);
  }
  watchEdits(e);
  e.classList.add("open");
  e.setAttribute("aria-hidden", "false");
}
function closeModal(e) {
  e.classList.remove("open");
  e.setAttribute("aria-hidden", "true");
}
function escapeHtml(v) {
  return String(v ?? "").replace(
    /[&<>'\"]/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '\"': "&quot;",
      })[ch],
  );
}
function safeImageUrl(v) {
  try {
    const u = new URL(String(v));
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
}
function clearJoinErrors() {
  joinModal.querySelectorAll(".field-error").forEach((e) => e.remove());
  joinModal
    .querySelectorAll(".field.invalid")
    .forEach((e) => e.classList.remove("invalid"));
  document
    .getElementById("joinConsent")
    ?.closest("label")
    ?.classList.remove("consent-invalid");
}
function joinFieldError(id, m) {
  const f = document.getElementById(id);
  if (!f) return;
  f.classList.add("invalid");
  const e = document.createElement("div");
  e.className = "field-error";
  e.textContent = m;
  f.insertAdjacentElement("afterend", e);
}
document
  .querySelectorAll("[data-open-join]")
  .forEach((b) => (b.onclick = () => openModal(joinModal)));

function openChef(id) {
  const chef = chefsCache.find((c) => String(c.id) === String(id));
  if (chef) openMealOrdering(chef).catch((e) => showToast(e.message));
}
document.getElementById("discoverBtn").onclick = async () => {
  showScreen("chefs");
  await loadChefs();
};
document.querySelectorAll(".gender").forEach(
  (b) =>
    (b.onclick = () => {
      document.querySelectorAll(".gender").forEach((x) => {
        x.classList.toggle("active", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      joinGender = b.dataset.gender === "male" ? "m" : "f";
    }),
);
document.getElementById("joinName").oninput = (e) =>
  (e.target.value = cleanName(e.target.value));
document.getElementById("addDishBtn").onclick = () => addDish();
document.querySelectorAll("#builderDays button").forEach(
  (b) =>
    (b.onclick = () => {
      b.classList.toggle("selected");
      updatePreview();
    }),
);
document
  .getElementById("builderSpecialty")
  .addEventListener("change", updatePreview);
const fulfilmentSelect = document.getElementById("builderFulfilment"),
  deliveryWrap = document.getElementById("deliveryMethodWrap"),
  deliveryBySelect = document.getElementById("builderDeliveryBy");
function syncDeliveryUi() {
  const hasDelivery =
    fulfilmentSelect.value === "delivery" || fulfilmentSelect.value === "both";
  deliveryWrap.hidden = !hasDelivery;
  if (!hasDelivery) deliveryBySelect.value = "customer";
}
fulfilmentSelect.addEventListener("change", syncDeliveryUi);
deliveryBySelect.addEventListener("change", updatePreview);
function collectDishes() {
  return [...document.querySelectorAll(".builder-dish-row")]
    .map((r) => ({
      name: r.querySelector(".dish-name").value.trim(),
      price: r.querySelector(".dish-price").value.trim(),
    }))
    .filter((d) => d.name);
}
function updatePreview() {
  const ds = collectDishes(),
    specialty = document.getElementById("builderSpecialty").value;
  document.getElementById("builderDishCount").textContent = ds.length;
  document.getElementById("builderPreview").innerHTML =
    `<strong>${prefix(currentChefGender)} ${escapeHtml(currentChefName)}</strong><span>${escapeHtml(currentChefArea)} · الدار البيضاء</span>${specialty ? `<p>${escapeHtml(specialty)}</p>` : ""}<div>${ds.length ? ds.map((d) => `<small>${escapeHtml(d.name)}${d.price ? ` · ${mealMoney(d.price)}` : ""}</small>`).join("") : "<small>أضيفي أول طبق</small>"}</div>`;
}
function openBuilder() {
  document.getElementById("builderKitchenName").textContent =
    `مطبخ ${prefix(currentChefGender)} ${currentChefName}`;
  document.getElementById("builderKitchenMeta").textContent =
    `${currentChefArea}، الدار البيضاء`;
  document.getElementById("builderSpecialty").value = "";
  document.getElementById("builderDishes").innerHTML = "";
  document
    .querySelectorAll("#builderDays button")
    .forEach((b) => b.classList.remove("selected"));
  fulfilmentSelect.value = "pickup";
  syncDeliveryUi();
  addDish();
  showScreen("buildKitchen");
  updatePreview();
}
/* Chef registration, login, secure kitchen saving and image upload live in dish-images.js. No legacy direct writes remain here. */

// Navigation is bound to explicit back buttons only; blank areas never navigate.
