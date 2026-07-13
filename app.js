import {
  applyDispatch, assignmentSummary, customerAllowedMaterialIds, customerRuleSummary, defaultCustomerMaterialId,
  defaultState, ensureState, loadScore, makeOrderFromMaterial, makeWhatsAppMessage, materialById,
  materialLabel, recordActualTrip, renumberAssignments, sourceById, tallyForDate, tomorrowISO, truckLabel, uid,
} from "./scheduler.js";

const STORAGE_KEY = "dispatch-pilot-state-v5";
const LEGACY_STORAGE_KEYS = ["dispatch-pilot-state-v4", "dispatch-pilot-state-v3", "dispatch-pilot-state-v1"];
const DAILY_TABS = [["trucks", "Trucks"], ["orders", "Orders"], ["tally", "Tally"], ["dispatch", "Dispatch"], ["whatsapp", "WhatsApp"], ["logs", "Trip log"]];
const root = document.querySelector("#app");
const requestedTab = new URLSearchParams(window.location.search).get("tab");
const ui = {
  tab: [...DAILY_TABS.map(([id]) => id), "settings"].includes(requestedTab) ? requestedTab : "trucks",
  date: tomorrowISO(), toast: "", toastTone: "", newOrderCustomer: "",
};
let state = readState();

function readState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || LEGACY_STORAGE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    return ensureState(saved ? JSON.parse(saved) : defaultState());
  } catch { return defaultState(); }
}

function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function activeOrders() { return state.orders.filter((order) => order.date === ui.date); }
function activeAssignments() { return state.assignments.filter((item) => item.date === ui.date).sort((a, b) => `${truck(a.truckId)?.prefix || ""} ${truck(a.truckId)?.number || ""}`.localeCompare(`${truck(b.truckId)?.prefix || ""} ${truck(b.truckId)?.number || ""}`) || a.tripNumber - b.tripNumber); }
function customer(id) { return state.customers.find((item) => item.id === id); }
function truck(id) { return state.trucks.find((item) => item.id === id); }
function availableTrucks() { return state.trucks.filter((item) => ["available", "active"].includes(String(item.status).toLowerCase())); }
function badge(status) { return `<span class="badge ${esc(String(status).toLowerCase())}">${esc(status)}</span>`; }
function totalLoads() { return activeOrders().reduce((sum, order) => sum + Number(order.loads || 0), 0); }
function number(value) { return Math.max(0, Number(value) || 0); }

function showToast(message, tone = "success") {
  ui.toast = message; ui.toastTone = tone; render();
  window.clearTimeout(window.__dispatchToast);
  window.__dispatchToast = window.setTimeout(() => { ui.toast = ""; render(); }, 2600);
}
function persist(message = "Saved on this phone", tone = "success") {
  state = { ...state, schemaVersion: 5, updatedAt: new Date().toISOString() };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { showToast("Phone storage is full — changes could not be saved", "danger"); return; }
  showToast(message, tone);
}
function notify(message, tone = "") { showToast(message, tone); }

function zoneOptions(selected, includeRule = false) { return `${includeRule ? `<option value="" ${!selected ? "selected" : ""}>Customer default</option>` : ""}${["Near", "Far", "Stone"].map((item) => `<option value="${item}" ${item === selected ? "selected" : ""}>${item}</option>`).join("")}`; }
function customerOptions(selected = "") { return `<option value="">Choose customer</option>${state.customers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((item) => `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(item.name)}</option>`).join("")}`; }
function sourceOptions(selected = "", includeBlank = true) { return `${includeBlank ? `<option value="" ${!selected ? "selected" : ""}>Choose source</option>` : ""}${state.sources.slice().sort((a, b) => a.name.localeCompare(b.name)).map((item) => `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(item.name)} (${esc(item.type)})</option>`).join("")}`; }
function sourceMultiOptions(materialName, selectedIds = []) {
  const sources = state.sources.filter((source) => state.materials.some((material) => material.sourceId === source.id && material.name.trim().toLowerCase() === String(materialName || "").trim().toLowerCase()));
  return sources.map((source) => `<option value="${esc(source.id)}" ${selectedIds.includes(source.id) ? "selected" : ""}>${esc(source.name)}</option>`).join("") || "<option disabled>No saved source provides this material yet</option>";
}
function materialNameOptions(selected = "", kind = "") {
  const names = [...new Set(state.materials.filter((item) => !kind || item.kind === kind).map((item) => item.name))].sort((a, b) => a.localeCompare(b));
  return `<option value="">Choose material</option>${names.map((name) => `<option value="${esc(name)}" ${name === selected ? "selected" : ""}>${esc(name)}</option>`).join("")}`;
}
function materialOptions(selected = "", customerId = "", kind = "") {
  const target = customer(customerId);
  const permitted = target ? new Set(customerAllowedMaterialIds(state, target)) : null;
  const available = state.materials.filter((item) => (!kind || item.kind === kind) && (!permitted || permitted.has(item.id))).sort((a, b) => materialLabel(state, a.id).localeCompare(materialLabel(state, b.id)));
  return `<option value="">Choose material and source</option>${available.map((item) => `<option value="${esc(item.id)}" ${item.id === selected ? "selected" : ""}>${esc(materialLabel(state, item.id))}</option>`).join("")}`;
}
function stepper(entity, id, field, value) {
  return `<div class="stepper"><button type="button" aria-label="Reduce" data-action="step-value" data-entity="${entity}" data-id="${esc(id)}" data-field="${field}" data-delta="-1">−</button><input type="number" min="0" inputmode="numeric" value="${esc(number(value))}" data-${entity}-field="${field}"><button type="button" aria-label="Increase" data-action="step-value" data-entity="${entity}" data-id="${esc(id)}" data-field="${field}" data-delta="1">+</button></div>`;
}
function refreshCustomerMaterialIds(nextState = state) {
  return { ...nextState, customers: nextState.customers.map((item) => ({ ...item, materialIds: customerAllowedMaterialIds(nextState, item) })) };
}
function orderZoneTotals() { return ["Near", "Far", "Stone"].map((zone) => ({ zone, loads: activeOrders().filter((item) => item.zone === zone).reduce((sum, item) => sum + number(item.loads), 0) })); }
function capacityTotals() {
  const totals = { Daily: 0, Near: 0, Far: 0, Stone: 0 };
  availableTrucks().forEach((item) => { totals.Daily += number(item.dailyMax); totals.Near += number(item.nearMax); totals.Far += number(item.farMax); totals.Stone += number(item.stoneMax); });
  return totals;
}
function plannedZoneTotals() { return ["Near", "Far", "Stone"].reduce((totals, zone) => ({ ...totals, [zone]: activeAssignments().filter((item) => item.zone === zone && item.status !== "Skipped").length }), {}); }

function layout(content) {
  return `<header class="topbar"><div><p class="eyebrow">DISPATCH PILOT</p><h1>${esc(state.companyName || "My Transport Dispatch")}</h1></div><button class="icon-button" data-action="go-settings" aria-label="Settings">Settings</button></header>
    <main><section class="date-strip"><label>Dispatch date<input id="dispatch-date" type="date" value="${esc(ui.date)}"></label><span>${activeAssignments().length ? `${activeAssignments().length} trips planned` : "Plan not generated"}</span></section>${content}</main>
    <nav class="bottom-nav daily-nav">${DAILY_TABS.map(([id, label]) => `<button class="${ui.tab === id ? "active" : ""}" data-tab="${id}"><b>${label.slice(0, 1)}</b><span>${label}</span></button>`).join("")}</nav>${ui.toast ? `<div class="toast ${esc(ui.toastTone)}">${esc(ui.toast)}</div>` : ""}`;
}

function trucksPage() {
  const capacity = capacityTotals();
  return `<section class="page-title"><p class="eyebrow">STEP 1 — DAILY AVAILABILITY</p><h2>Trucks and trip limits</h2><p>Set today’s availability and limits. The full prefix and registration remain visible everywhere.</p></section>
    <section class="mini-summary"><span><b>${availableTrucks().length}</b> available</span><span><b>${capacity.Daily}</b> daily capacity</span><span><b>${capacity.Near}/${capacity.Far}/${capacity.Stone}</b> near / far / stone</span></section>
    <section class="panel compact-panel"><div class="section-head"><div><h2>Today’s fleet</h2><small>Tap + / − to adjust; tap Save only when ready.</small></div></div><div class="table-scroll"><table class="compact-table truck-table"><thead><tr><th>Truck</th><th>Status</th><th>Daily</th><th>Near</th><th>Far</th><th>Stone</th><th></th></tr></thead><tbody>${state.trucks.map((item) => `<tr data-truck="${esc(item.id)}"><td><div class="plate-editor"><input class="prefix-input" aria-label="Prefix" placeholder="Prefix" data-truck-field="prefix" value="${esc(item.prefix)}"><input class="plate-input" aria-label="Registration number" placeholder="Registration" data-truck-field="number" value="${esc(item.number)}"></div><small>${item.notes ? esc(item.notes) : `Fairness: ${loadScore(state, item.id, ui.date).historical} completed / 30 days`}</small></td><td><select data-truck-field="status"><option ${item.status === "Available" ? "selected" : ""}>Available</option><option ${item.status === "Off" ? "selected" : ""}>Off</option><option ${item.status === "Breakdown" ? "selected" : ""}>Breakdown</option></select></td><td>${stepper("truck", item.id, "dailyMax", item.dailyMax)}</td><td>${stepper("truck", item.id, "nearMax", item.nearMax)}</td><td>${stepper("truck", item.id, "farMax", item.farMax)}</td><td>${stepper("truck", item.id, "stoneMax", item.stoneMax)}</td><td><button class="save-action tiny-save" data-action="save-truck" data-id="${esc(item.id)}">Save</button></td></tr>`).join("")}</tbody></table></div></section>
    <details class="panel compact-details"><summary>Add a truck</summary><form data-form="new-truck" class="inline-form"><input name="prefix" placeholder="Prefix, e.g. JY" aria-label="Prefix"><input required name="number" placeholder="Full registration" aria-label="Registration number"><select name="status"><option>Available</option><option>Off</option><option>Breakdown</option></select><input name="dailyMax" type="number" min="0" value="3" aria-label="Daily max"><input name="nearMax" type="number" min="0" value="3" aria-label="Near max"><input name="farMax" type="number" min="0" value="1" aria-label="Far max"><input name="stoneMax" type="number" min="0" value="1" aria-label="Stone max"><button class="primary" type="submit">Add</button></form></details>`;
}

function orderRow(order) {
  return `<tr data-order="${esc(order.id)}"><td><select data-order-field="customerId">${customerOptions(order.customerId)}</select></td><td><select data-order-field="materialId">${materialOptions(order.materialId, order.customerId, order.kind)}</select></td><td><select data-order-field="zone">${zoneOptions(order.zone)}</select></td><td>${stepper("order", order.id, "loads", order.loads)}</td><td><label class="inline-check"><input type="checkbox" data-order-field="early" ${order.early ? "checked" : ""}>Early</label></td><td><input class="short-note" data-order-field="notes" value="${esc(order.notes)}" placeholder="Remark"></td><td><button class="delete" data-action="delete-order" data-id="${esc(order.id)}">Remove</button></td></tr>`;
}
function ordersPage() {
  const totals = orderZoneTotals(); const selectedCustomer = customer(ui.newOrderCustomer);
  return `<section class="page-title"><p class="eyebrow">STEP 2 — CUSTOMER DEMAND</p><h2>Orders for ${esc(ui.date)}</h2><p>One row is one material and source. Add more rows for the same customer when they require several materials.</p></section>
    <section class="mini-summary"><span><b>${totals[0].loads}</b> near</span><span><b>${totals[1].loads}</b> far</span><span><b>${totals[2].loads}</b> stone</span><span><b>${totalLoads()}</b> total</span></section>
    <form class="panel compact-panel add-order" data-form="new-order"><div class="section-head"><div><h2>Add order line</h2><small>Choose customer first; the material list then follows that customer’s rules.</small></div></div><div class="table-scroll"><table class="compact-table add-order-table"><tbody><tr><td><select required name="customerId" data-new-order-customer>${customerOptions(ui.newOrderCustomer)}</select></td><td><select required name="materialId">${materialOptions("", selectedCustomer?.id || "", selectedCustomer?.kind || "")}</select></td><td><select name="zone">${zoneOptions("", true)}</select></td><td><input required name="loads" type="number" min="1" value="1" aria-label="Loads"></td><td><label class="inline-check"><input name="early" type="checkbox">Early</label></td><td><input name="notes" placeholder="Remark"></td><td><button class="primary" type="submit">Add</button></td></tr></tbody></table></div></form>
    <section class="panel compact-panel"><div class="section-head"><div><h2>Saved order lines</h2><small>Edit here, then save all order changes.</small></div><button class="save-action tiny-save" data-action="save-orders">Save orders</button></div><div class="table-scroll"><table class="compact-table orders-table"><thead><tr><th>Customer</th><th>Material / source</th><th>Zone</th><th>Loads</th><th>Early</th><th>Remark</th><th></th></tr></thead><tbody>${activeOrders().map(orderRow).join("") || "<tr><td colspan='7' class='empty-cell'>No orders yet.</td></tr>"}</tbody></table></div></section>`;
}

function tallyTable() {
  const tally = tallyForDate(state, ui.date);
  return `<section class="panel compact-panel tally-panel"><div class="section-head"><div><h2>Customer order vs planned trips</h2><small>Use this again after any manual dispatch edit.</small></div><span>${tally.every((item) => item.balance === 0) ? badge("Tally") : badge("Review")}</span></div><div class="table-scroll"><table class="compact-table tally-table"><thead><tr><th>Customer</th><th>Need</th><th>Planned</th><th>Balance</th></tr></thead><tbody>${tally.map((item) => `<tr class="${item.balance === 0 ? "ok" : "mismatch"}"><td>${esc(item.customerName)}</td><td>${item.required}</td><td>${item.planned}</td><td><b>${item.balance > 0 ? "+" : ""}${item.balance}</b></td></tr>`).join("") || "<tr><td colspan='4' class='empty-cell'>No order lines to check.</td></tr>"}</tbody></table></div></section>`;
}
function tallyPage() {
  const capacity = capacityTotals(); const demand = Object.fromEntries(orderZoneTotals().map((item) => [item.zone, item.loads])); const planned = plannedZoneTotals(); const rows = ["Near", "Far", "Stone"].map((zone) => ({ zone, demand: demand[zone], capacity: capacity[zone], planned: planned[zone] || 0 }));
  const dailyBalance = capacity.Daily - totalLoads(); const unallocated = state.lastAllocation?.date === ui.date ? state.lastAllocation.unresolved || [] : [];
  return `<section class="page-title"><p class="eyebrow">STEP 3 — CAPACITY CHECK</p><h2>Can today’s available trucks cover the orders?</h2><p>The checker compares requested loads with the limits you set in Trucks. Daily capacity remains the final overall limit.</p></section>
    <section class="mini-summary ${dailyBalance < 0 ? "warning-summary" : ""}"><span><b>${totalLoads()}</b> orders</span><span><b>${capacity.Daily}</b> daily capacity</span><span><b>${dailyBalance >= 0 ? "+" : ""}${dailyBalance}</b> overall balance</span></section>
    <section class="panel compact-panel"><div class="section-head"><div><h2>Order demand vs truck limits</h2><small>A negative balance means adjust orders or increase available capacity before generating.</small></div></div><div class="table-scroll"><table class="compact-table capacity-table"><thead><tr><th>Trip type</th><th>Customer need</th><th>Available capacity</th><th>Balance</th><th>Already planned</th></tr></thead><tbody>${rows.map((row) => `<tr class="${row.capacity - row.demand < 0 ? "mismatch" : "ok"}"><td>${row.zone}</td><td>${row.demand}</td><td>${row.capacity}</td><td><b>${row.capacity - row.demand >= 0 ? "+" : ""}${row.capacity - row.demand}</b></td><td>${row.planned}</td></tr>`).join("")}</tbody></table></div></section>
    ${unallocated.length ? `<section class="alert"><b>Last auto-dispatch could not place ${unallocated.length} load(s)</b>${unallocated.map((item) => `<p>${esc(customer(item.customerId)?.name)} — ${esc(item.reason)}</p>`).join("")}</section>` : ""}
    <button class="primary wide" data-action="run-dispatch">Auto-generate dispatch</button><p class="workflow-next">Next: review or edit the plan in <b>Dispatch</b>, then open <b>WhatsApp</b>.</p>${activeAssignments().length ? tallyTable() : ""}`;
}

function dispatchRow(assignment) {
  return `<tr data-assignment="${esc(assignment.id)}"><td>${assignment.tripNumber}</td><td><select data-assignment-field="customerId">${customerOptions(assignment.customerId)}</select></td><td><select data-assignment-field="materialId">${materialOptions(assignment.materialId, assignment.customerId, assignment.kind)}</select></td><td><select data-assignment-field="zone">${zoneOptions(assignment.zone)}</select></td><td><label class="inline-check"><input type="checkbox" data-assignment-field="early" ${assignment.early ? "checked" : ""}>Early</label></td><td><input class="short-note" data-assignment-field="notes" value="${esc(assignment.notes)}" placeholder="Remark"></td><td class="trip-actions"><button data-action="move-trip-up" data-id="${esc(assignment.id)}" title="Move up">↑</button><button data-action="move-trip-down" data-id="${esc(assignment.id)}" title="Move down">↓</button><button class="delete" data-action="remove-trip" data-id="${esc(assignment.id)}">×</button></td></tr>`;
}
function dispatchPage() {
  const assignments = activeAssignments(); const groups = state.trucks.map((item) => ({ item, trips: assignments.filter((assignment) => assignment.truckId === item.id) })).filter((group) => group.trips.length || ["available", "active"].includes(String(group.item.status).toLowerCase()));
  return `<section class="page-title"><p class="eyebrow">STEP 4 — REVIEW AND EDIT</p><h2>Dispatch board</h2><p>Edit only after auto-generation. Every full truck plate is kept visible; swipe a table left or right if needed.</p></section>${assignments.length ? `${tallyTable()}<section class="manual-help"><b>Manual edit</b><span>Change a line, use ↑ / ↓ to resequence, then tap Save dispatch.</span></section>${groups.map(({ item, trips }) => `<section class="dispatch-card"><div class="dispatch-head"><div><b class="truck-name">${esc(truckLabel(item))}</b>${badge(item.status)}</div><span>${trips.length}/${item.dailyMax} loads</span></div><div class="table-scroll">${trips.length ? `<table class="compact-table dispatch-table"><thead><tr><th>#</th><th>Customer</th><th>Material / source</th><th>Zone</th><th>Early</th><th>Remark</th><th></th></tr></thead><tbody>${trips.map(dispatchRow).join("")}</tbody></table>` : "<p class='muted pad'>No trip assigned.</p>"}</div><button class="secondary add-trip" data-action="add-manual-trip" data-truck="${esc(item.id)}">Add manual trip</button></section>`).join("")}<button class="primary wide save-dispatch" data-action="save-dispatch">Save dispatch changes</button>` : `<div class="empty"><b>No dispatch yet.</b><p>Complete Trucks, Orders and Tally first, then auto-generate the plan.</p><button class="primary" data-tab="tally">Go to tally</button></div>`}`;
}

function whatsappPage() {
  const assignments = activeAssignments();
  return `<section class="page-title"><p class="eyebrow">STEP 5 — SEND TO DRIVERS</p><h2>WhatsApp message</h2><p>The message is created from the saved dispatch plan, including source, material, customer remarks and driver reminders.</p></section>${assignments.length ? `<section class="panel message-card"><pre>${esc(makeWhatsAppMessage(state, ui.date))}</pre><div class="button-row"><button class="primary" data-action="copy-message">Copy message</button><button class="secondary" data-action="open-whatsapp">Open WhatsApp</button></div></section>` : `<div class="empty"><b>No dispatch plan yet.</b><p>Generate and save the dispatch first.</p><button class="primary" data-tab="tally">Go to tally</button></div>`}`;
}

function logsPage() {
  const assignments = activeAssignments();
  return `<section class="page-title"><p class="eyebrow">STEP 6 — ACTUAL TRIPS</p><h2>Trip log</h2><p>Save what actually happened. If the driver went to a different customer, the next auto-dispatch will remember the follow-up work.</p></section><section class="log-list">${assignments.length ? assignments.map((assignment) => { const info = assignmentSummary(state, assignment); const log = state.tripLogs.find((item) => item.assignmentId === assignment.id); return `<article class="log-card" data-assignment="${esc(assignment.id)}"><div class="log-title"><b class="truck-name">${esc(info.truckNo)}</b><span>Trip ${assignment.tripNumber}</span><strong>${esc(info.customerName)}</strong><small>${esc(materialLabel(state, assignment.materialId))}</small></div><div class="log-controls"><select data-log-field="actualCustomerId">${customerOptions(log?.actualCustomerId || assignment.customerId)}</select><select data-log-field="status"><option ${(!log || log.status === "Completed") ? "selected" : ""}>Completed</option><option ${log?.status === "Changed" ? "selected" : ""}>Changed</option><option ${log?.status === "Skipped" ? "selected" : ""}>Skipped</option></select><input data-log-field="remark" value="${esc(log?.remark || "")}" placeholder="What happened?"><button class="save-action ${log ? "is-saved" : ""}" data-action="save-log" data-id="${esc(assignment.id)}">${log ? "Update" : "Save"}</button>${log ? `<button class="secondary" data-action="clear-log" data-id="${esc(assignment.id)}">Reset</button>` : ""}</div></article>`; }).join("") : "<div class='empty'><b>No dispatch board yet.</b><p>Generate a dispatch before recording actual trips.</p></div>"}</section>`;
}

function sourceEditor(item) {
  const materials = state.materials.filter((material) => material.sourceId === item.id).sort((a, b) => a.name.localeCompare(b.name));
  return `<details class="source-editor" data-source="${esc(item.id)}"><summary><span><b>${esc(item.name)}</b><small>${esc(item.type)} · ${materials.length} material(s)</small></span><span class="material-chips">${materials.map((material) => `<i>${esc(material.name)}</i>`).join("") || "No materials"}</span></summary><div class="detail-body"><div class="inline-form source-fields"><input data-source-field="name" value="${esc(item.name)}" aria-label="Source name"><select data-source-field="type"><option ${item.type === "Sandpit" ? "selected" : ""}>Sandpit</option><option ${item.type === "Quarry" ? "selected" : ""}>Quarry</option></select><input data-source-field="notes" value="${esc(item.notes)}" placeholder="Source note"><button class="save-action tiny-save" data-action="save-source" data-id="${esc(item.id)}">Save source</button><button class="delete" data-action="delete-source" data-id="${esc(item.id)}">Delete</button></div><form class="batch-material-form" data-form="source-material-batch" data-source="${esc(item.id)}"><label>Add several materials, separated by comma or new line<textarea required name="materials" placeholder="e.g. 1x cuci, 2x cuci, Pasir Kasar"></textarea></label><button class="secondary" type="submit">Add materials under this source</button></form><div class="material-edit-list">${materials.map((material) => `<div data-material="${esc(material.id)}"><input data-material-field="name" value="${esc(material.name)}" aria-label="Material name"><select data-material-field="kind"><option ${material.kind === "Sand" ? "selected" : ""}>Sand</option><option ${material.kind === "Stone" ? "selected" : ""}>Stone</option></select><select data-material-field="defaultZone">${zoneOptions(material.defaultZone)}</select><button class="save-action tiny-save" data-action="save-material" data-id="${esc(material.id)}">Save</button><button class="delete" data-action="delete-material" data-id="${esc(material.id)}">Delete</button></div>`).join("") || "<small class='muted'>Add the materials provided by this source above.</small>"}</div></div></details>`;
}

function customerRuleEditor(item, rule) {
  return `<div class="customer-rule" data-rule="${esc(rule.id)}"><select data-rule-field="materialName">${materialNameOptions(rule.materialName, item.kind)}</select><select data-rule-field="sourceMode"><option value="Any" ${rule.sourceMode === "Any" ? "selected" : ""}>Any source</option><option value="Specific" ${rule.sourceMode === "Specific" ? "selected" : ""}>Only selected sources</option></select>${rule.sourceMode === "Specific" ? `<select multiple size="2" data-rule-sources aria-label="Sources for ${esc(rule.materialName)}">${sourceMultiOptions(rule.materialName, rule.sourceIds || [])}</select>` : `<span class="any-source-note">Any saved source that provides this material</span>`}<button class="delete" data-action="remove-customer-rule" data-customer="${esc(item.id)}" data-rule="${esc(rule.id)}">Remove</button></div>`;
}
function customerEditor(item) {
  const allowedCount = customerAllowedMaterialIds(state, item).length;
  return `<details class="customer-editor" data-customer="${esc(item.id)}"><summary><span><b>${esc(item.name)}</b><small>${esc(item.kind)} · ${esc(item.defaultZone)} · ${allowedCount} matching material/source option(s)</small></span><span>${esc(customerRuleSummary(state, item))}</span></summary><div class="detail-body"><div class="inline-form customer-fields"><input data-customer-field="name" value="${esc(item.name)}" aria-label="Customer name"><select data-customer-field="kind"><option ${item.kind === "Sand" ? "selected" : ""}>Sand</option><option ${item.kind === "Stone" ? "selected" : ""}>Stone</option></select><select data-customer-field="defaultZone">${zoneOptions(item.defaultZone)}</select><input data-customer-field="notes" value="${esc(item.notes)}" placeholder="Permanent remark"></div><p class="field-hint">Use <b>Any source</b> for Durable / IPS-style rules. Use <b>Only selected sources</b> for Zhin Heng-style rules such as Serdang from MingLiong only.</p><div class="rule-list">${(item.materialRules || []).map((rule) => customerRuleEditor(item, rule)).join("") || "<small class='muted'>Add at least one material rule.</small>"}</div><div class="card-actions"><button class="secondary" data-action="add-customer-rule" data-id="${esc(item.id)}">Add material rule</button><button class="save-action tiny-save" data-action="save-customer" data-id="${esc(item.id)}">Save customer</button><button class="delete" data-action="delete-customer" data-id="${esc(item.id)}">Delete</button></div></div></details>`;
}

function settingsPage() {
  return `<section class="page-title"><p class="eyebrow">SETTINGS — USED LESS OFTEN</p><h2>Master data</h2><p>Sources own their materials. Customers can accept a material from any source or only selected sources.</p></section>
    <section class="panel compact-panel"><div class="section-head"><h2>Company and group reminder</h2><button class="save-action tiny-save" data-action="save-company">Save</button></div><input data-setting="companyName" value="${esc(state.companyName)}" aria-label="Company name">${(state.notices || []).map((item, index) => `<div class="notice-row"><input data-notice="${index}" value="${esc(item)}" placeholder="Reminder for all drivers"><button class="delete" data-action="delete-notice" data-id="${index}">Remove</button></div>`).join("")}<button class="secondary" data-action="add-notice">Add group reminder</button></section>
    <details class="panel compact-details"><summary>Add source and its materials</summary><form class="source-create-form" data-form="new-source"><div class="inline-form"><input required name="name" placeholder="Sandpit / quarry name"><select name="type"><option>Sandpit</option><option>Quarry</option></select><input name="notes" placeholder="Source note"></div><label>Materials this source provides — comma or new-line separated<textarea name="materials" placeholder="e.g. 1x cuci, 2x cuci, Pasir Kasar"></textarea></label><small>Sandpit materials are created as Sand / Near; quarry materials as Stone / Stone. You can correct a material below if needed.</small><button class="primary" type="submit">Save source and materials</button></form></details>
    <section class="panel compact-panel"><div class="section-head"><div><h2>Sources with materials</h2><small>Add material names in batches under the correct source.</small></div><span>${state.sources.length}</span></div>${state.sources.map(sourceEditor).join("")}</section>
    <details class="panel compact-details"><summary>Add customer and first material rule</summary><form data-form="new-customer"><div class="inline-form"><input required name="name" placeholder="Customer name"><select name="kind"><option>Sand</option><option>Stone</option></select><select name="defaultZone">${zoneOptions("Near")}</select></div><div class="inline-form"><select required name="materialName">${materialNameOptions()}</select><select name="sourceMode"><option value="Any">Any source</option><option value="Specific">Only selected sources</option></select><select multiple size="2" name="sourceId">${sourceOptions("", false)}</select></div><input name="notes" placeholder="Permanent remark, e.g. deliver early"><small>For a specific-source rule, select one or more sources. After saving, open the customer to add more rules.</small><button class="primary" type="submit">Save customer</button></form></details>
    <section class="panel compact-panel customer-rules"><div class="section-head"><div><h2>Customers and material rules</h2><small>Examples: Durable = 1x cuci + Any source; Zhin Heng = three separate rules.</small></div><span>${state.customers.length}</span></div>${state.customers.map(customerEditor).join("")}</section>
    <section class="panel local-storage-panel"><p class="eyebrow">GUI PHASE — PHONE ONLY</p><h2>Local data and future API handover</h2><p>Your records are saved in this phone’s browser. Download a backup before clearing Chrome, changing phones, or beginning the later SQLite API integration.</p><div class="button-row"><button class="primary" data-action="download-backup">Download JSON backup</button><label class="secondary file-button">Restore JSON backup<input id="backup-file" type="file" accept="application/json,.json"></label></div><small>The later API developer receives the SQLite schema and CRUD contract in this release. Google Sheets is not being used as the database.</small></section>`;
}

function page() {
  if (ui.tab === "orders") return ordersPage();
  if (ui.tab === "tally") return tallyPage();
  if (ui.tab === "dispatch") return dispatchPage();
  if (ui.tab === "whatsapp") return whatsappPage();
  if (ui.tab === "logs") return logsPage();
  if (ui.tab === "settings") return settingsPage();
  return trucksPage();
}
function render() { root.innerHTML = layout(page()); }

function updateOrder(id, field, value) {
  state = { ...state, orders: state.orders.map((item) => {
    if (item.id !== id) return item;
    if (field === "customerId") { const selected = customer(value); return makeOrderFromMaterial({ ...item, customerId: value, kind: selected?.kind || item.kind, zone: selected?.defaultZone || item.zone, materialId: defaultCustomerMaterialId(state, selected) }, state); }
    if (field === "materialId") return makeOrderFromMaterial({ ...item, materialId: value }, state);
    return { ...item, [field]: field === "loads" ? number(value) : value, updatedAt: new Date().toISOString() };
  }) };
}
function updateTruck(id, field, value) { state = { ...state, trucks: state.trucks.map((item) => item.id === id ? { ...item, [field]: ["dailyMax", "nearMax", "farMax", "stoneMax"].includes(field) ? number(value) : value, updatedAt: new Date().toISOString() } : item) }; }
function updateAssignment(id, field, value) {
  state = { ...state, assignments: state.assignments.map((item) => {
    if (item.id !== id) return item;
    if (field === "customerId") { const selected = customer(value); return makeOrderFromMaterial({ ...item, customerId: value, kind: selected?.kind || item.kind, zone: selected?.defaultZone || item.zone, materialId: defaultCustomerMaterialId(state, selected) || item.materialId }, state); }
    if (field === "materialId") return makeOrderFromMaterial({ ...item, materialId: value }, state);
    return { ...item, [field]: value, updatedAt: new Date().toISOString() };
  }) };
}
function updateCustomer(id, field, value) { state = { ...state, customers: state.customers.map((item) => item.id === id ? { ...item, [field]: value, updatedAt: new Date().toISOString() } : item) }; }
function updateCustomerRule(customerId, ruleId, field, value) {
  state = { ...state, customers: state.customers.map((item) => item.id === customerId ? { ...item, materialRules: (item.materialRules || []).map((rule) => rule.id === ruleId ? { ...rule, [field]: value } : rule) } : item) };
  state = refreshCustomerMaterialIds(state);
}
function updateSource(id, field, value) { state = { ...state, sources: state.sources.map((item) => item.id === id ? { ...item, [field]: value, updatedAt: new Date().toISOString() } : item) }; }
function updateMaterial(id, field, value) { state = refreshCustomerMaterialIds({ ...state, materials: state.materials.map((item) => item.id === id ? { ...item, [field]: value, updatedAt: new Date().toISOString() } : item) }); }
function updateSetting(field, value) { state = { ...state, [field]: value }; }
function parseMaterialNames(value) { return [...new Set(String(value || "").split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean).map((item) => item.toLowerCase()))].map((normalised) => String(value).split(/[\n,;]+/).map((item) => item.trim()).find((item) => item.toLowerCase() === normalised)); }
function addMaterialsToSource(sourceId, names) {
  const source = sourceById(state, sourceId); if (!source) return 0;
  const existing = new Set(state.materials.filter((item) => item.sourceId === sourceId).map((item) => item.name.trim().toLowerCase()));
  const items = names.filter((name) => !existing.has(name.toLowerCase())).map((name) => ({ id: uid("material"), sourceId, name, kind: source.type === "Quarry" ? "Stone" : "Sand", defaultZone: source.type === "Quarry" ? "Stone" : "Near", notes: "", updatedAt: new Date().toISOString() }));
  state = refreshCustomerMaterialIds({ ...state, materials: [...state.materials, ...items] });
  return items.length;
}

async function copyMessage() { const text = makeWhatsAppMessage(state, ui.date); try { await navigator.clipboard.writeText(text); notify("WhatsApp message copied"); } catch { window.prompt("Copy this WhatsApp message:", text); } }
function downloadBackup() { const payload = JSON.stringify({ app: "Dispatch Pilot", schemaVersion: 5, exportedAt: new Date().toISOString(), state }, null, 2); const blob = new Blob([payload], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `dispatch-pilot-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href); state = { ...state, settings: { ...state.settings, lastBackupAt: new Date().toLocaleString() } }; persist("JSON backup downloaded"); }
async function restoreBackup(file) { if (!file) return; try { const parsed = JSON.parse(await file.text()); const incoming = parsed.state || parsed; if (!incoming.trucks || !incoming.customers) throw new Error("This is not a Dispatch Pilot backup"); if (!window.confirm("Replace the current phone data with this backup?")) return; state = ensureState(incoming); persist("Backup restored to this phone"); } catch (error) { notify(`Backup could not be restored: ${error.message}`, "danger"); } }
function canDelete(type, id) {
  if (type === "truck") return !state.assignments.some((item) => item.truckId === id) && !state.tripLogs.some((item) => item.truckId === id);
  if (type === "customer") return !state.orders.some((item) => item.customerId === id) && !state.assignments.some((item) => item.customerId === id) && !state.tripLogs.some((item) => item.plannedCustomerId === id || item.actualCustomerId === id);
  if (type === "material") return !state.customers.some((item) => customerAllowedMaterialIds(state, item).includes(id)) && !state.orders.some((item) => item.materialId === id) && !state.assignments.some((item) => item.materialId === id);
  if (type === "source") return !state.materials.some((item) => item.sourceId === id);
  return true;
}
function moveTrip(id, direction) { const target = state.assignments.find((item) => item.id === id); if (!target) return; const list = state.assignments.filter((item) => item.date === target.date && item.truckId === target.truckId).sort((a, b) => a.tripNumber - b.tripNumber); const index = list.findIndex((item) => item.id === id); const swap = list[index + direction]; if (!swap) return notify("This trip is already at the end of the sequence"); [target.tripNumber, swap.tripNumber] = [swap.tripNumber, target.tripNumber]; state = { ...state, assignments: renumberAssignments(state.assignments) }; persist("Trip sequence saved"); }
function clearLog(assignmentId) { state = { ...state, assignments: state.assignments.map((item) => item.id === assignmentId ? { ...item, status: "Planned" } : item), tripLogs: state.tripLogs.filter((item) => item.assignmentId !== assignmentId), makeUps: state.makeUps.filter((item) => item.assignmentId !== assignmentId) }; persist("Actual trip reset to planned"); }

root.addEventListener("click", async (event) => {
  const button = event.target.closest("button"); if (!button) return;
  if (button.dataset.tab) { ui.tab = button.dataset.tab; render(); return; }
  const action = button.dataset.action;
  if (action === "go-settings") { ui.tab = "settings"; render(); return; }
  if (action === "run-dispatch") { state = applyDispatch(state, ui.date); ui.tab = "dispatch"; persist("Dispatch generated. Review and save any manual edits."); return; }
  if (action === "copy-message") return copyMessage();
  if (action === "open-whatsapp") return window.open(`https://wa.me/?text=${encodeURIComponent(makeWhatsAppMessage(state, ui.date))}`, "_blank", "noopener");
  if (action === "step-value") { const delta = Number(button.dataset.delta); const input = button.parentElement.querySelector("input"); const next = number(Number(input.value) + delta); if (button.dataset.entity === "truck") updateTruck(button.dataset.id, button.dataset.field, next); if (button.dataset.entity === "order") updateOrder(button.dataset.id, button.dataset.field, next); input.value = next; return; }
  if (action === "save-truck") { persist(`Truck ${truckLabel(truck(button.dataset.id))} saved`); return; }
  if (action === "save-orders") { persist("Customer orders saved"); return; }
  if (action === "delete-order") { state = { ...state, orders: state.orders.filter((item) => item.id !== button.dataset.id) }; persist("Order line removed"); return; }
  if (action === "save-dispatch") { state = { ...state, assignments: renumberAssignments(state.assignments) }; persist("Dispatch changes saved and tally updated"); return; }
  if (action === "add-manual-trip") { const targetTruck = truck(button.dataset.truck); const selectedCustomer = state.customers[0]; const materialId = defaultCustomerMaterialId(state, selectedCustomer); if (!targetTruck || !selectedCustomer || !materialId) return notify("Add a customer material rule before creating a manual trip", "danger"); const assignment = makeOrderFromMaterial({ id: uid("assignment"), date: ui.date, truckId: targetTruck.id, orderId: `manual-${uid("trip")}`, customerId: selectedCustomer.id, materialId, zone: selectedCustomer.defaultZone, kind: selectedCustomer.kind, early: false, notes: "", status: "Planned", tripNumber: 99, createdAt: new Date().toISOString() }, state); state = { ...state, assignments: renumberAssignments([...state.assignments, assignment]) }; persist("Manual trip added — edit it and save the dispatch"); return; }
  if (action === "move-trip-up") return moveTrip(button.dataset.id, -1);
  if (action === "move-trip-down") return moveTrip(button.dataset.id, 1);
  if (action === "remove-trip") { state = { ...state, assignments: state.assignments.filter((item) => item.id !== button.dataset.id) }; persist("Trip removed — check the tally"); return; }
  if (action === "save-log") { const card = button.closest("[data-assignment]"); state = recordActualTrip(state, button.dataset.id, { actualCustomerId: card.querySelector('[data-log-field="actualCustomerId"]').value, status: card.querySelector('[data-log-field="status"]').value, remark: card.querySelector('[data-log-field="remark"]').value }); persist("Actual trip saved"); return; }
  if (action === "clear-log") return clearLog(button.dataset.id);
  if (action === "save-company") { persist("Company settings saved"); return; }
  if (action === "add-notice") { state = { ...state, notices: [...(state.notices || []), ""] }; render(); return; }
  if (action === "delete-notice") { state = { ...state, notices: state.notices.filter((_, index) => String(index) !== button.dataset.id) }; persist("Reminder removed"); return; }
  if (action === "save-source") { persist("Source saved"); return; }
  if (action === "delete-source") { if (!canDelete("source", button.dataset.id)) return notify("Delete or reassign its materials first", "danger"); state = { ...state, sources: state.sources.filter((item) => item.id !== button.dataset.id) }; persist("Source deleted"); return; }
  if (action === "save-material") { persist("Material saved"); return; }
  if (action === "delete-material") { if (!canDelete("material", button.dataset.id)) return notify("This material is still used by a customer, order, or dispatch", "danger"); state = refreshCustomerMaterialIds({ ...state, materials: state.materials.filter((item) => item.id !== button.dataset.id) }); persist("Material deleted"); return; }
  if (action === "add-customer-rule") { const target = customer(button.dataset.id); const firstName = state.materials.find((item) => item.kind === target?.kind)?.name || ""; state = refreshCustomerMaterialIds({ ...state, customers: state.customers.map((item) => item.id === button.dataset.id ? { ...item, materialRules: [...(item.materialRules || []), { id: uid("rule"), materialName: firstName, sourceMode: "Any", sourceIds: [] }] } : item) }); render(); return; }
  if (action === "remove-customer-rule") { const target = customer(button.dataset.customer); if ((target?.materialRules || []).length <= 1) return notify("A customer needs at least one material rule", "danger"); state = refreshCustomerMaterialIds({ ...state, customers: state.customers.map((item) => item.id === button.dataset.customer ? { ...item, materialRules: item.materialRules.filter((rule) => rule.id !== button.dataset.rule) } : item) }); render(); return; }
  if (action === "save-customer") { const target = customer(button.dataset.id); if (!(target?.materialRules || []).length || !customerAllowedMaterialIds(state, target).length) return notify("Give this customer a material rule with at least one matching source", "danger"); persist("Customer saved"); return; }
  if (action === "delete-customer") { if (!canDelete("customer", button.dataset.id)) return notify("Cannot delete a customer with order, dispatch, or trip-log history", "danger"); state = { ...state, customers: state.customers.filter((item) => item.id !== button.dataset.id) }; persist("Customer deleted"); return; }
  if (action === "download-backup") return downloadBackup();
});

root.addEventListener("change", (event) => {
  const element = event.target;
  if (element.id === "dispatch-date") { ui.date = element.value; render(); return; }
  if (element.id === "backup-file") { restoreBackup(element.files?.[0]); return; }
  if (element.dataset.newOrderCustomer !== undefined) { ui.newOrderCustomer = element.value; render(); return; }
  if (element.dataset.orderField) { updateOrder(element.closest("[data-order]").dataset.order, element.dataset.orderField, element.type === "checkbox" ? element.checked : element.value); if (element.dataset.orderField === "customerId") render(); return; }
  if (element.dataset.truckField) { updateTruck(element.closest("[data-truck]").dataset.truck, element.dataset.truckField, element.value); return; }
  if (element.dataset.assignmentField) { updateAssignment(element.closest("[data-assignment]").dataset.assignment, element.dataset.assignmentField, element.type === "checkbox" ? element.checked : element.value); if (element.dataset.assignmentField === "customerId") render(); return; }
  if (element.dataset.customerField) { updateCustomer(element.closest("[data-customer]").dataset.customer, element.dataset.customerField, element.value); return; }
  if (element.dataset.ruleField) { const container = element.closest("[data-customer]"); updateCustomerRule(container.dataset.customer, element.closest("[data-rule]").dataset.rule, element.dataset.ruleField, element.value); render(); return; }
  if (element.dataset.ruleSources !== undefined) { const container = element.closest("[data-customer]"); updateCustomerRule(container.dataset.customer, element.closest("[data-rule]").dataset.rule, "sourceIds", [...element.selectedOptions].map((option) => option.value)); return; }
  if (element.dataset.sourceField) { updateSource(element.closest("[data-source]").dataset.source, element.dataset.sourceField, element.value); return; }
  if (element.dataset.materialField) { updateMaterial(element.closest("[data-material]").dataset.material, element.dataset.materialField, element.value); return; }
  if (element.dataset.setting) { updateSetting(element.dataset.setting, element.value); return; }
  if (element.dataset.notice !== undefined) { state = { ...state, notices: state.notices.map((item, index) => String(index) === element.dataset.notice ? element.value : item) }; }
});

root.addEventListener("submit", (event) => {
  event.preventDefault(); const form = event.target; const data = new FormData(form); const values = Object.fromEntries(data);
  if (form.dataset.form === "new-truck") { state = { ...state, trucks: [...state.trucks, { id: uid("truck"), prefix: values.prefix?.trim() || "", number: values.number.trim(), status: values.status, dailyMax: number(values.dailyMax), nearMax: number(values.nearMax), farMax: number(values.farMax), stoneMax: number(values.stoneMax), notes: "", updatedAt: new Date().toISOString() }] }; persist("Truck added"); return; }
  if (form.dataset.form === "new-order") { const selected = customer(values.customerId); const material = materialById(state, values.materialId); if (!selected || !material || !customerAllowedMaterialIds(state, selected).includes(material.id)) return notify("Choose a customer and one of their allowed material/source options", "danger"); state = { ...state, orders: [...state.orders, makeOrderFromMaterial({ id: uid("order"), date: ui.date, customerId: selected.id, loads: number(values.loads), zone: values.zone || selected.defaultZone, kind: selected.kind, materialId: material.id, early: values.early === "on", notes: values.notes || selected.notes || "" }, state)] }; ui.newOrderCustomer = selected.id; persist("Order line added"); return; }
  if (form.dataset.form === "new-source") { const source = { id: uid("source"), name: values.name.trim(), type: values.type, notes: values.notes || "", updatedAt: new Date().toISOString() }; state = { ...state, sources: [...state.sources, source] }; const added = addMaterialsToSource(source.id, parseMaterialNames(values.materials)); persist(`Source saved${added ? ` with ${added} material(s)` : ""}`); return; }
  if (form.dataset.form === "source-material-batch") { const added = addMaterialsToSource(form.dataset.source, parseMaterialNames(values.materials)); if (!added) return notify("No new material was added — check the names are not already saved", "danger"); persist(`${added} material(s) added under this source`); return; }
  if (form.dataset.form === "new-customer") { const rule = { id: uid("rule"), materialName: values.materialName, sourceMode: values.sourceMode === "Specific" ? "Specific" : "Any", sourceIds: data.getAll("sourceId").filter(Boolean) }; const item = { id: uid("customer"), name: values.name.trim(), kind: values.kind, defaultZone: values.defaultZone, materialRules: [rule], notes: values.notes || "", updatedAt: new Date().toISOString() }; if (!rule.materialName || !customerAllowedMaterialIds(state, item).length) return notify("Choose a material and a matching source rule", "danger"); state = refreshCustomerMaterialIds({ ...state, customers: [...state.customers, item] }); persist("Customer saved"); }
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js?v=20260713-2", { scope: "./", updateViaCache: "none" }));
render();
