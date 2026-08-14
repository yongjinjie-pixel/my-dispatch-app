export const todayISO = () => new Date().toISOString().slice(0, 10);
export const tomorrowISO = () => { const date = new Date(); date.setDate(date.getDate() + 1); return date.toISOString().slice(0, 10); };
export const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const normalise = (value) => String(value || "").trim().toLowerCase();

const number = (value) => Math.max(0, Number(value) || 0);
const textList = (value) => [...new Map((Array.isArray(value) ? value : String(value || "").split(/[\n,;]+/)).map((item) => String(item || "").trim()).filter(Boolean).map((item) => [normalise(item), item])).values()];
const sourceSeed = [
  ["src-ml", "MingLiong Mados", "Sandpit"], ["src-gsl", "GuanSengLee", "Sandpit"], ["src-gd", "GD Linggiu", "Sandpit"],
  ["src-kl", "KL Building", "Quarry"], ["src-bj", "BJ", "Quarry"], ["src-qcp", "QCP Manufacturing Kg Sawah", "Supplier"],
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
// The first Smart Fleet upgrade treated a Far trip as merely one of five
// interchangeable slots.  That is not how the sand routes work: a Far route
// consumes enough time that the normal full-day pattern is 3 Near + 1 Far.
// Keep the earlier converter only to recognise and safely correct generated
// v7 profiles during the v8 migration below.
function legacyProfilesV7(truck) {
  const daily = number(truck.dailyMax || 3); const far = number(truck.farMax); const stone = number(truck.stoneMax);
  const profiles = [{ id: "cap-near", near: daily, far: 0, stone: 0 }];
  if (far) profiles.push({ id: "cap-far", near: Math.max(0, daily - far), far, stone: 0 });
  if (stone) profiles.push({ id: "cap-stone", near: Math.max(0, daily - stone), far: 0, stone });
  if (far && stone && far + stone <= daily) profiles.push({ id: "cap-mixed", near: Math.max(0, daily - far - stone), far, stone });
  return normaliseProfiles(profiles);
}
function legacyProfiles(truck) {
  const daily = number(truck.dailyMax || 3); const far = number(truck.farMax); const stone = number(truck.stoneMax);
  const profiles = [{ id: "cap-near", near: daily, far: 0, stone: 0 }];
  // A Far route is deliberately capped at 3 Near + Far, even when a truck can
  // make five Near loads.  With a Stone route on top, 3 Near + Far + Stone is
  // the normal five-load combination.
  if (far) profiles.push({ id: "cap-far", near: Math.min(3, Math.max(0, daily - far)), far, stone: 0 });
  if (stone) profiles.push({ id: "cap-stone", near: Math.max(0, daily - stone), far: 0, stone });
  if (far && stone && far + stone <= daily) profiles.push({ id: "cap-mixed", near: Math.min(3, Math.max(0, daily - far - stone)), far, stone });
  return normaliseProfiles(profiles);
}
function profilesMatch(left, right) {
  const keys = (items) => normaliseProfiles(items).map(profileKey).sort().join(",");
  return keys(left) === keys(right);
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
export function comfortableTruckTrips(truck) {
  const maximum = maximumTruckTrips(truck);
  // Newer five-load trucks normally work four loads. Older four-load trucks
  // normally work three; the dispatcher may still use their saved maximum when
  // demand is genuinely high.
  const fallback = maximum >= 5 ? 4 : Math.min(3, maximum);
  return Math.min(maximum, Math.max(1, number(truck?.comfortableLoads) || fallback));
}
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
  return rules.length ? rules.map((rule) => {
    const sourceIds = state.materials
      .filter((material) => normalise(material.name) === normalise(rule.materialName) && (rule.sourceMode === "Any" || (rule.sourceIds || []).includes(material.sourceId)))
      .map((material) => material.sourceId);
    const sources = [...new Set(sourceIds)].map((id) => sourceShort(sourceById(state, id)?.name)).filter(Boolean).join("/");
    return `${rule.materialName} (${sources || (rule.sourceMode === "Any" ? "any saved source" : "choose source")})`;
  }).join("; ") : "No material rule";
}
export function makeOrderFromMaterial(order, state) {
  const target = state.customers.find((item) => item.id === order.customerId); const materialId = order.materialId || defaultCustomerMaterialId(state, target); const details = materialFields(state, materialId);
  return { ...order, ...details, kind: target?.kind || order.kind || materialById(state, materialId)?.kind || "Sand", zone: order.zone || target?.defaultZone || materialById(state, materialId)?.defaultZone || "Near", updatedAt: new Date().toISOString() };
}

function customerSeed(materials) {
  const rules = (name, kind, defaultZone, materialRules, notes = "") => ({ id: `customer-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`, name, kind, defaultZone, materialRules: materialRules.map((rule, index) => ({ id: `rule-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${index + 1}`, ...rule })), marginPerLoad: 0, notes, updatedAt: new Date().toISOString() });
  const customers = [
    rules("Durable Kempas", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Durable Senai", "Sand", "Near", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Durable Ulu Choh", "Sand", "Far", [{ materialName: "1x cuci", sourceMode: "Any", sourceIds: [] }]),
    rules("Top Mix JB City", "Sand", "Near", [{ materialName: "2x cuci", sourceMode: "Specific", sourceIds: ["src-gsl"] }], "Hantar Palong C GuanSengLee sahaja!"),
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
function sourcePermitDefaults(source) {
  if (source.type !== "Sandpit") return { permitScheme: "None", permitCostPerDay: 0 };
  const name = normalise(source.name);
  if (name.includes("ming")) return { permitScheme: "Daily", permitCostPerDay: 130 };
  if (name.includes("guan") || name.includes("linggiu") || name === "gd") return { permitScheme: "Period", permitCostPerDay: 0 };
  return { permitScheme: "Daily", permitCostPerDay: 0 };
}

export function defaultState() {
  const date = tomorrowISO(); const now = new Date().toISOString();
  const sources = sourceSeed.map(([id, name, type]) => ({ id, name, type, notes: "", weighbridgeContact: "", quarryNote: "", quarryCustomers: [], ...sourcePermitDefaults({ name, type }), updatedAt: now }));
  const materials = materialSeed.map(([id, sourceId, name, kind, defaultZone]) => ({ id, sourceId, name, kind, defaultZone, notes: "", updatedAt: now }));
  const trucks = truckSeed.map(([plate, prefix, status, daily, near, far, stone]) => ({ id: `truck-${plate}`, prefix, number: plate, status, capabilities: capabilitiesFromLegacy(daily, near, far, stone), comfortableLoads: daily >= 5 ? 4 : Math.min(3, daily), repairCapacity: { near: 0, far: 0, stone: 0 }, repairTime: "Morning", earlyRepair: false, dailyMax: daily, nearMax: near, farMax: far, stoneMax: stone, notes: "", updatedAt: now }));
  const customers = customerSeed(materials);
  const byName = new Map(customers.map((item) => [item.name, item]));
  const orderRows = [["Durable Kempas", 8], ["Durable Senai", 8], ["Top Mix JB City", 4], ["Top Mix Kota Puteri", 3], ["Zhin Heng Saleng", 2, "", true], ["IPS Precast", 2], ["Infraway Kong Kong", 2]];
  const orders = orderRows.map(([name, loads, notes = "", early = false]) => { const target = byName.get(name); return makeOrderFromMaterial({ id: uid("order"), date, customerId: target.id, loads, zone: target.defaultZone, kind: target.kind, materialId: defaultCustomerMaterialId({ sources, materials, customers }, target), early, notes }, { sources, materials, customers }); });
  return { schemaVersion: 17, companyName: "My Transport Dispatch", notices: ["Operasi JPJ: check documents, tyre condition and load cover before moving."], trucks, sources, materials, customers, orders, assignments: [], tripLogs: [], extraTripLogs: [], quarryTripLogs: [], quarryEnquiries: [], quarryRequests: [], quarryOnlyEntries: [], sandpitEntries: [], sandpitPermits: [], dailyFleetPlans: [], dailyTruckStatuses: [], messageRemarks: [], driverAbsences: [], planLocks: [], makeUps: [], settings: { storageMode: "phone-only", lastBackupAt: "", lastBackupDate: "", sandpitPermitCost: 0, themePreference: "system", screenOrientation: "auto" }, updatedAt: now };
}

export function ensureState(raw) {
  const seed = defaultState(); if (!raw || !Array.isArray(raw.trucks)) return seed;
  const state = {
    ...seed, ...raw, settings: { ...seed.settings, ...(raw.settings || {}), lastBackupAt: raw.settings?.lastBackupAt || "", lastBackupDate: raw.settings?.lastBackupDate || "", sandpitPermitCost: number(raw.settings?.sandpitPermitCost), screenOrientation: Number(raw.schemaVersion || 0) < 11 ? "auto" : (raw.settings?.screenOrientation || "auto") }, notices: Array.isArray(raw.notices) ? raw.notices : seed.notices,
    sources: Array.isArray(raw.sources) && raw.sources.length ? raw.sources : seed.sources, materials: Array.isArray(raw.materials) && raw.materials.length ? raw.materials : seed.materials,
    customers: Array.isArray(raw.customers) ? raw.customers : seed.customers, orders: Array.isArray(raw.orders) ? raw.orders : [], assignments: Array.isArray(raw.assignments) ? raw.assignments : [], tripLogs: Array.isArray(raw.tripLogs) ? raw.tripLogs : [], extraTripLogs: Array.isArray(raw.extraTripLogs) ? raw.extraTripLogs : [], quarryTripLogs: Array.isArray(raw.quarryTripLogs) ? raw.quarryTripLogs : [], quarryEnquiries: Array.isArray(raw.quarryEnquiries) ? raw.quarryEnquiries : [], quarryRequests: Array.isArray(raw.quarryRequests) ? raw.quarryRequests : [], quarryOnlyEntries: Array.isArray(raw.quarryOnlyEntries) ? raw.quarryOnlyEntries : [], sandpitEntries: Array.isArray(raw.sandpitEntries) ? raw.sandpitEntries : [], sandpitPermits: Array.isArray(raw.sandpitPermits) ? raw.sandpitPermits : [], dailyFleetPlans: Array.isArray(raw.dailyFleetPlans) ? raw.dailyFleetPlans : [], dailyTruckStatuses: Array.isArray(raw.dailyTruckStatuses) ? raw.dailyTruckStatuses : [], messageRemarks: Array.isArray(raw.messageRemarks) ? raw.messageRemarks : [], driverAbsences: Array.isArray(raw.driverAbsences) ? raw.driverAbsences : [], planLocks: Array.isArray(raw.planLocks) ? raw.planLocks : [], makeUps: Array.isArray(raw.makeUps) ? raw.makeUps : [],
  };
  state.sources = state.sources.map((source) => { const type = source.id === "src-qcp" || normalise(source.name).includes("qcp") ? "Supplier" : (source.type || "Sandpit"); const normalisedSource = { ...source, type }; const defaults = sourcePermitDefaults(normalisedSource); return { ...normalisedSource, weighbridgeContact: source.weighbridgeContact || source.timbangContact || "", quarryNote: source.quarryNote || "", quarryCustomers: textList(source.quarryCustomers || source.quarryCustomerList), ...defaults, permitScheme: type === "Sandpit" ? (source.permitScheme || defaults.permitScheme) : "None", permitCostPerDay: type === "Sandpit" ? (source.permitCostPerDay === undefined ? defaults.permitCostPerDay : number(source.permitCostPerDay)) : 0 }; });
  state.trucks = raw.trucks.map((truck) => {
    const oldGeneratedProfiles = legacyProfilesV7(truck); const shouldCorrectGeneratedV7Profiles = Number(raw.schemaVersion || 0) < 8 && Array.isArray(truck.capabilities) && profilesMatch(truck.capabilities, oldGeneratedProfiles);
    const capabilities = shouldCorrectGeneratedV7Profiles ? legacyProfiles(truck) : normaliseProfiles(truck.capabilities, legacyProfiles(truck)); const repairCapacity = { near: number(truck.repairCapacity?.near), far: number(truck.repairCapacity?.far), stone: number(truck.repairCapacity?.stone) };
    const active = normalise(truck.status) === "scheduled repair" && profileTotal(repairCapacity) ? [{ ...repairCapacity, id: "repair" }] : normalise(truck.status) === "scheduled repair" ? [] : capabilities;
    const maximum = Math.max(0, ...active.map(profileTotal)); const fallbackComfort = maximum >= 5 ? 4 : Math.min(3, maximum);
    return { ...truck, prefix: truck.prefix || "", number: truck.number || truck.registration || "", status: truck.status || "Available", statusReason: truck.statusReason || "", capabilityModel: "sand-v2", capabilities, comfortableLoads: Math.min(maximum || 1, Math.max(1, number(truck.comfortableLoads) || fallbackComfort)), repairCapacity, repairTime: truck.repairTime === "Afternoon" ? "Afternoon" : "Morning", earlyRepair: Boolean(truck.earlyRepair), dailyMax: maximum, nearMax: Math.max(0, ...active.map((profile) => profile.near)), farMax: Math.max(0, ...active.map((profile) => profile.far)), stoneMax: Math.max(0, ...active.map((profile) => profile.stone)), notes: truck.notes || "", updatedAt: truck.updatedAt || new Date().toISOString() };
  });
  state.dailyFleetPlans = state.dailyFleetPlans.filter((plan) => plan?.date && state.trucks.some((truck) => truck.id === plan.truckId)).map((plan) => ({ id: plan.id || uid("daily-fleet-plan"), date: plan.date, truckId: plan.truckId, near: number(plan.near), far: number(plan.far), stone: number(plan.stone), updatedAt: plan.updatedAt || new Date().toISOString() }));
  state.dailyTruckStatuses = state.dailyTruckStatuses.filter((entry) => entry?.date && state.trucks.some((truck) => truck.id === entry.truckId)).map((entry) => ({ id: entry.id || uid("daily-truck-status"), date: entry.date, truckId: entry.truckId, status: ["Available", "Quarry Only", "Off", "Breakdown", "Scheduled Repair"].includes(entry.status) ? entry.status : "Available", statusReason: entry.statusReason || "", repairTime: entry.repairTime === "Afternoon" ? "Afternoon" : "Morning", earlyRepair: Boolean(entry.earlyRepair), updatedAt: entry.updatedAt || new Date().toISOString() }));
  state.sandpitEntries = state.sandpitEntries.filter((entry) => entry?.date && state.trucks.some((truck) => truck.id === entry.truckId) && sourceById(state, entry.sourceId)?.type === "Sandpit").map((entry) => ({ id: entry.id || uid("sandpit-entry"), date: entry.date, truckId: entry.truckId, sourceId: entry.sourceId, updatedAt: entry.updatedAt || new Date().toISOString() }));
  state.quarryTripLogs = state.quarryTripLogs.filter((entry) => entry?.date && state.trucks.some((truck) => truck.id === entry.truckId)).map((entry) => ({ id: entry.id || uid("quarry-log"), date: entry.date, truckId: entry.truckId, sourceId: sourceById(state, entry.sourceId)?.type === "Quarry" ? entry.sourceId : "", materialId: materialById(state, entry.materialId)?.sourceId === entry.sourceId ? entry.materialId : "", customerName: entry.customerName || entry.destination || "", loads: number(entry.loads), remark: entry.remark || "", updatedAt: entry.updatedAt || new Date().toISOString() }));
  const findLegacyMaterial = (candidate, fallback = []) => {
    const supplied = normalise(candidate?.source || candidate?.supplier); const product = normalise(candidate?.product || candidate?.productLabel);
    return state.materials.find((material) => { const source = sourceById(state, material.sourceId); return (!supplied || normalise(source?.name).includes(supplied) || supplied.includes(normalise(source?.name))) && (!product || normalise(material.name) === product || normalise(candidate?.productLabel).includes(normalise(material.name))); })?.id || fallback[0] || "";
  };
  state.customers = state.customers.map((customer) => {
    let materialIds = Array.isArray(customer.materialIds) ? customer.materialIds.filter((id) => materialById(state, id)) : [];
    if (!materialIds.length && Array.isArray(customer.accepted)) materialIds = customer.accepted.map((item) => findLegacyMaterial(item)).filter(Boolean);
    const materialRules = Array.isArray(customer.materialRules) && customer.materialRules.length ? customer.materialRules.map((rule, index) => ({ id: rule.id || `${customer.id}-rule-${index + 1}`, materialName: rule.materialName || "", sourceMode: rule.sourceMode === "Any" ? "Any" : "Specific", sourceIds: Array.isArray(rule.sourceIds) ? rule.sourceIds.filter((id) => sourceById(state, id)) : [] })).filter((rule) => rule.materialName) : materialIds.reduce((rules, materialId) => { const material = materialById(state, materialId); if (!material) return rules; const existing = rules.find((rule) => normalise(rule.materialName) === normalise(material.name)); if (existing) existing.sourceIds.push(material.sourceId); else rules.push({ id: `${customer.id}-rule-${rules.length + 1}`, materialName: material.name, sourceMode: "Specific", sourceIds: [material.sourceId] }); return rules; }, []);
    const normalized = { ...customer, kind: customer.kind || "Sand", defaultZone: customer.defaultZone || "Near", materialRules: materialRules.map((rule) => ({ ...rule, sourceIds: [...new Set(rule.sourceIds)] })), marginPerLoad: number(customer.marginPerLoad), notes: customer.notes || "" };
    return { ...normalized, materialIds: customerAllowedMaterialIds(state, normalized) };
  });
  const orderSequenceByDate = new Map();
  state.orders = state.orders.map((order) => {
    const target = state.customers.find((item) => item.id === order.customerId);
    const allowed = customerAllowedMaterialIds(state, target); const savedMaterialId = order.materialId || findLegacyMaterial(order, target?.materialIds); const materialOverride = typeof order.materialOverride === "boolean" ? order.materialOverride : Boolean(savedMaterialId && savedMaterialId !== defaultCustomerMaterialId(state, target)); const materialId = materialOverride && allowed.includes(savedMaterialId) ? savedMaterialId : defaultCustomerMaterialId(state, target);
    const nextSequence = (orderSequenceByDate.get(order.date) || 0) + 1; orderSequenceByDate.set(order.date, nextSequence);
    return makeOrderFromMaterial({ ...order, sequence: number(order.sequence) || nextSequence, materialId, materialOverride, deliveryWindow: order.deliveryWindow || "" }, state);
  });
  state.assignments = state.assignments.map((assignment) => { const target = state.customers.find((item) => item.id === assignment.customerId); const linkedOrder = state.orders.find((order) => order.id === assignment.orderId); const preserveActualHistory = !["planned", ""].includes(normalise(assignment.status)); const materialId = linkedOrder && !linkedOrder.materialOverride && !preserveActualHistory ? linkedOrder.materialId : (assignment.materialId || findLegacyMaterial(assignment, target?.materialIds)); return makeOrderFromMaterial({ ...assignment, materialId }, state); });
  state.tripLogs = state.tripLogs.map((log) => {
    const assignment = state.assignments.find((item) => item.id === log.assignmentId); const actualCustomerId = state.customers.some((item) => item.id === log.actualCustomerId) ? log.actualCustomerId : (assignment?.customerId || log.plannedCustomerId || "");
    const actualCustomer = state.customers.find((item) => item.id === actualCustomerId); const allowed = actualCustomer ? customerAllowedMaterialIds(state, actualCustomer) : [];
    const actualMaterialId = allowed.includes(log.actualMaterialId) ? log.actualMaterialId : (allowed.includes(assignment?.materialId) ? assignment.materialId : defaultCustomerMaterialId(state, actualCustomer));
    return { ...log, actualCustomerId, actualMaterialId, updatedAt: log.updatedAt || log.recordedAt || new Date().toISOString() };
  });
  state.extraTripLogs = state.extraTripLogs.filter((entry) => entry?.date && state.trucks.some((truck) => truck.id === entry.truckId) && state.customers.some((customer) => customer.id === entry.customerId)).map((entry) => {
    const target = state.customers.find((customer) => customer.id === entry.customerId); const allowed = customerAllowedMaterialIds(state, target); const materialId = allowed.includes(entry.materialId) ? entry.materialId : defaultCustomerMaterialId(state, target);
    return { id: entry.id || uid("extra-log"), date: entry.date, truckId: entry.truckId, customerId: entry.customerId, materialId, loads: number(entry.loads) || 1, remark: entry.remark || "", updatedAt: entry.updatedAt || new Date().toISOString() };
  });
  const quarryEnquirySequenceByDate = new Map();
  state.quarryEnquiries = state.quarryEnquiries.filter((item) => item?.date && sourceById(state, item.sourceId)?.type === "Quarry").map((item) => { const nextSequence = (quarryEnquirySequenceByDate.get(item.date) || 0) + 1; quarryEnquirySequenceByDate.set(item.date, nextSequence); return { id: item.id || uid("quarry-enquiry"), date: item.date, sourceId: item.sourceId, sequence: number(item.sequence) || nextSequence, updatedAt: item.updatedAt || new Date().toISOString() }; });
  const quarryRequestSequenceByDate = new Map();
  state.quarryRequests = state.quarryRequests.filter((item) => item?.date && sourceById(state, item.sourceId)?.type === "Quarry").map((item) => { const nextSequence = (quarryRequestSequenceByDate.get(item.date) || 0) + 1; quarryRequestSequenceByDate.set(item.date, nextSequence); return { id: item.id || uid("quarry-request"), date: item.date, sourceId: item.sourceId, trucksNeeded: Math.max(1, number(item.trucksNeeded || item.loads) || 1), notes: item.notes || "", sequence: number(item.sequence) || nextSequence, updatedAt: item.updatedAt || new Date().toISOString() }; });
  state.quarryOnlyEntries = state.quarryOnlyEntries.filter((item) => item?.date && state.trucks.some((truck) => truck.id === item.truckId)).map((item) => ({ id: item.id || uid("quarry-only"), date: item.date, truckId: item.truckId, updatedAt: item.updatedAt || new Date().toISOString() }));
  state.sandpitPermits = state.sandpitPermits.filter((item) => item?.truckId && item?.sourceId && state.trucks.some((truck) => truck.id === item.truckId) && sourceById(state, item.sourceId)?.type === "Sandpit").map((item) => ({ id: item.id || uid("sandpit-permit"), truckId: item.truckId, sourceId: item.sourceId, startDate: item.startDate || todayISO(), durationDays: Math.max(1, number(item.durationDays) || 7), pricePerDay: number(item.pricePerDay ?? sourceById(state, item.sourceId)?.permitCostPerDay), updatedAt: item.updatedAt || new Date().toISOString() }));
  state.messageRemarks = state.messageRemarks.filter((item) => item?.date).map((item) => ({ id: item.id || uid("message-remark"), date: item.date, sand: item.sand || "", jagung: item.jagung || "", stone: item.stone || "", updatedAt: item.updatedAt || new Date().toISOString() }));
  state.driverAbsences = state.driverAbsences.filter((item) => item?.date && state.trucks.some((truck) => truck.id === item.truckId)).map((item) => ({ id: item.id || uid("driver-absence"), date: item.date, truckId: item.truckId, remark: item.remark || "", updatedAt: item.updatedAt || new Date().toISOString() }));
  state.planLocks = state.planLocks.filter((item) => item?.date).map((item) => ({ id: item.id || uid("plan-lock"), date: item.date, lockedAt: item.lockedAt || item.updatedAt || new Date().toISOString() }));
  state.schemaVersion = 17; return state;
}

function dayCounts(assignments, truckId) { const counts = { total: 0, near: 0, far: 0, stone: 0 }; assignments.filter((item) => item.truckId === truckId).forEach((item) => { counts.total += 1; if (normalise(item.kind) !== "quarry") counts[zoneKey(item.zone)] += 1; }); return counts; }
function profileFits(truck, counts) { return activeProfiles(truck).some((profile) => counts.near <= profile.near && counts.far <= profile.far && counts.stone <= profile.stone && counts.total <= profileTotal(profile)); }
function previousCounts(state, truckId, date) {
  const from = new Date(`${date}T00:00:00`); from.setDate(from.getDate() - 30); const counts = { total: 0, near: 0, far: 0, stone: 0 };
  state.assignments.filter((item) => item.truckId === truckId && item.date < date && item.status !== "Skipped" && new Date(`${item.date}T00:00:00`) >= from).forEach((item) => { counts.total += 1; counts[zoneKey(item.zone)] += 1; });
  (state.extraTripLogs || []).filter((item) => item.truckId === truckId && item.date < date && new Date(`${item.date}T00:00:00`) >= from).forEach((item) => { const loads = number(item.loads); const target = state.customers.find((customer) => customer.id === item.customerId); const material = materialById(state, item.materialId); const zone = material?.defaultZone || target?.defaultZone || "Near"; counts.total += loads; counts[zoneKey(zone)] += loads; });
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
  const comfortPenalty = zone === "stone" && counts.total >= comfortableTruckTrips(truck) ? (counts.total - comfortableTruckTrips(truck) + 1) * 1200 : 0;
  return counts.total * 100 + comfortPenalty + historical.total * 6 + counts[zone] * 35 + (special ? historical[zone] * 130 + (historical.far + historical.stone) * 25 : historical.near * 12) + (quarry ? previousSourceWork(state, truck.id, date, "Quarry") * 160 - (normalise(truck.status) === "quarry only" ? 900 : 0) : previousSourceWork(state, truck.id, date, "Sandpit") * 50) + (job.early ? -60 : 0) + (makeUp ? -10000 : 0) + (avoid ? 3000 : 0);
}

export function renumberAssignments(assignments) {
  const grouped = new Map(); assignments.forEach((assignment) => { const key = `${assignment.date}|${assignment.truckId}`; grouped.set(key, [...(grouped.get(key) || []), assignment]); });
  return [...grouped.values()].flatMap((items) => items.sort((a, b) => a.tripNumber - b.tripNumber || String(a.createdAt).localeCompare(String(b.createdAt))).map((item, index) => ({ ...item, tripNumber: index + 1 })));
}
function jobsForDate(state, date, lockedAssignments, filter = () => true) {
  const lockedByOrder = new Map(); lockedAssignments.forEach((item) => lockedByOrder.set(item.orderId, (lockedByOrder.get(item.orderId) || 0) + 1));
  return state.orders.filter((order) => order.date === date && number(order.loads) > 0 && filter(order)).flatMap((order) => Array.from({ length: Math.max(0, number(order.loads) - (lockedByOrder.get(order.id) || 0)) }, (_, index) => ({ ...order, loadIndex: index + 1 })));
}
function assignmentFromJob(job, truckId) { return { id: uid("assignment"), date: job.date, truckId, orderId: job.id, customerId: job.customerId, zone: job.zone, kind: job.kind, source: job.source, sourceId: job.sourceId, materialId: job.materialId, product: job.product, productLabel: job.productLabel, notes: job.notes, deliveryWindow: job.deliveryWindow || "", early: Boolean(job.early), status: "Planned", tripNumber: 0, createdAt: new Date().toISOString() }; }

// Manual dispatch is deliberately permissive. The dispatcher may have a
// special operational reason to place a load beyond a saved route profile;
// the board shows the resulting totals instead of silently changing a plan.
export function addManualOrderLoad(state, { date, orderId, truckId, tripNumber }) {
  const order = state.orders.find((item) => item.id === orderId && item.date === date);
  const targetTruck = state.trucks.find((item) => item.id === truckId);
  if (!order || !targetTruck || !isDispatchable(targetTruck)) return state;
  const assignment = assignmentFromJob(order, targetTruck.id);
  const requestedSlot = Math.max(0, number(tripNumber)); const usedSlots = new Set(state.assignments.filter((item) => item.date === date && item.truckId === truckId).map((item) => number(item.tripNumber))); const nextSlot = requestedSlot || Array.from({ length: Math.max(1, ...usedSlots, 0) + 1 }, (_, index) => index + 1).find((slot) => !usedSlots.has(slot)) || 1;
  if (usedSlots.has(nextSlot)) return state;
  return { ...state, assignments: [...state.assignments, { ...assignment, tripNumber: nextSlot }], updatedAt: new Date().toISOString() };
}

function quarryRequestAssignment(state, request, truckId, tripNumber) {
  const source = sourceById(state, request.sourceId);
  return { id: uid("quarry-request-assignment"), date: request.date, truckId, orderId: "", quarryRequestId: request.id, customerId: "", materialId: "", sourceId: request.sourceId, source: source?.name || "Quarry", product: "Quarry truck request", productLabel: "Quarry truck request", kind: "Quarry", zone: "Quarry", notes: request.notes || "", early: false, status: "Planned", tripNumber, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

export function addManualQuarryRequestLoad(state, { date, requestId, truckId, tripNumber }) {
  const request = (state.quarryRequests || []).find((item) => item.id === requestId && item.date === date);
  const targetTruck = state.trucks.find((item) => item.id === truckId);
  if (!request || !targetTruck || !isDispatchable(targetTruck)) return state;
  const alreadyPlaced = state.assignments.filter((item) => item.date === date && item.quarryRequestId === request.id).length;
  const requestedSlot = Math.max(1, number(tripNumber)); const occupied = state.assignments.some((item) => item.date === date && item.truckId === truckId && number(item.tripNumber) === requestedSlot);
  if (alreadyPlaced >= number(request.trucksNeeded) || occupied) return state;
  return { ...state, assignments: [...state.assignments, quarryRequestAssignment(state, request, truckId, requestedSlot)], updatedAt: new Date().toISOString() };
}

export function replaceManualAssignmentQuarryRequest(state, { assignmentId, requestId }) {
  const assignment = state.assignments.find((item) => item.id === assignmentId); const request = (state.quarryRequests || []).find((item) => item.id === requestId && item.date === assignment?.date);
  if (!assignment || !request || normalise(assignment.status) !== "planned") return state;
  const alreadyPlaced = state.assignments.filter((item) => item.date === assignment.date && item.quarryRequestId === request.id && item.id !== assignmentId).length;
  if (alreadyPlaced >= number(request.trucksNeeded)) return state;
  const replacement = quarryRequestAssignment(state, request, assignment.truckId, assignment.tripNumber);
  return { ...state, assignments: state.assignments.map((item) => item.id === assignmentId ? { ...replacement, id: item.id, createdAt: item.createdAt } : item), updatedAt: new Date().toISOString() };
}

// A truck-first board changes the order inside an existing trip slot. Keep the
// slot number and assignment ID stable so the dispatcher can rearrange the plan
// without a blank/rebuilt board or losing its trip-log link by mistake.
export function replaceManualAssignmentOrder(state, { assignmentId, orderId }) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  const order = state.orders.find((item) => item.id === orderId && item.date === assignment?.date);
  if (!assignment || !order || normalise(assignment.status) !== "planned") return state;
  const replacement = assignmentFromJob(order, assignment.truckId);
  return {
    ...state,
    assignments: state.assignments.map((item) => item.id === assignmentId ? {
      ...replacement,
      id: item.id,
      tripNumber: item.tripNumber,
      createdAt: item.createdAt,
      updatedAt: new Date().toISOString(),
    } : item),
    updatedAt: new Date().toISOString(),
  };
}

// Delivery history is based on completed/changed actual trip logs. Old
// backups may contain completed assignments without a trip-log row, so those
// are included as a compatibility fallback. A Changed trip belongs to the
// customer actually delivered to, not the originally planned customer.
export function customerDeliveryHistory(state, { customerId, beforeDate = "9999-12-31", limit = 10, deliveryDays = 2 }) {
  const loggedAssignmentIds = new Set();
  const deliveries = [];
  (state.tripLogs || []).forEach((log) => {
    if (!log?.assignmentId || !["completed", "changed"].includes(normalise(log.status)) || log.date >= beforeDate) return;
    loggedAssignmentIds.add(log.assignmentId);
    if ((log.actualCustomerId || log.plannedCustomerId) === customerId) deliveries.push({ date: log.date, truckId: log.truckId, assignmentId: log.assignmentId, recordedAt: log.updatedAt || log.recordedAt || "" });
  });
  (state.assignments || []).forEach((assignment) => {
    if (loggedAssignmentIds.has(assignment.id) || assignment.date >= beforeDate || !["completed", "changed"].includes(normalise(assignment.status)) || assignment.customerId !== customerId) return;
    deliveries.push({ date: assignment.date, truckId: assignment.truckId, assignmentId: assignment.id, recordedAt: assignment.updatedAt || assignment.createdAt || "" });
  });
  (state.extraTripLogs || []).forEach((entry) => {
    if (entry.date >= beforeDate || entry.customerId !== customerId) return;
    Array.from({ length: Math.max(1, number(entry.loads)) }, (_, index) => deliveries.push({ date: entry.date, truckId: entry.truckId, assignmentId: `${entry.id}:${index + 1}`, recordedAt: entry.updatedAt || "" }));
  });
  deliveries.sort((left, right) => right.date.localeCompare(left.date) || String(right.recordedAt).localeCompare(String(left.recordedAt)) || String(right.assignmentId).localeCompare(String(left.assignmentId)));
  const dates = [...new Set(deliveries.map((item) => item.date))].slice(0, Math.max(0, Number(deliveryDays) || 0));
  const days = dates.map((date) => {
    const byTruck = new Map();
    deliveries.filter((item) => item.date === date).forEach((item) => byTruck.set(item.truckId, (byTruck.get(item.truckId) || 0) + 1));
    return { date, loads: [...byTruck.values()].reduce((sum, count) => sum + count, 0), trucks: [...byTruck.entries()].map(([truckId, loads]) => ({ truckId, loads })).sort((left, right) => truckLabel(state.trucks.find((item) => item.id === left.truckId)).localeCompare(truckLabel(state.trucks.find((item) => item.id === right.truckId)))) };
  });
  return { recent: deliveries.slice(0, Math.max(0, Number(limit) || 0)), days };
}
function patternFits(truck, pattern) { return profileFits(truck, { total: pattern.near + pattern.far + pattern.stone, ...pattern }); }
function sandJobKey(job) { return `${job.id}:${job.loadIndex}`; }
function permitEndDate(startDate, durationDays) { const end = new Date(`${startDate}T12:00:00`); end.setDate(end.getDate() + Math.max(1, number(durationDays)) - 1); return end.toISOString().slice(0, 10); }
export function activePeriodPermits(state, date) {
  return (state.sandpitPermits || []).filter((permit) => permit.startDate <= date && permitEndDate(permit.startDate, permit.durationDays) >= date && sourceById(state, permit.sourceId)?.permitScheme === "Period" && state.trucks.some((truck) => truck.id === permit.truckId));
}
function jobForPermitSource(state, job, sourceId) {
  const target = state.customers.find((customer) => customer.id === job.customerId);
  const materialId = customerAllowedMaterialIds(state, target).find((id) => materialById(state, id)?.sourceId === sourceId && normalise(materialById(state, id)?.kind) === "sand");
  return materialId ? makeOrderFromMaterial({ ...job, materialId, materialOverride: true }, state) : null;
}
function pickPeriodPermitJobs(state, date, lockedAssignments, sourceJobs) {
  const permits = activePeriodPermits(state, date).filter((permit) => { const truck = state.trucks.find((item) => item.id === permit.truckId); return truck && isDispatchable(truck) && normalise(truck.status) !== "quarry only"; });
  // Leave one compatible sand job for every paid permit, then fill normal
  // four-load daily permits. This gives the requested 22 = 5×4 + 2 outcome
  // when one truck already has a period permit.
  const targetLoads = permits.length ? Math.max(0, sourceJobs.length - Math.floor(Math.max(0, sourceJobs.length - permits.length) / 4) * 4) : 0;
  const remaining = [...sourceJobs]; const selectedKeys = new Set(); const assignments = []; const created = [...lockedAssignments]; const perTruck = new Map();
  while (assignments.length < targetLoads) {
    let assigned = false;
    const orderedPermits = permits.slice().sort((left, right) => (perTruck.get(left.truckId) || 0) - (perTruck.get(right.truckId) || 0) || left.truckId.localeCompare(right.truckId));
    for (const permit of orderedPermits) {
      if (assignments.length >= targetLoads) break;
      const truck = state.trucks.find((item) => item.id === permit.truckId); const counts = dayCounts(created, permit.truckId);
      const candidateIndex = remaining.findIndex((job) => { const converted = jobForPermitSource(state, job, permit.sourceId); if (!converted) return false; const zone = zoneKey(converted.zone); return profileFits(truck, { ...counts, total: counts.total + 1, [zone]: counts[zone] + 1 }); });
      if (candidateIndex < 0) continue;
      const job = jobForPermitSource(state, remaining[candidateIndex], permit.sourceId); remaining.splice(candidateIndex, 1); selectedKeys.add(sandJobKey(job)); const assignment = assignmentFromJob(job, permit.truckId); assignments.push(assignment); created.push(assignment); perTruck.set(permit.truckId, (perTruck.get(permit.truckId) || 0) + 1); assigned = true;
    }
    if (!assigned) break;
  }
  const warnings = permits.length && assignments.length < permits.length ? ["A paid period permit could not receive a compatible saved customer order. Check its source materials and customer rules."] : [];
  return { permits, targetLoads, assignments, selectedKeys, warnings };
}

function sandpitPermitPlanForJobs(state, date, jobs, periodInfo = {}) {
  const nearLoads = jobs.filter((item) => zoneKey(item.zone) === "near").length;
  const farLoads = jobs.filter((item) => zoneKey(item.zone) === "far").length;
  // Three sand loads makes a daily permit worthwhile. Four is the normal
  // workload; five remains a hard truck maximum that is used only when demand
  // requires it.
  const farGroups = farLoads;
  const nearGroups = nearLoads > farGroups * 3 ? Math.ceil((nearLoads - farGroups * 3) / 4) : 0;
  const groups = [
    ...Array.from({ length: farGroups }, () => ({ near: 3, far: 1, stone: 0, minimumNear: 2, minimumFar: 1, label: "3 Near + 1 Far" })),
    ...Array.from({ length: nearGroups }, () => ({ near: 4, far: 0, stone: 0, minimumNear: 3, minimumFar: 0, label: "4 Near" })),
  ];
  const targetNearLoads = farGroups * 3 + nearGroups * 4;
  const minimumNearLoads = farGroups * 2 + nearGroups * 3;
  const eligibleTrucks = state.trucks.filter((truck) => isDispatchable(truck) && normalise(truck.status) !== "quarry only" && groups.some((group) => patternFits(truck, group)));
  const workingTrucks = state.trucks.filter(isDispatchable);
  const markedQuarryOnly = workingTrucks.filter((truck) => normalise(truck.status) === "quarry only").length;
  const suggestedQuarryOnlyCount = Math.max(0, workingTrucks.length - groups.length - (periodInfo.permits?.length || 0));
  const recommendedQuarryOnlyTruckIds = workingTrucks.filter((truck) => normalise(truck.status) !== "scheduled repair" && !(periodInfo.permits || []).some((permit) => permit.truckId === truck.id)).sort((left, right) => previousSourceWork(state, left.id, date, "Quarry") - previousSourceWork(state, right.id, date, "Quarry") || previousSourceWork(state, right.id, date, "Sandpit") - previousSourceWork(state, left.id, date, "Sandpit") || truckLabel(left).localeCompare(truckLabel(right))).slice(0, suggestedQuarryOnlyCount).map((truck) => truck.id);
  return { nearLoads, farLoads, sandLoads: jobs.length + (periodInfo.assignments?.length || 0), dailyPermitLoads: jobs.length, targetNearLoads, minimumNearLoads, minimumExtraNearLoads: Math.max(0, minimumNearLoads - nearLoads), normalCapacityExtraNearLoads: Math.max(0, targetNearLoads - nearLoads), fullCapacityExtraNearLoads: Math.max(0, farGroups * 3 + Math.ceil(Math.max(0, nearLoads - farGroups * 3) / 5) * 5 - nearLoads), extraNearLoads: Math.max(0, targetNearLoads - nearLoads), groups, groupCount: groups.length, eligibleTruckCount: eligibleTrucks.length, workingTruckCount: workingTrucks.length, markedQuarryOnly, suggestedQuarryOnlyCount, recommendedQuarryOnlyTruckIds, periodPermitCount: periodInfo.permits?.length || 0, periodReservedLoads: periodInfo.assignments?.length || 0, periodPermitTruckIds: [...new Set((periodInfo.permits || []).map((permit) => permit.truckId))], periodWarnings: periodInfo.warnings || [] };
}
export function sandpitPermitPlan(state, date) {
  const sourceJobs = jobsForDate(state, date, [], (item) => sourceTypeFor(state, item) === "Sandpit" && ["near", "far"].includes(zoneKey(item.zone)));
  const period = pickPeriodPermitJobs(state, date, [], sourceJobs);
  return sandpitPermitPlanForJobs(state, date, sourceJobs.filter((job) => !period.selectedKeys.has(sandJobKey(job))), period);
}
function buildSandpitPermitAssignments(state, date, lockedAssignments, suppliedJobs = null, periodInfo = {}) {
  const jobs = suppliedJobs || jobsForDate(state, date, lockedAssignments, (item) => sourceTypeFor(state, item) === "Sandpit" && ["near", "far"].includes(zoneKey(item.zone))); const plan = sandpitPermitPlanForJobs(state, date, jobs, periodInfo); const hasEarly = jobs.some((item) => item.early);
  const periodTruckIds = new Set((periodInfo.permits || []).map((permit) => permit.truckId));
  const eligible = state.trucks.filter((truck) => isDispatchable(truck) && normalise(truck.status) !== "quarry only" && !periodTruckIds.has(truck.id) && (!hasEarly || !(normalise(truck.status) === "scheduled repair" && truck.earlyRepair)));
  const groups = []; const warnings = [];
  for (const pattern of plan.groups) {
    const candidates = eligible.filter((truck) => !groups.some((group) => group.truck.id === truck.id) && patternFits(truck, pattern));
    if (!candidates.length) { warnings.push(`No separate truck can cover the ideal sandpit permit group: ${pattern.label}`); continue; }
    const groupLoads = pattern.near + pattern.far; const truck = candidates.map((item) => ({ item, score: (comfortableTruckTrips(item) < groupLoads ? 10000 : 0) + previousSourceWork(state, item.id, date, "Sandpit") * 100 + previousCounts(state, item.id, date).total * 5 })).sort((a, b) => a.score - b.score || truckLabel(a.item).localeCompare(truckLabel(b.item)))[0].item;
    groups.push({ truck, remaining: { near: pattern.near, far: pattern.far, stone: 0 }, assigned: { near: 0, far: 0, stone: 0 }, minimum: { near: pattern.minimumNear, far: pattern.minimumFar, stone: 0 } });
  }
  const assignments = [];
  const priority = (job) => job.early ? 0 : zoneKey(job.zone) === "far" ? 1 : 2;
  jobs.sort((a, b) => priority(a) - priority(b) || a.customerId.localeCompare(b.customerId));
  for (const job of jobs) {
    const zone = zoneKey(job.zone); const candidates = groups.filter((group) => group.remaining[zone] > 0 && !(job.early && normalise(group.truck.status) === "scheduled repair" && group.truck.earlyRepair));
    if (!candidates.length) { warnings.push("Some sand orders need to use remaining compatible capacity instead of an ideal permit group."); continue; }
    const group = candidates.sort((a, b) => {
      const aMinimumGap = Math.max(0, a.minimum[zone] - a.assigned[zone]); const bMinimumGap = Math.max(0, b.minimum[zone] - b.assigned[zone]);
      return (bMinimumGap - aMinimumGap) || (b.remaining[zone] - a.remaining[zone]) || previousSourceWork(state, a.truck.id, date, "Sandpit") - previousSourceWork(state, b.truck.id, date, "Sandpit");
    })[0];
    group.remaining[zone] -= 1; group.assigned[zone] += 1; assignments.push(assignmentFromJob(job, group.truck.id));
  }
  groups.filter((group) => group.assigned.near + group.assigned.far < 3).forEach((group) => warnings.push(`${truckLabel(group.truck)} has fewer than 3 sand loads in the current permit plan.`));
  return { assignments, permitTruckIds: new Set(groups.map((group) => group.truck.id)), warnings: [...new Set(warnings)], plan };
}

export function buildDispatch(state, date, lockedAssignments = [], options = {}) {
  const jobs = jobsForDate(state, date, lockedAssignments);
  const priority = (job) => job.early ? 0 : zoneKey(job.zone) === "far" ? 1 : zoneKey(job.zone) === "stone" ? 2 : 3; jobs.sort((a, b) => priority(a) - priority(b) || a.customerId.localeCompare(b.customerId));
  const trucks = state.trucks.filter(isDispatchable); const created = [...lockedAssignments]; const unresolved = [];
  for (const job of jobs) {
    const zone = zoneKey(job.zone); const sourceType = sourceTypeFor(state, job); let candidates = trucks.filter((truck) => { if (sourceType !== "Quarry" && normalise(truck.status) === "quarry only") return false; if (sourceType === "Sandpit" && options.permitTruckIds?.size && !options.permitTruckIds.has(truck.id)) return false; if (job.early && normalise(truck.status) === "scheduled repair" && truck.earlyRepair) return false; const counts = dayCounts(created, truck.id); const next = { ...counts, total: counts.total + 1, [zone]: counts[zone] + 1 }; return profileFits(truck, next); });
    if (sourceType === "Quarry") { const quarryOnly = candidates.filter((truck) => normalise(truck.status) === "quarry only"); if (quarryOnly.length) candidates = quarryOnly; }
    if (zone === "far") { const unusedForFar = candidates.filter((truck) => dayCounts(created, truck.id).far === 0); if (unusedForFar.length) candidates = unusedForFar; }
    if (!candidates.length) { unresolved.push({ ...job, reason: `No available truck capability for ${job.zone}` }); continue; }
    const winner = candidates.map((truck) => ({ truck, score: candidateScore(state, truck, dayCounts(created, truck.id), job, date) })).sort((a, b) => a.score - b.score || truckLabel(a.truck).localeCompare(truckLabel(b.truck)))[0].truck;
    created.push(assignmentFromJob(job, winner.id));
  }
  const numbered = renumberAssignments(created.sort((a, b) => a.truckId.localeCompare(b.truckId) || Number(b.early) - Number(a.early) || a.tripNumber - b.tripNumber));
  const makeUps = state.makeUps.map((item) => item.status !== "Pending" ? item : (numbered.some((assignment) => assignment.truckId === item.truckId && assignment.customerId === item.customerId) ? { ...item, status: "Scheduled", scheduledFor: date } : item));
  return { assignments: numbered, unresolved, makeUps };
}
export function applyDispatch(state, date) {
  const locked = state.assignments.filter((item) => item.date === date && (item.status !== "Planned" || state.tripLogs.some((log) => log.assignmentId === item.id)));
  const sourceJobs = jobsForDate(state, date, locked, (item) => sourceTypeFor(state, item) === "Sandpit" && ["near", "far"].includes(zoneKey(item.zone)));
  const period = pickPeriodPermitJobs(state, date, locked, sourceJobs);
  const dailyJobs = sourceJobs.filter((job) => !period.selectedKeys.has(sandJobKey(job)));
  const permits = buildSandpitPermitAssignments(state, date, [...locked, ...period.assignments], dailyJobs, period);
  const permitTruckIds = new Set([...permits.permitTruckIds, ...period.permits.map((permit) => permit.truckId)]);
  const result = buildDispatch(state, date, [...locked, ...period.assignments, ...permits.assignments], { permitTruckIds });
  const plan = sandpitPermitPlanForJobs(state, date, dailyJobs, period);
  return { ...state, assignments: [...state.assignments.filter((item) => item.date !== date), ...result.assignments], makeUps: result.makeUps, lastAllocation: { date, unresolved: result.unresolved, permitPlan: plan, permitWarnings: [...period.warnings, ...permits.warnings], createdAt: new Date().toISOString() }, updatedAt: new Date().toISOString() };
}
export function assignmentSummary(state, assignment) { return { customerName: normalise(assignment.kind) === "quarry" ? `Quarry ${sourceById(state, assignment.sourceId)?.name || "request"}` : (state.customers.find((item) => item.id === assignment.customerId)?.name || "Unknown customer"), truckNo: truckLabel(state.trucks.find((item) => item.id === assignment.truckId)) }; }
export function recordActualTrip(state, assignmentId, { actualCustomerId, actualMaterialId, status, remark }) {
  const assignment = state.assignments.find((item) => item.id === assignmentId); if (!assignment) return state; const actual = actualCustomerId || assignment.customerId; const actualCustomer = state.customers.find((item) => item.id === actual); const allowed = actualCustomer ? customerAllowedMaterialIds(state, actualCustomer) : []; const materialId = allowed.includes(actualMaterialId) ? actualMaterialId : (allowed.includes(assignment.materialId) ? assignment.materialId : defaultCustomerMaterialId(state, actualCustomer)); const changed = actual !== assignment.customerId || status !== "Completed"; const existing = state.tripLogs.find((item) => item.assignmentId === assignmentId);
  const log = { id: existing?.id || uid("log"), assignmentId, date: assignment.date, truckId: assignment.truckId, plannedCustomerId: assignment.customerId, actualCustomerId: actual, actualMaterialId: materialId, status, remark: remark || "", recordedAt: existing?.recordedAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const makeUps = state.makeUps.filter((item) => item.assignmentId !== assignmentId); if (changed) makeUps.push({ id: uid("recovery"), assignmentId, truckId: assignment.truckId, customerId: assignment.customerId, avoidCustomerId: actual !== assignment.customerId ? actual : "", status: "Pending", reason: status === "Completed" ? "Delivered a different customer" : status, createdAt: new Date().toISOString() });
  return { ...state, assignments: state.assignments.map((item) => item.id === assignmentId ? { ...item, status, updatedAt: new Date().toISOString() } : item), tripLogs: [...state.tripLogs.filter((item) => item.assignmentId !== assignmentId), log], makeUps, updatedAt: new Date().toISOString() };
}
function absenceLogRemark(remark) { return remark ? `Driver absent: ${remark}` : "Driver absent"; }
export function markDriverAbsent(state, { date, truckId, remark = "" }) {
  // Some older phone backups have an empty assignment status. Treat that as
  // still planned, but never rewrite a completed, changed or already-skipped trip.
  const now = new Date().toISOString(); const skipped = state.assignments.filter((item) => item.date === date && item.truckId === truckId && !["completed", "changed", "skipped"].includes(normalise(item.status)));
  const absence = { id: (state.driverAbsences || []).find((item) => item.date === date && item.truckId === truckId)?.id || uid("driver-absence"), date, truckId, remark, updatedAt: now };
  const existingLogs = new Map((state.tripLogs || []).map((item) => [item.assignmentId, item]));
  const logs = (state.tripLogs || []).filter((item) => !skipped.some((assignment) => assignment.id === item.assignmentId));
  skipped.forEach((assignment) => logs.push({ id: existingLogs.get(assignment.id)?.id || uid("log"), assignmentId: assignment.id, date, truckId, plannedCustomerId: assignment.customerId || "", actualCustomerId: assignment.customerId || "", actualMaterialId: assignment.materialId || "", status: "Skipped", remark: absenceLogRemark(remark), autoDriverAbsent: true, recordedAt: existingLogs.get(assignment.id)?.recordedAt || now, updatedAt: now }));
  return { ...state, driverAbsences: [...(state.driverAbsences || []).filter((item) => !(item.date === date && item.truckId === truckId)), absence], assignments: state.assignments.map((item) => skipped.some((assignment) => assignment.id === item.id) ? { ...item, status: "Skipped", updatedAt: now } : item), tripLogs: logs, updatedAt: now };
}
export function updateDriverAbsenceRemark(state, { date, truckId, remark }) {
  const now = new Date().toISOString(); const marked = new Set((state.tripLogs || []).filter((item) => item.date === date && item.truckId === truckId && item.autoDriverAbsent).map((item) => item.assignmentId));
  return { ...state, driverAbsences: (state.driverAbsences || []).map((item) => item.date === date && item.truckId === truckId ? { ...item, remark, updatedAt: now } : item), tripLogs: (state.tripLogs || []).map((item) => marked.has(item.assignmentId) ? { ...item, remark: absenceLogRemark(remark), updatedAt: now } : item), updatedAt: now };
}
export function clearDriverAbsent(state, { date, truckId }) {
  const autoIds = new Set((state.tripLogs || []).filter((item) => item.date === date && item.truckId === truckId && item.autoDriverAbsent).map((item) => item.assignmentId));
  return { ...state, driverAbsences: (state.driverAbsences || []).filter((item) => !(item.date === date && item.truckId === truckId)), assignments: state.assignments.map((item) => autoIds.has(item.id) ? { ...item, status: "Planned", updatedAt: new Date().toISOString() } : item), tripLogs: (state.tripLogs || []).filter((item) => !autoIds.has(item.assignmentId)), updatedAt: new Date().toISOString() };
}
function firstQuarryMaterial(state, sourceId = "") {
  const source = sourceById(state, sourceId) || state.sources.find((item) => item.type === "Quarry");
  if (!source) return { sourceId: "", materialId: "" };
  return { sourceId: source.id, materialId: state.materials.find((item) => item.sourceId === source.id)?.id || "", customerName: "" };
}
export function addQuarryTripLog(state, { date, truckId }) {
  const defaults = firstQuarryMaterial(state);
  if (!defaults.sourceId) return state;
  const log = { id: uid("quarry-log"), date, truckId, ...defaults, loads: 0, remark: "", updatedAt: new Date().toISOString() };
  return { ...state, quarryTripLogs: [...(state.quarryTripLogs || []), log], updatedAt: new Date().toISOString() };
}
export function updateQuarryTripLog(state, id, field, value) {
  const existing = (state.quarryTripLogs || []).find((item) => item.id === id); if (!existing) return state;
  let next = { ...existing, [field]: field === "loads" ? number(value) : value, updatedAt: new Date().toISOString() };
  if (field === "sourceId") next = { ...next, ...firstQuarryMaterial(state, value) };
  if (field === "materialId") { const material = materialById(state, value); if (material?.sourceId) next.sourceId = material.sourceId; }
  return { ...state, quarryTripLogs: state.quarryTripLogs.map((item) => item.id === id ? next : item), updatedAt: new Date().toISOString() };
}
export function removeQuarryTripLog(state, id) { return { ...state, quarryTripLogs: (state.quarryTripLogs || []).filter((item) => item.id !== id), updatedAt: new Date().toISOString() }; }
function firstExtraTripMaterial(state, customerId = "") {
  const target = state.customers.find((item) => item.id === customerId) || state.customers.find((item) => customerAllowedMaterialIds(state, item).length);
  if (!target) return { customerId: "", materialId: "" };
  return { customerId: target.id, materialId: defaultCustomerMaterialId(state, target) };
}
export function addExtraTripLog(state, { date, truckId }) {
  const defaults = firstExtraTripMaterial(state);
  if (!defaults.customerId || !defaults.materialId) return state;
  const log = { id: uid("extra-log"), date, truckId, ...defaults, loads: 1, remark: "", updatedAt: new Date().toISOString() };
  return { ...state, extraTripLogs: [...(state.extraTripLogs || []), log], updatedAt: new Date().toISOString() };
}
export function updateExtraTripLog(state, id, field, value) {
  const existing = (state.extraTripLogs || []).find((item) => item.id === id); if (!existing) return state;
  let next = { ...existing, [field]: field === "loads" ? Math.max(1, number(value)) : value, updatedAt: new Date().toISOString() };
  if (field === "customerId") next = { ...next, ...firstExtraTripMaterial(state, value) };
  if (field === "materialId") { const target = state.customers.find((item) => item.id === next.customerId); if (!customerAllowedMaterialIds(state, target).includes(value)) next.materialId = defaultCustomerMaterialId(state, target); }
  return { ...state, extraTripLogs: state.extraTripLogs.map((item) => item.id === id ? next : item), updatedAt: new Date().toISOString() };
}
export function removeExtraTripLog(state, id) { return { ...state, extraTripLogs: (state.extraTripLogs || []).filter((item) => item.id !== id), updatedAt: new Date().toISOString() }; }
// Kept for older integrations: it updates the first quarry entry for the truck.
export function recordQuarryTripLog(state, { date, truckId, loads, remark }) {
  const existing = (state.quarryTripLogs || []).find((item) => item.date === date && item.truckId === truckId);
  if (!existing) { const next = addQuarryTripLog(state, { date, truckId }); const created = next.quarryTripLogs.at(-1); return created ? updateQuarryTripLog(updateQuarryTripLog(next, created.id, "loads", loads), created.id, "remark", remark) : next; }
  return updateQuarryTripLog(updateQuarryTripLog(state, existing.id, "loads", loads), existing.id, "remark", remark);
}
export function quarryEnquiriesForDate(state, date) {
  return (state.quarryEnquiries || []).filter((item) => item.date === date && sourceById(state, item.sourceId)?.type === "Quarry").slice().sort((left, right) => number(left.sequence) - number(right.sequence) || String(left.id).localeCompare(String(right.id))).map((item) => sourceById(state, item.sourceId)).filter(Boolean);
}
export function financialSummary(state, date) {
  const orders = state.orders.filter((item) => item.date === date && number(item.loads) > 0);
  const customerMargin = orders.reduce((sum, item) => sum + number(item.loads) * number(state.customers.find((customer) => customer.id === item.customerId)?.marginPerLoad), 0);
  const permitPlan = sandpitPermitPlan(state, date);
  const periodPermits = activePeriodPermits(state, date);
  const dailyPermitKeys = new Map();
  state.assignments.filter((item) => item.date === date && sourceTypeFor(state, item) === "Sandpit").forEach((item) => {
    const source = sourceById(state, item.sourceId); if (source?.permitScheme !== "Daily") return;
    dailyPermitKeys.set(`${item.truckId}:${item.sourceId}`, source);
  });
  const dailyPermitCount = dailyPermitKeys.size || permitPlan.groupCount;
  const fallbackDailySource = orders.map((item) => sourceById(state, item.sourceId)).find((source) => source?.permitScheme === "Daily");
  const dailyPermitCost = dailyPermitKeys.size ? [...dailyPermitKeys.values()].reduce((sum, source) => sum + number(source.permitCostPerDay || state.settings?.sandpitPermitCost), 0) : dailyPermitCount * number(fallbackDailySource?.permitCostPerDay || state.settings?.sandpitPermitCost);
  const periodPermitCost = periodPermits.reduce((sum, permit) => sum + number(permit.pricePerDay), 0);
  const permitCount = dailyPermitCount + periodPermits.length; const permitCost = dailyPermitCost + periodPermitCost;
  const configuredOrderLoads = orders.filter((item) => number(state.customers.find((customer) => customer.id === item.customerId)?.marginPerLoad) > 0).reduce((sum, item) => sum + number(item.loads), 0);
  return { customerMargin, permitCount, dailyPermitCount, dailyPermitCost, periodPermitCount: periodPermits.length, periodPermitCost, permitCost, netAfterPermit: customerMargin - permitCost, configuredOrderLoads, totalOrderLoads: orders.reduce((sum, item) => sum + number(item.loads), 0) };
}
export function tallyForDate(state, date) {
  const lines = new Map(); const actualByAssignment = new Map((state.tripLogs || []).map((log) => [log.assignmentId, log])); state.orders.filter((item) => item.date === date).forEach((item) => { const line = lines.get(item.customerId) || { customerId: item.customerId, required: 0, planned: 0 }; line.required += number(item.loads); lines.set(item.customerId, line); }); state.assignments.filter((item) => item.date === date && item.status !== "Skipped" && item.customerId && !item.quarryRequestId).forEach((item) => { const log = actualByAssignment.get(item.id); const customerId = log?.actualCustomerId || item.customerId; const line = lines.get(customerId) || { customerId, required: 0, planned: 0 }; line.planned += 1; lines.set(customerId, line); }); (state.extraTripLogs || []).filter((item) => item.date === date && item.customerId).forEach((item) => { const line = lines.get(item.customerId) || { customerId: item.customerId, required: 0, planned: 0 }; line.planned += Math.max(1, number(item.loads)); lines.set(item.customerId, line); });
  return [...lines.values()].map((line) => ({ ...line, customerName: state.customers.find((item) => item.id === line.customerId)?.name || "Unknown customer", balance: line.planned - line.required })).sort((a, b) => a.customerName.localeCompare(b.customerName));
}
function truckCounts(items, label) { const counts = new Map(); items.forEach((item) => { const key = label(item); counts.set(key, (counts.get(key) || 0) + 1); }); return [...counts.entries()].map(([name, count]) => count > 1 ? `${name} x${count}` : name).join("/") || "-"; }
function whatsappSafe(value) { return String(value || "").replaceAll("*", "").trim(); }
function whatsappNote(value) { const note = whatsappSafe(value); return note ? `‼ ${note}` : ""; }
function customerMaterialSources(state, customerId, materialName) {
  const rule = (state.customers.find((item) => item.id === customerId)?.materialRules || []).find((item) => normalise(item.materialName) === normalise(materialName));
  const ids = state.materials.filter((item) => normalise(item.name) === normalise(materialName) && (rule?.sourceMode === "Any" || (rule?.sourceIds || []).includes(item.sourceId))).map((item) => item.sourceId);
  return [...new Set(ids)].map((id) => sourceShort(sourceById(state, id)?.name)).filter(Boolean).join("/");
}
export function makeWhatsAppMessage(state, date) {
  const truckOrder = new Map(state.trucks.map((truck, index) => ({ truck, index })).sort((left, right) => number(left.truck.sequence || left.index + 1) - number(right.truck.sequence || right.index + 1) || left.index - right.index).map(({ truck }, index) => [truck.id, index]));
  const byTruckSequence = (left, right) => (truckOrder.get(left.truckId) ?? Number.MAX_SAFE_INTEGER) - (truckOrder.get(right.truckId) ?? Number.MAX_SAFE_INTEGER) || number(left.tripNumber) - number(right.tripNumber);
  const assignments = state.assignments.filter((item) => item.date === date).sort(byTruckSequence); const truckNo = (item) => assignmentSummary(state, item).truckNo; const customerName = (item) => assignmentSummary(state, item).customerName;
  const sand = assignments.filter((item) => normalise(item.kind) === "sand"); const stone = assignments.filter((item) => normalise(item.kind) === "stone");
  const normalSand = sand.filter((item) => !normalise(materialById(state, item.materialId)?.name || item.product).includes("jagung")); const jagung = sand.filter((item) => normalise(materialById(state, item.materialId)?.name || item.product).includes("jagung"));
  const manualSandpitEntries = (state.sandpitEntries || []).filter((entry) => entry.date === date && sourceById(state, entry.sourceId)?.type === "Sandpit");
  const temporaryQuarryOnly = new Set((state.quarryOnlyEntries || []).filter((entry) => entry.date === date).map((entry) => entry.truckId));
  const quarryOnlyIds = new Set([...state.trucks.filter((truck) => normalise(truck.status) === "quarry only").map((truck) => truck.id), ...temporaryQuarryOnly]);
  const manualSelectionExists = manualSandpitEntries.length > 0;
  const sandpitSourceIds = new Set((manualSelectionExists ? manualSandpitEntries : [...normalSand, ...jagung].filter((item) => !quarryOnlyIds.has(item.truckId))).map((item) => item.sourceId).filter((id) => sourceById(state, id)?.type === "Sandpit"));
  const sandSources = [...sandpitSourceIds].map((sourceId) => { const source = sourceById(state, sourceId); const planned = manualSelectionExists ? [] : assignments.filter((item) => normalise(item.kind) === "sand" && item.sourceId === sourceId && !quarryOnlyIds.has(item.truckId)); const entered = manualSandpitEntries.filter((entry) => entry.sourceId === sourceId).map((entry) => ({ truckId: entry.truckId })); const unique = new Map(); [...planned, ...entered].forEach((item) => unique.set(item.truckId, item)); return `Masuk Lombong ${source?.name || "Sandpit"}: ${truckCounts([...unique.values()], truckNo)}`; });
  const remarkFingerprint = (value) => normalise(whatsappSafe(value)).replace(/[^a-z0-9]/g, "").replaceAll("pasir", "");
  const customerRemark = (item) => { const permanent = whatsappSafe(state.customers.find((customer) => customer.id === item.customerId)?.notes); const daily = whatsappSafe(item.notes); if (!permanent) return daily; if (!daily || remarkFingerprint(permanent) === remarkFingerprint(daily) || remarkFingerprint(permanent).includes(remarkFingerprint(daily)) || remarkFingerprint(daily).includes(remarkFingerprint(permanent))) return permanent; return `${permanent} · ${daily}`; };
  const groupedLines = (items, type) => { const groups = new Map(); items.forEach((item) => { const material = materialById(state, item.materialId); const window = whatsappSafe(item.deliveryWindow); const key = `${item.customerId}|${material?.name || item.product || item.productLabel}|${window}|${customerRemark(item)}`; groups.set(key, [...(groups.get(key) || []), item]); }); return [...groups.values()].sort((left, right) => number(state.orders.find((order) => order.id === left[0].orderId)?.sequence) - number(state.orders.find((order) => order.id === right[0].orderId)?.sequence)).map((group) => { const sample = group[0]; const material = materialById(state, sample.materialId); const note = customerRemark(sample); const window = whatsappSafe(sample.deliveryWindow); const timing = window ? `\n⏰ ${window}` : ""; if (type === "sand") { const name = material?.name || sample.product || sample.productLabel; const sourceText = customerMaterialSources(state, sample.customerId, name) || sourceShort(sourceById(state, material?.sourceId || sample.sourceId)?.name); return `${customerName(sample)}:\n${name} ${sourceText} - ${group.length} (${truckCounts(group, truckNo)})${timing}${whatsappNote(note) ? `\n${whatsappNote(note)}` : ""}`; } const source = sourceById(state, material?.sourceId || sample.sourceId)?.name || sample.source || "Quarry"; return `${source} ke ${customerName(sample)}:\n${material?.name || sample.product || sample.productLabel} - ${group.length} (${truckCounts(group, truckNo)})${timing}${whatsappNote(note) ? `\n${whatsappNote(note)}` : ""}`; }); };
  const notices = (state.notices || []).filter(Boolean).map(whatsappNote).filter(Boolean).join("\n");
  const sectionRemarks = (state.messageRemarks || []).find((item) => item.date === date) || {};
  const quarryOnly = state.trucks.filter((truck) => quarryOnlyIds.has(truck.id)).sort((left, right) => (truckOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (truckOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)).map(truckLabel).join("/");
  const quarryRequests = (state.quarryRequests || []).filter((item) => item.date === date).slice().sort((left, right) => number(left.sequence) - number(right.sequence) || String(left.id).localeCompare(String(right.id))).map((item) => { const source = sourceById(state, item.sourceId); const placed = assignments.filter((assignment) => assignment.quarryRequestId === item.id); return `Order quarry ${source?.name || "Quarry"}:\nNeed ${number(item.trucksNeeded)} truck${number(item.trucksNeeded) === 1 ? "" : "s"}${placed.length ? ` (${truckCounts(placed, truckNo)})` : ""}${whatsappNote(item.notes) ? `\n${whatsappNote(item.notes)}` : ""}`; });
  const quarryEnquiries = quarryEnquiriesForDate(state, date).map((source) => `Order quarry ${source.name}${source.weighbridgeContact ? `\n‼ contact ${whatsappSafe(source.weighbridgeContact)}` : ""}${source.quarryNote ? `\n${whatsappNote(source.quarryNote)}` : ""}`);
  const message = ["Esok order pasir", sandSources.join("\n"), groupedLines(normalSand, "sand").join("\n\n") || "-", whatsappNote(sectionRemarks.sand), "---------------------------------------------------", jagung.length ? "Esok order pasir jagung" : "", jagung.length ? groupedLines(jagung, "sand").join("\n\n") : "", jagung.length ? whatsappNote(sectionRemarks.jagung) : "", jagung.length ? "---------------------------------------------------" : "", "Esok order batu", quarryOnly ? `Esok masuk quarry sahaja: ${quarryOnly}` : "", groupedLines(stone, "stone").join("\n\n") || "-", quarryRequests.join("\n\n"), quarryEnquiries.join("\n\n"), whatsappNote(sectionRemarks.stone), notices ? `Peringatan semua driver:\n${notices}` : ""].filter(Boolean).join("\n\n");
  return message.replace(/\n{3,}/g, "\n\n").trim();
}
export function loadScore(state, truckId, date) { const historical = previousCounts(state, truckId, date); const planned = dayCounts(state.assignments.filter((item) => item.date === date), truckId); return { historical: historical.total, planned: planned.total, far: historical.far, stone: historical.stone, quarry: previousSourceWork(state, truckId, date, "Quarry"), total: historical.total + planned.total }; }
