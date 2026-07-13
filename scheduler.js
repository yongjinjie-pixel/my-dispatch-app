export const todayISO = () => new Date().toISOString().slice(0, 10);
export const tomorrowISO = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};
export const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const normalise = (value) => String(value || "").trim().toLowerCase();

const sourceSeed = [
  ["src-ml", "MingLiong Mados", "Sandpit"], ["src-gsl", "GuanSengLee", "Sandpit"], ["src-gd", "GD Linggiu", "Sandpit"],
  ["src-kl", "KL Building", "Quarry"], ["src-bj", "BJ", "Quarry"], ["src-saroma", "Saroma Kangkar Pulai", "Quarry"],
];
const materialSeed = [
  ["mat-ml-1x", "src-ml", "1x cuci", "Sand"], ["mat-gsl-1x", "src-gsl", "1x cuci", "Sand"],
  ["mat-ml-2x", "src-ml", "2x cuci", "Sand"], ["mat-gsl-2x", "src-gsl", "2x cuci", "Sand"],
  ["mat-gsl-23x", "src-gsl", "2x/3x cuci", "Sand"], ["mat-ml-kasar", "src-ml", "Pasir Kasar", "Sand"], ["mat-gsl-kasar", "src-gsl", "Pasir Kasar", "Sand"],
  ["mat-ml-serdang", "src-ml", "Pasir Serdang", "Sand"], ["mat-gsl-serdang", "src-gsl", "Pasir Serdang", "Sand"], ["mat-ml-halus", "src-ml", "Pasir Halus", "Sand"], ["mat-gsl-halus", "src-gsl", "Pasir Halus", "Sand"],
  ["mat-ml-jagung", "src-ml", "Pasir Jagung", "Sand"], ["mat-gsl-jagung", "src-gsl", "Pasir Jagung", "Sand"],
  ["mat-kl-cr", "src-kl", "Crusher Run", "Stone"], ["mat-kl-20", "src-kl", "20mm", "Stone"],
];

const materialRefs = {
  "1x cuci ML/GSL": ["mat-ml-1x", "mat-gsl-1x"], "1x cuci GSL": ["mat-gsl-1x"],
  "2x cuci ML/GSL": ["mat-ml-2x", "mat-gsl-2x"], "2x/3x cuci GSL": ["mat-gsl-23x"],
  "Pasir Kasar ML": ["mat-ml-kasar"], "Pasir Serdang ML": ["mat-ml-serdang"],
  "Pasir Halus GSL": ["mat-gsl-halus"], "Pasir Jagung": ["mat-ml-jagung", "mat-gsl-jagung"],
  "Crusher Run": ["mat-kl-cr"], "20mm": ["mat-kl-20"],
};

export function defaultState() {
  const date = tomorrowISO();
  const trucks = [
    ["1349", "Off", 3], ["1390", "Off", 3], ["1867", "Available", 4], ["3726", "Off", 3],
    ["3772", "Available", 4], ["4460", "Off", 3], ["5274", "Available", 4], ["6128", "Off", 3],
    ["6307", "Available", 3], ["7914", "Available", 5], ["7962", "Available", 4], ["9465", "Available", 5],
  ].map(([number, status, dailyMax]) => ({
    id: `truck-${number}`, prefix: "", number, status, dailyMax, nearMax: Math.min(3, dailyMax), farMax: 1, stoneMax: 1,
    notes: "", updatedAt: new Date().toISOString(),
  }));
  const sources = sourceSeed.map(([id, name, type]) => ({ id, name, type, notes: "", updatedAt: new Date().toISOString() }));
  const materials = materialSeed.map(([id, sourceId, name, kind]) => ({ id, sourceId, name, kind, defaultZone: kind === "Stone" ? "Stone" : "Near", notes: "", updatedAt: new Date().toISOString() }));
  const customerRows = [
    ["Durable Kempas", "Sand", "Near", "1x cuci ML/GSL"], ["Durable Senai", "Sand", "Near", "1x cuci ML/GSL"],
    ["Durable Ulu Choh", "Sand", "Far", "1x cuci ML/GSL"], ["Top Mix JB City", "Sand", "Near", "1x cuci ML/GSL"],
    ["Top Mix Kota Puteri", "Sand", "Near", "1x cuci ML/GSL"], ["Prima Precast", "Sand", "Near", "2x/3x cuci GSL"],
    ["CK Plentong", "Sand", "Near", "1x cuci ML/GSL"], ["CK Ulu Tiram", "Sand", "Near", "1x cuci GSL"],
    ["Zhin Heng Saleng", "Sand", "Near", "Zhin Heng mixed sand rule"], ["Ginson Kulai", "Sand", "Near", "1x cuci ML/GSL"],
    ["Ginson Seelong", "Sand", "Near", "1x cuci ML/GSL"], ["Kulai Chuan Seng", "Sand", "Near", "1x cuci ML/GSL"],
    ["Yong Seng Hardware K", "Sand", "Near", "Pasir Kasar ML"], ["Yong Seng Hardware S", "Sand", "Near", "Pasir Serdang ML"],
    ["Lim & Lam Hardware", "Sand", "Near", "1x cuci ML/GSL"], ["IPS Precast", "Sand", "Far", "2x cuci ML/GSL"],
    ["Aurum Precast", "Sand", "Far", "2x/3x cuci GSL"], ["CK Mutiara Bestari", "Sand", "Far", "1x cuci ML/GSL"],
    ["CK Lima Kedai", "Sand", "Far", "1x cuci ML/GSL"], ["Sudi Bina Bukit Amber", "Sand", "Far", "Pasir Jagung"],
    ["Xing Guang Tg Puteri", "Stone", "Stone", "Crusher Run"], ["Lien Soon Ulu Tiram", "Stone", "Stone", "Crusher Run"],
    ["Infraway Kong Kong CR", "Stone", "Stone", "Crusher Run"], ["Infraway Kong Kong 20mm", "Stone", "Stone", "20mm"],
    ["Infraway Kota Masai", "Stone", "Stone", "Crusher Run"], ["Infraway Desa Cemerlang CR", "Stone", "Stone", "Crusher Run"],
    ["Lien Soon Tg Langsat CR", "Stone", "Stone", "Crusher Run"], ["Lien Soon Tg Langsat 20mm", "Stone", "Stone", "20mm"],
    ["Xing Guang Desa Cemerlang", "Stone", "Stone", "20mm"],
  ];
  const customers = customerRows.map(([name, kind, defaultZone, rule]) => {
    const id = `customer-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;
    const materialIds = [...(materialRefs[rule] || [])];
    const materialName = materials.find((item) => item.id === materialIds[0])?.name || "";
    const sourceIds = materialIds.map((item) => materials.find((material) => material.id === item)?.sourceId).filter(Boolean);
    const anySource = ["1x cuci ML/GSL", "2x cuci ML/GSL", "Pasir Jagung"].includes(rule);
    const materialRules = name === "Zhin Heng Saleng" ? [
      { id: `${id}-rule-kasar`, materialName: "Pasir Kasar", sourceMode: "Any", sourceIds: [] },
      { id: `${id}-rule-serdang`, materialName: "Pasir Serdang", sourceMode: "Specific", sourceIds: ["src-ml"] },
      { id: `${id}-rule-halus`, materialName: "Pasir Halus", sourceMode: "Any", sourceIds: [] },
    ] : materialName ? [{ id: `${id}-rule-1`, materialName, sourceMode: anySource ? "Any" : "Specific", sourceIds: anySource ? [] : sourceIds }] : [];
    const allowedIds = materials.filter((material) => materialRules.some((item) => normalise(item.materialName) === normalise(material.name) && (item.sourceMode === "Any" || item.sourceIds.includes(material.sourceId)))).map((item) => item.id);
    return { id, name, kind, defaultZone, materialIds: allowedIds, materialRules, notes: "", updatedAt: new Date().toISOString() };
  });
  const orderRows = [
    ["Durable Kempas", 8], ["Durable Senai", 4], ["Top Mix JB City", 2], ["Top Mix Kota Puteri", 2],
    ["Zhin Heng Saleng", 1, "hantar pagi sebelum 12pm", true], ["Kulai Chuan Seng", 1, "hantar pagi sebelum 12pm", true],
    ["IPS Precast", 2], ["Sudi Bina Bukit Amber", 1], ["Infraway Kong Kong CR", 3],
  ];
  const customersByName = new Map(customers.map((item) => [item.name, item]));
  const orders = orderRows.map(([name, loads, notes = "", early = false]) => {
    const target = customersByName.get(name);
    return makeOrderFromMaterial({ id: uid("order"), date, customerId: target.id, loads, zone: target.defaultZone, kind: target.kind, materialId: defaultCustomerMaterialId({ sources, materials, customers }, target), early, notes }, { sources, materials, customers });
  });
  return {
    schemaVersion: 5, companyName: "My Transport Dispatch", notices: ["Operasi JPJ: check documents, tyre condition and load cover before moving."],
    trucks, sources, materials, customers, orders, assignments: [], tripLogs: [], makeUps: [],
    settings: { storageMode: "phone-only", lastBackupAt: "" }, updatedAt: new Date().toISOString(),
  };
}

export function sourceById(state, sourceId) { return state.sources.find((item) => item.id === sourceId); }
export function materialById(state, materialId) { return state.materials.find((item) => item.id === materialId); }
export function truckLabel(truck) { return [truck?.prefix, truck?.number].filter(Boolean).join(" ") || "Unknown truck"; }
export function customerAllowedMaterialIds(state, customer) {
  if (!customer) return [];
  const rules = Array.isArray(customer.materialRules) ? customer.materialRules : [];
  if (!rules.length) return (customer.materialIds || []).filter((id) => materialById(state, id));
  return state.materials.filter((material) => rules.some((rule) => normalise(rule.materialName) === normalise(material.name) && (rule.sourceMode === "Any" || (rule.sourceIds || []).includes(material.sourceId)))).map((material) => material.id);
}
export function defaultCustomerMaterialId(state, customer) { return customerAllowedMaterialIds(state, customer)[0] || ""; }
export function customerRuleSummary(state, customer) {
  const rules = Array.isArray(customer?.materialRules) ? customer.materialRules : [];
  if (!rules.length) return "No material rule";
  return rules.map((rule) => `${rule.materialName} (${rule.sourceMode === "Any" ? "any source" : (rule.sourceIds || []).map((id) => sourceById(state, id)?.name).filter(Boolean).join(" / ") || "choose source"})`).join("; ");
}
export function materialLabel(state, materialId) {
  const material = materialById(state, materialId);
  if (!material) return "Material not set";
  return `${material.name} — ${sourceById(state, material.sourceId)?.name || "Unknown source"}`;
}
export function sourceShort(sourceName) {
  const name = normalise(sourceName);
  if (name.includes("ming")) return "ML";
  if (name.includes("guan")) return "GSL";
  if (name.includes("linggiu") || name === "gd") return "GD";
  return sourceName || "-";
}

export function materialFields(state, materialId) {
  const material = materialById(state, materialId);
  const source = material && sourceById(state, material.sourceId);
  return {
    materialId: material?.id || "", sourceId: source?.id || "", source: source?.name || "", product: material?.name || "",
    productLabel: material ? `${material.name} ${sourceShort(source?.name)}` : "",
  };
}

export function makeOrderFromMaterial(order, state) {
  const customer = state.customers.find((item) => item.id === order.customerId);
  const materialId = order.materialId || defaultCustomerMaterialId(state, customer);
  const details = materialFields(state, materialId);
  return {
    ...order, ...details, kind: customer?.kind || order.kind || materialById(state, materialId)?.kind || "Sand",
    zone: order.zone || customer?.defaultZone || materialById(state, materialId)?.defaultZone || "Near", updatedAt: new Date().toISOString(),
  };
}

export function ensureState(raw) {
  const seed = defaultState();
  if (!raw || !Array.isArray(raw.trucks)) return seed;
  const state = {
    ...seed, ...raw, settings: { ...seed.settings, lastBackupAt: raw.settings?.lastBackupAt || "" }, notices: Array.isArray(raw.notices) ? raw.notices : seed.notices,
    trucks: raw.trucks.map((truck) => ({ ...truck, prefix: truck.prefix || "", number: truck.number || truck.registration || "", dailyMax: Number(truck.dailyMax ?? 3), nearMax: Number(truck.nearMax ?? 3), farMax: Number(truck.farMax ?? 1), stoneMax: Number(truck.stoneMax ?? 1), notes: truck.notes || "" })),
    sources: Array.isArray(raw.sources) && raw.sources.length ? raw.sources : seed.sources,
    materials: Array.isArray(raw.materials) && raw.materials.length ? raw.materials : seed.materials,
    customers: Array.isArray(raw.customers) ? raw.customers : seed.customers,
    orders: Array.isArray(raw.orders) ? raw.orders : [], assignments: Array.isArray(raw.assignments) ? raw.assignments : [],
    tripLogs: Array.isArray(raw.tripLogs) ? raw.tripLogs : [], makeUps: Array.isArray(raw.makeUps) ? raw.makeUps : [],
  };
  const findLegacyMaterial = (candidate, fallback = []) => {
    const supplied = normalise(candidate?.source || candidate?.supplier);
    const product = normalise(candidate?.product || candidate?.productLabel);
    return state.materials.find((material) => {
      const source = sourceById(state, material.sourceId);
      return (!supplied || normalise(source?.name).includes(supplied) || supplied.includes(normalise(source?.name))) && (!product || normalise(material.name) === product || normalise(candidate?.productLabel).includes(normalise(material.name)));
    })?.id || fallback[0] || "";
  };
  state.customers = state.customers.map((customer) => {
    let materialIds = Array.isArray(customer.materialIds) ? customer.materialIds.filter((id) => materialById(state, id)) : [];
    if (!materialIds.length && Array.isArray(customer.accepted)) materialIds = customer.accepted.map((rule) => findLegacyMaterial(rule)).filter(Boolean);
    if (!materialIds.length && customer.defaultProductLabel) materialIds = materialRefs[customer.defaultProductLabel] || [];
    const materialRules = Array.isArray(customer.materialRules) && customer.materialRules.length ? customer.materialRules.map((rule, index) => ({ id: rule.id || `${customer.id}-rule-${index + 1}`, materialName: rule.materialName || "", sourceMode: rule.sourceMode === "Any" ? "Any" : "Specific", sourceIds: Array.isArray(rule.sourceIds) ? rule.sourceIds.filter((id) => sourceById(state, id)) : [] })).filter((rule) => rule.materialName) : materialIds.reduce((rules, materialId) => {
      const material = materialById(state, materialId); if (!material) return rules;
      const existing = rules.find((rule) => normalise(rule.materialName) === normalise(material.name));
      if (existing) existing.sourceIds.push(material.sourceId); else rules.push({ id: `${customer.id}-rule-${rules.length + 1}`, materialName: material.name, sourceMode: "Specific", sourceIds: [material.sourceId] });
      return rules;
    }, []);
    const normalizedRules = materialRules.map((rule) => ({ ...rule, sourceIds: [...new Set(rule.sourceIds)] }));
    const normalizedCustomer = { ...customer, kind: customer.kind || "Sand", defaultZone: customer.defaultZone || "Near", materialRules: normalizedRules, notes: customer.notes || "" };
    return { ...normalizedCustomer, materialIds: customerAllowedMaterialIds(state, normalizedCustomer) };
  });
  state.orders = state.orders.map((order) => makeOrderFromMaterial({ ...order, materialId: order.materialId || findLegacyMaterial(order, state.customers.find((item) => item.id === order.customerId)?.materialIds) }, state));
  state.assignments = state.assignments.map((assignment) => makeOrderFromMaterial({ ...assignment, materialId: assignment.materialId || findLegacyMaterial(assignment, state.customers.find((item) => item.id === assignment.customerId)?.materialIds) }, state));
  state.schemaVersion = 5;
  return state;
}

function zoneKey(zone) {
  const normalized = normalise(zone);
  return normalized === "stone" || normalized === "batu" ? "stone" : normalized === "far" || normalized === "jauh" ? "far" : "near";
}
function isAvailable(truck) { return ["available", "active"].includes(normalise(truck.status)); }
function dayCounts(assignments, truckId) {
  const counts = { total: 0, near: 0, far: 0, stone: 0 };
  assignments.filter((item) => item.truckId === truckId).forEach((item) => { counts.total += 1; counts[zoneKey(item.zone)] += 1; });
  return counts;
}
function historicalLoads(tripLogs, truckId, date) {
  const from = new Date(`${date}T00:00:00`); from.setDate(from.getDate() - 30);
  return tripLogs.filter((log) => log.truckId === truckId && log.status === "Completed" && new Date(`${log.date}T00:00:00`) >= from).length;
}
function candidateScore({ truck, counts, historical, job, makeUps }) {
  const pending = makeUps.filter((item) => item.status === "Pending" && item.truckId === truck.id);
  const recovery = pending.find((item) => item.customerId === job.customerId);
  const repeatAvoid = pending.some((item) => item.avoidCustomerId === job.customerId);
  const zone = zoneKey(job.zone);
  const balanceBonus = zone === "far" && counts.near >= 3 ? -12 : zone === "stone" && counts.total >= 3 ? -8 : 0;
  return (counts.total * 100) + (historical * 6) + (counts[zone] * 30) + (job.early ? -60 : 0) + balanceBonus + (recovery ? -10000 : 0) + (repeatAvoid ? 3000 : 0);
}

export function renumberAssignments(assignments) {
  const grouped = new Map();
  assignments.forEach((assignment) => {
    const key = `${assignment.date}|${assignment.truckId}`;
    grouped.set(key, [...(grouped.get(key) || []), assignment]);
  });
  return [...grouped.values()].flatMap((items) => items.sort((a, b) => a.tripNumber - b.tripNumber || String(a.createdAt).localeCompare(String(b.createdAt))).map((assignment, index) => ({ ...assignment, tripNumber: index + 1 })));
}

export function buildDispatch(state, date, lockedAssignments = []) {
  const lockedByOrder = new Map();
  lockedAssignments.forEach((item) => lockedByOrder.set(item.orderId, (lockedByOrder.get(item.orderId) || 0) + 1));
  const targetOrders = state.orders.filter((order) => order.date === date && Number(order.loads) > 0).map((order) => ({ ...order, loads: Math.max(0, Number(order.loads) - (lockedByOrder.get(order.id) || 0)) }));
  const jobs = targetOrders.flatMap((order) => Array.from({ length: Number(order.loads) }, (_, index) => ({ ...order, loadIndex: index + 1 })));
  const priority = (job) => (job.early ? 0 : zoneKey(job.zone) === "far" ? 1 : zoneKey(job.zone) === "stone" ? 2 : 3);
  jobs.sort((left, right) => priority(left) - priority(right) || left.customerId.localeCompare(right.customerId));
  const trucks = state.trucks.filter(isAvailable);
  const created = [...lockedAssignments];
  const unresolved = [];
  for (const job of jobs) {
    const zone = zoneKey(job.zone);
    const candidates = trucks.filter((truck) => {
      const counts = dayCounts(created, truck.id);
      const zoneMax = Number(truck[`${zone}Max`] ?? truck.dailyMax);
      return counts.total < Number(truck.dailyMax) && counts[zone] < zoneMax;
    });
    if (!candidates.length) { unresolved.push({ ...job, reason: `No available truck capacity for ${job.zone}` }); continue; }
    const winner = candidates.map((truck) => ({ truck, score: candidateScore({ truck, counts: dayCounts(created, truck.id), historical: historicalLoads(state.tripLogs, truck.id, date), job, makeUps: state.makeUps }) })).sort((left, right) => left.score - right.score || truckLabel(left.truck).localeCompare(truckLabel(right.truck)))[0].truck;
    created.push({ id: uid("assignment"), date, truckId: winner.id, orderId: job.id, customerId: job.customerId, zone: job.zone, kind: job.kind, source: job.source, sourceId: job.sourceId, materialId: job.materialId, product: job.product, productLabel: job.productLabel, notes: job.notes, early: Boolean(job.early), status: "Planned", tripNumber: 0, createdAt: new Date().toISOString() });
  }
  const zoneOrder = { near: 0, far: 1, stone: 2 };
  const numbered = renumberAssignments(created.sort((a, b) => {
    if (a.truckId !== b.truckId) return a.truckId.localeCompare(b.truckId);
    if (Boolean(a.early) !== Boolean(b.early)) return Number(b.early) - Number(a.early);
    return (zoneOrder[zoneKey(a.zone)] ?? 9) - (zoneOrder[zoneKey(b.zone)] ?? 9) || String(a.createdAt).localeCompare(String(b.createdAt));
  }).map((assignment, index) => ({ ...assignment, tripNumber: index + 1 })));
  const makeUps = state.makeUps.map((item) => item.status !== "Pending" ? item : (numbered.some((assignment) => assignment.truckId === item.truckId && assignment.customerId === item.customerId) ? { ...item, status: "Scheduled", scheduledFor: date } : item));
  return { assignments: numbered, unresolved, makeUps };
}

export function applyDispatch(state, date) {
  const locked = state.assignments.filter((assignment) => assignment.date === date && (assignment.status !== "Planned" || state.tripLogs.some((log) => log.assignmentId === assignment.id)));
  const result = buildDispatch(state, date, locked);
  return { ...state, assignments: [...state.assignments.filter((assignment) => assignment.date !== date), ...result.assignments], makeUps: result.makeUps, lastAllocation: { date, unresolved: result.unresolved, createdAt: new Date().toISOString() }, updatedAt: new Date().toISOString() };
}

export function assignmentSummary(state, assignment) {
  const customer = state.customers.find((item) => item.id === assignment.customerId);
  const truck = state.trucks.find((item) => item.id === assignment.truckId);
  return { customerName: customer?.name || "Unknown customer", truckNo: truckLabel(truck) };
}

export function recordActualTrip(state, assignmentId, { actualCustomerId, status, remark }) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return state;
  const actual = actualCustomerId || assignment.customerId;
  const completed = status === "Completed";
  const changed = actual !== assignment.customerId || !completed;
  const existing = state.tripLogs.find((log) => log.assignmentId === assignmentId);
  const log = { id: existing?.id || uid("log"), assignmentId, date: assignment.date, truckId: assignment.truckId, plannedCustomerId: assignment.customerId, actualCustomerId: actual, status, remark: remark || "", recordedAt: existing?.recordedAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const makeUps = state.makeUps.filter((item) => item.assignmentId !== assignmentId);
  if (changed) makeUps.push({ id: uid("recovery"), assignmentId, truckId: assignment.truckId, customerId: assignment.customerId, avoidCustomerId: actual !== assignment.customerId ? actual : "", status: "Pending", reason: completed ? "Delivered a different customer" : status, createdAt: new Date().toISOString() });
  return { ...state, assignments: state.assignments.map((item) => item.id === assignmentId ? { ...item, status, updatedAt: new Date().toISOString() } : item), tripLogs: [...state.tripLogs.filter((item) => item.assignmentId !== assignmentId), log], makeUps, updatedAt: new Date().toISOString() };
}

export function tallyForDate(state, date) {
  const lines = new Map();
  state.orders.filter((order) => order.date === date).forEach((order) => {
    const current = lines.get(order.customerId) || { customerId: order.customerId, required: 0, planned: 0 };
    current.required += Number(order.loads || 0); lines.set(order.customerId, current);
  });
  state.assignments.filter((assignment) => assignment.date === date && assignment.status !== "Skipped").forEach((assignment) => {
    const current = lines.get(assignment.customerId) || { customerId: assignment.customerId, required: 0, planned: 0 };
    current.planned += 1; lines.set(assignment.customerId, current);
  });
  return [...lines.values()].map((line) => ({ ...line, customerName: state.customers.find((item) => item.id === line.customerId)?.name || "Unknown customer", balance: line.planned - line.required })).sort((left, right) => left.customerName.localeCompare(right.customerName));
}

export function makeWhatsAppMessage(state, date) {
  const assignments = state.assignments.filter((item) => item.date === date).sort((a, b) => a.tripNumber - b.tripNumber);
  const truckNo = (assignment) => assignmentSummary(state, assignment).truckNo;
  const customerName = (assignment) => assignmentSummary(state, assignment).customerName;
  const sand = assignments.filter((item) => normalise(item.kind) === "sand");
  const stone = assignments.filter((item) => normalise(item.kind) === "stone");
  const uniqueTrucks = (items) => [...new Set(items.map(truckNo))].join("/") || "-";
  const sandSources = state.sources.filter((source) => source.type === "Sandpit").map((source) => `Masuk Lombong ${source.name}: ${uniqueTrucks(sand.filter((item) => item.sourceId === source.id || item.source === source.name))}`);
  const sandGroups = new Map();
  sand.forEach((assignment) => {
    const key = `${assignment.customerId}|${assignment.materialId}|${assignment.notes || ""}`;
    sandGroups.set(key, [...(sandGroups.get(key) || []), assignment]);
  });
  const sandLines = [...sandGroups.values()].map((items) => {
    const sample = items[0];
    const material = materialById(state, sample.materialId);
    const spec = material ? `${material.name} ${sourceShort(sourceById(state, material.sourceId)?.name)}` : sample.productLabel || sample.product;
    return `${customerName(sample)}:\n${spec} - ${items.length} (${items.map(truckNo).join("/")})${sample.notes ? `\n**${sample.notes}` : ""}`;
  });
  const stoneGroups = new Map();
  stone.forEach((assignment) => {
    const key = `${assignment.customerId}|${assignment.materialId}|${assignment.notes || ""}`;
    stoneGroups.set(key, [...(stoneGroups.get(key) || []), assignment]);
  });
  const stoneLines = [...stoneGroups.values()].map((items) => {
    const sample = items[0];
    const material = materialById(state, sample.materialId);
    const source = sourceById(state, material?.sourceId || sample.sourceId)?.name || sample.source || "Quarry";
    return `${source} ke ${customerName(sample)}:\n${material?.name || sample.product || sample.productLabel} - ${items.length} (${items.map(truckNo).join("/")})${sample.notes ? `\n**${sample.notes}` : ""}`;
  });
  const notices = (state.notices || []).filter(Boolean).map((notice) => `**${notice}`).join("\n");
  return ["Esok order pasir", "", sandSources.join("\n"), "", sandLines.join("\n\n") || "- Tiada order pasir", "", "---------------------------------------------------", "", "Esok order batu", "", stoneLines.join("\n\n") || "- Tiada order batu", "", "Kalau siap order pasir, boleh masuk ambil order quarry yang diberi.", notices ? `\nPeringatan semua driver:\n${notices}` : ""].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function loadScore(state, truckId, date) {
  const historical = historicalLoads(state.tripLogs, truckId, date);
  const planned = state.assignments.filter((item) => item.date === date && item.truckId === truckId).length;
  return { historical, planned, total: historical + planned };
}
