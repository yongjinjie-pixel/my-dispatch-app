import {
  applyDispatch, assignmentSummary, defaultState, loadScore, makeWhatsAppMessage,
  recordActualTrip, tomorrowISO, uid,
} from "./scheduler.js";

const STORAGE_KEY = "dispatch-pilot-state-v1";
const root = document.querySelector("#app");
const requestedTab = new URLSearchParams(window.location.search).get("tab");
const ui = { tab: ["orders", "dispatch", "logs", "settings", "trucks"].includes(requestedTab) ? requestedTab : "home", date: tomorrowISO(), toast: "" };
let state = readState();

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved?.trucks?.length ? saved : defaultState();
  } catch { return defaultState(); }
}

function persist(message = "Saved on this phone") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  ui.toast = message;
  render();
  window.clearTimeout(window.__dispatchToast);
  window.__dispatchToast = window.setTimeout(() => { ui.toast = ""; render(); }, 2600);
}

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function activeOrders() { return state.orders.filter((order) => order.date === ui.date); }
function activeAssignments() { return state.assignments.filter((assignment) => assignment.date === ui.date).sort((a, b) => a.tripNumber - b.tripNumber); }
function customer(id) { return state.customers.find((item) => item.id === id); }
function truck(id) { return state.trucks.find((item) => item.id === id); }
function totalLoads() { return activeOrders().reduce((sum, order) => sum + Number(order.loads || 0), 0); }
function availableCapacity() { return state.trucks.filter((item) => ["available", "active"].includes(String(item.status).toLowerCase())).reduce((sum, item) => sum + Number(item.dailyMax || 0), 0); }
function customerOptions(selected = "") {
  return state.customers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((item) => `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(item.name)}</option>`).join("");
}
function zoneOptions(selected) { return ["Near", "Far", "Stone"].map((item) => `<option ${item === selected ? "selected" : ""}>${item}</option>`).join(""); }
function newZoneOptions() { return `<option value="" selected>Use customer rule</option>${zoneOptions("")}`; }
function sourceOptions(selected) { return [`<option value="" ${!selected ? "selected" : ""}>Use customer rule</option>`, ...["MingLiong Mados", "GuanSengLee", "GD Linggiu", "KL Building", "BJ", "Saroma Kangkar Pulai"].map((item) => `<option ${item === selected ? "selected" : ""}>${item}</option>`)].join(""); }
function badge(status) { return `<span class="badge ${esc(String(status).toLowerCase())}">${esc(status)}</span>`; }
function notify(message) { ui.toast = message; render(); }

function layout(content) {
  return `
    <header class="topbar">
      <div><p class="eyebrow">DISPATCH PILOT</p><h1>${esc(state.companyName || "My Transport Dispatch")}</h1></div>
      <button class="icon-button" data-action="go-settings" aria-label="Settings">⚙</button>
    </header>
    <main>
      <section class="date-strip">
        <label>Dispatch date<input id="dispatch-date" type="date" value="${esc(ui.date)}"></label>
        <span>${activeAssignments().length ? `${activeAssignments().length} trips planned` : "Not balanced yet"}</span>
      </section>
      ${content}
    </main>
    <nav class="bottom-nav">
      ${[["home", "⌂", "Today"], ["orders", "＋", "Orders"], ["dispatch", "⇄", "Dispatch"], ["logs", "✓", "Trip log"], ["settings", "⚙", "Setup"]].map(([id, icon, label]) => `<button class="${ui.tab === id ? "active" : ""}" data-tab="${id}"><b>${icon}</b><span>${label}</span></button>`).join("")}
    </nav>
    ${ui.toast ? `<div class="toast">${esc(ui.toast)}</div>` : ""}
  `;
}

function homePage() {
  const assignments = activeAssignments();
  const unresolved = state.lastAllocation?.date === ui.date ? state.lastAllocation.unresolved || [] : [];
  const byTruck = state.trucks.filter((item) => ["available", "active"].includes(String(item.status).toLowerCase())).map((item) => ({ item, count: assignments.filter((assignment) => assignment.truckId === item.id).length }));
  return `
    <section class="hero">
      <p>Nightly plan</p><h2>Balance fairly, then send the driver message.</h2>
      <div class="hero-actions"><button class="primary" data-action="run-dispatch">Auto-balance orders</button><button class="secondary" data-action="go-dispatch">Review trips</button></div>
    </section>
    <section class="metrics">
      <article><span>Orders</span><strong>${totalLoads()}</strong><small>loads requested</small></article>
      <article><span>Planned</span><strong>${assignments.length}</strong><small>${unresolved.length ? `${unresolved.length} to review` : "all allocated"}</small></article>
      <article><span>Capacity</span><strong>${availableCapacity()}</strong><small>available today</small></article>
    </section>
    ${unresolved.length ? `<section class="alert"><b>Needs your decision</b>${unresolved.map((item) => `<p>${esc(customer(item.customerId)?.name)} — ${esc(item.reason)}</p>`).join("")}</section>` : ""}
    <section class="panel"><div class="section-head"><div><p class="eyebrow">FAIRNESS CHECK</p><h2>Available trucks</h2></div><button class="text-button" data-tab="trucks">Edit trucks</button></div>
      <div class="load-list">${byTruck.map(({ item, count }) => {
        const score = loadScore(state, item.id, ui.date);
        return `<div class="load-row"><div><strong>${esc(item.number)}</strong>${badge(item.status)}</div><div class="mini-bar"><i style="width:${Math.min(100, count / Math.max(1, item.dailyMax) * 100)}%"></i></div><span>${count}/${item.dailyMax}</span><small>${score.historical} done in last 30 days</small></div>`;
      }).join("") || "<p class='muted'>Set truck availability first.</p>"}</div>
    </section>
    <section class="panel message-card"><div class="section-head"><div><p class="eyebrow">READY TO SEND</p><h2>WhatsApp message</h2></div><button class="text-button" data-action="copy-message">Copy</button></div><pre>${esc(makeWhatsAppMessage(state, ui.date))}</pre><button class="primary wide" data-action="open-whatsapp">Open WhatsApp with this message</button></section>
  `;
}

function orderCard(order) {
  return `<article class="order-card" data-order="${esc(order.id)}">
    <div class="order-card-top"><select data-order-field="customerId">${customerOptions(order.customerId)}</select><button class="delete" data-action="delete-order" data-id="${esc(order.id)}">×</button></div>
    <div class="fields three"><label>Loads<input type="number" min="0" data-order-field="loads" value="${esc(order.loads)}"></label><label>Zone<select data-order-field="zone">${zoneOptions(order.zone)}</select></label><label>Type<input disabled value="${esc(order.kind)}"></label></div>
    <div class="fields two"><label>Source<select data-order-field="source">${sourceOptions(order.source)}</select></label><label>Sand / stone product<input data-order-field="productLabel" value="${esc(order.productLabel || order.product)}" placeholder="e.g. 1x cuci ML/GSL"></label></div>
    <div class="fields two"><label>Product detail<input data-order-field="product" value="${esc(order.product)}" placeholder="e.g. 1x cuci"></label><label class="check"><input type="checkbox" data-order-field="early" ${order.early ? "checked" : ""}> Must arrive early</label></div>
    <label>Customer / driver remarks<textarea data-order-field="notes" placeholder="e.g. hantar pagi sebelum 12pm">${esc(order.notes)}</textarea></label>
  </article>`;
}

function ordersPage() {
  return `
    <section class="page-title"><p class="eyebrow">INPUT FOR ${esc(ui.date)}</p><h2>Customer orders</h2><p>Each order can use the customer’s saved rule, or you can choose the exact mine/quarry and product for tonight.</p></section>
    <form class="panel add-form" data-form="new-order"><div class="section-head"><h2>Add customer order</h2><button class="primary" type="submit">Add order</button></div>
      <div class="fields two"><label>Customer<select name="customerId">${customerOptions()}</select></label><label>Loads<input name="loads" required type="number" min="1" value="1"></label></div>
      <div class="fields two"><label>Zone<select name="zone">${newZoneOptions()}</select></label><label>Product label<input name="productLabel" placeholder="Use saved rule if blank"></label></div>
      <div class="fields two"><label>Source<select name="source">${sourceOptions("")}</select></label><label>Product detail<input name="product" placeholder="e.g. 1x cuci"></label></div>
      <label class="check"><input name="early" type="checkbox"> Customer needs early delivery</label><label>Remark<textarea name="notes" placeholder="e.g. hantar pagi before 12pm"></textarea></label>
    </form>
    <section class="order-list">${activeOrders().length ? activeOrders().map(orderCard).join("") : "<div class='empty'><b>No orders for this date.</b><p>Add the loads your customers need, then auto-balance.</p></div>"}</section>
  `;
}

function trucksPage() {
  return `
    <section class="page-title"><p class="eyebrow">DAILY AVAILABILITY</p><h2>Trucks & capability</h2><p>Daily maximum is the safety cap. Near/Far/Stone are optional caps within it, so an older truck can be limited to 3 total loads.</p></section>
    <section class="truck-list">${state.trucks.map((item) => {
      const score = loadScore(state, item.id, ui.date);
      return `<article class="truck-card" data-truck="${esc(item.id)}"><div class="truck-head"><strong>${esc(item.number)}</strong><select data-truck-field="status"><option ${item.status === "Available" ? "selected" : ""}>Available</option><option ${item.status === "Off" ? "selected" : ""}>Off</option><option ${item.status === "Breakdown" ? "selected" : ""}>Breakdown</option></select></div>
        <div class="fields four"><label>Daily<input type="number" min="0" data-truck-field="dailyMax" value="${esc(item.dailyMax)}"></label><label>Near<input type="number" min="0" data-truck-field="nearMax" value="${esc(item.nearMax)}"></label><label>Far<input type="number" min="0" data-truck-field="farMax" value="${esc(item.farMax)}"></label><label>Stone<input type="number" min="0" data-truck-field="stoneMax" value="${esc(item.stoneMax)}"></label></div>
        <label>Availability / maintenance note<input data-truck-field="notes" value="${esc(item.notes)}" placeholder="e.g. tyre repair after 3pm"></label><p class="muted">Fairness: ${score.historical} completed last 30 days · ${score.planned} planned for this date.</p>
      </article>`;
    }).join("")}</section>
    <button class="secondary wide" data-action="add-truck">Add a truck</button>
  `;
}

function dispatchPage() {
  const assignments = activeAssignments();
  const groups = state.trucks.map((item) => ({ item, trips: assignments.filter((assignment) => assignment.truckId === item.id) })).filter((group) => group.trips.length || ["available", "active"].includes(String(group.item.status).toLowerCase()));
  return `
    <section class="page-title"><p class="eyebrow">AUTO-BALANCED PLAN</p><h2>Dispatch board</h2><p>Review it before sending. Early customers stay first; other trips are ordered Near → Far → Stone.</p><div class="button-row"><button class="primary" data-action="run-dispatch">Rebalance from orders</button><button class="secondary" data-action="copy-message">Copy WhatsApp</button></div></section>
    ${groups.map(({ item, trips }) => `<article class="dispatch-card"><div class="dispatch-head"><div><b>Truck ${esc(item.number)}</b>${badge(item.status)}</div><span>${trips.length}/${item.dailyMax} loads</span></div>${trips.length ? `<ol>${trips.map((assignment) => { const info = assignmentSummary(state, assignment); return `<li class="${assignment.early ? "early" : ""}"><b>${assignment.tripNumber}</b><div><strong>${esc(info.customerName)}</strong><span>${esc(assignment.productLabel || assignment.product)} · ${esc(assignment.source)}</span>${assignment.notes ? `<small>${esc(assignment.notes)}</small>` : ""}</div>${badge(assignment.status)}</li>`; }).join("")}</ol>` : "<p class='muted'>No order assigned.</p>"}</article>`).join("")}
    ${state.makeUps.filter((item) => item.status === "Pending" || item.status === "Scheduled").length ? `<section class="alert"><b>Follow-up needed</b>${state.makeUps.filter((item) => item.status === "Pending" || item.status === "Scheduled").map((item) => `<p>Truck ${esc(truck(item.truckId)?.number)} should next cover ${esc(customer(item.customerId)?.name)}${item.avoidCustomerId ? ` instead of ${esc(customer(item.avoidCustomerId)?.name)}` : ""}.</p>`).join("")}</section>` : ""}
  `;
}

function logsPage() {
  const assignments = activeAssignments();
  return `
    <section class="page-title"><p class="eyebrow">ACTUAL DELIVERY RECORD</p><h2>Trip log</h2><p>Record the customer actually delivered. When a truck changes the assigned customer, Dispatch Pilot creates a recovery rule for the next plan.</p></section>
    <section class="log-list">${assignments.length ? assignments.map((assignment) => {
      const info = assignmentSummary(state, assignment); const log = state.tripLogs.find((item) => item.assignmentId === assignment.id);
      return `<article class="log-card" data-assignment="${esc(assignment.id)}"><div><span>Truck ${esc(info.truckNo)} · Trip ${assignment.tripNumber}</span><h3>${esc(info.customerName)}</h3><p>${esc(assignment.productLabel || assignment.product)} from ${esc(assignment.source)}</p></div><div class="fields two"><label>Actual customer<select data-log-field="actualCustomerId">${customerOptions(log?.actualCustomerId || assignment.customerId)}</select></label><label>Status<select data-log-field="status"><option ${(!log || log.status === "Completed") ? "selected" : ""}>Completed</option><option ${log?.status === "Changed" ? "selected" : ""}>Changed</option><option ${log?.status === "Skipped" ? "selected" : ""}>Skipped</option></select></label></div><label>What happened?<input data-log-field="remark" value="${esc(log?.remark || "")}" placeholder="Optional explanation"></label><button class="secondary wide" data-action="save-log" data-id="${esc(assignment.id)}">Save actual trip</button></article>`;
    }).join("") : "<div class='empty'><b>No dispatch board yet.</b><p>Balance your customer orders first.</p></div>"}</section>
  `;
}

function settingsPage() {
  return `
    <section class="page-title"><p class="eyebrow">MASTER DATA & CLOUD SYNC</p><h2>Setup</h2><p>Use this page once to build your own customer and truck rules. The Google Sheet mirror keeps your office records online.</p></section>
    <section class="panel"><h2>Company & driver reminder</h2><label>Company name<input data-setting="companyName" value="${esc(state.companyName)}"></label><div class="notice-list">${(state.notices || []).map((item, index) => `<div><input data-notice="${index}" value="${esc(item)}"><button class="delete" data-action="delete-notice" data-id="${index}">×</button></div>`).join("")}</div><button class="secondary" data-action="add-notice">Add group reminder</button></section>
    <form class="panel add-form" data-form="new-customer"><div class="section-head"><h2>Add customer rule</h2><button class="primary" type="submit">Save customer</button></div><div class="fields two"><label>Name<input required name="name" placeholder="Customer name"></label><label>Type<select name="kind"><option>Sand</option><option>Stone</option></select></label></div><div class="fields three"><label>Default zone<select name="zone">${zoneOptions("Near")}</select></label><label>Allowed supplier(s)<input name="supplier" placeholder="MingLiong Mados, GuanSengLee"></label><label>Product<input name="product" placeholder="e.g. 1x cuci"></label></div><label>Permanent note<input name="notes" placeholder="e.g. needs early delivery"></label></form>
    <section class="panel customer-rules"><div class="section-head"><h2>Saved customer rules</h2><span>${state.customers.length}</span></div>${state.customers.map((item) => `<div><b>${esc(item.name)}</b><span>${esc(item.kind)} · ${esc(item.defaultZone)}</span><small>${esc(item.accepted.map((rule) => `${rule.product} (${rule.supplier})`).join(" / "))}</small></div>`).join("")}</section>
    <section class="panel sync-panel"><p class="eyebrow">GOOGLE SHEETS</p><h2>Online database connection</h2><p>Paste the Web App URL and shared secret after deploying the included Google Apps Script. Your data remains on this phone until you press sync.</p><label>Apps Script Web App URL<input data-setting="endpoint" value="${esc(state.settings?.endpoint || "")}" placeholder="https://script.google.com/macros/s/.../exec"></label><label>Shared secret<input data-setting="syncSecret" type="password" value="${esc(state.settings?.syncSecret || "")}" placeholder="Set in Script Properties"></label><div class="button-row"><button class="primary" data-action="sync-up">Sync to Google Sheet</button><button class="secondary" data-action="sync-down">Load from Google Sheet</button></div><small>Last sync: ${esc(state.settings?.lastSyncAt || "Never")}</small></section>
  `;
}

function page() {
  if (ui.tab === "orders") return ordersPage();
  if (ui.tab === "trucks") return trucksPage();
  if (ui.tab === "dispatch") return dispatchPage();
  if (ui.tab === "logs") return logsPage();
  if (ui.tab === "settings") return settingsPage();
  return homePage();
}

function render() { root.innerHTML = layout(page()); }

function updateOrder(id, field, value) {
  state = { ...state, orders: state.orders.map((order) => {
    if (order.id !== id) return order;
    if (field === "customerId") {
      const selected = customer(value);
      return { ...order, customerId: value, kind: selected?.kind || order.kind, zone: selected?.defaultZone || order.zone, source: selected?.accepted[0]?.supplier || order.source, product: selected?.accepted[0]?.product || order.product, productLabel: selected?.defaultProductLabel || order.productLabel };
    }
    return { ...order, [field]: field === "loads" ? Number(value) : value, updatedAt: new Date().toISOString() };
  })};
}

function updateTruck(id, field, value) {
  state = { ...state, trucks: state.trucks.map((item) => item.id === id ? { ...item, [field]: ["dailyMax", "nearMax", "farMax", "stoneMax"].includes(field) ? Number(value) : value, updatedAt: new Date().toISOString() } : item) };
}

function updateSetting(field, value) {
  if (field === "companyName") state = { ...state, companyName: value };
  else state = { ...state, settings: { ...state.settings, [field]: value } };
}

async function copyMessage() {
  const text = makeWhatsAppMessage(state, ui.date);
  try { await navigator.clipboard.writeText(text); notify("WhatsApp message copied"); } catch { window.prompt("Copy this WhatsApp message:", text); }
}

function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `dispatchPilot_${Date.now()}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => { cleanup(); reject(new Error("Google Sheet did not reply")); }, 12000);
    const cleanup = () => { window.clearTimeout(timer); delete window[callback]; script.remove(); };
    window[callback] = (response) => { cleanup(); resolve(response); };
    script.onerror = () => { cleanup(); reject(new Error("Could not reach the Google Apps Script URL")); };
    const joiner = url.includes("?") ? "&" : "?";
    script.src = `${url}${joiner}action=get&secret=${encodeURIComponent(state.settings?.syncSecret || "")}&callback=${callback}`;
    document.head.appendChild(script);
  });
}

async function syncUp() {
  const endpoint = state.settings?.endpoint?.trim();
  if (!endpoint) return notify("Paste your Apps Script Web App URL first");
  const cloudState = { ...state, settings: { ...state.settings, endpoint: "", syncSecret: "" } };
  try {
    await fetch(endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "save", secret: state.settings?.syncSecret || "", state: cloudState }) });
    state = { ...state, settings: { ...state.settings, lastSyncAt: new Date().toLocaleString() } };
    persist("Sync sent to Google Sheet");
  } catch (error) { notify(`Sync failed: ${error.message}`); }
}

async function syncDown() {
  const endpoint = state.settings?.endpoint?.trim();
  if (!endpoint) return notify("Paste your Apps Script Web App URL first");
  try {
    const response = await jsonp(endpoint);
    if (!response?.ok || !response.state) throw new Error(response?.error || "No data found");
    const settings = state.settings;
    state = { ...response.state, settings: { ...response.state.settings, ...settings, lastSyncAt: new Date().toLocaleString() } };
    persist("Loaded latest data from Google Sheet");
  } catch (error) { notify(`Load failed: ${error.message}`); }
}

root.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.tab) { ui.tab = button.dataset.tab; render(); return; }
  const action = button.dataset.action;
  if (action === "go-settings") { ui.tab = "settings"; render(); }
  if (action === "go-dispatch") { ui.tab = "dispatch"; render(); }
  if (action === "run-dispatch") { state = applyDispatch(state, ui.date); persist("Orders balanced. Review the dispatch board."); }
  if (action === "copy-message") await copyMessage();
  if (action === "open-whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(makeWhatsAppMessage(state, ui.date))}`, "_blank", "noopener");
  if (action === "delete-order") { state = { ...state, orders: state.orders.filter((item) => item.id !== button.dataset.id) }; persist("Order removed"); }
  if (action === "add-truck") {
    const number = window.prompt("Truck number?"); if (!number?.trim()) return;
    state = { ...state, trucks: [...state.trucks, { id: uid("truck"), number: number.trim(), status: "Available", dailyMax: 3, nearMax: 3, farMax: 1, stoneMax: 1, notes: "", updatedAt: new Date().toISOString() }] }; persist("Truck added");
  }
  if (action === "save-log") {
    const card = button.closest("[data-assignment]");
    const actualCustomerId = card.querySelector('[data-log-field="actualCustomerId"]').value;
    const status = card.querySelector('[data-log-field="status"]').value;
    const remark = card.querySelector('[data-log-field="remark"]').value;
    state = recordActualTrip(state, button.dataset.id, { actualCustomerId, status, remark }); persist("Actual trip recorded");
  }
  if (action === "add-notice") { state = { ...state, notices: [...(state.notices || []), ""] }; persist("Reminder added"); }
  if (action === "delete-notice") { state = { ...state, notices: state.notices.filter((_, index) => String(index) !== button.dataset.id) }; persist("Reminder removed"); }
  if (action === "sync-up") await syncUp();
  if (action === "sync-down") await syncDown();
});

root.addEventListener("change", (event) => {
  const element = event.target;
  if (element.id === "dispatch-date") { ui.date = element.value; render(); return; }
  if (element.dataset.orderField) { updateOrder(element.closest("[data-order]").dataset.order, element.dataset.orderField, element.type === "checkbox" ? element.checked : element.value); persist("Order saved"); }
  if (element.dataset.truckField) { updateTruck(element.closest("[data-truck]").dataset.truck, element.dataset.truckField, element.value); persist("Truck updated"); }
  if (element.dataset.setting) { updateSetting(element.dataset.setting, element.value); persist("Setup saved"); }
  if (element.dataset.notice !== undefined) { state = { ...state, notices: state.notices.map((item, index) => String(index) === element.dataset.notice ? element.value : item) }; persist("Reminder saved"); }
});

root.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const values = Object.fromEntries(new FormData(form));
  if (form.dataset.form === "new-order") {
    const selected = customer(values.customerId); if (!selected) return notify("Choose a customer");
    state = { ...state, orders: [...state.orders, { id: uid("order"), date: ui.date, customerId: selected.id, loads: Number(values.loads), zone: values.zone || selected.defaultZone, kind: selected.kind, source: values.source || selected.accepted[0]?.supplier || "", product: values.product || selected.accepted[0]?.product || "", productLabel: values.productLabel || selected.defaultProductLabel || values.product || "", early: values.early === "on", notes: values.notes || selected.notes || "", updatedAt: new Date().toISOString() }] };
    persist("Order added");
  }
  if (form.dataset.form === "new-customer") {
    const accepted = String(values.supplier || "").split(",").map((supplier) => supplier.trim()).filter(Boolean).map((supplier) => ({ supplier, product: values.product || "" }));
    state = { ...state, customers: [...state.customers, { id: uid("customer"), name: values.name.trim(), kind: values.kind, defaultZone: values.zone, accepted, defaultProductLabel: values.product || "", notes: values.notes || "", updatedAt: new Date().toISOString() }] };
    persist("Customer rule saved");
  }
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js?v=20260711-2", { scope: "./", updateViaCache: "none" }));
render();
