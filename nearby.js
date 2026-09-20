/* Public kitchen map. Kitchens appear at the exact saved point only after explicit chef consent. */
"use strict";
const launchCity = {
  id: "casablanca",
  label: "الدار البيضاء",
  center: [33.5731, -7.5898],
};
const mapConfig = {
  tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};
let nearbyPoint = null,
  nearbyPointSource = "",
  nearbyLocations = [],
  nearbyLocationError = false,
  nearbyMeals = [],
  nearbyWorkdays = [],
  nearbyMap = null,
  nearbyLayer = null,
  leafletPromise = null,
  discoveryVersion = 0;
const nearDistance = (a, b) => {
  const r = Math.PI / 180,
    dlat = (b[0] - a[0]) * r,
    dlng = (b[1] - a[1]) * r,
    v =
      Math.sin(dlat / 2) ** 2 +
      Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dlng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(Math.max(0, 1 - v)));
};
function discoveryCityName(id) {
  return (
    [...citySelect.options]
      .find((o) => o.value === id)
      ?.textContent.split(" — ")[0] ||
    id ||
    ""
  );
}
function publishedKitchenLocation(c) {
  return nearbyLocations.find(
    (p) =>
      p.chef_id === c.id &&
      p.lat != null &&
      p.lng != null &&
      Number.isFinite(Number(p.lat)) &&
      Number.isFinite(Number(p.lng)),
  );
}
function locationLabel(c) {
  if (nearbyLocationError) return "تعذر تحميل موقع المطبخ";
  const p = publishedKitchenLocation(c);
  if (!p) return "لم يُنشر موقع هذا المطبخ على الخريطة";
  if (!nearbyPoint) return "";
  const d = nearDistance(nearbyPoint, [Number(p.lat), Number(p.lng)]),
    from = nearbyPointSource === "device" ? "عن موقعك" : "عن المكان المختار";
  return d < 0.5
    ? `أقل من نصف كيلومتر ${from}`
    : `نحو ${d.toFixed(1)} كم ${from}`;
}
function updateNearbyAreas() {
  const city = document.getElementById("nearCity").value,
    areas = [
      ...new Set(
        chefsCache
          .filter((c) => !city || c.city === city)
          .map((c) => c.area)
          .filter(Boolean),
      ),
    ].sort(),
    select = document.getElementById("nearArea"),
    old = select.value;
  select.replaceChildren(
    new Option("كل الأحياء", ""),
    ...areas.map((a) => new Option(a, a)),
  );
  select.value = areas.includes(old) ? old : "";
}
function updateDiscoveryLabels() {
  const city = document.getElementById("nearCity").value,
    rows = filteredKitchens(),
    canSort = nearbyPoint && rows.some(publishedKitchenLocation);
  document.getElementById("discoveryTitle").textContent = canSort
    ? "المطابخ حسب المسافة"
    : "المطابخ المتاحة";
  document.getElementById("cityTitle").textContent = city
    ? discoveryCityName(city)
    : "كل المدن";
  document.getElementById("nearStatus").textContent = nearbyLocationError
    ? "تعذر تحميل مواقع المطابخ. القائمة متاحة، لكن المسافات والخريطة غير مكتملتين."
    : canSort
      ? `مرتبة حسب المسافة المباشرة ${nearbyPointSource === "device" ? "من موقعك" : "من المكان الذي اخترته"}، وليست مسافة الطريق. المطابخ بلا موقع منشور في نهاية القائمة.`
      : nearbyPoint
        ? "لا توجد مواقع منشورة في هذا الاختيار لحساب المسافة."
        : "لم تحدد موقع البحث. اختر المدينة أو اضغط «بالقرب مني».";
}
function setNearbySearchPoint(point, source) {
  nearbyPoint = point;
  nearbyPointSource = source;
  document.getElementById("nearCity").value = "";
  document.getElementById("nearArea").value = "";
  updateNearbyAreas();
  renderNearby();
  fitNearbyMap();
  if (typeof updateNearbyNavigation === "function") updateNearbyNavigation();
}
function requestPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Error("يمكنك اختيار الحي أو تحديد نقطة على الخريطة."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve([p.coords.latitude, p.coords.longitude]),
      () => reject(Error("لم نحصل على موقعك. يمكنك اختيار الحي يدويًا.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "vendor/leaflet/leaflet.css";
    document.head.append(css);
    const script = document.createElement("script");
    script.src = "vendor/leaflet/leaflet.js";
    const timer = setTimeout(() => {
      script.remove();
      leafletPromise = null;
      reject(Error("تعذر فتح الخريطة. قائمة المطابخ ما زالت متاحة."));
    }, 12000);
    script.onload = () => {
      clearTimeout(timer);
      resolve(window.L);
    };
    script.onerror = () => {
      clearTimeout(timer);
      leafletPromise = null;
      script.remove();
      reject(Error("تعذر فتح الخريطة. قائمة المطابخ ما زالت متاحة."));
    };
    document.head.append(script);
  });
  return leafletPromise;
}
function addMapTiles(map, note) {
  map.zoomControl?.setPosition("topleft");
  const container = map.getContainer();
  setTimeout(() => {
    const plus = container.querySelector(".leaflet-control-zoom-in"),
      minus = container.querySelector(".leaflet-control-zoom-out");
    if (plus) {
      plus.title = "تكبير";
      plus.setAttribute("aria-label", "تكبير");
    }
    if (minus) {
      minus.title = "تصغير";
      minus.setAttribute("aria-label", "تصغير");
    }
  }, 0);
  L.tileLayer(mapConfig.tiles, {
    attribution: mapConfig.attribution,
    maxZoom: 19,
    updateWhenIdle: true,
    keepBuffer: 1,
  })
    .on("tileerror", () => {
      note.textContent =
        "تعذر تحميل بعض أجزاء الخريطة. يمكنك الاستمرار باستخدام القائمة.";
    })
    .addTo(map);
}
function installDiscovery() {
  const host = document.querySelector("#chefs .content"),
    bar = document.createElement("section");
  bar.className = "nearby-controls";
  bar.innerHTML = `<div class="nearby-actions"><button type="button" class="primary" id="nearMe">بالقرب مني</button><button type="button" class="admin-secondary" id="showKitchenMap">عرض الخريطة</button></div><label for="nearCity">المدينة<select id="nearCity" class="field"><option value="">كل المدن</option>${[
    ...citySelect.options,
  ]
    .filter((o) => o.value)
    .map(
      (o) =>
        `<option value="${escapeHtml(o.value)}">${escapeHtml(discoveryCityName(o.value))}</option>`,
    )
    .join(
      "",
    )}</select></label><label for="nearArea">الحي <select id="nearArea" class="field"><option value="">كل الأحياء</option></select></label><p id="nearStatus" role="status"></p><div id="nearMapWrap" hidden><p>تظهر المطابخ التي حُفظ موقعها ووافق أصحابها على نشره.</p><div id="nearMap" class="location-map" aria-label="خريطة المطابخ"></div><p id="mapStatus" role="status"></p><button type="button" class="admin-secondary" id="chooseSearchPoint">البحث حول مكان آخر على الخريطة</button></div>`;
  host.prepend(bar);
  document.getElementById("nearMe").onclick = (e) =>
    mealBusy(e.currentTarget, async () =>
      setNearbySearchPoint(await requestPosition(), "device"),
    );
  document.getElementById("nearCity").onchange = () => {
    if (
      typeof restoringNavigationState === "undefined" ||
      !restoringNavigationState
    ) {
      nearbyPoint = null;
      nearbyPointSource = "";
      document.getElementById("nearArea").value = "";
    }
    updateNearbyAreas();
    renderNearby();
    fitNearbyMap();
  };
  document.getElementById("nearArea").onchange = () => {
    renderNearby();
    fitNearbyMap();
  };
  document.getElementById("showKitchenMap").onclick = async (e) => {
    const button = e.currentTarget;
    await mealBusy(button, async () => {
      const wrap = document.getElementById("nearMapWrap");
      wrap.hidden = !wrap.hidden;
      if (wrap.hidden) return;
      await loadLeaflet();
      if (!nearbyMap) {
        nearbyMap = L.map("nearMap", { scrollWheelZoom: false }).setView(
          [31.8, -7.1],
          5,
        );
        addMapTiles(nearbyMap, document.getElementById("mapStatus"));
        nearbyLayer = L.layerGroup().addTo(nearbyMap);
        nearbyMap.on("zoomend", renderNearbyMap);
      }
      nearbyMap.invalidateSize();
      renderNearbyMap();
      fitNearbyMap();
    });
    button.textContent = document.getElementById("nearMapWrap").hidden
      ? "عرض الخريطة"
      : "إخفاء الخريطة";
  };
  document.getElementById("chooseSearchPoint").onclick = () =>
    pickLocation(false, nearbyPoint, (p) => setNearbySearchPoint(p, "map"));
  updateDiscoveryLabels();
}
async function loadChefs() {
  const version = ++discoveryVersion,
    grid = document.getElementById("chefGrid");
  grid.innerHTML = '<p role="status">جاري تحميل المطابخ…</p>';
  try {
    const [chefs, locations, offers, workdays] = await Promise.all([
      db
        .from("chefs")
        .select("id,name,gender,city,specialty,dishes,area")
        .eq("status", "active")
        .order("created_at", { ascending: false }),
      db.rpc("public_kitchen_locations"),
      db
        .from("meal_offers")
        .select("id,chef_id,dish_name,price,reference_price,image_url,serves")
        .eq("active", true)
        .order("created_at"),
      db.rpc("public_kitchen_workdays"),
    ]);
    if (version !== discoveryVersion) return;
    if (chefs.error) throw chefs.error;
    chefsCache = chefs.data || [];
    nearbyWorkdays = workdays.error ? [] : workdays.data || [];
    nearbyLocationError = Boolean(locations.error);
    nearbyLocations = locations.error ? [] : locations.data || [];
    nearbyMeals = offers.error ? [] : offers.data || [];
    updateNearbyAreas();
    renderNearby();
    if (offers.error)
      document.getElementById("nearStatus").textContent =
        "تعذر تحميل اقتراحات الأطباق. يمكنك فتح المطبخ أو تحديث الصفحة.";
    fitNearbyMap();
  } catch {
    grid.innerHTML = "<p>تعذر تحميل المطابخ الآن.</p>";
    grid.append(mealAction("إعادة المحاولة", loadChefs));
  }
}
function filteredKitchens() {
  const city = document.getElementById("nearCity")?.value,
    area = document.getElementById("nearArea")?.value;
  const rows = chefsCache.filter(
    (c) => (!city || c.city === city) && (!area || c.area === area),
  );
  return rows.sort((a, b) => {
    if (nearbyPoint) {
      const x = publishedKitchenLocation(a),
        y = publishedKitchenLocation(b),
        dist = (p) =>
          p
            ? nearDistance(nearbyPoint, [Number(p.lat), Number(p.lng)])
            : Infinity;
      const delta = dist(x) - dist(y);
      if (!Number.isNaN(delta) && delta !== 0) return delta;
    }
    return (
      Number(nearbyMeals.some((o) => o.chef_id === b.id)) -
      Number(nearbyMeals.some((o) => o.chef_id === a.id))
    );
  });
}
function renderNearby() {
  const grid = document.getElementById("chefGrid"),
    rows = filteredKitchens();
  updateDiscoveryLabels();
  grid.replaceChildren();
  if (!rows.length) {
    grid.innerHTML =
      '<div class="empty-state"><strong>لا توجد مطابخ في هذا الاختيار بعد.</strong><p>يمكنك اختيار مدينة أخرى أو عرض كل المدن.</p></div>';
    renderNearbyMap();
    return;
  }
  rows.forEach((c) => {
    const meal = nearbyMeals.find((o) => o.chef_id === c.id),
      photo = safeImageUrl(meal?.image_url),
      button = document.createElement("button");
    button.type = "button";
    button.className = "chef-card nearby-card";
    button.innerHTML = `${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(meal.dish_name)}" loading="lazy">` : ""}<span class="chef-main"><strong class="chef-name">${prefix(c.gender)} ${escapeHtml(c.name)}</strong><span>${escapeHtml([c.area, discoveryCityName(c.city)].filter(Boolean).join(" · "))}</span><span>${escapeHtml(locationLabel(c))}</span><span>${escapeHtml(kitchenDaysLabel(nearbyWorkdays.find((x) => x.chef_id === c.id)?.work_days))}</span>${meal ? `<strong>${escapeHtml(meal.dish_name)} · ${meal.reference_price != null ? mealMoney(meal.reference_price) + " للشخص — مرجعي" : "الثمن حسب الاتفاق"}</strong><span>من الأطباق التي نتقنها</span><span class="status available">أطباق تُحضّر حسب الطلب</span>` : "<span>اكتب ما تشتهيه واسأل المطبخ</span>"}<span class="open-kitchen">اختر ما تشتهيه ←</span></span>`;
    button.onclick = () => openChef(c.id);
    grid.append(button);
  });
  renderNearbyMap();
}
function fitNearbyMap() {
  if (!nearbyMap || document.getElementById("nearMapWrap").hidden) return;
  const points = filteredKitchens()
    .map(publishedKitchenLocation)
    .filter(Boolean)
    .map((p) => [Number(p.lat), Number(p.lng)]);
  if (nearbyPoint) points.push(nearbyPoint);
  if (points.length)
    nearbyMap.fitBounds(points, { padding: [24, 24], maxZoom: 15 });
  else nearbyMap.setView([31.8, -7.1], 5);
}
function renderNearbyMap() {
  if (!nearbyMap || document.getElementById("nearMapWrap").hidden) return;
  nearbyLayer.clearLayers();
  const groups = new Map(),
    zoom = nearbyMap.getZoom(),
    size = zoom < 14 ? 65 : 25;
  for (const c of filteredKitchens()) {
    const p = publishedKitchenLocation(c);
    if (!p) continue;
    const pt = nearbyMap.project([Number(p.lat), Number(p.lng)], zoom),
      key = Math.floor(pt.x / size) + ":" + Math.floor(pt.y / size);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ c, p });
  }
  for (const members of groups.values()) {
    const lat =
        members.reduce((a, x) => a + Number(x.p.lat), 0) / members.length,
      lng = members.reduce((a, x) => a + Number(x.p.lng), 0) / members.length,
      live = members.some((x) => nearbyMeals.some((o) => o.chef_id === x.c.id));
    const icon = L.divIcon({
      className: "kitchen-map-dot " + (live ? "live" : ""),
      html: members.length > 1 ? String(members.length) : "",
      iconSize: [32, 32],
    });
    const marker = L.marker([lat, lng], {
      icon,
      title:
        members.length === 1 ? members[0].c.name : `${members.length} مطابخ`,
    }).addTo(nearbyLayer);
    marker.on("click", () => {
      if (members.length === 1) {
        openChef(members[0].c.id);
        return;
      }
      const box = document.getElementById("mapStatus");
      box.replaceChildren();
      members.forEach((x) =>
        box.append(
          mealAction(`${prefix(x.c.gender)} ${x.c.name}`, () =>
            openChef(x.c.id),
          ),
        ),
      );
    });
  }
  if (nearbyPoint)
    L.circleMarker(nearbyPoint, { radius: 7, color: "#2563eb", fillOpacity: 1 })
      .bindTooltip(nearbyPointSource === "device" ? "موقعك" : "مكان البحث")
      .addTo(nearbyLayer);
  const rows = filteredKitchens(),
    mapped = rows.filter(publishedKitchenLocation).length;
  document.getElementById("mapStatus").textContent = nearbyLocationError
    ? "تعذر تحميل مواقع المطابخ. حدّث الصفحة للمحاولة مجددًا."
    : mapped
      ? `عدد المطابخ على الخريطة: ${mapped}. الأخضر: أطباق مقترحة. الرمادي: اسأل المطبخ عمّا تشتهيه.${mapped < rows.length ? " بقية المطابخ لم تنشر مواقعها." : ""}`
      : rows.length
        ? "المطابخ المعروضة لم تنشر مواقعها بعد. تجدها في القائمة."
        : "لا توجد مطابخ في المدينة أو الحي المختار.";
}
async function pickLocation(owner, initial, onSave) {
  const screen = mealPanel(
      "locationPicker",
      owner ? "موقع مطبخي" : "اختيار مكان البحث",
    ),
    box = screen.querySelector(".meal-content");
  const previous = document.querySelector(".screen.active")?.id || "home";
  box.innerHTML = `<p>${owner ? "اضغط على موقع مطبخك بدقة، ثم ضع علامة الموافقة على نشره." : "اضغط على المكان الذي تريد البحث حوله، أو استخدم موقعك الحالي."}</p><p>عند فتح الخريطة يتصل جهازك بمزوّد الخرائط لتحميل المنطقة المعروضة.</p><button class="admin-secondary" id="pickerGPS">استخدام موقعي الحالي</button><div id="pickerMap" class="location-map"></div>${owner ? '<label class="join-consent"><input id="publicMapConsent" type="checkbox"> <span>أوافق على ظهور موقع مطبخي المحدد على الخريطة لجميع الزبائن.</span></label>' : ""}<p id="pickerStatus" role="status"></p><button id="savePoint" class="primary full" disabled>حفظ الموقع</button>`;
  screen.dataset.locationOwner = String(owner);
  screen.dataset.point = JSON.stringify(initial || null);
  showScreen(screen.id);
  let point = initial || null;
  try {
    await loadLeaflet();
    const map = L.map("pickerMap", { scrollWheelZoom: false }).setView(
      initial || (owner ? launchCity.center : [31.8, -7.1]),
      initial ? 16 : owner ? 12 : 5,
    );
    addMapTiles(map, document.getElementById("pickerStatus"));
    screen.navigationCleanup = () => {
      map.remove();
      screen.navigationCleanup = null;
    };
    let marker = null;
    const select = (p) => {
      point = p;
      screen.dataset.point = JSON.stringify(p);
      if (marker) marker.remove();
      marker = L.circleMarker(p, { radius: 10, color: "#B6382D" }).addTo(map);
      document.getElementById("savePoint").disabled =
        owner && !document.getElementById("publicMapConsent").checked;
    };
    if (initial) select(initial);
    if (owner)
      document.getElementById("publicMapConsent").onchange = () => {
        document.getElementById("savePoint").disabled =
          !point || !document.getElementById("publicMapConsent").checked;
      };
    map.on("click", (e) => select([e.latlng.lat, e.latlng.lng]));
    document.getElementById("pickerGPS").onclick = (e) =>
      mealBusy(e.currentTarget, async () => {
        const p = await requestPosition();
        select(p);
        map.setView(p, 16);
      });
    document.getElementById("savePoint").onclick = (e) =>
      mealBusy(e.currentTarget, async () => {
        if (!point) return;
        if (
          owner &&
          (point[0] < 33.35 ||
            point[0] > 33.8 ||
            point[1] < -7.95 ||
            point[1] > -7.3)
        )
          throw Error("الانطلاقة في الدار البيضاء فقط. حدد موقع مطبخك داخلها.");
        const consent =
          !owner || document.getElementById("publicMapConsent")?.checked;
        if (owner && !consent)
          throw Error("ضع علامة الموافقة حتى يظهر مطبخك في الخريطة.");
        await onSave(point, consent);
        await navigateBack();
      });
  } catch (e) {
    document.getElementById("pickerStatus").textContent = e.message;
  }
}
installDiscovery();
