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

async function openModal(type, data = null) {
  currentModal = type;
  editId = data ? (data.id || null) : null;
  const titles = { fleet: 'Truck', driver: 'Driver', trip: 'Trip', maintenance: 'Maintenance Log', billing: 'Invoice', salary: 'Salary Record', company: 'Company Details' };
  document.getElementById('modal-title').textContent = (editId ? 'Edit ' : 'Add ') + (titles[type] || type);
  const forms = { fleet: fleetForm, driver: driverForm, trip: tripForm, maintenance: maintForm, billing: billingForm, salary: salaryForm, company: companyForm };
  document.getElementById('modal-body').innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);font-size:13px">Loading...</div>';
  document.getElementById('modal-overlay').classList.add('open');
  if (forms[type]) {
    const html = await Promise.resolve(forms[type](data || {}));
    if (html) document.getElementById('modal-body').innerHTML = html;
  }
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

// ─── DATE FILTER UTILITY ─────────────────────────────────
const DateFilter = {
  // Returns {from, to} date strings based on preset or custom input
  get(filterId) {
    const preset = document.getElementById(filterId + '-preset')?.value;
    const from = document.getElementById(filterId + '-from')?.value;
    const to = document.getElementById(filterId + '-to')?.value;
    if (preset && preset !== 'custom') return this.preset(preset);
    return { from: from || null, to: to || null };
  },

  preset(p) {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    switch (p) {
      case 'today':
        const t = now.toISOString().slice(0, 10);
        return { from: t, to: t };
      case 'this_week': {
        const day = now.getDay();
        const mon = new Date(now); mon.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
        return { from: mon.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
      }
      case 'this_month':
        return { from: new Date(y, m, 1).toISOString().slice(0, 10), to: new Date(y, m + 1, 0).toISOString().slice(0, 10) };
      case 'last_month':
        return { from: new Date(y, m - 1, 1).toISOString().slice(0, 10), to: new Date(y, m, 0).toISOString().slice(0, 10) };
      case 'this_quarter': {
        const q = Math.floor(m / 3);
        return { from: new Date(y, q * 3, 1).toISOString().slice(0, 10), to: new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10) };
      }
      case 'this_year':
        return { from: new Date(y, 0, 1).toISOString().slice(0, 10), to: new Date(y, 11, 31).toISOString().slice(0, 10) };
      case 'last_year':
        return { from: new Date(y - 1, 0, 1).toISOString().slice(0, 10), to: new Date(y - 1, 11, 31).toISOString().slice(0, 10) };
      default:
        return { from: null, to: null };
    }
  },

  // Filter an array of records by date field
  apply(records, dateField, filterId) {
    const { from, to } = this.get(filterId);
    if (!from && !to) return records;
    return records.filter(r => {
      if (!r[dateField]) return false;
      const d = r[dateField].slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  },

  // Render the filter bar HTML
  html(filterId, onchange) {
    return `<div class="date-filter-bar" id="${filterId}-bar">
      <select id="${filterId}-preset" class="df-select" onchange="handlePresetChange('${filterId}');${onchange}">
        <option value="">All time</option>
        <option value="today">Today</option>
        <option value="this_week">This week</option>
        <option value="this_month">This month</option>
        <option value="last_month">Last month</option>
        <option value="this_quarter">This quarter</option>
        <option value="this_year">This year</option>
        <option value="last_year">Last year</option>
        <option value="custom">Custom range...</option>
      </select>
      <div id="${filterId}-custom" class="df-custom" style="display:none">
        <input type="date" id="${filterId}-from" class="df-date" onchange="${onchange}" placeholder="From">
        <span class="df-sep">→</span>
        <input type="date" id="${filterId}-to" class="df-date" onchange="${onchange}" placeholder="To">
      </div>
      <span id="${filterId}-summary" class="df-summary"></span>
    </div>`;
  },

  // Update summary label
  updateSummary(filterId, count, label) {
    const el = document.getElementById(filterId + '-summary');
    if (el) el.textContent = count !== null ? `${count} ${label}` : '';
  }
};

function handlePresetChange(filterId) {
  const preset = document.getElementById(filterId + '-preset')?.value;
  const custom = document.getElementById(filterId + '-custom');
  if (custom) custom.style.display = preset === 'custom' ? 'flex' : 'none';
}
