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
const defaultState = {
  inputs: { branch: "SALAYA", dc: 953, product: "salmon56", sku: 129101, priceTier: "single", price: 380, openingStock: 0, safetyStock: 5, planMode: "mid", kgPerCarton: 22, etaDates: "24, 26, 28 Aug 2026", pricePeriod: "25–31 Aug 2026" },
  priceCatalog: defaultCatalog,
  rounds: [
    { date: "2026-08-31", days: 2, retail: 16, promo: 0 },
    { date: "2026-09-02", days: 2, retail: 17, promo: 0 },
    { date: "2026-09-04", days: 3, retail: 19, promo: 0 },
  ],
  customers: [],
};
let state = structuredClone(defaultState);

function customerCartons(row) {
  const divisor = row.unit === "fish" ? 4 : 1;
  const confirmed = number(row.confirmed);
  if (confirmed > 0) return confirmed / divisor;
  const min = number(row.min); const max = number(row.max);
  return (state.inputs.planMode === "high" ? max : (min + max) / 2) / divisor;
}
function plannedData() {
  let stock = number(state.inputs.openingStock);
  const safety = number(state.inputs.safetyStock);
  const kgPerCarton = number(state.inputs.kgPerCarton);
  return state.rounds.map((round, index) => {
    const customer = state.customers.filter((row) => Number(row.round) === index + 1).reduce((sum, row) => sum + customerCartons(row), 0);
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
  customerRows.innerHTML = "";
  state.customers.forEach((row, index) => {
    const fragment = template.content.cloneNode(true);
    const tr = fragment.querySelector("tr");
    tr.querySelector(".customer-round").value = row.round;
    tr.querySelector(".customer-name").value = row.name;
    tr.querySelector(".customer-unit").value = row.unit;
    tr.querySelector(".customer-min").value = row.min;
    tr.querySelector(".customer-max").value = row.max;
    tr.querySelector(".customer-confirmed").value = row.confirmed;
    tr.querySelector(".customer-selected").textContent = decimal(customerCartons(row));
    tr.querySelector(".customer-kg").textContent = decimal(customerCartons(row) * number(state.inputs.kgPerCarton));
    tr.querySelectorAll("input,select").forEach((element) => element.addEventListener("input", () => {
      state.customers[index] = { round: tr.querySelector(".customer-round").value, name: tr.querySelector(".customer-name").value, unit: tr.querySelector(".customer-unit").value, min: tr.querySelector(".customer-min").value, max: tr.querySelector(".customer-max").value, confirmed: tr.querySelector(".customer-confirmed").value };
      update();
    }));
    tr.querySelector(".delete-customer").addEventListener("click", () => { state.customers.splice(index, 1); update(); });
    customerRows.append(fragment);
  });
}
function renderKpis() {
  const rows = plannedData();
  const cartons = rows.reduce((sum, row) => sum + row.recommended, 0);
  const kg = rows.reduce((sum, row) => sum + row.kg, 0);
  const value = kg * number(state.inputs.price);
  const closing = rows.at(-1)?.closing || number(state.inputs.openingStock);
  $("#totalCartons").textContent = decimal(cartons); $("#totalKg").textContent = decimal(kg); $("#totalValue").textContent = money(value); $("#endStock").textContent = decimal(closing);
  const status = closing >= number(state.inputs.safetyStock) ? "อยู่ในระดับปลอดภัย" : "ต่ำกว่า Safety stock";
  $("#stockStatus").textContent = status;
  $(".status-card").style.borderLeftColor = closing >= number(state.inputs.safetyStock) ? "#4d9a58" : "#d65e50";
}
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
  const status = $("#priceFileStatus");
  try {
    status.textContent = "กำลังอ่านไฟล์…";
    const imported = extractCatalog(sheetRowsFromXlsx(await unzipXlsx(file)));
    state.priceCatalog = imported.catalog;
    const salmon56 = imported.catalog.find((item) => String(item.sku) === "129101");
    state.inputs.product = (salmon56 || imported.catalog[0]).id;
    state.inputs.priceTier = "standard";
    status.textContent = `อัปเดต ${imported.catalog.length} รายการจากชีต ${imported.sheetName}`;
    renderProducts();
    update();
  } catch (error) {
    status.textContent = error.message || "อ่านไฟล์ไม่สำเร็จ";
  }
}
function syncInputs() { applyProductPrice(); Object.entries(state.inputs).forEach(([key, value]) => { const el = $(`#${key}`); if (el && key !== "product") el.value = value; }); }
function update() { applyProductPrice(); syncInputs(); renderPriceBand(); renderKpis(); renderWeeklyPlan(); renderRounds(); renderCustomers(); }
function save() { localStorage.setItem("plan-salmon-salaya", JSON.stringify(state)); $("#saveState").textContent = "บันทึกแล้ว"; setTimeout(() => { $("#saveState").textContent = ""; }, 1800); }
function downloadCsv() {
  const headers = ["รอบ", "วันเข้า DC", "Demand (ลัง)", "แนะนำเข้า (ลัง)", "กก.", "สต๊อกปลายรอบ"];
  const data = plannedData().map((row) => [`รอบ ${row.index}`, row.date, row.demand, row.recommended, row.kg, row.closing]);
  const csv = "\uFEFF" + [headers, ...data].map((row) => row.join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "Salaya-Salmon-Plan.csv"; a.click(); URL.revokeObjectURL(a.href);
}
function init() {
  const saved = localStorage.getItem("plan-salmon-salaya"); if (saved) { const stored = JSON.parse(saved); state = { ...defaultState, ...stored, inputs: { ...defaultState.inputs, ...stored.inputs }, priceCatalog: stored.priceCatalog || defaultCatalog, rounds: stored.rounds || defaultState.rounds, customers: stored.customers || [] }; }
  renderProducts();
  syncInputs();
  const updateInput = (event) => { if (event.target.matches(".form-grid input,.form-grid select")) { state.inputs[event.target.id] = event.target.value; update(); } };
  document.addEventListener("input", updateInput);
  document.addEventListener("change", updateInput);
  $("#etaDates").addEventListener("input", (event) => { state.inputs.etaDates = event.target.value; });
  $("#pricePeriod").addEventListener("input", (event) => { state.inputs.pricePeriod = event.target.value; update(); });
  $("#priceFile").addEventListener("change", (event) => { if (event.target.files[0]) importPriceFile(event.target.files[0]); });
  $("#addCustomerBtn").addEventListener("click", () => { state.customers.push({ round: "1", name: "", unit: "carton", min: 0, max: 0, confirmed: 0 }); update(); });
  $("#saveBtn").addEventListener("click", save); $("#exportBtn").addEventListener("click", downloadCsv); $("#printBtn").addEventListener("click", () => window.print());
  $("#resetBtn").addEventListener("click", () => { if (confirm("เริ่มแผนใหม่และล้างข้อมูลที่บันทึกไว้หรือไม่?")) { localStorage.removeItem("plan-salmon-salaya"); state = structuredClone(defaultState); syncInputs(); update(); } });
  update();
}
init();
