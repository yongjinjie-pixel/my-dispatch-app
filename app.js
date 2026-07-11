import {
  applyDispatch, assignmentSummary, defaultState, ensureState, loadScore, makeOrderFromMaterial, makeWhatsAppMessage,
  materialById, materialFields, materialLabel, recordActualTrip, renumberAssignments, sourceById, tallyForDate,
  tomorrowISO, truckLabel, uid,
} from "./scheduler.js";

const STORAGE_KEY = "dispatch-pilot-state-v3";
const LEGACY_STORAGE_KEY = "dispatch-pilot-state-v1";
const root = document.querySelector("#app");
const requestedTab = new URLSearchParams(window.location.search).get("tab");
const ui = { tab: ["orders", "dispatch", "logs", "settings", "trucks"].includes(requestedTab) ? requestedTab : "home", date: tomorrowISO(), toast: "", toastTone: "" };
let state = readState();

function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
    return ensureState(raw || defaultState());
  } catch { return defaultState(); }
}

function persist(message = "Saved on this phone", tone = "success") {
  state = { ...state, updatedAt: new Date().toISOString() };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { ui.toast = "Phone storage is full - changes could not be saved"; ui.toastTone = "danger"; render(); return; }
  ui.toast = message; ui.toastTone = tone; render();
  window.clearTimeout(window.__dispatchToast);
  window.__dispatchToast = window.setTimeout(() => { ui.toast = ""; render(); }, 2500);
}

function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function activeOrders() { return state.orders.filter((order) => order.date === ui.date); }
function activeAssignments() { return state.assignments.filter((assignment) => assignment.date === ui.date).sort((a, b) => truck(a.truckId)?.number.localeCompare(truck(b.truckId)?.number) || a.tripNumber - b.tripNumber); }
function customer(id) { return state.customers.find((item) => item.id === id); }
function truck(id) { return state.trucks.find((item) => item.id === id); }
function totalLoads() { return activeOrders().reduce((sum, order) => sum + Number(order.loads || 0), 0); }
function availableCapacity() { return state.trucks.filter((item) => ["available", "active"].includes(String(item.status).toLowerCase())).reduce((sum, item) => sum + Number(item.dailyMax || 0), 0); }
function badge(status) { return `<span class="badge ${esc(String(status).toLowerCase())}">${esc(status)}</span>`; }
function notify(message, tone = "") { ui.toast = message; ui.toastTone = tone; render(); }
function zoneOptions(selected, includeRule = false) { return `${includeRule ? `<option value="" ${!selected ? "selected" : ""}>Use customer rule</option>` : ""}${["Near", "Far", "Stone"].map((item) => `<option value="${item}" ${item === selected ? "selected" : ""}>${item}</option>`).join("")}`; }
function sourceOptions(selected = "", includeBlank = true) { return `${includeBlank ? `<option value="" ${!selected ? "selected" : ""}>Choose source</option>` : ""}${state.sources.slice().sort((a, b) => a.name.localeCompare(b.name)).map((item) => `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(item.name)} (${esc(item.type)})</option>`).join("")}`; }
function customerOptions(selected = "") { return `<option value="">Choose customer</option>${state.customers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((item) => `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(item.name)}</option>`).join("")}`; }
function materialOptions(selected = "", customerId = "", kind = "") {
  const target = customer(customerId);
  const allowed = target?.materialIds?.length ? new Set(target.materialIds) : null;
  const available = state.materials.filter((item) => (!kind || item.kind === kind) && (!allowed || allowed.has(item.id))).sort((a, b) => materialLabel(state, a.id).localeCompare(materialLabel(state, b.id)));
  return `<option value="">Choose material and source</option>${available.map((item) => `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(materialLabel(state, item.id))}</option>`).join("")}`;
}
function materialCheckboxes(selected = [], attrs = "") {
  return `<div class="material-picker">${state.materials.slice().sort((a, b) => materialLabel(state, a.id).localeCompare(materialLabel(state, b.id))).map((item) => `<label class="material-choice"><input type="checkbox" value="${esc(item.id)}" ${selected.includes(item.id) ? "checked" : ""} ${attrs}><span><b>${esc(item.name)}</b><small>${esc(sourceById(state, item.sourceId)?.name || "Unknown source")} · ${esc(item.kind)}</small></span></label>`).join("")}</div>`;
}
function zoneTotals() { return ["Near", "Far", "Stone"].map((zone) => ({ zone, count: activeOrders().filter((order) => order.zone === zone).reduce((sum, order) => sum + Number(order.loads || 0), 0) })); }
function customerMaterialSummary(item) { return (item.materialIds || []).map((id) => materialLabel(state, id)).join(" / ") || "No material selected"; }

function layout(content) {
  return `<header class="topbar"><div><p class="eyebrow">DISPATCH PILOT</p><h1>${esc(state.companyName || "My Transport Dispatch")}</h1></div><button class="icon-button" data-action="go-settings" aria-label="Setup">Settings</button></header>
    <main><section class="date-strip"><label>Dispatch date<input id="dispatch-date" type="date" value="${esc(ui.date)}"></label><span>${activeAssignments().length ? `${activeAssignments().length} trips planned` : "Not balanced yet"}</span></section>${content}</main>
    <nav class="bottom-nav">${[["home", "Home"], ["orders", "Orders"], ["dispatch", "Dispatch"], ["logs", "Trip log"], ["settings", "Setup"]].map(([id, label]) => `<button class="${ui.tab === id ? "active" : ""}" data-tab="${id}"><b>${label.slice(0, 1)}</b><span>${label}</span></button>`).join("")}</nav>${ui.toast ? `<div class="toast ${esc(ui.toastTone)}">${esc(ui.toast)}</div>` : ""}`;
}

function homePage() {
  const assignments = activeAssignments(); const unresolved = state.lastAllocation?.date === ui.date ? state.lastAllocation.unresolved || [] : [];
  const available = state.trucks.filter((item) => ["available", "active"].includes(String(item.status).toLowerCase()));
  return `<section class="hero"><p>Nightly plan</p><h2>Balance fairly, then send the driver message.</h2><div class="hero-actions"><button class="primary" data-action="run-dispatch">Auto-balance orders</button><button class="secondary" data-action="go-dispatch">Review and edit trips</button></div></section>
    <section class="metrics"><article><span>Orders</span><strong>${totalLoads()}</strong><small>loads requested</small></article><article><span>Planned</span><strong>${assignments.length}</strong><small>${unresolved.length ? `${unresolved.length} to review` : "all allocated"}</small></article><article><span>Capacity</span><strong>${availableCapacity()}</strong><small>available today</small></article></section>
    ${unresolved.length ? `<section class="alert"><b>Needs your decision</b>${unresolved.map((item) => `<p>${esc(customer(item.customerId)?.name)} - ${esc(item.reason)}</p>`).join("")}</section>` : ""}
    <section class="panel"><div class="section-head"><div><p class="eyebrow">FAIRNESS CHECK</p><h2>Available trucks</h2></div><button class="text-button" data-tab="trucks">Edit trucks</button></div><div class="load-list">${available.map((item) => { const count = assignments.filter((assignment) => assignment.truckId === item.id).length; const score = loadScore(state, item.id, ui.date); return `<div class="load-row"><div><strong>${esc(truckLabel(item))}</strong>${badge(item.status)}</div><div class="mini-bar"><i style="width:${Math.min(100, count / Math.max(1, item.dailyMax) * 100)}%"></i></div><span>${count}/${item.dailyMax}</span><small>${score.historical} completed in the last 30 days</small></div>`; }).join("") || "<p class='muted'>Set truck availability first.</p>"}</div></section>
    <section class="panel message-card"><div class="section-head"><div><p class="eyebrow">READY TO SEND</p><h2>WhatsApp message</h2></div><button class="text-button" data-action="copy-message">Copy</button></div><pre>${esc(makeWhatsAppMessage(state, ui.date))}</pre><button class="primary wide" data-action="open-whatsapp">Open WhatsApp with this message</button></section>`;
}

function orderCard(order) {
  return `<article class="order-card" data-order="${esc(order.id)}"><div class="order-card-top"><select data-order-field="customerId">${customerOptions(order.customerId)}</select><button class="delete" data-action="delete-order" data-id="${esc(order.id)}">Remove</button></div>
    <div class="fields three"><label>Loads<input type="number" min="0" data-order-field="loads" value="${esc(order.loads)}"></label><label>Zone<select data-order-field="zone">${zoneOptions(order.zone)}</select></label><label>Type<input disabled value="${esc(order.kind)}"></label></div>
    <label>Material from source<select required data-order-field="materialId">${materialOptions(order.materialId, order.customerId, order.kind)}</select></label><p class="field-hint">${esc(materialLabel(state, order.materialId))}</p>
    <label class="check"><input type="checkbox" data-order-field="early" ${order.early ? "checked" : ""}> Customer needs early delivery</label><label>Customer / driver remarks<textarea data-order-field="notes" placeholder="e.g. hantar pagi before 12pm">${esc(order.notes)}</textarea></label></article>`;
}

function ordersPage() {
  const totals = zoneTotals();
  return `<section class="page-title"><p class="eyebrow">INPUT FOR ${esc(ui.date)}</p><h2>Customer orders</h2><p>Select one saved material-source combination for every order.</p></section>
    <section class="metrics compact">${totals.map((item) => `<article><span>${item.zone}</span><strong>${item.count}</strong><small>loads needed</small></article>`).join("")}<article><span>Total</span><strong>${totalLoads()}</strong><small>all orders</small></article></section>
    <form class="panel add-form" data-form="new-order"><div class="section-head"><h2>Add customer order</h2><button class="primary" type="submit">Add order</button></div><div class="fields two"><label>Customer<select required name="customerId">${customerOptions()}</select></label><label>Loads<input name="loads" required type="number" min="1" value="1"></label></div><div class="fields two"><label>Zone<select name="zone">${zoneOptions("", true)}</select></label><label>Material from source<select required name="materialId">${materialOptions()}</select></label></div><label class="check"><input name="early" type="checkbox"> Customer needs early delivery</label><label>Remark<textarea name="notes" placeholder="e.g. hantar pagi before 12pm"></textarea></label></form>
    <section class="order-list">${activeOrders().length ? activeOrders().map(orderCard).join("") : "<div class='empty'><b>No orders for this date.</b><p>Add the loads your customers need, then auto-balance.</p></div>"}</section>`;
}

function trucksPage() {
  return `<section class="page-title"><p class="eyebrow">DAILY AVAILABILITY</p><h2>Trucks and capability</h2><p>Prefix + registration will be used everywhere, including dispatch and WhatsApp.</p></section>
    <form class="panel add-form" data-form="new-truck"><div class="section-head"><h2>Add truck</h2><button class="primary" type="submit">Add truck</button></div><div class="fields two"><label>Prefix<input name="prefix" placeholder="e.g. JTT"></label><label>Registration no.<input required name="number" placeholder="e.g. 1349"></label></div><div class="fields four"><label>Daily<input name="dailyMax" type="number" min="0" value="3"></label><label>Near<input name="nearMax" type="number" min="0" value="3"></label><label>Far<input name="farMax" type="number" min="0" value="1"></label><label>Stone<input name="stoneMax" type="number" min="0" value="1"></label></div></form>
    <section class="truck-list">${state.trucks.map((item) => { const score = loadScore(state, item.id, ui.date); return `<article class="truck-card" data-truck="${esc(item.id)}"><div class="truck-head"><strong>${esc(truckLabel(item))}</strong><select data-truck-field="status"><option ${item.status === "Available" ? "selected" : ""}>Available</option><option ${item.status === "Off" ? "selected" : ""}>Off</option><option ${item.status === "Breakdown" ? "selected" : ""}>Breakdown</option></select></div><div class="fields two"><label>Prefix<input data-truck-field="prefix" value="${esc(item.prefix)}"></label><label>Registration no.<input data-truck-field="number" value="${esc(item.number)}"></label></div><div class="fields four"><label>Daily<input type="number" min="0" data-truck-field="dailyMax" value="${esc(item.dailyMax)}"></label><label>Near<input type="number" min="0" data-truck-field="nearMax" value="${esc(item.nearMax)}"></label><label>Far<input type="number" min="0" data-truck-field="farMax" value="${esc(item.farMax)}"></label><label>Stone<input type="number" min="0" data-truck-field="stoneMax" value="${esc(item.stoneMax)}"></label></div><label>Availability / maintenance note<input data-truck-field="notes" value="${esc(item.notes)}" placeholder="e.g. tyre repair after 3pm"></label><div class="card-actions"><small>Fairness: ${score.historical} completed last 30 days · ${score.planned} planned.</small><button class="save-action" data-action="save-truck" data-id="${esc(item.id)}">Save truck</button><button class="delete" data-action="delete-truck" data-id="${esc(item.id)}">Delete</button></div></article>`; }).join("")}</section>`;
}

function dispatchEditor(assignment) {
  const info = assignmentSummary(state, assignment);
  return `<li data-assignment="${esc(assignment.id)}"><b>${assignment.tripNumber}</b><div class="assignment-editor"><div class="fields two"><label>Customer<select data-assignment-field="customerId">${customerOptions(assignment.customerId)}</select></label><label>Material / source<select data-assignment-field="materialId">${materialOptions(assignment.materialId, "", assignment.kind)}</select></label></div><div class="fields two"><label>Zone<select data-assignment-field="zone">${zoneOptions(assignment.zone)}</select></label><label class="check"><input type="checkbox" data-assignment-field="early" ${assignment.early ? "checked" : ""}> Early</label></div><label>Remark<input data-assignment-field="notes" value="${esc(assignment.notes)}"></label><small>${esc(info.customerName)} · ${esc(materialLabel(state, assignment.materialId))}</small></div><div class="trip-actions"><button data-action="move-trip-up" data-id="${esc(assignment.id)}" title="Move up">Up</button><button data-action="move-trip-down" data-id="${esc(assignment.id)}" title="Move down">Down</button><button class="delete" data-action="remove-trip" data-id="${esc(assignment.id)}">Remove</button></div></li>`;
}

function tallyTable() {
  const tally = tallyForDate(state, ui.date);
  return `<section class="panel tally-panel"><div class="section-head"><div><p class="eyebrow">TALLY CHECKER</p><h2>Customer order vs planned trips</h2></div><span>${tally.every((item) => item.balance === 0) ? badge("Tally") : badge("Review")}</span></div><div class="tally-table"><div class="tally-head"><span>Customer</span><span>Need</span><span>Planned</span><span>Balance</span></div>${tally.map((item) => `<div class="tally-row ${item.balance === 0 ? "ok" : "mismatch"}"><span>${esc(item.customerName)}</span><span>${item.required}</span><span>${item.planned}</span><b>${item.balance > 0 ? "+" : ""}${item.balance}</b></div>`).join("") || "<p class='muted'>No orders to tally.</p>"}</div></section>`;
}

function dispatchPage() {
  const assignments = activeAssignments();
  const groups = state.trucks.map((item) => ({ item, trips: assignments.filter((assignment) => assignment.truckId === item.id) })).filter((group) => group.trips.length || ["available", "active"].includes(String(group.item.status).toLowerCase()));
  return `<section class="page-title"><p class="eyebrow">AUTO-BALANCED PLAN</p><h2>Dispatch board</h2><p>Auto-generate first, then change any trip manually. The tally checker shows if your edit still meets customer demand.</p><div class="button-row"><button class="primary" data-action="run-dispatch">Rebalance from orders</button><button class="secondary" data-action="copy-message">Copy WhatsApp</button></div></section>${tallyTable()}
    <section class="manual-help"><b>Manual edit</b><span>Change customer, material, source, zone or sequence below, then tap Save dispatch changes.</span></section>
    ${groups.map(({ item, trips }) => `<article class="dispatch-card"><div class="dispatch-head"><div><b>${esc(truckLabel(item))}</b>${badge(item.status)}</div><span>${trips.length}/${item.dailyMax} loads</span></div>${trips.length ? `<ol>${trips.map(dispatchEditor).join("")}</ol>` : "<p class='muted pad'>No order assigned.</p>"}<button class="secondary add-trip" data-action="add-manual-trip" data-truck="${esc(item.id)}">Add manual trip</button></article>`).join("")}
    <button class="primary wide save-dispatch" data-action="save-dispatch">Save dispatch changes</button>${state.makeUps.filter((item) => item.status === "Pending" || item.status === "Scheduled").length ? `<section class="alert"><b>Follow-up needed</b>${state.makeUps.filter((item) => item.status === "Pending" || item.status === "Scheduled").map((item) => `<p>${esc(truckLabel(truck(item.truckId)))} should next cover ${esc(customer(item.customerId)?.name)}${item.avoidCustomerId ? ` instead of ${esc(customer(item.avoidCustomerId)?.name)}` : ""}.</p>`).join("")}</section>` : ""}`;
}

function logsPage() {
  const assignments = activeAssignments();
  return `<section class="page-title"><p class="eyebrow">ACTUAL DELIVERY RECORD</p><h2>Trip log</h2><p>Actual trip records are saved in phone storage immediately. You can update or clear a saved entry if it was wrong.</p></section><section class="log-list">${assignments.length ? assignments.map((assignment) => { const info = assignmentSummary(state, assignment); const log = state.tripLogs.find((item) => item.assignmentId === assignment.id); return `<article class="log-card" data-assignment="${esc(assignment.id)}"><div><span>${esc(info.truckNo)} · Trip ${assignment.tripNumber}</span><h3>${esc(info.customerName)}</h3><p>${esc(materialLabel(state, assignment.materialId))}</p></div><div class="fields two"><label>Actual customer<select data-log-field="actualCustomerId">${customerOptions(log?.actualCustomerId || assignment.customerId)}</select></label><label>Status<select data-log-field="status"><option ${(!log || log.status === "Completed") ? "selected" : ""}>Completed</option><option ${log?.status === "Changed" ? "selected" : ""}>Changed</option><option ${log?.status === "Skipped" ? "selected" : ""}>Skipped</option></select></label></div><label>What happened?<input data-log-field="remark" value="${esc(log?.remark || "")}" placeholder="Optional explanation"></label><div class="button-row"><button class="save-action wide ${log ? "is-saved" : ""}" data-action="save-log" data-id="${esc(assignment.id)}">${log ? "Saved ✓ Update actual trip" : "Save actual trip"}</button>${log ? `<button class="secondary" data-action="clear-log" data-id="${esc(assignment.id)}">Reset to planned</button>` : ""}</div></article>`; }).join("") : "<div class='empty'><b>No dispatch board yet.</b><p>Balance your customer orders first.</p></div>"}</section>`;
}

function customerEditor(item) {
  return `<details class="customer-editor" data-customer="${esc(item.id)}"><summary><span><b>${esc(item.name)}</b><small>${esc(item.kind)} · ${esc(item.defaultZone)}</small></span><span>${(item.materialIds || []).length} material(s)</span></summary><div class="detail-body"><div class="fields two"><label>Name<input data-customer-field="name" value="${esc(item.name)}"></label><label>Type<select data-customer-field="kind"><option ${item.kind === "Sand" ? "selected" : ""}>Sand</option><option ${item.kind === "Stone" ? "selected" : ""}>Stone</option></select></label></div><label>Default zone<select data-customer-field="defaultZone">${zoneOptions(item.defaultZone)}</select></label><label>Allowed materials (select one or more)${materialCheckboxes(item.materialIds || [], `data-customer-material="${esc(item.id)}"`)}</label><label>Permanent customer note<input data-customer-field="notes" value="${esc(item.notes)}"></label><p class="field-hint">${esc(customerMaterialSummary(item))}</p><div class="card-actions"><button class="save-action" data-action="save-customer" data-id="${esc(item.id)}">Save customer</button><button class="delete" data-action="delete-customer" data-id="${esc(item.id)}">Delete</button></div></div></details>`;
}

function settingsPage() {
  return `<section class="page-title"><p class="eyebrow">MASTER DATA AND CLOUD SYNC</p><h2>Setup</h2><p>Manage the sources, materials, customers and trucks that the app uses every night.</p></section>
    <section class="panel"><h2>Company and driver reminder</h2><label>Company name<input data-setting="companyName" value="${esc(state.companyName)}"></label><div class="notice-list">${(state.notices || []).map((item, index) => `<div><input data-notice="${index}" value="${esc(item)}"><button class="delete" data-action="delete-notice" data-id="${index}">Remove</button></div>`).join("")}</div><button class="secondary" data-action="add-notice">Add group reminder</button></section>
    <form class="panel add-form" data-form="new-source"><div class="section-head"><h2>Add source</h2><button class="primary" type="submit">Save source</button></div><div class="fields two"><label>Sandpit / quarry name<input required name="name" placeholder="e.g. New Sandpit"></label><label>Type<select name="type"><option>Sandpit</option><option>Quarry</option></select></label></div><label>Source note<input name="notes" placeholder="e.g. operating-hours note"></label></form>
    <section class="panel"><div class="section-head"><h2>Saved sources</h2><span>${state.sources.length}</span></div><div class="source-list">${state.sources.map((item) => `<article data-source="${esc(item.id)}"><div class="fields two"><label>Name<input data-source-field="name" value="${esc(item.name)}"></label><label>Type<select data-source-field="type"><option ${item.type === "Sandpit" ? "selected" : ""}>Sandpit</option><option ${item.type === "Quarry" ? "selected" : ""}>Quarry</option></select></label></div><label>Note<input data-source-field="notes" value="${esc(item.notes)}"></label><div class="card-actions"><button class="save-action" data-action="save-source" data-id="${esc(item.id)}">Save source</button><button class="delete" data-action="delete-source" data-id="${esc(item.id)}">Delete</button></div></article>`).join("")}</div></section>
    <form class="panel add-form" data-form="new-material"><div class="section-head"><h2>Add material</h2><button class="primary" type="submit">Save material</button></div><div class="fields two"><label>Source<select required name="sourceId">${sourceOptions()}</select></label><label>Material name<input required name="name" placeholder="e.g. 1x cuci"></label></div><div class="fields two"><label>Type<select name="kind"><option>Sand</option><option>Stone</option></select></label><label>Default zone<select name="defaultZone">${zoneOptions("Near")}</select></label></div><label>Material note<input name="notes" placeholder="Optional note"></label></form>
    <section class="panel"><div class="section-head"><h2>Saved materials</h2><span>${state.materials.length}</span></div><div class="source-list">${state.materials.map((item) => `<article data-material="${esc(item.id)}"><div class="fields two"><label>Name<input data-material-field="name" value="${esc(item.name)}"></label><label>Source<select data-material-field="sourceId">${sourceOptions(item.sourceId, false)}</select></label></div><div class="fields two"><label>Type<select data-material-field="kind"><option ${item.kind === "Sand" ? "selected" : ""}>Sand</option><option ${item.kind === "Stone" ? "selected" : ""}>Stone</option></select></label><label>Default zone<select data-material-field="defaultZone">${zoneOptions(item.defaultZone)}</select></label></div><label>Note<input data-material-field="notes" value="${esc(item.notes)}"></label><div class="card-actions"><button class="save-action" data-action="save-material" data-id="${esc(item.id)}">Save material</button><button class="delete" data-action="delete-material" data-id="${esc(item.id)}">Delete</button></div></article>`).join("")}</div></section>
    <form class="panel add-form" data-form="new-customer"><div class="section-head"><h2>Add customer rule</h2><button class="primary" type="submit">Save customer</button></div><div class="fields two"><label>Name<input required name="name" placeholder="Customer name"></label><label>Type<select name="kind"><option>Sand</option><option>Stone</option></select></label></div><label>Default zone<select name="defaultZone">${zoneOptions("Near")}</select></label><label>Allowed materials (select at least one)${materialCheckboxes([], "name=materialId")}</label><label>Permanent note<input name="notes" placeholder="e.g. needs early delivery"></label></form>
    <section class="panel customer-rules"><div class="section-head"><h2>Saved customer rules</h2><span>${state.customers.length}</span></div>${state.customers.map(customerEditor).join("")}</section>
    <section class="panel sync-panel"><p class="eyebrow">GOOGLE SHEETS</p><h2>Online database connection</h2><p>When you set up the supplied Apps Script, every source, material, customer, order, dispatch assignment and trip log will be exported to sortable Google Sheet view tabs.</p><label>Apps Script Web App URL<input data-setting="endpoint" value="${esc(state.settings?.endpoint || "")}" placeholder="https://script.google.com/macros/s/.../exec"></label><label>Shared secret<input data-setting="syncSecret" type="password" value="${esc(state.settings?.syncSecret || "")}" placeholder="Set in Script Properties"></label><div class="button-row"><button class="primary" data-action="sync-up">Sync to Google Sheet</button><button class="secondary" data-action="sync-down">Load from Google Sheet</button></div><small>Last sync: ${esc(state.settings?.lastSyncAt || "Never")}</small></section>`;
}

function page() { if (ui.tab === "orders") return ordersPage(); if (ui.tab === "trucks") return trucksPage(); if (ui.tab === "dispatch") return dispatchPage(); if (ui.tab === "logs") return logsPage(); if (ui.tab === "settings") return settingsPage(); return homePage(); }
function render() { root.innerHTML = layout(page()); }

function updateOrder(id, field, value) {
  state = { ...state, orders: state.orders.map((order) => {
    if (order.id !== id) return order;
    if (field === "customerId") { const selected = customer(value); return makeOrderFromMaterial({ ...order, customerId: value, kind: selected?.kind || order.kind, zone: selected?.defaultZone || order.zone, materialId: selected?.materialIds?.[0] || "" }, state); }
    if (field === "materialId") return makeOrderFromMaterial({ ...order, materialId: value }, state);
    return { ...order, [field]: field === "loads" ? Number(value) : value, updatedAt: new Date().toISOString() };
  }) };
}
function updateTruck(id, field, value) { state = { ...state, trucks: state.trucks.map((item) => item.id === id ? { ...item, [field]: ["dailyMax", "nearMax", "farMax", "stoneMax"].includes(field) ? Number(value) : value, updatedAt: new Date().toISOString() } : item) }; }
function updateCustomer(id, field, value) { state = { ...state, customers: state.customers.map((item) => item.id === id ? { ...item, [field]: value, updatedAt: new Date().toISOString() } : item) }; }
function updateSource(id, field, value) { state = { ...state, sources: state.sources.map((item) => item.id === id ? { ...item, [field]: value, updatedAt: new Date().toISOString() } : item) }; }
function updateMaterial(id, field, value) { state = { ...state, materials: state.materials.map((item) => item.id === id ? { ...item, [field]: value, updatedAt: new Date().toISOString() } : item) }; }
function updateAssignment(id, field, value) { state = { ...state, assignments: state.assignments.map((assignment) => { if (assignment.id !== id) return assignment; if (field === "customerId") { const selected = customer(value); return makeOrderFromMaterial({ ...assignment, customerId: value, kind: selected?.kind || assignment.kind, zone: selected?.defaultZone || assignment.zone, materialId: selected?.materialIds?.[0] || assignment.materialId }, state); } if (field === "materialId") return makeOrderFromMaterial({ ...assignment, materialId: value }, state); return { ...assignment, [field]: value, updatedAt: new Date().toISOString() }; }) }; }
function updateSetting(field, value) { state = field === "companyName" ? { ...state, companyName: value } : { ...state, settings: { ...state.settings, [field]: value } }; }
function setCustomerMaterial(customerId, materialId, checked) { state = { ...state, customers: state.customers.map((item) => item.id === customerId ? { ...item, materialIds: checked ? [...new Set([...(item.materialIds || []), materialId])] : (item.materialIds || []).filter((id) => id !== materialId) } : item) }; }

async function copyMessage() { const text = makeWhatsAppMessage(state, ui.date); try { await navigator.clipboard.writeText(text); notify("WhatsApp message copied"); } catch { window.prompt("Copy this WhatsApp message:", text); } }
function jsonp(url) { return new Promise((resolve, reject) => { const callback = `dispatchPilot_${Date.now()}`; const script = document.createElement("script"); const timer = window.setTimeout(() => { cleanup(); reject(new Error("Google Sheet did not reply")); }, 12000); const cleanup = () => { window.clearTimeout(timer); delete window[callback]; script.remove(); }; window[callback] = (response) => { cleanup(); resolve(response); }; script.onerror = () => { cleanup(); reject(new Error("Could not reach the Google Apps Script URL")); }; script.src = `${url}${url.includes("?") ? "&" : "?"}action=get&secret=${encodeURIComponent(state.settings?.syncSecret || "")}&callback=${callback}`; document.head.appendChild(script); }); }
async function syncUp() { const endpoint = state.settings?.endpoint?.trim(); if (!endpoint) return notify("Paste your Apps Script Web App URL first", "danger"); const cloudState = { ...state, settings: { ...state.settings, endpoint: "", syncSecret: "" } }; try { await fetch(endpoint, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "save", secret: state.settings?.syncSecret || "", state: cloudState }) }); state = { ...state, settings: { ...state.settings, lastSyncAt: new Date().toLocaleString() } }; persist("Sync sent to Google Sheet"); } catch (error) { notify(`Sync failed: ${error.message}`, "danger"); } }
async function syncDown() { const endpoint = state.settings?.endpoint?.trim(); if (!endpoint) return notify("Paste your Apps Script Web App URL first", "danger"); try { const response = await jsonp(endpoint); if (!response?.ok || !response.state) throw new Error(response?.error || "No data found"); const settings = state.settings; state = ensureState({ ...response.state, settings: { ...response.state.settings, ...settings, lastSyncAt: new Date().toLocaleString() } }); persist("Loaded latest data from Google Sheet"); } catch (error) { notify(`Load failed: ${error.message}`, "danger"); } }

function canDelete(type, id) {
  if (type === "truck") return !state.assignments.some((item) => item.truckId === id) && !state.tripLogs.some((item) => item.truckId === id);
  if (type === "customer") return !state.orders.some((item) => item.customerId === id) && !state.assignments.some((item) => item.customerId === id) && !state.tripLogs.some((item) => item.plannedCustomerId === id || item.actualCustomerId === id);
  if (type === "material") return !state.customers.some((item) => item.materialIds?.includes(id)) && !state.orders.some((item) => item.materialId === id) && !state.assignments.some((item) => item.materialId === id);
  if (type === "source") return !state.materials.some((item) => item.sourceId === id);
  return true;
}
function moveTrip(id, direction) { const target = state.assignments.find((item) => item.id === id); if (!target) return; const list = state.assignments.filter((item) => item.date === target.date && item.truckId === target.truckId).sort((a, b) => a.tripNumber - b.tripNumber); const index = list.findIndex((item) => item.id === id); const swap = list[index + direction]; if (!swap) return notify("This trip is already at the end of the truck sequence"); [target.tripNumber, swap.tripNumber] = [swap.tripNumber, target.tripNumber]; state = { ...state, assignments: renumberAssignments(state.assignments) }; persist("Trip sequence saved"); }
function clearLog(assignmentId) { state = { ...state, assignments: state.assignments.map((item) => item.id === assignmentId ? { ...item, status: "Planned" } : item), tripLogs: state.tripLogs.filter((item) => item.assignmentId !== assignmentId), makeUps: state.makeUps.filter((item) => item.assignmentId !== assignmentId) }; persist("Actual trip reset to planned"); }

root.addEventListener("click", async (event) => {
  const button = event.target.closest("button"); if (!button) return; if (button.dataset.tab) { ui.tab = button.dataset.tab; render(); return; }
  const action = button.dataset.action;
  if (action === "go-settings") { ui.tab = "settings"; render(); return; }
  if (action === "go-dispatch") { ui.tab = "dispatch"; render(); return; }
  if (action === "run-dispatch") { state = applyDispatch(state, ui.date); persist("Orders balanced. You can now edit the dispatch board."); return; }
  if (action === "copy-message") return copyMessage();
  if (action === "open-whatsapp") return window.open(`https://wa.me/?text=${encodeURIComponent(makeWhatsAppMessage(state, ui.date))}`, "_blank", "noopener");
  if (action === "delete-order") { state = { ...state, orders: state.orders.filter((item) => item.id !== button.dataset.id) }; persist("Order removed"); return; }
  if (action === "save-truck") { persist(`Truck ${truckLabel(truck(button.dataset.id))} saved`); return; }
  if (action === "delete-truck") { if (!canDelete("truck", button.dataset.id)) return notify("Cannot delete a truck with dispatch or trip-log history", "danger"); state = { ...state, trucks: state.trucks.filter((item) => item.id !== button.dataset.id) }; persist("Truck deleted"); return; }
  if (action === "save-dispatch") { state = { ...state, assignments: renumberAssignments(state.assignments) }; persist("Dispatch changes saved and tally updated"); return; }
  if (action === "add-manual-trip") { const targetTruck = truck(button.dataset.truck); const selectedCustomer = state.customers[0]; if (!targetTruck || !selectedCustomer?.materialIds?.length) return notify("Add a customer with a material before creating a manual trip", "danger"); const order = makeOrderFromMaterial({ id: uid("assignment"), date: ui.date, truckId: targetTruck.id, orderId: `manual-${uid("trip")}`, customerId: selectedCustomer.id, materialId: selectedCustomer.materialIds[0], zone: selectedCustomer.defaultZone, kind: selectedCustomer.kind, early: false, notes: "", status: "Planned", tripNumber: 99, createdAt: new Date().toISOString() }, state); state = { ...state, assignments: renumberAssignments([...state.assignments, order]) }; persist("Manual trip added. Edit it, then save the board."); return; }
  if (action === "move-trip-up") return moveTrip(button.dataset.id, -1);
  if (action === "move-trip-down") return moveTrip(button.dataset.id, 1);
  if (action === "remove-trip") { state = { ...state, assignments: state.assignments.filter((item) => item.id !== button.dataset.id) }; persist("Trip removed. Check the tally below."); return; }
  if (action === "save-log") { const card = button.closest("[data-assignment]"); const actualCustomerId = card.querySelector('[data-log-field="actualCustomerId"]').value; const status = card.querySelector('[data-log-field="status"]').value; const remark = card.querySelector('[data-log-field="remark"]').value; state = recordActualTrip(state, button.dataset.id, { actualCustomerId, status, remark }); persist("Actual trip saved ✓"); return; }
  if (action === "clear-log") return clearLog(button.dataset.id);
  if (action === "add-notice") { state = { ...state, notices: [...(state.notices || []), ""] }; persist("Reminder added"); return; }
  if (action === "delete-notice") { state = { ...state, notices: state.notices.filter((_, index) => String(index) !== button.dataset.id) }; persist("Reminder removed"); return; }
  if (action === "save-source") { persist("Source saved"); return; }
  if (action === "delete-source") { if (!canDelete("source", button.dataset.id)) return notify("Delete or reassign its materials first", "danger"); state = { ...state, sources: state.sources.filter((item) => item.id !== button.dataset.id) }; persist("Source deleted"); return; }
  if (action === "save-material") { persist("Material saved"); return; }
  if (action === "delete-material") { if (!canDelete("material", button.dataset.id)) return notify("This material is still used by a customer, order, or dispatch", "danger"); state = { ...state, materials: state.materials.filter((item) => item.id !== button.dataset.id) }; persist("Material deleted"); return; }
  if (action === "save-customer") { const selected = customer(button.dataset.id); if (!selected?.materialIds?.length) return notify("Select at least one allowed material for this customer", "danger"); persist("Customer saved"); return; }
  if (action === "delete-customer") { if (!canDelete("customer", button.dataset.id)) return notify("Cannot delete a customer with order, dispatch, or trip-log history", "danger"); state = { ...state, customers: state.customers.filter((item) => item.id !== button.dataset.id) }; persist("Customer deleted"); return; }
  if (action === "sync-up") return syncUp();
  if (action === "sync-down") return syncDown();
});

root.addEventListener("change", (event) => {
  const element = event.target;
  if (element.id === "dispatch-date") { ui.date = element.value; render(); return; }
  if (element.dataset.orderField) { updateOrder(element.closest("[data-order]").dataset.order, element.dataset.orderField, element.type === "checkbox" ? element.checked : element.value); persist("Order saved"); return; }
  if (element.dataset.truckField) { updateTruck(element.closest("[data-truck]").dataset.truck, element.dataset.truckField, element.value); return; }
  if (element.dataset.assignmentField) { updateAssignment(element.closest("[data-assignment]").dataset.assignment, element.dataset.assignmentField, element.type === "checkbox" ? element.checked : element.value); return; }
  if (element.dataset.customerField) { updateCustomer(element.closest("[data-customer]").dataset.customer, element.dataset.customerField, element.value); return; }
  if (element.dataset.customerMaterial) { setCustomerMaterial(element.dataset.customerMaterial, element.value, element.checked); return; }
  if (element.dataset.sourceField) { updateSource(element.closest("[data-source]").dataset.source, element.dataset.sourceField, element.value); return; }
  if (element.dataset.materialField) { updateMaterial(element.closest("[data-material]").dataset.material, element.dataset.materialField, element.value); return; }
  if (element.dataset.setting) { updateSetting(element.dataset.setting, element.value); persist("Setup saved"); return; }
  if (element.dataset.notice !== undefined) { state = { ...state, notices: state.notices.map((item, index) => String(index) === element.dataset.notice ? element.value : item) }; persist("Reminder saved"); }
});

root.addEventListener("submit", (event) => {
  event.preventDefault(); const form = event.target; const data = new FormData(form); const values = Object.fromEntries(data);
  if (form.dataset.form === "new-order") { const selected = customer(values.customerId); const material = materialById(state, values.materialId); if (!selected || !material) return notify("Choose both customer and material", "danger"); state = { ...state, orders: [...state.orders, makeOrderFromMaterial({ id: uid("order"), date: ui.date, customerId: selected.id, loads: Number(values.loads), zone: values.zone || selected.defaultZone, kind: selected.kind, materialId: material.id, early: values.early === "on", notes: values.notes || selected.notes || "" }, state)] }; persist("Order added"); }
  if (form.dataset.form === "new-truck") { state = { ...state, trucks: [...state.trucks, { id: uid("truck"), prefix: values.prefix || "", number: values.number.trim(), status: "Available", dailyMax: Number(values.dailyMax), nearMax: Number(values.nearMax), farMax: Number(values.farMax), stoneMax: Number(values.stoneMax), notes: "", updatedAt: new Date().toISOString() }] }; persist("Truck added"); }
  if (form.dataset.form === "new-source") { state = { ...state, sources: [...state.sources, { id: uid("source"), name: values.name.trim(), type: values.type, notes: values.notes || "", updatedAt: new Date().toISOString() }] }; persist("Source added"); }
  if (form.dataset.form === "new-material") { if (!values.sourceId) return notify("Choose a source for this material", "danger"); state = { ...state, materials: [...state.materials, { id: uid("material"), sourceId: values.sourceId, name: values.name.trim(), kind: values.kind, defaultZone: values.defaultZone, notes: values.notes || "", updatedAt: new Date().toISOString() }] }; persist("Material added"); }
  if (form.dataset.form === "new-customer") { const materialIds = data.getAll("materialId"); if (!materialIds.length) return notify("Select at least one allowed material", "danger"); state = { ...state, customers: [...state.customers, { id: uid("customer"), name: values.name.trim(), kind: values.kind, defaultZone: values.defaultZone, materialIds, notes: values.notes || "", updatedAt: new Date().toISOString() }] }; persist("Customer rule saved"); }
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js?v=20260711-3", { scope: "./", updateViaCache: "none" }));
render();
