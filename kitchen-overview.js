"use strict";
let kitchenOverviewVersion = 0;
function mountMealDashboard(c) {
  const box = document.querySelector("#chefKitchenDashboard .kitchen-builder");
  let actions = document.getElementById("mealActions");
  if (!actions) {
    actions = document.createElement("div");
    actions.id = "mealActions";
    box.append(actions);
  }
  actions.className = "kitchen-toolbar";
  actions.replaceChildren(
    mealAction("＋ إضافة وجبة", () => openMealOfferForm(c)),
    mealAction("بيانات مطبخي", () => openKitchenSettings(c)),
  );
  actions.firstChild.className = "primary";
  let overview = document.getElementById("kitchenOverview");
  if (!overview) {
    overview = document.createElement("div");
    overview.id = "kitchenOverview";
    box.append(overview);
  }
  overview.innerHTML =
    '<div id="kitchenPendingSummary" aria-live="polite"></div><div id="kitchenMapSummary" role="status"></div><section class="kitchen-section"><h2>أطباق مطبخي</h2><div id="kitchenDishCards" class="kitchen-dish-grid"><p>جاري تحميل أطباقك…</p></div></section><section class="kitchen-section kitchen-orders" id="kitchenOrdersSection"><h2>طلبات مطبخي</h2><div id="kitchenOrderCards"><p>جاري تحميل الطلبات…</p></div></section>';
  const refresh = () => loadKitchenOverview(c);
  const button = mealAction("تحديث الأطباق والطلبات", refresh);
  button.classList.add("overview-refresh");
  overview.append(button);
  refresh();
}
async function loadKitchenOverview(c) {
  const version = ++kitchenOverviewVersion,
    token = chefSessionToken;
  const results = await Promise.allSettled([
    mealRpc("chef_meal_offers", { p_session_token: token }),
    getKitchenOrders(token),
    mealRpc("chef_location", { p_session_token: token }),
  ]);
  if (version !== kitchenOverviewVersion || token !== chefSessionToken) return;
  const dishes = document.getElementById("kitchenDishCards"),
    ordersBox = document.getElementById("kitchenOrderCards"),
    summary = document.getElementById("kitchenPendingSummary");
  if (!dishes || !ordersBox) return;
  const refresh = () => loadKitchenOverview(c);
  dishes.replaceChildren();
  ordersBox.replaceChildren();
  summary.replaceChildren();
  const mapSummary = document.getElementById("kitchenMapSummary");
  if (mapSummary) {
    mapSummary.replaceChildren();
    const location = results[2];
    if (location.status === "rejected")
      mapSummary.textContent =
        "تعذر التحقق من ظهور مطبخك على الخريطة. يمكنك المحاولة من «بيانات مطبخي».";
    else if (location.value?.public_on_map)
      mapSummary.textContent = "موقع مطبخك منشور على الخريطة.";
    else {
      const p = location.value;
      mapSummary.textContent =
        "مطبخك ظاهر في القائمة، لكنه غير ظاهر على الخريطة. ";
      mapSummary.append(
        mealAction(p ? "نشر موقعي على الخريطة" : "تحديد موقع مطبخي", () =>
          pickLocation(
            true,
            p ? [Number(p.lat), Number(p.lng)] : null,
            saveKitchenPoint,
          ),
        ),
      );
    }
  }
  if (results[0].status === "rejected") {
    dishes.textContent = "تعذر تحميل الأطباق. اضغط تحديث للمحاولة مجددًا.";
  } else {
    const offers = results[0].value || [];
    if (!offers.length)
      dishes.innerHTML =
        '<p class="overview-empty">لم تضف طبقًا بعد. ابدأ بزر «إضافة وجبة» أعلاه.</p>';
    offers.forEach((o) => {
      const card = document.createElement("article");
      card.className = "kitchen-dish-card";
      const photo = safeImageUrl(o.image_url);
      card.innerHTML = `${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(o.dish_name)}" loading="lazy">` : '<div class="dish-placeholder" role="img" aria-label="Ommi Food — لم تُضف صورة للطبق"><span class="placeholder-brand" dir="ltr">Ommi Food</span><span class="placeholder-caption">من مطابخ أمهاتنا</span></div>'}<div class="dish-card-body"><h3>${escapeHtml(o.dish_name)}</h3><strong class="dish-price">${o.reference_price != null ? mealMoney(o.reference_price) + " — سعر مرجعي للشخص" : "حدّد السعر المرجعي للشخص"}</strong><p>${o.group_pricing ? "يمكن الاتفاق على سعر خاص حسب الكمية" : "من الأطباق التي نتقنها"}</p><span class="dish-state ${o.active ? "is-available" : "is-paused"}">${o.active ? "متاح للطلب" : "متوقف مؤقتًا"}</span></div>`;
      const controls = document.createElement("div");
      controls.className = "dish-card-controls";
      controls.append(
        mealAction("تعديل الطبق", () => openMealOfferForm(o)),
        mealAction(o.active ? "إيقاف مؤقت" : "إتاحة الطبق", async () => {
          await mealRpc("meal_offer_availability", {
            p_session_token: chefSessionToken,
            p_offer_id: o.id,
            p_active: !o.active,
          });
          await refresh();
        }),
      );
      card.append(controls);
      dishes.append(card);
    });
  }
  if (results[1].status === "rejected") {
    ordersBox.textContent = "تعذر تحميل الطلبات. اضغط تحديث للمحاولة مجددًا.";
    return;
  }
  const orders = results[1].value || [],
    priority = {
      pending: 0,
      discussing: 1,
      proposed: 1,
      accepted: 2,
      preparing: 3,
      ready: 4,
    };
  orders.sort(
    (a, b) =>
      (priority[mealEffectiveStatus(a)] ?? 4) -
      (priority[mealEffectiveStatus(b)] ?? 4),
  );
  const pending = orders.filter(
    (o) => mealEffectiveStatus(o) === "pending",
  ).length;
  if (pending) {
    const jump = mealAction(
      `لديك ${pending} طلب بانتظار قبولك — عرض الطلبات`,
      () =>
        document
          .getElementById("kitchenOrdersSection")
          .scrollIntoView({ behavior: "smooth", block: "start" }),
    );
    jump.className = "pending-summary";
    summary.append(jump);
  }
  if (!orders.length)
    ordersBox.innerHTML =
      '<p class="overview-empty">لا توجد طلبات بعد. ستظهر هنا عندما يطلب زبون من مطبخك.</p>';
  orders.forEach((o) => {
    const card = chefOrderCard(o, refresh);
    const status = mealEffectiveStatus(o);
    card.dataset.status = status;
    ordersBox.append(card);
  });
}

function renderKitchenDashboard(c) {
  const screen = ensureKitchenDashboard(),
    ds = Array.isArray(c?.dishes) ? c.dishes.filter((d) => d?.name) : [];
  screen.querySelector("#myKitchenTitle").textContent =
    `مطبخ ${prefix(c.gender)} ${c.name}`;
  screen.querySelector("#myKitchenMeta").textContent =
    `${c.area || ""} · ${c.city_label || "الدار البيضاء"}`;
  screen.querySelector("#myKitchenSpecialty").textContent = c.specialty || "";
  const list = screen.querySelector("#myKitchenDishes");
  list.innerHTML = ds.length
    ? ds
        .map((d, i) => {
          const u = safeImageUrl(d.image_url);
          return `<article class="dish-option${u ? " has-image" : ""}" data-my-dish="${i}">${u ? `<img class="dish-option-image" src="${escapeHtml(u)}" alt="${escapeHtml(d.name)}">` : '<span class="dish-option-placeholder">بدون صورة</span>'}<span class="dish-option-info"><strong>${escapeHtml(d.name)}</strong><span>${mealMoney(d.price || 0)}</span></span></article>`;
        })
        .join("")
    : '<div class="empty-state"><strong>لا توجد أطباق بعد.</strong></div>';
  screen.dataset.chef = JSON.stringify(c);
  const box = screen.querySelector(".kitchen-builder");
  box.querySelector(".builder-step")?.remove();
  list.hidden = true;
  box.querySelector(".builder-actions").hidden = true;
  screen.querySelector(".welcome-kitchen > span").textContent =
    "تم ربط مطبخ منزلك بالمنصة";
  return screen;
}
function ensureKitchenDashboard() {
  let screen = document.getElementById("chefKitchenDashboard");
  if (screen) return screen;
  screen = document.createElement("section");
  screen.id = "chefKitchenDashboard";
  screen.className = "screen";
  screen.innerHTML = `<header class="topbar"><button class="back" id="myKitchenHome" type="button">←</button><div><strong>مطبخي</strong><span>إدارة مطبخك وأطباقك</span></div><span class="mini-logo">Ommi Food</span></header><div class="content kitchen-builder"><div class="welcome-kitchen"><span>مطبخي</span><h1 id="myKitchenTitle"></h1><p id="myKitchenMeta"></p><p id="myKitchenSpecialty"></p></div><div class="builder-step"><div><h2>أطباقي</h2><p>الأطباق المحفوظة في مطبخك</p></div></div><div id="myKitchenDishes" class="dish-list"></div><div class="builder-actions" style="margin-top:18px"><button type="button" class="primary full" id="myKitchenAddDish">+ إضافة طبق</button><button type="button" class="admin-secondary full" id="myKitchenEdit">تعديل معلومات المطبخ والأطباق</button><button type="button" class="admin-secondary full" id="myKitchenPublic">استكشاف المطابخ القريبة</button></div></div>`;
  document.querySelector("main")?.appendChild(screen) ||
    document.body.appendChild(screen);
  screen.querySelector("#myKitchenHome").onclick = () => showScreen("home");
  screen.querySelector("#myKitchenEdit").onclick = async () => {
    const c = await restoreChefSession(false);
    if (c) await openKitchenPreferences();
  };
  screen.querySelector("#myKitchenAddDish").onclick = async () => {
    const c = await restoreChefSession(false);
    if (c) await openMealOfferForm();
  };
  screen.querySelector("#myKitchenPublic").onclick = async () => {
    showScreen("chefs");
    await loadChefs();
  };
  return screen;
}
function openKitchenDashboard(c) {
  currentChefId = c.id;
  currentChefName = c.name;
  currentChefArea = c.area || "";
  currentChefGender = c.gender;
  renderKitchenDashboard(c);
  mountMealDashboard(c);
  showScreen("chefKitchenDashboard");
}
