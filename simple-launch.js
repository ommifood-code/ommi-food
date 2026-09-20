/* Dish editor and shared kitchen settings for the free launch. */
"use strict";
document.getElementById("showDiscoveryBtn").onclick = async () => {
  showScreen("chefs");
  await loadChefs();
};
document
  .querySelector("#home .home-form")
  .prepend(document.querySelector("#home .home-paths"));

async function openKitchenSettings(c) {
  const screen = mealPanel("kitchenSettings", "بيانات مطبخي"),
    box = screen.querySelector(".meal-content");
  box.innerHTML = `<h1>${prefix(c.gender)} ${escapeHtml(c.name)}</h1><p>${escapeHtml(c.area || "")} · الدار البيضاء</p><p id="kitchenLocationStatus">جاري تحميل الموقع…</p>`;
  box.append(
    mealAction("تحديد موقع مطبخي", async () => {
      await pickLocation(true, null, saveKitchenPoint);
    }),
    mealAction("أيام العمل والاستلام", openKitchenPreferences),
    mealAction("أطباق مطبخي", openMyMealOffers),
    mealAction("تسجيل الخروج", async () => {
      await mealRpc("chef_logout", { p_session_token: chefSessionToken });
      localStorage.removeItem(CHEF_SESSION_KEY);
      chefSessionToken = "";
      currentChefId = null;
      showScreen("home");
    }),
  );
  showScreen(screen.id);
  try {
    const p = await mealRpc("chef_location", {
      p_session_token: chefSessionToken,
    });
    document.getElementById("kitchenLocationStatus").textContent = p
      ? p.public_on_map
        ? "موقع مطبخك منشور على الخريطة للزبائن."
        : "موقعك محفوظ لكنه غير منشور على الخريطة."
      : "حدد موقع مطبخك ليظهر للزبائن على الخريطة.";
    if (p) {
      box.append(
        mealAction("تعديل الموقع", () =>
          pickLocation(true, [Number(p.lat), Number(p.lng)], saveKitchenPoint),
        ),
        mealAction("حذف الموقع المحفوظ", async () => {
          await mealRpc("chef_location", {
            p_session_token: chefSessionToken,
            p_remove: true,
          });
          await openKitchenSettings(c);
        }),
      );
    }
  } catch {
    document.getElementById("kitchenLocationStatus").textContent =
      "تعذر تحميل الموقع. يمكنك الاستمرار وتحديده لاحقًا.";
  }
  box.append(mealAction("مشاركة مطبخي", () => shareKitchen(c)));
}
async function saveKitchenPoint(p, publicOnMap = false) {
  await mealRpc("chef_location", {
    p_session_token: chefSessionToken,
    p_lat: p[0],
    p_lng: p[1],
  });
  await mealRpc("chef_location_visibility", {
    p_session_token: chefSessionToken,
    p_public_on_map: Boolean(publicOnMap),
  });
  const status = document.getElementById("kitchenLocationStatus");
  if (status)
    status.textContent = publicOnMap
      ? "تم حفظ الموقع ونشره على الخريطة للزبائن."
      : "تم حفظ الموقع دون نشره.";
  showToast(
    publicOnMap ? "تم نشر موقع مطبخك على الخريطة." : "تم حفظ موقع مطبخك.",
  );
}
function localMealValue(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Casablanca",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(date))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
async function openMealOfferForm(editOffer = null) {
  if (!editOffer?.dish_name) editOffer = null;
  const c = await restoreChefSession(false);
  if (!c) throw Error("ادخل إلى مطبخك مجددًا.");
  const screen = mealPanel("mealOfferEditor", "إضافة وجبة"),
    box = screen.querySelector(".meal-content"),
    request = crypto.randomUUID();
  screen.dataset.offerId = editOffer?.id || "";
  const defaults = await mealRpc("chef_meal_defaults", {
    p_session_token: chefSessionToken,
  });
  const specialties = [
    ...document.getElementById("builderSpecialty").options,
  ].filter((o) => o.value);
  box.innerHTML = `<form id="mealOfferForm" class="meal-form"><h1>طبق من مطبخك</h1><label ${c.specialty ? "hidden" : ""}>نوع الأطباق<select name="specialty" class="field" required><option value="">اختيار النوع</option>${specialties.map((o) => `<option ${o.value === c.specialty ? "selected" : ""}>${escapeHtml(o.value)}</option>`).join("")}</select></label><label>اسم الطبق<input name="dish_name" class="field" required maxlength="150" placeholder="مثال: كسكس بالخضر واللحم"></label><label>السعر المرجعي للشخص الواحد بالدرهم<input name="price" class="field" type="number" min="1" max="10000" step="0.01" inputmode="decimal" required></label><label>صورة الطبق (اختياري)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" class="field"></label><img id="mealPhotoPreview" alt="معاينة صورة الطبق" hidden><label class="group-pricing"><input name="group_pricing" type="checkbox"> يمكن الاتفاق على سعر خاص حسب الكمية</label><small>وضع علامة يساعد الزبون على اقتراح تقدير للسعر قبل الاتفاق معك.</small><label>المكونات الرئيسية (اختياري)<textarea name="ingredients" class="field" maxlength="2000" placeholder="مثال: سميد، خضر، لحم"></textarea></label>${defaults?.configured ? "<p>تُستخدم إعدادات الاستلام المحفوظة لمطبخك. يمكنك تعديلها من «بيانات مطبخي».</p>" : `<section><h2>إعدادات مطبخك — تُحفظ مرة واحدة</h2>${kitchenSettingsFields(defaults || {})}</section>`}<button type="submit" class="primary full" value="done">حفظ والعودة إلى مطبخي</button><button type="submit" class="admin-secondary full" value="another">حفظ وإضافة طبق آخر</button><p role="status" id="mealFormStatus"></p></form>`;
  const form = box.querySelector("form");
  if (!defaults?.configured) bindKitchenSettings(form, defaults || {});
  let savedImage = null,
    uploaded = null,
    objectUrl = null;
  const preview = box.querySelector("#mealPhotoPreview");
  if (editOffer) {
    box.querySelector("h1").textContent = "تعديل الطبق المعروض";
    form.elements.specialty.disabled = true;
    form.elements.dish_name.value = editOffer.dish_name;
    form.elements.price.value = editOffer.reference_price ?? "";
    form.elements.group_pricing.checked = Boolean(editOffer.group_pricing);
    form.elements.ingredients.value = editOffer.ingredients || "";
    savedImage = safeImageUrl(editOffer.image_url) || null;
    if (savedImage) {
      preview.src = savedImage;
      preview.hidden = false;
    }
    form.querySelector("[value=another]").hidden = true;
  }

  form.elements.photo.onchange = () => {
    uploaded = null;
    const f = form.elements.photo.files[0];
    if (!f) return;
    if (
      f.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(f.type)
    ) {
      form.elements.photo.value = "";
      showToast("اختر صورة لا تتجاوز 5 ميغابايت.");
      return;
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = URL.createObjectURL(f);
    preview.src = objectUrl;
    preview.hidden = false;
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const submitter = e.submitter || form.querySelector("[type=submit]");
    if (form.dataset.saving) return;
    form.dataset.saving = "1";
    form.querySelectorAll("[type=submit]").forEach((b) => (b.disabled = true));
    mealBusy(submitter, async () => {
      const p = Object.fromEntries(new FormData(form));
      p.group_pricing = form.elements.group_pricing.checked;
      if (!defaults?.configured) Object.assign(p, readKitchenSettings(form));
      const photo = form.elements.photo.files[0];
      if (photo && !uploaded) uploaded = await uploadImageSecure(photo);
      const dish = {
        name: p.dish_name.trim(),
        price: Number(p.price),
        image_url: uploaded || savedImage,
      };
      await mealRpc("chef_save_reference_dish", {
        p_session_token: chefSessionToken,
        p_id: editOffer?.id || null,
        p_dish: dish,
        p_offer: p,
        p_request: request,
      });
      markFormSaved(form);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      showToast("طبقك معروض لاستقبال الطلبات.");
      if (submitter.value === "another") await openMealOfferForm();
      else {
        const fresh = await restoreChefSession(false);
        if (fresh) await openKitchenDashboard(fresh);
      }
    }).finally(() => {
      delete form.dataset.saving;
      form
        .querySelectorAll("[type=submit]")
        .forEach((b) => (b.disabled = false));
    });
  };
  showScreen(screen.id);
}
// Neutral wording works for both male and female cooks without guessing from names.
document.querySelector("#buildKitchen .join-note")?.remove();
// Share a kitchen, never a private order or chef session.
async function shareKitchen(c) {
  const url = new URL(location.origin + location.pathname);
  url.hash = "kitchen=" + c.id;
  const data = {
    title: `${prefix(c.gender)} ${c.name} — أمّي فود`,
    text: "أطباق مغربية بطعم البيت، من مطبخي إلى بيتك.",
    url: url.href,
  };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
    await navigator.clipboard.writeText(url.href);
    showToast("تم نسخ رابط مطبخك.");
  } catch (e) {
    if (e.name === "AbortError") return;
    const box = document.querySelector("#kitchenSettings .meal-content");
    let input = box.querySelector("[data-kitchen-link]");
    if (!input) {
      input = document.createElement("input");
      input.className = "field";
      input.readOnly = true;
      input.dataset.kitchenLink = "";
      input.setAttribute("aria-label", "رابط مطبخي");
      box.append(input);
    }
    input.value = url.href;
    input.focus();
    input.select();
    showToast("انسخ رابط مطبخك الظاهر.");
  }
}
async function followKitchenLink() {
  const match = location.hash.match(/^#kitchen=([0-9a-f-]{36})$/i);
  if (!match) return;
  showScreen("chefs");
  await loadChefs();
  const c = chefsCache.find((c) => String(c.id) === match[1]);
  if (c) await openMealOrdering(c);
  else showToast("هذا المطبخ غير متاح الآن.");
}
