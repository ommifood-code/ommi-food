"use strict";
const requestStatus = OrderRules.statusLabel;
let requestDraft = null,
  requestViewVersion = 0,
  requestTrackingToken = null,
  requestTrackingViewVersion = 0;
const referenceLabel = (o) =>
  o.reference_price != null
    ? `${mealMoney(o.reference_price)} للشخص — سعر مرجعي`
    : "الثمن بعد الاتفاق مع المطبخ";
function requestSummary(o) {
  return `<h2>${escapeHtml(o.dish_name)}</h2><p>${peopleLabel(o.people)} · ${o.requested_at ? "الموعد المطلوب: " + mealDate(o.requested_at) : "الموعد حسب الاتفاق"}</p>${o.chef_agreed_at && o.agreed_at && Date.parse(o.agreed_at) !== Date.parse(o.requested_at) ? `<p>الموعد الجديد الذي سجّله المطبخ بعد التواصل: ${mealDate(o.agreed_at)}</p>` : ""}<p>${o.estimate != null ? "تقدير الطعام: " + mealMoney(o.estimate) + " — ليس ثمنًا نهائيًا، والتوصيل حسب الاتفاق" : "الثمن بعد الاتفاق مع المطبخ"}</p>${o.notes ? `<p>رغبة الزبون: ${escapeHtml(o.notes)}</p>` : ""}`;
}
// Never carry an obsolete appointment into a fresh request.
function requestDraftTime(value) {
  if (!value) return "";
  try {
    return Date.parse(mealLocalToISO(value)) > Date.now() ? value : "";
  } catch {
    return "";
  }
}
function requestPhone(phone, label, text) {
  const a = document.createElement("a");
  a.className = "admin-secondary";
  a.textContent = label;
  a.href = text
    ? "https://wa.me/" +
      phone.replace(/^0/, "212") +
      "?text=" +
      encodeURIComponent(text)
    : "tel:" + phone;
  if (text) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  }
  return a;
}
async function openMealOrdering(chef) {
  const version = ++requestViewVersion;
  activeChef = chef;
  selectedMealOffer = null;
  mealRequest = null;
  document.getElementById("orderChefName").textContent =
    `${prefix(chef.gender)} ${chef.name}`;
  document.getElementById("orderChefArea").textContent =
    chef.area || "الدار البيضاء";
  document.querySelector(".order-meals h1").textContent =
    "من الأطباق التي نتقنها";
  const list = document.getElementById("dishList");
  list.textContent = "جاري تحميل الاقتراحات…";
  const form = document.getElementById("mealCustomerForm");
  form.innerHTML = `<div class="meal-form"><label>لكم شخصًا تريد الطعام؟<input class="field" name="people" type="number" min="1" max="1000" step="1" inputmode="numeric" value="1" required></label><label>متى تريد طعامك؟ (اختياري)<input class="field" name="requested_at" type="datetime-local"></label><small>يمكنك تركه فارغًا والاتفاق مع المطبخ. بتوقيت المغرب.</small><label>الاستلام<select class="field" name="fulfilment"><option value="discuss">نتفق مع المطبخ</option><option value="pickup">أفضل الاستلام من المطبخ</option><option value="delivery">أفضل التوصيل</option></select></label><label>اسمك<input class="field" name="name" required minlength="2" maxlength="100" autocomplete="name"></label><label>رقم الهاتف<input class="field" name="phone" type="tel" pattern="0[5-7][0-9]{8}" maxlength="10" required autocomplete="tel"></label><label>كيف تحب تحضيره؟ (اختياري)<textarea class="field" name="notes" maxlength="1000"></textarea></label><p id="requestEstimate" aria-live="polite"></p><p>الثمن النهائي والعدد والموعد والاستلام تُتفق مع المطبخ. الدفع مباشرة معه.</p><button class="primary" type="submit">إرسال طلب إلى المطبخ</button></div>`;
  let custom = document.getElementById("customDishLabel");
  if (!custom) {
    custom = document.createElement("label");
    custom.id = "customDishLabel";
    custom.className = "custom-dish";
    custom.innerHTML =
      'لم تجد ما تشتهيه؟<input id="customDishName" name="dish" form="mealCustomerForm" class="field" maxlength="150" placeholder="اكتب اسم الطبق الذي تشتهيه">';
    list.after(custom);
  }
  const input = custom.querySelector("input");
  input.value = "";
  const estimate = () => {
    const n = Number(form.elements.people.value);
    document.getElementById("requestEstimate").textContent =
      selectedMealOffer?.reference_price != null
        ? `تقدير الطعام لـ ${n} أشخاص: ${mealMoney(n * selectedMealOffer.reference_price)}. الثمن النهائي والتوصيل حسب الاتفاق.`
        : "الثمن بعد الاتفاق مع المطبخ.";
  };
  input.oninput = () => {
    selectedMealOffer = null;
    list.querySelectorAll("button").forEach((b) => {
      b.classList.remove("selected");
      b.setAttribute("aria-pressed", "false");
    });
    estimate();
  };
  form.elements.people.oninput = estimate;
  showScreen("orderModal");
  const [result, days, rep] = await Promise.all([
    db
      .from("meal_offers")
      .select("*")
      .eq("chef_id", chef.id)
      .eq("active", true)
      .order("created_at"),
    db.rpc("public_kitchen_workdays"),
    db.rpc("food_request_reputation"),
  ]);
  if (version !== requestViewVersion) return;
  list.replaceChildren();
  if (result.error) {
    list.textContent = "تعذر تحميل الاقتراحات. يمكنك كتابة طبقك أدناه.";
  }
  mealOffers = result.data || [];
  let day = document.getElementById("orderKitchenDays");
  if (!day) {
    day = document.createElement("p");
    day.id = "orderKitchenDays";
    document.querySelector(".order-meals").prepend(day);
  }
  day.textContent = kitchenDaysLabel(
    (days.data || []).find((x) => x.chef_id === chef.id)?.work_days,
  );
  const reputation = (rep.data || []).find((x) => x.chef_id === chef.id);
  let badge = document.getElementById("requestReputation");
  if (!badge) {
    badge = document.createElement("p");
    badge.id = "requestReputation";
    day.after(badge);
  }
  badge.textContent = reputation
    ? `${reputation.confirmed_received} طلبات مؤكدة الاستلام · ${reputation.rating_count ? reputation.average_rating + " / 5 من " + reputation.rating_count + " تقييمات" : "لا تقييمات بعد"}`
    : "مطبخ يبني سمعته — لا تقييمات بعد";
  mealOffers.forEach((o) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "dish-option meal-card";
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `${safeImageUrl(o.image_url) ? `<img class="dish-option-image" src="${escapeHtml(safeImageUrl(o.image_url))}" alt="${escapeHtml(o.dish_name)}" loading="lazy">` : ``}<span><strong>${escapeHtml(o.dish_name)}</strong><span>${referenceLabel(o)}</span>${o.group_pricing ? "<span>يمكن الاتفاق على سعر خاص حسب الكمية</span>" : ""}${o.ingredients ? `<span>${escapeHtml(o.ingredients)}</span>` : ""}</span>`;
    b.onclick = () => {
      selectedMealOffer = o;
      input.value = "";
      list.querySelectorAll("button").forEach((x) => {
        x.classList.toggle("selected", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
      estimate();
    };
    list.append(b);
  });
  if (!mealOffers.length && !result.error)
    list.textContent = "يمكنك كتابة الطبق الذي تشتهيه أدناه.";
  if (requestDraft) {
    const matched = mealOffers.some(
      (o) => o.dish_name.trim() === (requestDraft.dish || "").trim(),
    );
    input.value = matched ? "" : requestDraft.dish || "";
    for (const k of ["people", "name", "phone", "notes", "fulfilment"])
      if (requestDraft[k] != null) form.elements[k].value = requestDraft[k];
    form.elements.requested_at.value = requestDraftTime(
      requestDraft.requested_at,
    );
    requestDraft = null;
  }
  estimate();
  watchEdits(document.getElementById("orderModal"));
  form.onsubmit = (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    mealBusy(form.querySelector("[type=submit]"), async () => {
      let dish = input.value.trim();
      if (dish) {
        const match = mealOffers.find((o) => o.dish_name.trim() === dish);
        if (match) selectedMealOffer = match;
      }
      if (!selectedMealOffer && !dish)
        throw Error("اختر طبقًا أو اكتب ما تشتهيه.");
      const data = Object.fromEntries(new FormData(form));
      const args = {
        p_chef: chef.id,
        p_offer: selectedMealOffer?.id || null,
        p_people: Number(data.people),
        p_customer: {
          ...data,
          dish: dish || selectedMealOffer.dish_name,
          requested_at: data.requested_at
            ? mealLocalToISO(data.requested_at)
            : null,
        },
      };
      const signature = JSON.stringify(args);
      if (!mealRequest || mealRequest.signature !== signature) {
        mealRequest = { signature, token: newMealToken() };
        const receipts = readMealReceipts();
        receipts.unshift({ token: mealRequest.token, ref: "طلب قيد الإرسال" });
        localStorage.setItem(
          MEAL_RECEIPTS_KEY,
          JSON.stringify(receipts.slice(0, 100)),
        );
      }
      const token = mealRequest.token;
      const answer = await mealRpc("food_request_create", {
        ...args,
        p_token: token,
      });
      const receipts = readMealReceipts();
      const row = receipts.find((x) => x.token === token);
      if (row) row.ref = answer.order_ref;
      localStorage.setItem(MEAL_RECEIPTS_KEY, JSON.stringify(receipts));
      markFormSaved(form);
      await openCustomerMealOrder(token);
    });
  };
}
async function openCustomerMealOrder(token) {
  const view = ++requestTrackingViewVersion,
    revision = navigationRevision;
  const stale = () =>
    view !== requestTrackingViewVersion || revision !== navigationRevision;
  const o = await mealRpc("food_request_customer", { p_token: token });
  if (stale()) return;
  if (!o) {
    const legacy = await mealRpc("customer_meal_order", {
      p_access_token: token,
    });
    if (stale()) return;
    requestTrackingToken = null;
    try {
      localStorage.removeItem("ommi_last_order_token");
    } catch {}
    return renderLegacyCustomerOrder(token, legacy);
  }
  if (o.status === "cancelled") return leaveCancelledMealOrder(token);
  requestTrackingToken = token;
  requestSeen = JSON.stringify([
    o.status,
    o.agreement_version,
    o.received_at,
    o.last_reminder_at,
    o.rating,
  ]);
  mealTrackingToken = null;
  try {
    localStorage.setItem("ommi_last_order_token", token);
  } catch {}
  rememberMealReceipt(token, o.dish_name);
  const screen = mealPanel("customerMealTracking", "متابعة طلبي"),
    box = screen.querySelector(".meal-content");
  screen.dataset.orderToken = token;
  box.innerHTML = `<article class="meal-card"><strong>${escapeHtml(requestStatus(o))}</strong>${requestSummary(o)}<details class="request-reference"><summary>رقم الطلب</summary><p dir="ltr" style="overflow-wrap:anywhere">${escapeHtml(o.order_ref)}</p></details>${o.reason ? `<p>${escapeHtml(o.reason)}</p>` : ""}</article><p>الدفع والتواصل مباشرة مع المطبخ.</p>`;
  const action = async (name, data = {}) => {
    await mealRpc("food_request_customer_action", {
      p_token: token,
      p_action: name,
      p_data: data,
    });
    if (name === "cancel") return leaveCancelledMealOrder(token);
    await openCustomerMealOrder(token);
  };
  const card = box.querySelector("article");
  const missed =
    ["pending", "discussing", "proposed"].includes(o.status) &&
    OrderRules.isOverdue(o);
  if (missed) {
    card.insertAdjacentHTML(
      "beforeend",
      '<div class="admin-warning"><strong>فات الموعد المطلوب.</strong> لم يُحسم الطلب بعد. تواصل مع المطبخ، أو ألغِ الطلب وابحث عن مطبخ آخر.</div>',
    );
  }
  card.append(
    mealAction("نسخ رابط طلبي", async () => {
      const url = location.origin + location.pathname + "#order=" + token;
      try {
        await navigator.clipboard.writeText(url);
        showToast("تم نسخ رابط طلبك.");
      } catch {
        const field = document.createElement("input");
        field.className = "field";
        field.readOnly = true;
        field.value = url;
        field.setAttribute("aria-label", "رابط متابعة طلبي");
        card.append(field);
        field.focus();
        field.select();
        showToast("انسخ الرابط من الخانة الظاهرة.");
      }
    }),
  );
  card.insertAdjacentHTML(
    "beforeend",
    "<small>الرابط يفتح متابعة طلبك من أي جهاز. لا تشاركه؛ من يملكه يستطيع إدارة الطلب.</small>",
  );
  if (o.chef_phone) {
    box.insertAdjacentHTML(
      "beforeend",
      `<p><strong>رقم المطبخ:</strong> <span dir="ltr">${escapeHtml(o.chef_phone)}</span></p><p>${o.status === "pending" ? "يمكنك الانتظار أو التواصل مع المطبخ مباشرة." : "تواصل مع المطبخ لتأكيد التفاصيل."}</p>`,
    );
    box.append(
      requestPhone(o.chef_phone, "اتصال"),
      requestPhone(
        o.chef_phone,
        "واتساب",
        `مرحبًا، بخصوص طلبي ${o.order_ref}: ${o.dish_name} لـ ${peopleLabel(o.people)}.`,
      ),
    );
  }
  box.append(
    mealAction("التحقق من رد المطبخ", async () => {
      await openCustomerMealOrder(token);
      showToast("تم جلب آخر حالة للطلب.");
    }),
  );

  if (["pending", "discussing", "proposed"].includes(o.status))
    box.append(mealAction("إلغاء طلبي", () => action("cancel")));
  if (
    ["accepted", "preparing", "ready", "delivered"].includes(o.status) &&
    !o.received_at
  ) {
    box.insertAdjacentHTML("beforeend", "<h2>هل استلمت طلبك؟</h2>");
    box.append(mealAction("نعم، استلمت", () => action("received")));
  }
  if (o.received_at && !o.rating) {
    const form = document.createElement("form");
    form.className = "meal-form";
    form.innerHTML =
      '<h2>كيف كانت تجربتك؟</h2><p>التقييم اختياري. رأيك الصادق يساعد الآخرين.</p><div class="request-stars" role="group" aria-label="التقييم من خمس نجوم">' +
      [1, 2, 3, 4, 5]
        .map(
          (n) =>
            `<label><input type="radio" name="rating" value="${n}" required><span>${n} ★</span></label>`,
        )
        .join("") +
      '</div><label>تعليق اختياري<textarea name="feedback" class="field" maxlength="2000"></textarea></label><button class="primary">حفظ التقييم</button>';
    form.onsubmit = (e) => {
      e.preventDefault();
      if (form.reportValidity())
        mealBusy(form.querySelector("button"), async () => {
          await mealRpc("food_request_customer_action", {
            p_token: token,
            p_action: "rate",
            p_data: {
              rating: Number(new FormData(form).get("rating")),
              feedback: form.elements.feedback.value,
            },
          });
          markFormSaved(form);
          await openCustomerMealOrder(token);
        });
    };
    box.append(
      form,
      mealAction("ليس الآن", () => {
        form.hidden = true;
      }),
    );
  }
  if (o.rating)
    box.insertAdjacentHTML(
      "beforeend",
      `<p>تقييمك: ${o.rating} / 5${o.feedback ? " — " + escapeHtml(o.feedback) : ""}</p>`,
    );
  const help = document.createElement("details");
  help.innerHTML = "<summary>لدي مشكلة</summary>";
  if (o.complaint)
    help.innerHTML += `<p>${o.complaint_resolved_at ? "تمت مراجعة البلاغ" : "بلاغك محفوظ للمراجعة"}</p>`;
  else {
    const f = document.createElement("form");
    f.className = "meal-form";
    f.innerHTML =
      '<textarea name="message" class="field" required minlength="5" maxlength="2000" aria-label="اشرح المشكلة"></textarea><button class="primary">إبلاغ الإدارة</button>';
    f.onsubmit = (e) => {
      e.preventDefault();
      if (f.reportValidity())
        mealBusy(f.querySelector("button"), async () => {
          await action("complaint", { message: f.elements.message.value });
        });
    };
    help.append(f);
  }
  box.append(help);
  if (o.status === "rejected") {
    box.append(
      mealAction("البحث عن مطبخ آخر بنفس الطلب", async () => {
        requestDraft = {
          dish: o.dish_name,
          people: o.people,
          requested_at: o.requested_at
            ? requestDraftTime(localMealValue(o.requested_at))
            : "",
          name: o.customer_name,
          phone: o.customer_phone,
          notes: o.notes,
          fulfilment: o.fulfilment,
        };
        showScreen("chefs");
        await loadChefs();
      }),
    );
  }
  if (o.last_reminder_at && !o.received_at)
    box.insertAdjacentHTML(
      "afterbegin",
      '<p class="pending-summary">المطبخ يذكّرك بتأكيد الاستلام إذا وصلك الطعام.</p>',
    );
  showScreen(screen.id);
  history.replaceState(
    null,
    "",
    location.pathname + location.search + "#order=" + token,
  );
}
function chefOrderCard(o, refresh) {
  if (!o.request_v2) return legacyChefOrderCard(o, refresh);
  const card = document.createElement("article");
  card.className = "meal-card";
  card.innerHTML = `<strong>${escapeHtml(requestStatus(o))}</strong>${requestSummary(o)}<p>${escapeHtml(o.customer_name)} · ${escapeHtml(o.order_ref)}</p><p><strong>رقم الزبون:</strong> <span dir="ltr">${escapeHtml(o.customer_phone)}</span></p>`;
  card.append(
    requestPhone(o.customer_phone, "اتصال"),
    requestPhone(
      o.customer_phone,
      "واتساب",
      `مرحبًا، أنا من المطبخ بخصوص طلبك ${o.order_ref}: ${o.dish_name}.`,
    ),
  );
  if (o.received_at) {
    if (o.rating)
      card.insertAdjacentHTML(
        "beforeend",
        `<p>تقييم الزبون: ${o.rating} / 5</p>`,
      );
    return card;
  }
  const action = async (name, data = {}) => {
    await mealRpc("food_request_chef_action", {
      p_session_token: chefSessionToken,
      p_id: o.id,
      p_action: name,
      p_data: data,
    });
    await refresh();
  };
  const late = o.status === "pending" && OrderRules.isOverdue(o);
  if (late)
    card.insertAdjacentHTML(
      "beforeend",
      '<div class="admin-warning"><strong>فات موعد هذا الطلب.</strong> لا يمكن قبوله الآن.</div>',
    );
  if (o.status === "pending" && !late)
    card.append(mealAction("قبول الطلب", () => action("discussing")));
  if (["discussing", "proposed"].includes(o.status)) {
    card.insertAdjacentHTML(
      "beforeend",
      "<p>تواصل مع الزبون هاتفيًا أو عبر واتساب، وبعد اتفاقكما أكّد ذلك هنا.</p>",
    );
    if (OrderRules.isOverdue(o)) {
      const f = document.createElement("form");
      f.className = "meal-form";
      f.innerHTML =
        '<label>الموعد الجديد المتفق عليه<input class="field" name="at" type="datetime-local" required></label><small>بتوقيت المغرب. حدده بعد التواصل مع الزبون.</small><button class="admin-secondary">تم الاتفاق — ابدأ التحضير</button>';
      f.onsubmit = (e) => {
        e.preventDefault();
        if (f.reportValidity())
          mealBusy(f.querySelector("button"), async () => {
            await action("agreed", { at: mealLocalToISO(f.elements.at.value) });
            markFormSaved(f);
          });
      };
      card.append(f);
    } else
      card.append(
        mealAction("تم الاتفاق — ابدأ التحضير", () => action("agreed")),
      );
  }
  const rejection =
    o.status === "pending"
      ? "rejected"
      : ["discussing", "proposed", "accepted", "preparing", "ready"].includes(
            o.status,
          )
        ? "cancelled"
        : null;
  if (rejection)
    card.append(
      mealAction(
        rejection === "rejected" ? "أعتذر عن الطلب" : "إلغاء بعد التواصل",
        () => {
          if (card.querySelector(".reason-form")) return;
          const f = document.createElement("form");
          f.className = "meal-form reason-form";
          f.innerHTML =
            '<label>السبب<input class="field" name="reason" required minlength="3" maxlength="500"></label><button class="admin-secondary">تأكيد</button>';
          f.onsubmit = (e) => {
            e.preventDefault();
            if (f.reportValidity())
              mealBusy(f.querySelector("button"), () =>
                action(rejection, { reason: f.elements.reason.value }),
              );
          };
          card.append(f);
          markFormSaved(f);
        },
      ),
    );
  if (o.status === "accepted")
    card.append(mealAction("بدأت التحضير", () => action("preparing")));
  if (["accepted", "preparing"].includes(o.status))
    card.append(mealAction("الطعام جاهز", () => action("ready")));
  if (["accepted", "preparing", "ready"].includes(o.status))
    card.append(mealAction("سلّمت الطلب", () => action("delivered")));
  if (o.status === "delivered" && !o.received_at) {
    card.insertAdjacentHTML(
      "beforeend",
      "<p>بانتظار تأكيد الزبون. عدم تقييمه لا يخصم من سمعتك.</p>",
    );
    if (
      o.reminder_count < 2 &&
      (!o.last_reminder_at ||
        Date.now() - Date.parse(o.last_reminder_at) > 86400000)
    )
      card.append(
        mealAction("تذكير الزبون بتأكيد الاستلام", async () => {
          await action("reminder");
          showToast("ظهر تذكير في متابعة طلب الزبون داخل التطبيق.");
        }),
      );
  }
  if (o.rating)
    card.insertAdjacentHTML(
      "beforeend",
      `<p>تقييم الزبون: ${o.rating} / 5</p>`,
    );
  return card;
}
// A reminder is shown in the existing private request; no paid messages or automatic phone contact.
const MEAL_LAST_ORDER_KEY = "ommi_last_order_token";
function refreshHomeOrderShortcut() {
  document.getElementById("homeOrderHint")?.remove();
  const button = document.getElementById("homeMyOrdersBtn");
  if (button) {
    button.textContent = "متابعة طلباتي";
    button.setAttribute("aria-label", "متابعة طلباتي");
  }
}
document.getElementById("myOrdersBtn").onclick = openMyMealReceipts;
document.getElementById("homeMyOrdersBtn").onclick = openMyMealReceipts;
refreshHomeOrderShortcut();
async function restoreRecentOrder() {
  if (location.hash) return;
  let token = "";
  try {
    token = localStorage.getItem(MEAL_LAST_ORDER_KEY) || "";
  } catch {}
  if (!/^[0-9a-f]{64}$/.test(token)) return;
  try {
    await openCustomerMealOrder(token);
  } catch {
    showToast("تعذر تحميل الطلب. يمكنك فتحه من «متابعة طلباتي».");
    refreshHomeOrderShortcut();
  }
}
let requestPollBusy = false,
  requestSeen = "";
setInterval(async () => {
  if (
    requestPollBusy ||
    document.visibilityState === "hidden" ||
    !requestTrackingToken ||
    !document.querySelector("#customerMealTracking.active")
  )
    return;
  requestPollBusy = true;
  try {
    const token = requestTrackingToken,
      o = await mealRpc("food_request_customer", { p_token: token });
    if (!o || token !== requestTrackingToken) return;
    if (o.status === "cancelled") {
      await leaveCancelledMealOrder(token);
      return;
    }
    const signature = JSON.stringify([
      o.status,
      o.agreement_version,
      o.received_at,
      o.last_reminder_at,
      o.rating,
    ]);
    if (requestSeen && requestSeen !== signature) {
      let note = document.getElementById("requestUpdateNotice");
      if (!note) {
        note = mealAction("وصل تحديث لطلبك — عرضه", () =>
          openCustomerMealOrder(token),
        );
        note.id = "requestUpdateNotice";
        document
          .querySelector("#customerMealTracking .meal-content")
          .prepend(note);
      }
    }
    requestSeen = signature;
  } catch {
  } finally {
    requestPollBusy = false;
  }
}, 20000);
