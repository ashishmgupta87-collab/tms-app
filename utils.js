const rupee = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const fmtDate = d => { if (!d) return '-'; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); };
const daysUntil = d => { if (!d) return 999; return Math.ceil((new Date(d) - new Date()) / 86400000); };
const expClass = d => { const x = daysUntil(d); return x < 0 ? 'b-red' : x < 30 ? 'b-amber' : 'b-green'; };
const expLabel = d => { const x = daysUntil(d); return x < 0 ? 'Expired' : x < 30 ? x + 'd left' : fmtDate(d); };
const g = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };

let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

function badge(text, cls) {
  return `<span class="badge ${cls}">${text}</span>`;
}

function emptyState(msg) {
  return `<tr><td colspan="20" class="empty-state">${msg}</td></tr>`;
}

let currentModal = '', editId = null;

function openModal(type, data = null) {
  currentModal = type;
  editId = data ? (data.id || null) : null;
  const titles = { fleet: 'Truck', driver: 'Driver', trip: 'Trip', maintenance: 'Maintenance Log', billing: 'Invoice', salary: 'Salary Record', company: 'Company Details' };
  document.getElementById('modal-title').textContent = (editId ? 'Edit ' : 'Add ') + (titles[type] || type);
  const forms = { fleet: fleetForm, driver: driverForm, trip: tripForm, maintenance: maintForm, billing: billingForm, salary: salaryForm, company: companyForm };
  document.getElementById('modal-body').innerHTML = forms[type] ? forms[type](data || {}) : '';
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  currentModal = ''; editId = null;
}

async function saveModal() {
  const btn = document.getElementById('modal-save-btn');
  btn.textContent = 'Saving...'; btn.disabled = true;
  try {
    const savers = { fleet: saveFleet, driver: saveDriver, trip: saveTrip, maintenance: saveMaint, billing: saveBilling, salary: saveSalary, company: saveCompany };
    if (savers[currentModal]) await savers[currentModal](editId);
    closeModal();
    showToast('Saved successfully!');
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.textContent = 'Save'; btn.disabled = false;
  }
}

async function delRecord(table, id, refreshFn) {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  await DB.delete(table, id);
  showToast('Deleted.');
  if (refreshFn) refreshFn();
}

function exportExcel(data, filename) {
  if (!data.length) { showToast('No data to export', 'warning'); return; }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, filename + '_' + new Date().toISOString().slice(0, 10) + '.xlsx');
}
