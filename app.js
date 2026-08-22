const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const roundRows = $("#roundRows");
const customerRows = $("#customerRows");
const template = $("#customerTemplate");
const number = (value) => Math.max(0, Number(value) || 0);
const decimal = (value) => new Intl.NumberFormat("th-TH", { maximumFractionDigits: 1 }).format(value);
const money = (value) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value);

const defaultState = {
  inputs: { branch: "SALAYA", dc: 953, sku: 129101, price: 369, openingStock: 0, safetyStock: 5, planMode: "mid", kgPerCarton: 22 },
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
function syncInputs() { Object.entries(state.inputs).forEach(([key, value]) => { const el = $(`#${key}`); if (el) el.value = value; }); }
function update() { renderKpis(); renderRounds(); renderCustomers(); }
function save() { localStorage.setItem("plan-salmon-salaya", JSON.stringify(state)); $("#saveState").textContent = "บันทึกแล้ว"; setTimeout(() => { $("#saveState").textContent = ""; }, 1800); }
function downloadCsv() {
  const headers = ["รอบ", "วันเข้า DC", "Demand (ลัง)", "แนะนำเข้า (ลัง)", "กก.", "สต๊อกปลายรอบ"];
  const data = plannedData().map((row) => [`รอบ ${row.index}`, row.date, row.demand, row.recommended, row.kg, row.closing]);
  const csv = "\uFEFF" + [headers, ...data].map((row) => row.join(",")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = "Salaya-Salmon-Plan.csv"; a.click(); URL.revokeObjectURL(a.href);
}
function init() {
  const saved = localStorage.getItem("plan-salmon-salaya"); if (saved) state = JSON.parse(saved);
  syncInputs();
  $$(".form-grid input,.form-grid select").forEach((element) => element.addEventListener("input", () => { state.inputs[element.id] = element.value; update(); }));
  $("#addCustomerBtn").addEventListener("click", () => { state.customers.push({ round: "1", name: "", unit: "carton", min: 0, max: 0, confirmed: 0 }); update(); });
  $("#saveBtn").addEventListener("click", save); $("#exportBtn").addEventListener("click", downloadCsv); $("#printBtn").addEventListener("click", () => window.print());
  $("#resetBtn").addEventListener("click", () => { if (confirm("เริ่มแผนใหม่และล้างข้อมูลที่บันทึกไว้หรือไม่?")) { localStorage.removeItem("plan-salmon-salaya"); state = structuredClone(defaultState); syncInputs(); update(); } });
  update();
}
init();
