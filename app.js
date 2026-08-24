const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const roundRows = $("#roundRows");
const customerRows = $("#customerRows");
const template = $("#customerTemplate");
const number = (value) => Math.max(0, Number(value) || 0);
const decimal = (value) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value);
const money = (value) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value);

const defaultCatalog = [
  { id: "salmon45", sku: 811675, description: "Fresh Salmon 4–5 kg", standard: 370, single: 365, ten: 360 },
  { id: "salmon56", sku: 129101, description: "Fresh Salmon 5–6 kg", standard: 385, single: 380, ten: 375 },
];
const repeatWeek = (days) => Array.from({ length: 4 }, () => [...days]).flat();
const defaultCustomerPlans = [
  { name: "พี่เชอร์รี่ ตลาดชลบุรี แซลมอนแคท", schedule: repeatWeek([10, 10, 10, 10, 15, 20, 20]) },
  { name: "อูมามิ", schedule: repeatWeek(["", "15-20", "", "", "15-20", "", ""]) },
  { name: "ซูชิไข่หวานสามพราน", schedule: repeatWeek(["5ตัว", "5ตัว", "5ตัว", "5ตัว", "5ตัว", "5ตัว", "5ตัว"]) },
  { name: "ไฟท์โตะ", schedule: repeatWeek(["10ตัว", "10ตัว", "10ตัว", "10ตัว", "10ตัว", "10ตัว", "10ตัว"]) },
  { name: "นินจามีสามสาขา", schedule: repeatWeek(["5-6ตัว", "5-6ตัว", "5-6ตัว", "5-6ตัว", "5-6ตัว", "5-6ตัว", "5-6ตัว"]) },
  { name: "มาตาเนะนครชัยศรี", schedule: repeatWeek(["6ตัว", "", "6ตัว", "", "6ตัว", "", "6ตัว"]) },
  { name: "ทะเลดอง", schedule: repeatWeek([2, 2, 2, 2, 2, 2, 2]) },
  { name: "พี่เมย์ซีฟู๊ด", schedule: repeatWeek([5, "", "", 5, "", "", 5]) },
  { name: "แหม่มสลัด", schedule: repeatWeek(["2ตัว", "2ตัว", "2ตัว", "2ตัว", "2ตัว", "2ตัว", "2ตัว"]) },
  { name: "ไข่หวานพอสสิจูด", schedule: repeatWeek(["1ตัว", "1ตัว", "1ตัว", "1ตัว", "1ตัว", "1ตัว", "1ตัว"]) },
  { name: "โคฟูกุ", schedule: repeatWeek(["2-4ตัว", "2-4ตัว", "2-4ตัว", "2-4ตัว", "2-4ตัว", "2-4ตัว", "2-4ตัว"]) },
];
const defaultState = {
  inputs: { branch: "SALAYA", dc: 953, product: "salmon56", sku: 129101, priceTier: "single", price: 380, openingStock: 0, safetyStock: 5, planMode: "mid", kgPerCarton: 22, etaDates: "24, 26, 28 Aug 2026", pricePeriod: "25–31 Aug 2026" },
  priceCatalog: defaultCatalog,
  rounds: [
    { date: "2026-08-31", days: 2, retail: 16, promo: 0 },
    { date: "2026-09-02", days: 2, retail: 17, promo: 0 },
    { date: "2026-09-04", days: 3, retail: 19, promo: 0 },
  ],
  customers: [],
  customerPlans: defaultCustomerPlans,
};
let state = structuredClone(defaultState);
let sourceReady = false;
let selectedSourceFile = null;
let selectedCustomerFile = null;

function customerCartons(row) {
  const divisor = row.unit === "fish" ? 4 : 1;
  const confirmed = number(row.confirmed);
  if (confirmed > 0) return confirmed / divisor;
  const min = number(row.min); const max = number(row.max);
  return (state.inputs.planMode === "high" ? max : (min + max) / 2) / divisor;
}
function orderToUnits(value) {
  const raw = String(value ?? "").trim(); if (!raw) return 0;
  const values = (raw.match(/\d+(?:\.\d+)?/g) || []).map(Number); if (!values.length) return 0;
  const average = values.reduce((sum, item) => sum + item, 0) / values.length;
  return /ตัว/.test(raw) ? { cartons: 0, fish: average } : { cartons: average, fish: 0 };
}
function orderToCartons(value) {
  const units = orderToUnits(value); return units ? units.cartons + units.fish / 4 : 0;
}
function addUnits(total, value) {
  const units = orderToUnits(value); if (!units) return total;
  return { cartons: total.cartons + units.cartons, fish: total.fish + units.fish };
}
function customerWeekTotals() {
  return Array.from({ length: 4 }, (_, week) => state.customerPlans.reduce((total, customer) => customer.schedule.slice(week * 7, week * 7 + 7).reduce(addUnits, total), { cartons: 0, fish: 0 }));
}
function regularCustomerDemand(round) {
  const firstDate = new Date(`${state.rounds[0]?.date || "2026-08-31"}T00:00:00`); const monday = new Date(firstDate);
  monday.setDate(firstDate.getDate() - ((firstDate.getDay() + 6) % 7));
  const arrival = new Date(`${round.date}T00:00:00`); const start = Math.round((arrival - monday) / 86400000);
  return Array.from({ length: number(round.days) }, (_, day) => state.customerPlans.reduce((sum, customer) => sum + orderToCartons(customer.schedule[start + day]), 0)).reduce((sum, value) => sum + value, 0);
}
function plannedData() {
  let stock = number(state.inputs.openingStock);
  const safety = number(state.inputs.safetyStock);
  const kgPerCarton = number(state.inputs.kgPerCarton);
  return state.rounds.map((round, index) => {
    const customer = regularCustomerDemand(round);
    const demand = number(round.days) * number(round.retail) + customer + number(round.promo);
    const recommended = Math.ceil(Math.max(0, demand + safety - stock));
    const closing = stock + recommended - demand;
    const item = { ...round, index: index + 1, customer, demand, opening: stock, recommended, kg: recommended * kgPerCarton, closing };
    stock = closing;
    return item;
  });
}
function renderRounds() {
  const rows = plannedData();
  roundRows.innerHTML = rows.map((row) => `<tr>
    <td>รอบ ${row.index}</td><td><input data-round="${row.index - 1}" data-key="date" type="date" value="${row.date}" /></td>
    <td><input data-round="${row.index - 1}" data-key="days" type="number" min="1" step="1" value="${row.days}" /></td>
    <td><input data-round="${row.index - 1}" data-key="retail" type="number" min="0" step="0.5" value="${row.retail}" /></td>
    <td>${decimal(row.customer)}</td><td><input data-round="${row.index - 1}" data-key="promo" type="number" min="0" step="0.5" value="${row.promo}" /></td>
    <td><b>${decimal(row.demand)}</b></td><td>${decimal(row.opening)}</td><td><b>${decimal(row.recommended)}</b></td><td>${decimal(row.kg)}</td><td class="${row.closing < number(state.inputs.safetyStock) ? "low-stock" : ""}">${decimal(row.closing)}</td>
  </tr>`).join("");
  $$("[data-round]").forEach((input) => input.addEventListener("input", (event) => { state.rounds[event.target.dataset.round][event.target.dataset.key] = event.target.value; update(); }));
}
function renderCustomers() {
  const dayNames = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
  $("#customerHead").innerHTML = `<tr><th rowspan="2" class="customer-name-head">ลูกค้าประจำ</th>${[1, 2, 3, 4].map((week) => `<th colspan="7" class="week-head week-${week}">สัปดาห์ที่ ${week}</th>`).join("")}<th rowspan="2">รวม 4 สัปดาห์<br>(ลัง / ตัว)</th><th rowspan="2"></th></tr><tr>${Array.from({ length: 4 }, () => dayNames.map((day) => `<th>${day}</th>`).join("")).join("")}</tr>`;
  customerRows.innerHTML = state.customerPlans.map((customer, index) => {
    const weekly = Array.from({ length: 4 }, (_, week) => customer.schedule.slice(week * 7, week * 7 + 7).reduce(addUnits, { cartons: 0, fish: 0 }));
    const days = Array.from({ length: 28 }, (_, day) => `<td><input class="customer-day" data-customer="${index}" data-day="${day}" value="${escapeHtml(customer.schedule[day] ?? "")}" aria-label="${escapeHtml(customer.name || "ลูกค้าใหม่")} วันที่ ${day + 1}" /></td>`).join("");
    const total = weekly.reduce((sum, value) => ({ cartons: sum.cartons + value.cartons, fish: sum.fish + value.fish }), { cartons: 0, fish: 0 });
    return `<tr><td class="customer-name"><input class="customer-name-input" data-customer-name="${index}" value="${escapeHtml(customer.name)}" placeholder="ชื่อลูกค้าใหม่" /></td>${days}<td class="customer-total"><b>${decimal(total.cartons)} ลัง</b><small>${decimal(total.fish)} ตัว</small></td><td><button class="icon-button delete-customer" data-delete-customer="${index}" aria-label="ลบลูกค้า">×</button></td></tr>`;
  }).join("");
  const totals = customerWeekTotals();
  const grandTotal = totals.reduce((sum, value) => ({ cartons: sum.cartons + value.cartons, fish: sum.fish + value.fish }), { cartons: 0, fish: 0 });
  $("#customerWeekSummary").innerHTML = [...totals, grandTotal].map((value, index) => `<div><span>${index < 4 ? `สัปดาห์ ${index + 1}` : "รวม 4 สัปดาห์"}</span><strong>${decimal(value.cartons)}</strong><small>ลัง</small><b>${decimal(value.fish)} ตัว</b></div>`).join("");
  $$(".customer-day").forEach((input) => input.addEventListener("change", (event) => { const { customer, day } = event.target.dataset; state.customerPlans[customer].schedule[day] = event.target.value; persistState(); update(); }));
  $$(".customer-name-input").forEach((input) => input.addEventListener("change", (event) => { state.customerPlans[event.target.dataset.customerName].name = event.target.value; persistState(); update(); }));
  $$(".delete-customer").forEach((button) => button.addEventListener("click", () => { state.customerPlans.splice(button.dataset.deleteCustomer, 1); persistState(); update(); }));
}
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character])); }
function persistState() { localStorage.setItem("plan-salmon-salaya", JSON.stringify(state)); }
function setSourceReady(ready) { sourceReady = ready; $("#sourceGate").hidden = ready; $("#plannerContent").hidden = !ready; }
function thaiDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}
function renderWeeklyPlan() {
  const rows = plannedData(); const product = state.priceCatalog.find((item) => item.id === state.inputs.product) || state.priceCatalog[0];
  const cartons = rows.reduce((sum, row) => sum + row.recommended, 0); const kg = rows.reduce((sum, row) => sum + row.kg, 0); const value = kg * number(state.inputs.price);
  $("#weeklyDates").textContent = rows.map((row) => thaiDate(row.date)).join(" • ");
  $("#weeklyPricePeriod").textContent = `ราคาอ้างอิงมีผล ${state.inputs.pricePeriod}`;
  $("#weeklyProduct").textContent = product?.description || "—"; $("#weeklySku").textContent = state.inputs.sku; $("#weeklyPrice").textContent = money(state.inputs.price);
  $("#weeklyCartons").textContent = `${decimal(cartons)} ลัง`; $("#weeklyKg").textContent = `${decimal(kg)} กก.`; $("#weeklyValue").textContent = money(value);
  $("#weeklyRounds").innerHTML = rows.map((row) => `<article class="weekly-round"><span class="round-label">รอบเข้า DC ${row.index}</span><span class="date">${thaiDate(row.date)} • ครอบคลุม ${decimal(row.days)} วัน</span><div class="numbers"><strong>${decimal(row.recommended)}</strong><span>ลังแนะนำเข้า<br>${decimal(row.kg)} กก.</span></div><div class="details"><span>Demand ${decimal(row.demand)} ลัง</span><span>ปลายรอบ ${decimal(row.closing)} ลัง</span></div></article>`).join("");
}
function applyProductPrice() {
  const product = state.priceCatalog.find((item) => item.id === state.inputs.product) || state.priceCatalog[0];
  if (!product) return;
  state.inputs.product = product.id;
  state.inputs.sku = product.sku;
  state.inputs.price = product[state.inputs.priceTier] ?? product.standard;
}
function renderPriceBand() {
  $("#pricePeriodLabel").textContent = `มีผล ${state.inputs.pricePeriod}`;
  $("#priceRows").innerHTML = state.priceCatalog.map((item) => `<tr data-product="${item.id}" class="${item.id === state.inputs.product ? "active" : ""}"><td>${item.description}</td><td>${decimal(item.standard)}</td><td>${decimal(item.single)}</td><td>${decimal(item.ten)}</td></tr>`).join("");
}
function renderProducts() {
  const selector = $("#product");
  selector.innerHTML = state.priceCatalog.map((item) => `<option value="${item.id}">${item.description}</option>`).join("");
  selector.value = state.inputs.product;
}
function numericValue(value) {
  const normalized = String(value ?? "").replace(/[^0-9.\-]/g, "");
  return Number(normalized) || 0;
}
const xmlNodes = (document, name) => [...document.getElementsByTagName("*")].filter((node) => node.localName === name);
const childNode = (node, name) => [...node.children].find((child) => child.localName === name);
const columnIndex = (reference) => [...reference.match(/[A-Z]+/)[0]].reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
async function unzipXlsx(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (offset) => view.getUint16(offset, true); const u32 = (offset) => view.getUint32(offset, true);
  let eocd = -1; for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) { if (u32(offset) === 0x06054b50) { eocd = offset; break; } }
  if (eocd < 0) throw new Error("ไฟล์ Excel ไม่สมบูรณ์");
  let pointer = u32(eocd + 16); const entries = new Map(); const decoder = new TextDecoder();
  while (pointer < bytes.length && u32(pointer) === 0x02014b50) {
    const method = u16(pointer + 10); const compressedSize = u32(pointer + 20); const nameLength = u16(pointer + 28); const extraLength = u16(pointer + 30); const commentLength = u16(pointer + 32); const localOffset = u32(pointer + 42);
    const name = decoder.decode(bytes.slice(pointer + 46, pointer + 46 + nameLength));
    if (u32(localOffset) !== 0x04034b50) throw new Error("อ่านไฟล์ Excel ไม่สำเร็จ");
    const localNameLength = u16(localOffset + 26); const localExtraLength = u16(localOffset + 28); const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize); let output;
    if (method === 0) output = compressed;
    else if (method === 8 && "DecompressionStream" in window) output = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else throw new Error("เบราว์เซอร์นี้ยังไม่รองรับการอ่านไฟล์ Excel");
    entries.set(name, decoder.decode(output)); pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}
function relationshipId(node) { return [...node.attributes].find((attribute) => attribute.localName === "id")?.value; }
function sheetRowsFromXlsx(entries) {
  const parse = (content) => new DOMParser().parseFromString(content, "application/xml");
  const workbook = parse(entries.get("xl/workbook.xml")); const relationships = parse(entries.get("xl/_rels/workbook.xml.rels"));
  const relationMap = new Map(xmlNodes(relationships, "Relationship").map((node) => [node.getAttribute("Id"), node.getAttribute("Target")]));
  const sheet = xmlNodes(workbook, "sheet").find((node) => node.getAttribute("name").trim() === "ราคาสินค้า") || xmlNodes(workbook, "sheet").find((node) => node.getAttribute("name").includes("ราคา"));
  if (!sheet) throw new Error("ไม่พบชีตชื่อ ‘ราคาสินค้า’");
  const target = relationMap.get(relationshipId(sheet)); if (!target) throw new Error("ไม่พบข้อมูลชีตราคา");
  const parts = ["xl"]; target.split("/").forEach((part) => { if (part === "..") parts.pop(); else if (part !== ".") parts.push(part); });
  const sheetDocument = parse(entries.get(parts.join("/"))); const stringsDocument = entries.get("xl/sharedStrings.xml") ? parse(entries.get("xl/sharedStrings.xml")) : null;
  const sharedStrings = stringsDocument ? xmlNodes(stringsDocument, "si").map((node) => node.textContent || "") : [];
  const rows = new Map();
  xmlNodes(sheetDocument, "c").forEach((cell) => { const reference = cell.getAttribute("r"); if (!reference) return; const rowNumber = Number(reference.match(/\d+/)[0]); const valueNode = childNode(cell, "v"); const inlineNode = childNode(cell, "is"); let value = inlineNode ? inlineNode.textContent : valueNode?.textContent || ""; if (cell.getAttribute("t") === "s") value = sharedStrings[Number(value)] || ""; if (!rows.has(rowNumber)) rows.set(rowNumber, []); rows.get(rowNumber)[columnIndex(reference)] = value; });
  return { sheetName: sheet.getAttribute("name"), rows: [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row || []) };
}
function firstSheetRowsFromXlsx(entries) {
  const parse = (content) => new DOMParser().parseFromString(content, "application/xml");
  const workbook = parse(entries.get("xl/workbook.xml")); const relationships = parse(entries.get("xl/_rels/workbook.xml.rels"));
  const relationMap = new Map(xmlNodes(relationships, "Relationship").map((node) => [node.getAttribute("Id"), node.getAttribute("Target")]));
  const sheet = xmlNodes(workbook, "sheet")[0]; if (!sheet) throw new Error("ไม่พบชีทในไฟล์ลูกค้า");
  const target = relationMap.get(relationshipId(sheet)); if (!target) throw new Error("ไม่พบข้อมูลชีทลูกค้า");
  const parts = ["xl"]; target.split("/").forEach((part) => { if (part === "..") parts.pop(); else if (part !== ".") parts.push(part); });
  const sheetDocument = parse(entries.get(parts.join("/"))); const stringsDocument = entries.get("xl/sharedStrings.xml") ? parse(entries.get("xl/sharedStrings.xml")) : null;
  const sharedStrings = stringsDocument ? xmlNodes(stringsDocument, "si").map((node) => node.textContent || "") : []; const rows = new Map();
  xmlNodes(sheetDocument, "c").forEach((cell) => { const reference = cell.getAttribute("r"); if (!reference) return; const rowNumber = Number(reference.match(/\d+/)[0]); const valueNode = childNode(cell, "v"); const inlineNode = childNode(cell, "is"); let value = inlineNode ? inlineNode.textContent : valueNode?.textContent || ""; if (cell.getAttribute("t") === "s") value = sharedStrings[Number(value)] || ""; if (!rows.has(rowNumber)) rows.set(rowNumber, []); rows.get(rowNumber)[columnIndex(reference)] = value; });
  return { sheetName: sheet.getAttribute("name"), rows: [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, row]) => row || []) };
}
function extractCustomerPlan({ sheetName, rows }) {
  const headingIndex = rows.findIndex((row) => /ลูกค้าประจำ|ชื่อลูกค้า/i.test(String(row[0] || "")));
  const start = headingIndex >= 0 ? headingIndex + 1 : 0;
  const ignored = /^(salmon customer plan|กรอกข้อมูล|ใส่ชื่อลูกค้า|ลูกค้าประจำ)$/i;
  const customers = rows.slice(start).map((row) => ({ name: String(row[0] || "").trim(), schedule: Array.from({ length: 28 }, (_, day) => String(row[day + 1] ?? "").trim()) })).filter((customer) => customer.name && !ignored.test(customer.name) && !/^①|^②/.test(customer.name));
  if (!customers.length) throw new Error("ไม่พบรายชื่อลูกค้าในคอลัมน์แรกของชีทแรก");
  return { sheetName, customers };
}
function extractCatalog({ sheetName, rows }) {
  const headerIndex = rows.findIndex((row) => row.some((cell) => /item|sku|สินค้า/i.test(String(cell))) && row.some((cell) => /price|ราคา/i.test(String(cell))));
  const header = Array.from(rows[headerIndex >= 0 ? headerIndex : 0], (cell) => String(cell ?? "").toLowerCase());
  const findColumn = (keywords, fallback) => { const found = header.findIndex((cell) => keywords.some((word) => cell.includes(word))); return found >= 0 ? found : fallback; };
  const skuColumn = findColumn(["item", "sku", "plu"], 0);
  const descriptionColumn = findColumn(["description", "สินค้า", "detail"], 1);
  const priceColumn = findColumn(["price", "ราคา"], 2);
  const dataRows = rows.slice((headerIndex >= 0 ? headerIndex : 0) + 1);
  const catalog = dataRows.map((row) => {
    const sku = numericValue(row[skuColumn]); const standard = numericValue(row[priceColumn]);
    return { id: `excel-${sku}`, sku, description: String(row[descriptionColumn] || `SKU ${sku}`).trim(), standard, single: standard, ten: standard };
  }).filter((item) => item.sku && item.standard);
  if (!catalog.length) throw new Error("ไม่พบรายการ SKU และราคาในชีต ‘ราคาสินค้า’");
  return { sheetName, catalog };
}
async function importPriceFile(file) {
  const status = $("#priceFileStatus"); const gateStatus = $("#sourceStatus");
  try {
    status.textContent = "กำลังอ่านไฟล์…"; gateStatus.textContent = "กำลังอ่านไฟล์…";
    const imported = extractCatalog(sheetRowsFromXlsx(await unzipXlsx(file)));
    state.priceCatalog = imported.catalog;
    const salmon56 = imported.catalog.find((item) => String(item.sku) === "129101");
    state.inputs.product = (salmon56 || imported.catalog[0]).id;
    state.inputs.priceTier = "standard";
    status.textContent = `อัปเดต ${imported.catalog.length} รายการจากชีต ${imported.sheetName}`;
    gateStatus.textContent = `อ่านสำเร็จ ${imported.catalog.length} รายการ • กำลังเปิดหน้าแผน`;
    renderProducts();
    setSourceReady(true);
    update();
  } catch (error) {
    status.textContent = error.message || "อ่านไฟล์ไม่สำเร็จ";
    gateStatus.textContent = error.message || "อ่านไฟล์ไม่สำเร็จ";
  }
}
async function importCustomerFile(file) {
  const status = $("#customerSourceStatus");
  try {
    status.textContent = "กำลังอ่านแผนลูกค้า…";
    const imported = extractCustomerPlan(firstSheetRowsFromXlsx(await unzipXlsx(file)));
    const existing = new Map(state.customerPlans.map((customer, index) => [String(customer.name || "").trim().toLocaleLowerCase("th-TH"), index]));
    let additions = 0; imported.customers.forEach((customer) => { const key = customer.name.toLocaleLowerCase("th-TH"); if (existing.has(key)) state.customerPlans[existing.get(key)] = customer; else { state.customerPlans.push(customer); additions += 1; } });
    persistState(); renderCustomers();
    status.textContent = `อ่าน ${imported.customers.length} รายชื่อและยอดรายวันจากชีท ${imported.sheetName} • เพิ่มใหม่ ${additions} รายชื่อ`;
    if (sourceReady) update();
  } catch (error) { status.textContent = error.message || "อ่านไฟล์ลูกค้าไม่สำเร็จ"; }
}
function syncInputs() { applyProductPrice(); Object.entries(state.inputs).forEach(([key, value]) => { const el = $(`#${key}`); if (el && key !== "product") el.value = value; }); }
function update() { applyProductPrice(); syncInputs(); renderPriceBand(); renderWeeklyPlan(); renderRounds(); renderCustomers(); }
function save() { persistState(); $("#saveState").textContent = "บันทึกแล้ว"; setTimeout(() => { $("#saveState").textContent = ""; }, 1800); }
function downloadCsv() {
  const headers = ["รอบ", "วันเข้า DC", "Demand (ลัง)", "แนะนำเข้า (ลัง)", "กก.", "สต๊อกปลายรอบ"];
  const data = plannedData().map((row) => [`รอบ ${row.index}`, row.date, row.demand, row.recommended, row.kg, row.closing]);
  const csv = "\uFEFF" + [headers, ...data].map((row) => row.join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "Salaya-Salmon-Plan.csv"; a.click(); URL.revokeObjectURL(a.href);
}
function init() {
  const saved = localStorage.getItem("plan-salmon-salaya"); if (saved) { const stored = JSON.parse(saved); state = { ...defaultState, ...stored, inputs: { ...defaultState.inputs, ...stored.inputs }, priceCatalog: stored.priceCatalog || defaultCatalog, rounds: stored.rounds || defaultState.rounds, customers: stored.customers || [], customerPlans: stored.customerPlans || defaultCustomerPlans }; }
  renderProducts();
  syncInputs();
  setSourceReady(false);
  const updateInput = (event) => { if (event.target.matches(".form-grid input,.form-grid select")) { state.inputs[event.target.id] = event.target.value; update(); } };
  document.addEventListener("input", updateInput);
  document.addEventListener("change", updateInput);
  $("#etaDates").addEventListener("input", (event) => { state.inputs.etaDates = event.target.value; });
  $("#pricePeriod").addEventListener("input", (event) => { state.inputs.pricePeriod = event.target.value; update(); });
  $("#sourceFile").addEventListener("change", (event) => { selectedSourceFile = event.target.files[0] || null; $("#readSourceBtn").disabled = !selectedSourceFile; $("#sourceStatus").textContent = selectedSourceFile ? `ขั้นที่ 2: พร้อมอ่าน ${selectedSourceFile.name}` : "ขั้นที่ 1: เลือกไฟล์ .xlsx หรือ .xls"; });
  $("#readSourceBtn").addEventListener("click", () => { if (selectedSourceFile) importPriceFile(selectedSourceFile); });
  $("#customerSourceFile").addEventListener("change", (event) => { selectedCustomerFile = event.target.files[0] || null; $("#readCustomerBtn").disabled = !selectedCustomerFile; $("#customerSourceStatus").textContent = selectedCustomerFile ? `พร้อมอ่าน ${selectedCustomerFile.name}` : "รายชื่อลูกค้าและแผน 4 สัปดาห์ถูกบันทึกไว้ในเครื่องนี้"; });
  $("#readCustomerBtn").addEventListener("click", () => { if (selectedCustomerFile) importCustomerFile(selectedCustomerFile); });
  $("#addCustomerBtn").addEventListener("click", () => { state.customerPlans.push({ name: "", schedule: Array(28).fill("") }); persistState(); update(); });
  $("#saveBtn").addEventListener("click", save); $("#exportBtn").addEventListener("click", downloadCsv); $("#printBtn").addEventListener("click", () => window.print());
  $("#resetBtn").addEventListener("click", () => { if (confirm("เริ่มแผนใหม่และล้างข้อมูลที่บันทึกไว้หรือไม่?")) { localStorage.removeItem("plan-salmon-salaya"); state = structuredClone(defaultState); renderProducts(); syncInputs(); setSourceReady(false); } });
  update();
}
init();

