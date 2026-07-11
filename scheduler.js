export const todayISO = () => new Date().toISOString().slice(0, 10);

export const tomorrowISO = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
};

export const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const normalise = (value) => String(value || "").trim().toLowerCase();

export function defaultState() {
  const date = tomorrowISO();
  const trucks = [
    ["1349", "Off", 3], ["1390", "Off", 3], ["1867", "Available", 4], ["3726", "Off", 3],
    ["3772", "Available", 4], ["4460", "Off", 3], ["5274", "Available", 4], ["6128", "Off", 3],
    ["6307", "Available", 3], ["7914", "Available", 5], ["7962", "Available", 4], ["9465", "Available", 5],
  ].map(([number, status, dailyMax]) => ({
    id: `truck-${number}`,
    number,
    status,
    dailyMax,
    nearMax: Math.min(3, dailyMax),
    farMax: 1,
    stoneMax: 1,
    notes: "",
    updatedAt: new Date().toISOString(),
  }));

  const products = {
    "1x cuci ML/GSL": { product: "1x cuci", sources: ["MingLiong Mados", "GuanSengLee"] },
    "1x cuci GSL": { product: "1x cuci", sources: ["GuanSengLee"] },
    "2x cuci ML/GSL": { product: "2x cuci", sources: ["MingLiong Mados", "GuanSengLee"] },
    "2x/3x cuci GSL": { product: "2x/3x cuci", sources: ["GuanSengLee"] },
    "Pasir Kasar ML": { product: "Pasir Kasar", sources: ["MingLiong Mados"] },
    "Pasir Serdang ML": { product: "Pasir Serdang", sources: ["MingLiong Mados"] },
    "Pasir Halus GSL": { product: "Pasir Halus", sources: ["GuanSengLee"] },
    "Pasir Jagung": { product: "Pasir Jagung", sources: ["MingLiong Mados", "GuanSengLee"] },
  };
  const customerRows = [
    ["Durable Kempas", "Sand", "Near", "1x cuci ML/GSL"], ["Durable Senai", "Sand", "Near", "1x cuci ML/GSL"],
    ["Durable Ulu Choh", "Sand", "Far", "1x cuci ML/GSL"], ["Top Mix JB City", "Sand", "Near", "1x cuci ML/GSL"],
    ["Top Mix Kota Puteri", "Sand", "Near", "1x cuci ML/GSL"], ["Prima Precast", "Sand", "Near", "2x/3x cuci GSL"],
    ["CK Plentong", "Sand", "Near", "1x cuci ML/GSL"], ["CK Ulu Tiram", "Sand", "Near", "1x cuci GSL"],
    ["Zhin Heng Saleng K", "Sand", "Near", "Pasir Kasar ML"], ["Zhin Heng Saleng S", "Sand", "Near", "Pasir Serdang ML"],
    ["Zhin Heng Saleng H", "Sand", "Near", "Pasir Halus GSL"], ["Ginson Kulai", "Sand", "Near", "1x cuci ML/GSL"],
    ["Ginson Seelong", "Sand", "Near", "1x cuci ML/GSL"], ["Kulai Chuan Seng", "Sand", "Near", "1x cuci ML/GSL"],
    ["Yong Seng Hardware K", "Sand", "Near", "Pasir Kasar ML"], ["Yong Seng Hardware S", "Sand", "Near", "Pasir Serdang ML"],
    ["Lim & Lam Hardware", "Sand", "Near", "1x cuci ML/GSL"], ["IPS Precast", "Sand", "Far", "2x cuci ML/GSL"],
    ["Aurum Precast", "Sand", "Far", "2x/3x cuci GSL"], ["CK Mutiara Bestari", "Sand", "Far", "1x cuci ML/GSL"],
    ["CK Lima Kedai", "Sand", "Far", "1x cuci ML/GSL"], ["Sudi Bina Bukit Amber", "Sand", "Far", "Pasir Jagung"],
    ["Xing Guang Tg Puteri", "Stone", "Stone", "Crusher Run", "KL Building"],
    ["Lien Soon Ulu Tiram", "Stone", "Stone", "Crusher Run", "KL Building"],
    ["Infraway Kong Kong CR", "Stone", "Stone", "Crusher Run", "KL Building"],
    ["Infraway Kong Kong 20mm", "Stone", "Stone", "20mm", "KL Building"],
    ["Infraway Kota Masai", "Stone", "Stone", "Crusher Run", "KL Building"],
    ["Infraway Desa Cemerlang CR", "Stone", "Stone", "Crusher Run", "KL Building"],
    ["Lien Soon Tg Langsat CR", "Stone", "Stone", "Crusher Run", "KL Building"],
    ["Lien Soon Tg Langsat 20mm", "Stone", "Stone", "20mm", "KL Building"],
    ["Xing Guang Desa Cemerlang", "Stone", "Stone", "20mm", "KL Building"],
  ];
  const customers = customerRows.map(([name, kind, zone, preset, source]) => {
    const compatibility = products[preset];
    return {
      id: `customer-${name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`,
      name,
      kind,
      defaultZone: zone,
      accepted: kind === "Sand"
        ? (compatibility?.sources || []).map((supplier) => ({ supplier, product: compatibility.product }))
        : [{ supplier: source || "KL Building", product: preset }],
      defaultProductLabel: preset,
      notes: "",
      updatedAt: new Date().toISOString(),
    };
  });
  const byName = (name) => customers.find((customer) => customer.name === name)?.id;
  const orderRows = [
    ["Durable Kempas", 8], ["Durable Senai", 4], ["Top Mix JB City", 2], ["Top Mix Kota Puteri", 2],
    ["Zhin Heng Saleng K", 1, "hantar pagi sebelum 12pm", true], ["Kulai Chuan Seng", 1, "hantar pagi sebelum 12pm", true],
    ["IPS Precast", 2], ["Sudi Bina Bukit Amber", 1], ["Infraway Kong Kong CR", 3],
  ];
  const orders = orderRows.map(([name, loads, notes = "", early = false]) => {
    const customer = customers.find((item) => item.name === name);
    return {
      id: uid("order"), date, customerId: customer.id, loads, zone: customer.defaultZone,
      kind: customer.kind, source: customer.accepted[0]?.supplier || "", product: customer.accepted[0]?.product || "",
      productLabel: customer.defaultProductLabel, early, notes, updatedAt: new Date().toISOString(),
    };
  });
  return {
    schemaVersion: 1,
    companyName: "My Transport Dispatch",
    notices: ["Operasi JPJ: check documents, tyre condition and load cover before moving."],
    trucks, customers, orders, assignments: [], tripLogs: [], makeUps: [],
    settings: { endpoint: "", syncSecret: "", lastSyncAt: "" },
  };
}

function zoneKey(zone) {
  const normalized = normalise(zone);
  return normalized === "stone" || normalized === "batu" ? "stone" : normalized === "far" || normalized === "jauh" ? "far" : "near";
}

function isAvailable(truck) {
  return normalise(truck.status) === "available" || normalise(truck.status) === "active";
}

function dayCounts(assignments, truckId) {
  const counts = { total: 0, near: 0, far: 0, stone: 0 };
  assignments.filter((item) => item.truckId === truckId).forEach((item) => {
    counts.total += 1;
    counts[zoneKey(item.zone)] += 1;
  });
  return counts;
}

function historicalLoads(tripLogs, truckId, date) {
  const from = new Date(`${date}T00:00:00`);
  from.setDate(from.getDate() - 30);
  return tripLogs.filter((log) => log.truckId === truckId && log.status === "Completed" && new Date(`${log.date}T00:00:00`) >= from).length;
}

function candidateScore({ truck, counts, historical, job, makeUps }) {
  const pending = makeUps.filter((item) => item.status === "Pending" && item.truckId === truck.id);
  const recovery = pending.find((item) => item.customerId === job.customerId);
  const repeatAvoid = pending.some((item) => item.avoidCustomerId === job.customerId);
  const zone = zoneKey(job.zone);
  const imbalance = zone === "far" && counts.near >= 3 ? -12 : zone === "stone" && counts.total >= 3 ? -8 : 0;
  return (counts.total * 100) + (historical * 6) + (counts[zone] * 30) + (job.early ? -60 : 0) + imbalance + (recovery ? -10000 : 0) + (repeatAvoid ? 3000 : 0);
}

export function buildDispatch(state, date) {
  const customers = new Map(state.customers.map((customer) => [customer.id, customer]));
  const targetOrders = state.orders.filter((order) => order.date === date && Number(order.loads) > 0);
  const jobs = targetOrders.flatMap((order) => Array.from({ length: Number(order.loads) }, (_, index) => ({ ...order, loadIndex: index + 1 })));
  const priority = (job) => (job.early ? 0 : zoneKey(job.zone) === "far" ? 1 : zoneKey(job.zone) === "stone" ? 2 : 3);
  jobs.sort((left, right) => priority(left) - priority(right) || left.customerId.localeCompare(right.customerId));
  const trucks = state.trucks.filter(isAvailable);
  const created = [];
  const unresolved = [];

  for (const job of jobs) {
    const zone = zoneKey(job.zone);
    const candidates = trucks.filter((truck) => {
      const counts = dayCounts(created, truck.id);
      const zoneMax = Number(truck[`${zone}Max`] ?? truck.dailyMax);
      return counts.total < Number(truck.dailyMax) && counts[zone] < zoneMax;
    });
    if (!candidates.length) {
      unresolved.push({ ...job, reason: `No available truck capacity for ${job.zone}` });
      continue;
    }
    const winner = candidates
      .map((truck) => ({
        truck,
        score: candidateScore({
          truck, counts: dayCounts(created, truck.id), historical: historicalLoads(state.tripLogs, truck.id, date), job, makeUps: state.makeUps,
        }),
      }))
      .sort((left, right) => left.score - right.score || left.truck.number.localeCompare(right.truck.number))[0].truck;
    created.push({
      id: uid("assignment"), date, truckId: winner.id, orderId: job.id, customerId: job.customerId,
      zone: job.zone, kind: job.kind, source: job.source, product: job.product, productLabel: job.productLabel,
      notes: job.notes, early: Boolean(job.early), status: "Planned", tripNumber: 0, createdAt: new Date().toISOString(),
    });
  }

  const zoneOrder = { near: 0, far: 1, stone: 2 };
  trucks.forEach((truck) => {
    const own = created.filter((assignment) => assignment.truckId === truck.id);
    own.sort((left, right) => {
      if (Boolean(right.early) !== Boolean(left.early)) return Number(right.early) - Number(left.early);
      return (zoneOrder[zoneKey(left.zone)] ?? 9) - (zoneOrder[zoneKey(right.zone)] ?? 9);
    });
    own.forEach((assignment, index) => { assignment.tripNumber = index + 1; });
  });
  const makeUps = state.makeUps.map((item) => {
    if (item.status !== "Pending") return item;
    const recovered = created.some((assignment) => assignment.truckId === item.truckId && assignment.customerId === item.customerId);
    return recovered ? { ...item, status: "Scheduled", scheduledFor: date } : item;
  });
  return { assignments: created, unresolved, makeUps, customers };
}

export function applyDispatch(state, date) {
  const result = buildDispatch(state, date);
  return {
    ...state,
    assignments: [...state.assignments.filter((assignment) => assignment.date !== date), ...result.assignments],
    makeUps: result.makeUps,
    lastAllocation: { date, unresolved: result.unresolved, createdAt: new Date().toISOString() },
  };
}

export function assignmentSummary(state, assignment) {
  const customer = state.customers.find((item) => item.id === assignment.customerId);
  const truck = state.trucks.find((item) => item.id === assignment.truckId);
  return { customerName: customer?.name || "Unknown customer", truckNo: truck?.number || "Unknown truck" };
}

export function recordActualTrip(state, assignmentId, { actualCustomerId, status, remark }) {
  const assignment = state.assignments.find((item) => item.id === assignmentId);
  if (!assignment) return state;
  const completed = status === "Completed";
  const actual = actualCustomerId || assignment.customerId;
  const changed = actual !== assignment.customerId || !completed;
  const existing = state.tripLogs.find((log) => log.assignmentId === assignmentId);
  const log = {
    id: existing?.id || uid("log"), assignmentId, date: assignment.date, truckId: assignment.truckId,
    plannedCustomerId: assignment.customerId, actualCustomerId: actual, status, remark: remark || "", recordedAt: new Date().toISOString(),
  };
  const makeUps = state.makeUps.filter((item) => item.assignmentId !== assignmentId);
  if (changed) makeUps.push({
    id: uid("recovery"), assignmentId, truckId: assignment.truckId, customerId: assignment.customerId,
    avoidCustomerId: actual !== assignment.customerId ? actual : "", status: "Pending", reason: completed ? "Delivered a different customer" : status,
    createdAt: new Date().toISOString(),
  });
  return {
    ...state,
    assignments: state.assignments.map((item) => item.id === assignmentId ? { ...item, status } : item),
    tripLogs: [...state.tripLogs.filter((item) => item.assignmentId !== assignmentId), log], makeUps,
  };
}

function shortSource(source) {
  const name = normalise(source);
  if (name.includes("ming")) return "ML";
  if (name.includes("guan")) return "GSL";
  if (name.includes("linggiu") || name === "gd") return "GD";
  return source || "-";
}

export function makeWhatsAppMessage(state, date) {
  const assignments = state.assignments.filter((item) => item.date === date).sort((a, b) => a.tripNumber - b.tripNumber);
  const truckNo = (assignment) => assignmentSummary(state, assignment).truckNo;
  const customerName = (assignment) => assignmentSummary(state, assignment).customerName;
  const sand = assignments.filter((item) => normalise(item.kind) === "sand");
  const stone = assignments.filter((item) => normalise(item.kind) === "stone");
  const unique = (items) => [...new Set(items)].join("/") || "-";
  const sandSources = ["GD Linggiu", "MingLiong Mados", "GuanSengLee"].map((source) => {
    const tokens = normalise(source).includes("ming") ? ["ming"] : normalise(source).includes("guan") ? ["guan"] : ["linggiu", " gd"];
    return [source, unique(sand.filter((item) => tokens.some((token) => normalise(item.source).includes(token))).map(truckNo))];
  });
  const customerLines = [];
  const groupSand = new Map();
  sand.forEach((assignment) => {
    const key = `${assignment.customerId}|${assignment.productLabel || assignment.product}|${assignment.source}|${assignment.notes || ""}`;
    groupSand.set(key, [...(groupSand.get(key) || []), assignment]);
  });
  [...groupSand.values()].forEach((items) => {
    const example = items[0];
    const spec = example.productLabel || `${example.product} ${shortSource(example.source)}`;
    customerLines.push(`${customerName(example)}:\n${spec} - ${items.length} (${items.map(truckNo).join("/")})${example.notes ? `\n**${example.notes}` : ""}`);
  });
  const stoneLines = [];
  const groupStone = new Map();
  stone.forEach((assignment) => {
    const key = `${assignment.customerId}|${assignment.source}|${assignment.product}|${assignment.notes || ""}`;
    groupStone.set(key, [...(groupStone.get(key) || []), assignment]);
  });
  [...groupStone.values()].forEach((items) => {
    const example = items[0];
    stoneLines.push(`${example.source || "Quarry"} ke ${customerName(example)}:\n${example.product || example.productLabel} - ${items.length} (${items.map(truckNo).join("/")})${example.notes ? `\n**${example.notes}` : ""}`);
  });
  const notices = (state.notices || []).filter(Boolean).map((notice) => `**${notice}`).join("\n");
  const sourceText = sandSources.map(([source, numbers]) => `Masuk Lombong ${source}: ${numbers}`).join("\n");
  return [
    "Esok order pasir", "", sourceText, "", customerLines.join("\n\n") || "- Tiada order pasir", "",
    "---------------------------------------------------", "", "Esok order batu", "", stoneLines.join("\n\n") || "- Tiada order batu", "",
    "Kalau siap order pasir, boleh masuk ambil order quarry yang diberi.", notices ? `\nPeringatan semua driver:\n${notices}` : "",
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function loadScore(state, truckId, date) {
  const historical = historicalLoads(state.tripLogs, truckId, date);
  const planned = state.assignments.filter((item) => item.date === date && item.truckId === truckId).length;
  return { historical, planned, total: historical + planned };
}
