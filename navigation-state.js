"use strict";
// Keep page context per tab. Credentials are never copied into this state;
// protected pages always revalidate the existing kitchen session with the server.
const OMMI_NAV_STATE_KEY = "ommi_navigation_state_v1";
const navigationPublic = new Set([
  "home",
  "chefs",
  "orderModal",
  "myMealReceipts",
  "customerMealTracking",
  "locationPicker",
]);
const navigationPrivate = new Set([
  "chefKitchenDashboard",
  "kitchenSettings",
  "kitchenPreferences",
  "myMealOffers",
  "chefMealOrders",
  "mealOfferEditor",
  "buildKitchen",
]);
let navigationRevision = 0;
let restoringNavigationState = false,
  navigationRestoreFailed = false,
  navigationCurrent = null,
  navigationTrail = [];
function navigationFields(root) {
  return [...root.querySelectorAll("input,select,textarea")]
    .filter(
      (el) =>
        !["password", "file", "hidden", "submit", "button"].includes(el.type) &&
        !/(pin|secret|token)/i.test(el.name || el.id),
    )
    .map((el) => ({
      key: el.id ? "#" + el.id : el.name,
      kind: el.type,
      value: el.value,
      checked: el.checked,
    }))
    .filter((x) => x.key);
}
function navigationSnapshot() {
  const screen = document.querySelector(".screen.active");
  if (!screen) return null;
  const id = screen.id;
  if (!navigationPublic.has(id) && !navigationPrivate.has(id)) return null;
  const state = {
    screen: id,
    fields: navigationFields(screen),
    scroll: window.scrollY,
  };
  if (navigationPrivate.has(id)) state.owner = currentChefId;
  if (id === "orderModal") state.chefId = activeChef?.id;
  if (id === "mealOfferEditor") state.offerId = screen.dataset.offerId || null;
  if (id === "customerMealTracking")
    state.token = requestTrackingToken || mealTrackingToken;
  if (id === "chefs") {
    state.searchPoint = nearbyPoint;
    state.searchPointSource = nearbyPointSource;
    state.mapOpen = !document.getElementById("nearMapWrap").hidden;
  }
  if (id === "locationPicker") {
    state.locationOwner = screen.dataset.locationOwner === "true";
    state.point = JSON.parse(screen.dataset.point || "null");
    if (state.locationOwner) state.owner = currentChefId;
  }
  const modal = document.querySelector(".modal.open");
  if (modal && ["joinModal", "chefLoginModal"].includes(modal.id))
    state.modal = { id: modal.id, fields: navigationFields(modal) };
  return state;
}
function saveNavigationState() {
  if (restoringNavigationState || navigationRestoreFailed) return;
  navigationCurrent = navigationSnapshot();
  try {
    sessionStorage.setItem(
      OMMI_NAV_STATE_KEY,
      JSON.stringify({
        current: navigationCurrent,
        trail: navigationTrail.slice(-20),
      }),
    );
  } catch {}
}
function forgetOrderNavigation(token) {
  const cancelled = (state) =>
    state?.screen === "customerMealTracking" && state.token === token;
  navigationTrail = navigationTrail.filter((state) => !cancelled(state));
  if (cancelled(navigationCurrent)) navigationCurrent = null;
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(OMMI_NAV_STATE_KEY) || "null",
    );
    if (saved) {
      if (cancelled(saved.current)) saved.current = { screen: "home" };
      saved.trail = (saved.trail || []).filter((state) => !cancelled(state));
      sessionStorage.setItem(OMMI_NAV_STATE_KEY, JSON.stringify(saved));
    }
  } catch {}
}
function updateNearbyNavigation() {
  if (document.querySelector("#locationPicker.active")) {
    const previous = navigationTrail.findLast(
      (state) => state.screen === "chefs",
    );
    if (previous) {
      previous.searchPoint = nearbyPoint;
      previous.searchPointSource = nearbyPointSource;
      previous.fields = navigationFields(document.getElementById("chefs"));
    }
  }
  saveNavigationState();
}
function showScreen(id) {
  if (!document.getElementById(id)) return;
  navigationRevision++;
  if (!restoringNavigationState) {
    navigationRestoreFailed = false;
    const previous = navigationSnapshot();
    if (id === "home") navigationTrail = [];
    else if (previous && previous.screen !== id) navigationTrail.push(previous);
    if (
      /^#kitchen=/.test(location.hash) &&
      (id !== "orderModal" || location.hash !== "#kitchen=" + activeChef?.id)
    )
      history.replaceState(null, "", location.pathname + location.search);
  }
  if (id === "home") {
    try {
      localStorage.removeItem(MEAL_LAST_ORDER_KEY);
    } catch {}
    requestTrackingToken = null;
    mealTrackingToken = null;
  }
  if (id !== "customerMealTracking" && /^#order=/.test(location.hash))
    history.replaceState(null, "", location.pathname + location.search);
  const current = document.querySelector(".screen.active"),
    next = document.getElementById(id);
  if (current?.id !== id) current?.navigationCleanup?.();
  prepareNavigation(next);
  watchEdits(next);
  document
    .querySelectorAll(".screen")
    .forEach((s) => s.classList.remove("active"));
  next.classList.add("active");
  window.scrollTo(0, 0);
  saveNavigationState();
}
function restoreNavigationFields(state) {
  const screen = document.getElementById(state.screen);
  for (const entry of state.fields || []) {
    const fields = [...screen.querySelectorAll("input,select,textarea")].filter(
      (el) => (el.id ? "#" + el.id : el.name) === entry.key,
    );
    for (const field of fields) {
      if (["password", "file", "hidden"].includes(field.type)) continue;
      if (["checkbox", "radio"].includes(field.type)) {
        if (field.value === entry.value) field.checked = Boolean(entry.checked);
      } else
        field.value =
          state.screen === "orderModal" && field.name === "requested_at"
            ? requestDraftTime(entry.value)
            : entry.value;
    }
  }
  if (state.screen === "locationPicker")
    document
      .getElementById("publicMapConsent")
      ?.dispatchEvent(new Event("change"));
  for (const select of screen.querySelectorAll("select"))
    select.dispatchEvent(new Event("change", { bubbles: true }));
  if (state.screen === "orderModal") {
    document
      .querySelector("#mealCustomerForm [name=people]")
      ?.dispatchEvent(new Event("input", { bubbles: true }));
  }
  if (state.modal) {
    const modal = document.getElementById(state.modal.id);
    if (modal) {
      openModal(modal);
      restoreNavigationFields({ screen: modal.id, fields: state.modal.fields });
    }
  }
  window.scrollTo(0, Number(state.scroll) || 0);
}
async function openNavigationState(state) {
  if (
    !state ||
    (!navigationPublic.has(state.screen) &&
      !navigationPrivate.has(state.screen))
  )
    return false;
  let chef;
  if (navigationPrivate.has(state.screen) || state.locationOwner) {
    chef = await restoreChefSession(false);
    if (!chef || String(chef.id) !== String(state.owner)) {
      showScreen("home");
      showToast("ادخل إلى مطبخك للمتابعة.");
      return false;
    }
  }
  switch (state.screen) {
    case "home":
      showScreen("home");
      break;
    case "chefs":
      nearbyPoint =
        Array.isArray(state.searchPoint) &&
        state.searchPoint.length === 2 &&
        state.searchPoint.every(Number.isFinite) &&
        Math.abs(state.searchPoint[0]) <= 90 &&
        Math.abs(state.searchPoint[1]) <= 180
          ? state.searchPoint
          : null;
      nearbyPointSource =
        nearbyPoint && state.searchPointSource === "device" ? "device" : "map";
      showScreen("chefs");
      await loadChefs();
      break;
    case "orderModal": {
      await loadChefs();
      const c = chefsCache.find((c) => String(c.id) === String(state.chefId));
      if (!c) {
        showScreen("chefs");
        showToast("هذا المطبخ غير متاح الآن.");
        return false;
      }
      await openMealOrdering(c);
      break;
    }
    case "myMealReceipts":
      await openMyMealReceipts();
      break;
    case "customerMealTracking":
      if (!/^[0-9a-f]{64}$/.test(state.token || "")) return false;
      await openCustomerMealOrder(state.token);
      break;
    case "chefKitchenDashboard":
      openKitchenDashboard(chef);
      break;
    case "kitchenSettings":
      await openKitchenSettings(chef);
      break;
    case "kitchenPreferences":
      await openKitchenPreferences();
      break;
    case "myMealOffers":
      await openMyMealOffers();
      break;
    case "chefMealOrders":
      await openChefMealOrders();
      break;
    case "mealOfferEditor": {
      let offer = null;
      if (state.offerId) {
        const rows = await mealRpc("chef_meal_offers", {
          p_session_token: chefSessionToken,
        });
        offer = rows.find((o) => o.id === state.offerId);
        if (!offer) {
          openKitchenDashboard(chef);
          return false;
        }
      }
      await openMealOfferForm(offer);
      break;
    }
    case "buildKitchen":
      await openKitchenEditor(chef);
      break;
    case "locationPicker": {
      const previous = navigationTrail.at(-1);
      if (previous && previous.screen !== "locationPicker")
        await openNavigationState(previous);
      else if (state.locationOwner) await openKitchenSettings(chef);
      else {
        showScreen("chefs");
        await loadChefs();
      }
      await pickLocation(
        Boolean(state.locationOwner),
        state.point,
        state.locationOwner
          ? saveKitchenPoint
          : (p) => setNearbySearchPoint(p, "map"),
      );
      break;
    }
  }
  if (document.querySelector(".screen.active")?.id === state.screen) {
    restoreNavigationFields(state);
    if (
      state.screen === "chefs" &&
      state.mapOpen &&
      document.getElementById("nearMapWrap").hidden
    )
      await document
        .getElementById("showKitchenMap")
        .onclick({ currentTarget: document.getElementById("showKitchenMap") });
  }
  return true;
}
async function navigateBack() {
  const previous = navigationTrail.pop() || { screen: "home" };
  restoringNavigationState = true;
  try {
    if (!(await openNavigationState(previous))) navigationTrail = [];
  } catch {
    navigationTrail.push(previous);
    showToast("تعذر الرجوع الآن. حاول مجددًا.");
  } finally {
    restoringNavigationState = false;
    saveNavigationState();
  }
}
async function restoreNavigationState() {
  let saved;
  try {
    saved = JSON.parse(sessionStorage.getItem(OMMI_NAV_STATE_KEY) || "null");
  } catch {}
  const current = saved?.current || saved;
  const order = location.hash.match(/^#order=([0-9a-f]{64})$/);
  const kitchen = location.hash.match(/^#kitchen=([0-9a-f-]{36})$/i);
  if (!order && !kitchen && !current?.screen) {
    await restoreRecentOrder();
    return;
  }
  const sameLink = order
    ? current?.screen === "customerMealTracking" && current.token === order[1]
    : kitchen
      ? current?.screen === "orderModal" && current.chefId === kitchen[1]
      : true;
  restoringNavigationState = true;
  navigationTrail = sameLink && Array.isArray(saved?.trail) ? saved.trail : [];
  try {
    if (order && !sameLink) await openCustomerMealOrder(order[1]);
    else if (kitchen && !sameLink) await followKitchenLink();
    else if (!(await openNavigationState(current))) navigationTrail = [];
  } catch {
    navigationRestoreFailed = true;
    showToast("تعذر استعادة الصفحة الآن. حدّثها للمحاولة مجددًا.");
    return;
  } finally {
    restoringNavigationState = false;
  }
  saveNavigationState();
}
// A single owner restores startup and address changes; renderers do not register startup handlers.
window.addEventListener("DOMContentLoaded", restoreNavigationState, {
  once: true,
});
window.addEventListener("pagehide", saveNavigationState);
window.addEventListener("beforeunload", saveNavigationState);
let navigationSaveTimer;
for (const event of ["input", "change"])
  document.addEventListener(event, () => {
    clearTimeout(navigationSaveTimer);
    navigationSaveTimer = setTimeout(saveNavigationState, 120);
  });

window.addEventListener("hashchange", () => {
  restoreNavigationState().catch(() => showToast("تعذر فتح الصفحة."));
});
