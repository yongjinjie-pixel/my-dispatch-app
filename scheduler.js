export const todayISO = () => new Date().toISOString().slice(0, 10);
export const tomorrowISO = () => { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); };
export const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const normalise = (value) => String(value || "").trim().toLowerCase();

const number = (value) => Math.max(0, Number(value) || 0);
const sourceSeed = [
  ["src-ml", "MingLiong Mados", "Sandpit"], ["src-gsl", "GuanSengLee", "Sandpit"], ["src-gd", "GD Linggiu", "Sandpit"],
  ["src-kl", "KL Building", "Quarry"], ["src-bj", "BJ", "Quarry"], ["src-qcp", "QCP Manufacturing Kg Sawah", "Sandpit"],
];
const materialSeed = [
  ["mat-ml-1x", "src-ml", "1x cuci", "Sand", "Near"], ["mat-gsl-1x", "src-gsl", "1x cuci", "Sand", "Near"],
  ["mat-ml-2x", "src-ml", "2x cuci", "Sand", "Near"], ["mat-gsl-2x", "src-gsl", "2x cuci", "Sand", "Near"],
  ["mat-ml-kasar", "src-ml", "Pasir Kasar", "Sand", "Near"], ["mat-gsl-kasar", "src-gsl", "Pasir Kasar", "Sand", "Near"],
  ["mat-ml-serdang", "src-ml", "Pasir Serdang", "Sand", "Near"], ["mat-ml-halus", "src-ml", "Pasir Halus", "Sand", "Near"],
  ["mat-gsl-halus", "src-gsl", "Pasir Halus", "Sand", "Near"], ["mat-ml-jagung", "src-ml", "Pasir Jagung", "Sand", "Near"],
  ["mat-kl-cr", "src-kl", "Crusher Run", "Stone", "Stone"], ["mat-kl-20", "src-kl", "20mm", "Stone", "Stone"],
  ["mat-qcp-jagung", "src-qcp", "Pasir Jagung", "Sand", "Far"], ["mat-bj-20", "src-bj", "20mm", "Stone", "Stone"], ["mat-bj-cr", "src-bj", "Crusher Run", "Stone", "Stone"],
];
const truckSeed = [
  ["1349", "JSE", "Off", 4, 3, 1, 0], ["1390", "JRM", "Off", 4, 3, 1, 0], ["1867", "JYJ", "Available", 5, 3, 1, 1],
  ["3726", "JRR", "Off", 4, 3, 1, 0], ["3772", "ANS", "Available", 5, 4, 0, 1], ["4460", "JSN", "Off", 3, 3, 1, 1],
  ["5274", "JYY", "Available", 5, 4, 0, 1], ["6128", "JJY", "Off", 4, 3, 1, 0], ["6307", "JSH", "Available", 4, 3, 1, 0],
  ["7914", "JYM", "Available", 5, 3, 1, 1], ["7962", "JYF", "Available", 5, 4, 0, 1], ["9465", "PRL", "Available", 5, 4, 0, 1],
];

function zoneKey(zone) { const item = normalise(zone); return item === "stone" || item === "batu" ? "stone" : item === "far" || item === "jauh" ? "far" : "near"; }
function profileKey(profile) { return `${number(profile.near)}|${number(profile.far)}|${number(profile.stone)}`; }
function profileTotal(profile) { return number(profile.near) + number(profile.far) + number(profile.stone); }
function normaliseProfiles(profiles, fallback = []) {
  const cleaned = (Array.isArray(profiles) ? profiles : fallback).map((profile, index) => ({ id: profile.id || `cap-${index + 1}`, near: number(profile.near), far: number(profile.far), stone: number(profile.stone) })).filter((profile) => profileTotal(profile) > 0);
  const unique = [...new Map(cleaned.map((profile) => [profileKey(profile), profile])).values()];
  return unique.length ? unique : [{ id: "cap-1", near: 1, far: 0, stone: 0 }];
}
function legacyProfiles(truck) {
  const daily = number(truck.dailyMax || 3); const far = number(truck.farMax); const stone = number(truck.stoneMax);
  const profiles = [{ id: "cap-near", near: daily, far: 0, stone: 0 }];
  if (far) profiles.push({ id: "cap-far", near: Math.max(0, daily - far), far, stone: 0 });
  if (stone) profiles.push({ id: "cap-stone", near: Math.max(0, daily - stone), far: 0, stone });
  if (far && stone && far + stone <= daily) profiles.push({ id: "cap-mixed", near: Math.max(0, daily - far - stone), far, stone });
  return normaliseProfiles(profiles);
}
function capabilitiesFromLegacy(daily, near, far, stone) { return legacyProfiles({ dailyMax: daily, nearMax: near, farMax: far, stoneMax: stone }); }

export function truckLabel(truck) { return [truck?.prefix, truck?.number].filter(Boolean).join(" ") || "Unknown truck"; }
export function sourceById(state, sourceId) { return state.sources.find((item) => item.id === sourceId); }
export function materialById(state, materialId) { return state.materials.find((item) => item.id === materialId); }
export function sourceShort(sourceName) { const name = normalise(sourceName); if (name.includes("ming")) return "ML"; if (name.includes("guan")) return "GSL"; if (name.includes("linggiu") || name === "gd") return "GD"; if (name.includes("qcp")) return "QCP"; return sourceName || "-"; }
export function materialLabel(state, materialId) { const material = materialById(state, materialId); return material ? `${material.name} — ${sourceById(state, material.sourceId)?.name || "Unknown source"}` : "Material not set"; }
export function materialFields(state, materialId) { const material = materialById(state, materialId); const source = material && sourceById(state, material.sourceId); return { materialId: material?.id || "", sourceId: source?.id || "", source: source?.name || "", product: material?.name || "", productLabel: material ? `${material.name} ${sourceShort(source?.name)}` : "" }; }
export function activeProfiles(truck) {
  if (normalise(truck?.status) === "scheduled repair") { const repair = { id: "repair", ...(truck.repairCapacity || {}) }; return profileTotal(repair) ? [{ ...repair, near: number(repair.near), far: number(repair.far), stone: number(repair.stone) }] : []; }
  return normaliseProfiles(truck?.capabilities, legacyProfiles(truck || {}));
}
export function maximumTruckTrips(truck) { return Math.max(0, ...activeProfiles(truck).map(profileTotal)); }
export function capabilitySummary(truck) { return activeProfiles(truck).map((profile) => [profile.near ? `${profile.near}N` : "", profile.far ? `${profile.far}F` : "", profile.stone ? `${profile.stone}S` : ""].filter(Boolean).join(" + ")).join("  |  "); }
export function isDispatchable(truck) { return ["available", "active", "scheduled repair", "quarry only"].includes(normalise(truck?.status)) && maximumTruckTrips(truck) > 0; }

export function customerAllowedMaterialIds(state, customer) {
  if (!customer) return [];
  const rules = Array.isArray(customer.materialRules) ? customer.materialRules : [];
  if (!rules.length) return (customer.materialIds || []).filter((id) => materialById(state, id));
  return state.materials.filter((material) => rules.some((rule) => normalise(rule.materialName) === normalise(material.name) && (rule.sourceMode === "Any" || (rule.sourceIds || []).includes(material.sourceId)))).map((material) => material.id);
}
export function defaultCustomerMaterialId(state, customer) { return customerAllowedMaterialIds(state, customer)[0] || ""; }
export function customerRuleSummary(state, customer) {
  const rules = customer?.materialRules || [];
  return rules.length ? rules.map((rule) => `${rule.materialName} (${rule.sourceMode === "Any" ? "any source" : (rule.sourceIds || []).map((id) => sourceById(state, id)?.name).filter(Boolean).join(" / ") || "choose source"})`).join("; ") : "No material rule";
}
export function makeOrderFromMaterial(order, state) {
  const target = state.customers.find((item) => item.id === order.customerId); const materialId = order.materialId || defaultCustomerMaterialId(state, target); const details = materialFields(state, materialId);
  return { ...order, ...details, kind: target?.kind || order.kind || materialById(state, materialId)?.kind || "Sand", zone: order.zone || target?.defaultZone || materialById(state, materialId)?.defaultZone || "Near", updatedAt: new Date().toISOString() };
}

function customerSeed(materials) {
  const rules = (name, kind, defaultZone, materialRules, notes = "") => ({ id: `customer-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`, name, kind, defaultZone, materialRules: materialRules.map((rule, index) => ({ id: `rule-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${index + 1}`, ...rule })), notes, updatedAt: new Date().toISOString() });
  const customers = [
    rules("Durable Kempas", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Durable Senai", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Durable Ulu Choh", "Sand", "Far", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Top Mix JB City", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Top Mix Kota Puteri", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Prima Precast", "Sand", "Near", [{ materialName: "2x cuci", sourceMode: "Specific", sourceIds: ["src-gsl"] }]),
    rules("CK Plentong", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("CK Ulu Tiram", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Specific", sourceIds: ["src-gsl"] }]),
    rules("Zhin Heng Saleng", "Sand", "Near", [{ materialName: "Pasir Kasar", sourceMode: "Any", sourceIds: [] }, { materialName: "Pasir Serdang", sourceMode: "Specific", sourceIds: ["src-ml"] }, { materialName: "Pasir Halus", sourceMode: "Any", sourceIds: [] }]),
    rules("Ginson Kulai", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Ginson Seelong", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Kulai Chuan Seng", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Yong Seng Hardware", "Sand", "Near", [{ materialName: "Pasir Kasar", sourceMode: "Any", sourceIds: [] }, { materialName: "Pasir Serdang", sourceMode: "Specific", sourceIds: ["src-ml"] }]),
    rules("Lim & Lam Hardware", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("IPS Precast", "Sand", "Far", [{ materialName: "2x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Aurum Precast", "Sand", "Far", [{ materialName: "2x cuci", sourceMode: "Specific", sourceIds: ["src-gsl"] }]),
    rules("CK Mutiara Bestari", "Sand", "Far", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("CK Lima Kedai", "Sand", "Far", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Sudi Bina Bukit Amber", "Sand", "Far", [{ materialName: "Pasir Jagung", sourceMode: "Specific", sourceIds: ["src-qcp"] }]),
    rules("Infraway Kong Kong", "Stone", "Stone", [{ materialName: "Crusher Run", sourceMode: "Specific", sourceIds: ["src-kl"] }]),
  ];
  return customers.map((customer) => ({ ...customer, materialIds: stateMaterialIds({ materials, sources: sourceSeed.map(([id, name, type]) => ({ id, name, type })) }, customer) }));
}
function stateMaterialIds(state, customer) { return customerAllowedMaterialIds({ ...state, customers: [] }, customer); }

export function defaultState() {
  const date = tomorrowISO(); const now = new Date().toISOString();
  const sources = sourceSeed.map(([id, name, type]) => ({ id, name, type, notes: "", updatedAt: now }));
  const materials = materialSeed.map(([id, sourceId, name, kind, defaultZone]) => ({ id, sourceId, name, kind, defaultZone, notes: "", updatedAt: now }));
  const trucks = truckSeed.map(([plate, prefix, status, daily, near, far, stone]) => ({ id: `truck-${plate}`, prefix, number: plate, status, capabilities: capabilitiesFromLegacy(daily, near, far, stone), repairCapacity: { near: 0, far: 0, stone: 0 }, repairTime: "Morning", earlyRepair: false, dailyMax: daily, nearMax: near, farMax: far, stoneMax: stone, notes: "", updatedAt: now }));
  const customers = customerSeed(materials);
  const byName = new Map(customers.map((item) => [item.name, item]));
  const orderRows = [["Durable Kempas", 8], ["Durable Senai", 8], ["Top Mix JB City", 4], ["Top Mix Kota Puteri", 3], ["Zhin Heng Saleng", 2, "", true], ["IPS Precast", 2], ["Infraway Kong Kong", 2]];
  const orders = orderRows.map(([name, loads, notes = "", early = false]) => { const target = byName.get(name); return makeOrderFromMaterial({ id: uid("order"), date, customerId: target.id, loads, zone: target.defaultZone, kind: target.kind, materialId: defaultCustomerMaterialId({ sources, materials, customers }, target), early, notes }, { sources, materials, customers }); });
  return { schemaVersion: 7, companyName: "My Transport Dispatch", notices: ["Operasi JPJ: check documents, tyre condition and load cover before moving."], trucks, sources, materials, customers, orders, assignments: [], tripLogs: [], quarryTripLogs: [], makeUps: [], settings: { storageMode: "phone-only", lastBackupAt: "" }, updatedAt: now };
}

export function ensureState(raw) {
  const seed = defaultState(); if (!raw || !Array.isArray(raw.trucks)) return seed;
  const state = {
    ...seed, ...raw, settings: { ...seed.settings, lastBackupAt: raw.settings?.lastBackupAt || "" }, notices: Array.isArray(raw.notices) ? raw.notices : seed.notices,
    sources: Array.isArray(raw.sources) && raw.sources.length ? raw.sources : seed.sources, materials: Array.isArray(raw.materials) && raw.materials.length ? raw.materials : seed.materials,
    customers: Array.isArray(raw.customers) ? raw.customers : seed.customers, orders: Array.isArray(raw.orders) ? raw.orders : [], assignments: Array.isArray(raw.assignments) ? raw.assignments : [], tripLogs: Array.isArray(raw.tripLogs) ? raw.tripLogs : [], quarryTripLogs: Array.isArray(raw.quarryTripLogs) ? raw.quarryTripLogs : [], makeUps: Array.isArray(raw.makeUps) ? raw.makeUps : [],
  };
  state.trucks = raw.trucks.map((truck) => {
    const capabilities = normaliseProfiles(truck.capabilities, legacyProfiles(truck)); const repairCapacity = { near: number(truck.repairCapacity?.near), far: number(truck.repairCapacity?.far), stone: number(truck.repairCapacity?.stone) };
    const active = normalise(truck.status) === "scheduled repair" && profileTotal(repairCapacity) ? [{ ...repairCapacity, id: "repair" }] : normalise(truck.status) === "scheduled repair" ? [] : capabilities;
    return { ...truck, prefix: truck.prefix || "", number: truck.number || truck.registration || "", status: truck.status || "Available", statusReason: truck.statusReason || "", capabilities, repairCapacity, repairTime: truck.repairTime === "Afternoon" ? "Afternoon" : "Morning", earlyRepair: Boolean(truck.earlyRepair), dailyMax: Math.max(0, ...active.map(profileTotal)), nearMax: Math.max(0, ...active.map((profile) => profile.near)), farMax: Math.max(0, ...active.map((profile) => profile.far)), stoneMax: Math.max(0, ...active.map((profile) => profile.stone)), notes: truck.notes || "", updatedAt: truck.updatedAt || new Date().toISOString() };
  });
  const findLegacyMaterial = (candidate, fallback = []) => {
    const supplied = normalise(candidate?.source || candidate?.supplier); const product = normalise(candidate?.product || candidate?.productLabel);
    return state.materials.find((material) => { const source = sourceById(state, material.sourceId); return (!supplied || normalise(source?.name).includes(supplied) || supplied.includes(normalise(source?.name))) && (!product || normalise(material.name) === product || normalise(candidate?.productLabel).includes(normalise(material.name))); })?.id || fallback[0] || "";
  };
  state.customers = state.customers.map((customer) => {
    let materialIds = Array.isArray(customer.materialIds) ? customer.materialIds.filter((id) => materialById(state, id)) : [];
    if (!materialIds.length && Array.isArray(customer.accepted)) materialIds = customer.accepted.map((item) => findLegacyMaterial(item)).filter(Boolean);
    const materialRules = Array.isArray(customer.materialRules) && customer.materialRules.length ? customer.materialRules.map((rule, index) => ({ id: rule.id || `${customer.id}-rule-${index + 1}`, materialName: rule.materialName || "", sourceMode: rule.sourceMode === "Any" ? "Any" : "Specific", sourceIds: Array.isArray(rule.sourceIds) ? rule.sourceIds.filter((id) => sourceById(state, id)) : [] })).filter((rule) => rule.materialName) : materialIds.reduce((rules, materialId) => { const material = materialById(state, materialId); if (!material) return rules; const existing = rules.find((rule) => normalise(rule.materialName) === normalise(material.name)); if (existing) existing.sourceIds.push(material.sourceId); else rules.push({ id: `${customer.id}-rule-${rules.length + 1}`, materialName: material.name, sourceMode: "Specific", sourceIds: [material.sourceId] }); return rules; }, []);
    const normalized = { ...customer, kind: customer.kind || "Sand", defaultZone: customer.defaultZone || "Near", materialRules: materialRules.map((rule) => ({ ...rule, sourceIds: [...new Set(rule.sourceIds)] })), notes: customer.notes || "" };
    return { ...normalized, materialIds: customerAllowedMaterialIds(state, normalized) };
  });
  state.orders = state.orders.map((order) => {
    const target = state.customers.find((item) => item.id === order.customerId);
    const materialId = order.materialId || findLegacyMaterial(order, target?.materialIds);
    return makeOrderFromMaterial({ ...order, materialId, materialOverride: typeof order.materialOverride === "boolean" ? order.materialOverride : Boolean(materialId && materialId !== defaultCustomerMaterialId(state, target)) }, state);
  });
  state.assignments = state.assignments.map((assignment) => makeOrderFromMaterial({ ...assignment, materialId: assignment.materialId || findLegacyMaterial(assignment, state.customers.find((item) => item.id === assignment.customerId)?.materialIds) }, state));
  state.schemaVersion = 7; return state;
}

function dayCounts(assignments, truckId) { const counts = { total: 0, near: 0, far: 0, stone: 0 }; assignments.filter((item) => item.truckId === truckId).forEach((item) => { counts.total += 1; counts[zoneKey(item.zone)] += 1; }); return counts; }
function profileFits(truck, counts) { return activeProfiles(truck).some((profile) => counts.near <= profile.near && counts.far <= profile.far && counts.stone <= profile.stone && counts.total <= profileTotal(profile)); }
function previousCounts(state, truckId, date) {
  const from = new Date(`${date}T00:00:00`); from.setDate(from.getDate() - 30); const counts = { total: 0, near: 0, far: 0, stone: 0 };
  state.assignments.filter((item) => item.truckId === truckId && item.date < date && item.status !== "Skipped" && new Date(`${item.date}T00:00:00`) >= from).forEach((item) => { counts.total += 1; counts[zoneKey(item.zone)] += 1; });
  return counts;
}
function sourceTypeFor(state, item) { return sourceById(state, item.sourceId)?.type || (normalise(item.kind) === "stone" ? "Quarry" : "Sandpit"); }
function previousSourceWork(state, truckId, date, sourceType) {
  const from = new Date(`${date}T00:00:00`); from.setDate(from.getDate() - 30);
  const assigned = state.assignments.filter((item) => item.truckId === truckId && item.date < date && item.status !== "Skipped" && new Date(`${item.date}T00:00:00`) >= from && sourceTypeFor(state, item) === sourceType).length;
  const quarryLogged = sourceType === "Quarry" ? (state.quarryTripLogs || []).filter((item) => item.truckId === truckId && item.date < date && new Date(`${item.date}T00:00:00`) >= from).reduce((sum, item) => sum + number(item.loads), 0) : 0;
  return assigned + quarryLogged;
}
function candidateScore(state, truck, counts, job, date) {
  const historical = previousCounts(state, truck.id, date); const zone = zoneKey(job.zone); const special = zone === "far" || zone === "stone";
  const makeUp = state.makeUps.find((item) => item.status === "Pending" && item.truckId === truck.id && item.customerId === job.customerId);
  const avoid = state.makeUps.some((item) => item.status === "Pending" && item.truckId === truck.id && item.avoidCustomerId === job.customerId);
  const quarry = sourceTypeFor(state, job) === "Quarry";
  return counts.total * 100 + historical.total * 6 + counts[zone] * 35 + (special ? historical[zone] * 130 + (historical.far + historical.stone) * 25 : historical.near * 12) + (quarry ? previousSourceWork(state, truck.id, date, "Quarry") * 160 - (normalise(truck.status) === "quarry only" ? 900 : 0) : previousSourceWork(state, truck.id, date, "Sandpit") * 50) + (job.early ? -60 : 0) + (makeUp ? -10000 : 0) + (avoid ? 3000 : 0);
}

export function renumberAssignments(assignments) {
  const grouped = new Map(); assignments.forEach((assignment) => { const key = `${assignment.date}|${assignment.truckId}`; grouped.set(key, [...(grouped.get(key) || []), assignment]); });
  return [...grouped.values()].flatMap((items) => items.sort((a, b) => a.tripNumber - b.tripNumber || String(a.createdAt).localeCompare(String(b.createdAt))).map((item, index) => ({ ...item, tripNumber: index + 1 })));
}
function jobsForDate(state, date, lockedAssignments, filter = () => true) {
  const lockedByOrder = new Map(); lockedAssignments.forEach((item) => lockedByOrder.set(item.orderId, (lockedByOrder.get(item.orderId) || 0) + 1));
  return state.orders.filter((order) => order.date === date && number(order.loads) > 0 && filter(order)).flatMap((order) => Array.from({ length: Math.max(0, number(order.loads) - (lockedByOrder.get(order.id) || 0)) }, (_, index) => ({ ...order, loadIndex: index + 1 })));
}
function assignmentFromJob(job, truckId) { return { id: uid("assignment"), date: job.date, truckId, orderId: job.id, customerId: job.customerId, zone: job.zone, kind: job.kind, source: job.source, sourceId: job.sourceId, materialId: job.materialId, product: job.product, productLabel: job.productLabel, notes: job.notes, early: Boolean(job.early), status: "Planned", tripNumber: 0, createdAt: new Date().toISOString() }; }
function patternFits(truck, pattern) { return profileFits(truck, { total: pattern.near + pattern.far + pattern.stone, ...pattern }); }

export function sandpitPermitPlan(state, date) {
  const sandOrders = state.orders.filter((item) => item.date === date && sourceTypeFor(state, item) === "Sandpit");
  const nearLoads = sandOrders.filter((item) => zoneKey(item.zone) === "near").reduce((sum, item) => sum + number(item.loads), 0);
  const farLoads = sandOrders.filter((item) => zoneKey(item.zone) === "far").reduce((sum, item) => sum + number(item.loads), 0);
  const farGroups = farLoads; const nearGroups = Math.ceil(Math.max(0, nearLoads - farGroups * 2) / 4);
  const groups = [...Array.from({ length: farGroups }, () => ({ near: 2, far: 1, stone: 0, label: "2 Near + 1 Far" })), ...Array.from({ length: nearGroups }, () => ({ near: 4, far: 0, stone: 0, label: "4 Near" }))];
  const targetNearLoads = farGroups * 2 + nearGroups * 4;
  const eligibleTrucks = state.trucks.filter((truck) => isDispatchable(truck) && normalise(truck.status) !== "quarry only" && groups.some((group) => patternFits(truck, group)));
  const workingTrucks = state.trucks.filter(isDispatchable);
  const markedQuarryOnly = workingTrucks.filter((truck) => normalise(truck.status) === "quarry only").length;
  const suggestedQuarryOnlyCount = Math.max(0, workingTrucks.length - groups.length);
  const recommendedQuarryOnlyTruckIds = workingTrucks.filter((truck) => normalise(truck.status) !== "scheduled repair").sort((left, right) => previousSourceWork(state, left.id, date, "Quarry") - previousSourceWork(state, right.id, date, "Quarry") || previousSourceWork(state, right.id, date, "Sandpit") - previousSourceWork(state, left.id, date, "Sandpit") || truckLabel(left).localeCompare(truckLabel(right))).slice(0, suggestedQuarryOnlyCount).map((truck) => truck.id);
  return { nearLoads, farLoads, targetNearLoads, extraNearLoads: Math.max(0, targetNearLoads - nearLoads), groups, groupCount: groups.length, eligibleTruckCount: eligibleTrucks.length, workingTruckCount: workingTrucks.length, markedQuarryOnly, suggestedQuarryOnlyCount, recommendedQuarryOnlyTruckIds };
}
function buildSandpitPermitAssignments(state, date, lockedAssignments) {
  const plan = sandpitPermitPlan(state, date); const jobs = jobsForDate(state, date, lockedAssignments, (item) => sourceTypeFor(state, item) === "Sandpit" && ["near", "far"].includes(zoneKey(item.zone))); const hasEarly = jobs.some((item) => item.early);
  const eligible = state.trucks.filter((truck) => isDispatchable(truck) && normalise(truck.status) !== "quarry only" && (!hasEarly || !(normalise(truck.status) === "scheduled repair" && truck.earlyRepair)));
  const groups = []; const warnings = [];
  for (const pattern of plan.groups) {
    const candidates = eligible.filter((truck) => !groups.some((group) => group.truck.id === truck.id) && patternFits(truck, pattern));
    if (!candidates.length) { warnings.push(`No separate truck can cover the ideal sandpit permit group: ${pattern.label}`); continue; }
    const truck = candidates.map((item) => ({ item, score: previousSourceWork(state, item.id, date, "Sandpit") * 100 + previousCounts(state, item.id, date).total * 5 })).sort((a, b) => a.score - b.score || truckLabel(a.item).localeCompare(truckLabel(b.item)))[0].item;
    groups.push({ truck, remaining: { near: pattern.near, far: pattern.far, stone: 0 } });
  }
  const assignments = [];
  const priority = (job) => job.early ? 0 : zoneKey(job.zone) === "far" ? 1 : 2;
  jobs.sort((a, b) => priority(a) - priority(b) || a.customerId.localeCompare(b.customerId));
  for (const job of jobs) {
    const zone = zoneKey(job.zone); const candidates = groups.filter((group) => group.remaining[zone] > 0 && !(job.early && normalise(group.truck.status) === "scheduled repair" && group.truck.earlyRepair));
    if (!candidates.length) { warnings.push("Some sand orders need to use remaining compatible capacity instead of an ideal permit group."); continue; }
    const group = candidates.sort((a, b) => (b.remaining[zone] - a.remaining[zone]) || previousSourceWork(state, a.truck.id, date, "Sandpit") - previousSourceWork(state, b.truck.id, date, "Sandpit"))[0];
    group.remaining[zone] -= 1; assignments.push(assignmentFromJob(job, group.truck.id));
  }
  return { assignments, permitTruckIds: new Set(groups.map((group) => group.truck.id)), warnings: [...new Set(warnings)], plan };
}

export function buildDispatch(state, date, lockedAssignments = [], options = {}) {
  const jobs = jobsForDate(state, date, lockedAssignments);
  const priority = (job) => job.early ? 0 : zoneKey(job.zone) === "far" ? 1 : zoneKey(job.zone) === "stone" ? 2 : 3; jobs.sort((a, b) => priority(a) - priority(b) || a.customerId.localeCompare(b.customerId));
  const trucks = state.trucks.filter(isDispatchable); const created = [...lockedAssignments]; const unresolved = [];
  for (const job of jobs) {
    const zone = zoneKey(job.zone); const sourceType = sourceTypeFor(state, job); let candidates = trucks.filter((truck) => { if (sourceType === "Sandpit" && normalise(truck.status) === "quarry only") return false; if (sourceType === "Sandpit" && options.permitTruckIds?.size && !options.permitTruckIds.has(truck.id)) return false; if (job.early && normalise(truck.status) === "scheduled repair" && truck.earlyRepair) return false; const counts = dayCounts(created, truck.id); const next = { ...counts, total: counts.total + 1, [zone]: counts[zone] + 1 }; return profileFits(truck, next); });
    if (sourceType === "Quarry") { const quarryOnly = candidates.filter((truck) => normalise(truck.status) === "quarry only"); if (quarryOnly.length) candidates = quarryOnly; }
    if ((zone === "far" || zone === "stone")) { const unusedForLongWork = candidates.filter((truck) => { const counts = dayCounts(created, truck.id); return counts.far + counts.stone === 0; }); if (unusedForLongWork.length) candidates = unusedForLongWork; }
    if (!candidates.length) { unresolved.push({ ...job, reason: `No available truck capability for ${job.zone}` }); continue; }
    const winner = candidates.map((truck) => ({ truck, score: candidateScore(state, truck, dayCounts(created, truck.id), job, date) })).sort((a, b) => a.score - b.score || truckLabel(a.truck).localeCompare(truckLabel(b.truck)))[0].truck;
    created.push(assignmentFromJob(job, winner.id));
  }
  const numbered = renumberAssignments(created.sort((a, b) => a.truckId.localeCompare(b.truckId) || Number(b.early) - Number(a.early) || a.tripNumber - b.tripNumber));
  const makeUps = state.makeUps.map((item) => item.status !== "Pending" ? item : (numbered.some((assignment) => assignment.truckId === item.truckId && assignment.customerId === item.customerId) ? { ...item, status: "Scheduled", scheduledFor: date } : item));
  return { assignments: numbered, unresolved, makeUps };
}
export function applyDispatch(state, date) {
  const locked = state.assignments.filter((item) => item.date === date && (item.status !== "Planned" || state.tripLogs.some((log) => log.assignmentId === item.id))); const permits = buildSandpitPermitAssignments(state, date, locked); const result = buildDispatch(state, date, [...locked, ...permits.assignments], { permitTruckIds: permits.permitTruckIds });
  return { ...state, assignments: [...state.assignments.filter((item) => item.date !== date), ...result.assignments], makeUps: result.makeUps, lastAllocation: { date, unresolved: result.unresolved, permitPlan: permits.plan, permitWarnings: permits.warnings, createdAt: new Date().toISOString() }, updatedAt: new Date().toISOString() };
}
export function assignmentSummary(state, assignment) { return { customerName: state.customers.find((item) => item.id === assignment.customerId)?.name || "Unknown customer", truckNo: truckLabel(state.trucks.find((item) => item.id === assignment.truckId)) }; }
export function recordActualTrip(state, assignmentId, { actualCustomerId, status, remark }) {
  const assignment = state.assignments.find((item) => item.id === assignmentId); if (!assignment) return state; const actual = actualCustomerId || assignment.customerId; const changed = actual !== assignment.customerId || status !== "Completed"; const existing = state.tripLogs.find((item) => item.assignmentId === assignmentId);
  const log = { id: existing?.id || uid("log"), assignmentId, date: assignment.date, truckId: assignment.truckId, plannedCustomerId: assignment.customerId, actualCustomerId: actual, status, remark: remark || "", recordedAt: existing?.recordedAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const makeUps = state.makeUps.filter((item) => item.assignmentId !== assignmentId); if (changed) makeUps.push({ id: uid("recovery"), assignmentId, truckId: assignment.truckId, customerId: assignment.customerId, avoidCustomerId: actual !== assignment.customerId ? actual : "", status: "Pending", reason: status === "Completed" ? "Delivered a different customer" : status, createdAt: new Date().toISOString() });
  return { ...state, assignments: state.assignments.map((item) => item.id === assignmentId ? { ...item, status, updatedAt: new Date().toISOString() } : item), tripLogs: [...state.tripLogs.filter((item) => item.assignmentId !== assignmentId), log], makeUps, updatedAt: new Date().toISOString() };
}
export function recordQuarryTripLog(state, { date, truckId, loads, remark }) {
  const existing = (state.quarryTripLogs || []).find((item) => item.date === date && item.truckId === truckId); const cleanLoads = number(loads); const cleanRemark = remark || "";
  if (!cleanLoads && !cleanRemark) return { ...state, quarryTripLogs: (state.quarryTripLogs || []).filter((item) => !(item.date === date && item.truckId === truckId)) };
  const log = { id: existing?.id || uid("quarry-log"), date, truckId, loads: cleanLoads, remark: cleanRemark, updatedAt: new Date().toISOString() };
  return { ...state, quarryTripLogs: [...(state.quarryTripLogs || []).filter((item) => !(item.date === date && item.truckId === truckId)), log] };
}
export function tallyForDate(state, date) {
  const lines = new Map(); state.orders.filter((item) => item.date === date).forEach((item) => { const line = lines.get(item.customerId) || { customerId: item.customerId, required: 0, planned: 0 }; line.required += number(item.loads); lines.set(item.customerId, line); }); state.assignments.filter((item) => item.date === date && item.status !== "Skipped").forEach((item) => { const line = lines.get(item.customerId) || { customerId: item.customerId, required: 0, planned: 0 }; line.planned += 1; lines.set(item.customerId, line); });
  return [...lines.values()].map((line) => ({ ...line, customerName: state.customers.find((item) => item.id === line.customerId)?.name || "Unknown customer", balance: line.planned - line.required })).sort((a, b) => a.customerName.localeCompare(b.customerName));
}
function truckCounts(items, label) { const counts = new Map(); items.forEach((item) => { const key = label(item); counts.set(key, (counts.get(key) || 0) + 1); }); return [...counts.entries()].map(([name, count]) => count > 1 ? `${name}*${count}` : name).join("/") || "-"; }
export function makeWhatsAppMessage(state, date) {
  const assignments = state.assignments.filter((item) => item.date === date).sort((a, b) => a.tripNumber - b.tripNumber); const truckNo = (item) => assignmentSummary(state, item).truckNo; const customerName = (item) => assignmentSummary(state, item).customerName;
  const sand = assignments.filter((item) => normalise(item.kind) === "sand"); const stone = assignments.filter((item) => normalise(item.kind) === "stone");
  const sandSources = state.sources.filter((source) => source.type === "Sandpit").map((source) => ({ source, items: sand.filter((item) => item.sourceId === source.id || item.source === source.name) })).filter((group) => group.items.length).map((group) => `Masuk Lombong ${group.source.name}: ${truckCounts(group.items, truckNo)}`);
  const groupedLines = (items, type) => { const groups = new Map(); items.forEach((item) => { const key = `${item.customerId}|${item.materialId}|${item.notes || ""}`; groups.set(key, [...(groups.get(key) || []), item]); }); return [...groups.values()].map((group) => { const sample = group[0]; const material = materialById(state, sample.materialId); if (type === "sand") { const spec = material ? `${material.name} ${sourceShort(sourceById(state, material.sourceId)?.name)}` : sample.productLabel || sample.product; return `${customerName(sample)}:\n${spec} - ${group.length} (${truckCounts(group, truckNo)})${sample.notes ? `\n**${sample.notes}` : ""}`; } const source = sourceById(state, material?.sourceId || sample.sourceId)?.name || sample.source || "Quarry"; return `${source} ke ${customerName(sample)}:\n${material?.name || sample.product || sample.productLabel} - ${group.length} (${truckCounts(group, truckNo)})${sample.notes ? `\n**${sample.notes}` : ""}`; }); };
  const notices = (state.notices || []).filter(Boolean).map((item) => `**${item}`).join("\n");
  const quarryOnly = state.trucks.filter((truck) => normalise(truck.status) === "quarry only").map(truckLabel).join("/");
  return ["Esok order pasir", "", sandSources.join("\n"), sandSources.length ? "" : "", groupedLines(sand, "sand").join("\n\n") || "- Tiada order pasir", "", "---------------------------------------------------", "", "Esok order batu", "", groupedLines(stone, "stone").join("\n\n") || "- Tiada order batu", quarryOnly ? `\nEsok masuk quarry sahaja: ${quarryOnly}` : "", "", "Kalau siap order pasir, boleh masuk ambil order quarry yang diberi.", notices ? `\nPeringatan semua driver:\n${notices}` : ""].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
export function loadScore(state, truckId, date) { const historical = previousCounts(state, truckId, date); const planned = dayCounts(state.assignments.filter((item) => item.date === date), truckId); return { historical: historical.total, planned: planned.total, far: historical.far, stone: historical.stone, quarry: previousSourceWork(state, truckId, date, "Quarry"), total: historical.total + planned.total }; }
