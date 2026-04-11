let _maintFilter = 'all';

async function renderMaint(search = '') {
  const el = document.getElementById('pg-maintenance');
  el.innerHTML = `<div class="pg-header"><div class="pg-title">Maintenance</div><div class="topbar-row"><div class="section-tabs"><div class="stab ${_maintFilter==='all'?'active':''}" onclick="setMaintTab('all',this)">All</div><div class="stab ${_maintFilter==='periodic'?'active':''}" onclick="setMaintTab('periodic',this)">Periodic</div><div class="stab ${_maintFilter==='tyre'?'active':''}" onclick="setMaintTab('tyre',this)">Tyres</div><div class="stab ${_maintFilter==='repair'?'active':''}" onclick="setMaintTab('repair',this)">Repairs</div></div><button class="btn btn-amber" onclick="exportMaint()">Export Excel</button><button class="btn btn-primary" onclick="openModal('maintenance')">+ Log work</button></div></div><div class="card"><div class="tbl-wrap"><table><thead><tr><th>Truck</th><th>Type</th><th>Description</th><th>Cost (₹)</th><th>Date</th><th>Next due</th><th>Vendor</th><th>Actions</th></tr></thead><tbody id="maint-body"><tr><td colspan="8" class="empty-state">Loading...</td></tr></tbody></table></div></div>`;

  let data = await DB.getAll('maintenance');
  if (_maintFilter !== 'all') data = data.filter(m => m.type === _maintFilter);

  document.getElementById('maint-body').innerHTML = data.length
    ? data.map(m => `<tr>
        <td><strong>${m.truck_no}</strong></td>
        <td>${badge(m.type, m.type === 'periodic' ? 'b-blue' : m.type === 'tyre' ? 'b-amber' : 'b-gray')}</td>
        <td>${m.description || '-'}</td>
        <td><strong>${rupee(m.cost)}</strong></td>
        <td>${fmtDate(m.date)}</td>
        <td>${m.next_due ? badge(expLabel(m.next_due), expClass(m.next_due)) : '-'}</td>
        <td>${m.vendor || '-'}</td>
        <td class="action-btns">
          <button class="btn btn-sm" onclick='openModal("maintenance", ${JSON.stringify(m)})'>Edit</button>
          <button class="btn btn-sm btn-danger" onclick="delRecord('maintenance','${m.id}',renderMaint)">Del</button>
        </td>
      </tr>`).join('')
    : emptyState('No maintenance records yet.');
}

function setMaintTab(f, el) {
  _maintFilter = f;
  renderMaint();
}

async function maintForm(d = {}) {
  const trucks = await DB.getAll('fleet');
  return `<div class="form-grid">
    <div class="form-group"><label>Truck no.*</label><select id="f-truck_no"><option value="">Select...</option>${trucks.map(t => `<option value="${t.truck_no}" ${d.truck_no === t.truck_no ? 'selected' : ''}>${t.truck_no}</option>`).join('')}</select></div>
    <div class="form-group"><label>Type*</label><select id="f-type"><option value="periodic" ${d.type === 'periodic' ? 'selected' : ''}>Periodic</option><option value="tyre" ${d.type === 'tyre' ? 'selected' : ''}>Tyre</option><option value="repair" ${d.type === 'repair' ? 'selected' : ''}>Repair</option></select></div>
    <div class="form-group"><label>Date</label><input id="f-date" type="date" value="${d.date || ''}"></div>
    <div class="form-group"><label>Cost (₹)*</label><input id="f-cost" type="number" value="${d.cost || ''}"></div>
    <div class="form-group"><label>Next due date</label><input id="f-next_due" type="date" value="${d.next_due || ''}"></div>
    <div class="form-group"><label>Vendor / workshop</label><input id="f-vendor" value="${d.vendor || ''}"></div>
    <div class="form-group" style="grid-column:1/-1"><label>Description</label><textarea id="f-description">${d.description || ''}</textarea></div>
  </div>`;
}

async function saveMaint(id) {
  if (!g('f-truck_no')) throw new Error('Truck is required.');
  const record = { truck_no: g('f-truck_no'), type: g('f-type'), date: g('f-date') || null, cost: g('f-cost') || 0, next_due: g('f-next_due') || null, vendor: g('f-vendor'), description: g('f-description') };
  id ? await DB.update('maintenance', id, record) : await DB.insert('maintenance', record);
  renderMaint();
}

async function exportMaint() {
  const data = await DB.getAll('maintenance');
  exportExcel(data.map(m => ({ 'Truck': m.truck_no, 'Type': m.type, 'Description': m.description, 'Cost': m.cost, 'Date': m.date, 'Next Due': m.next_due, 'Vendor': m.vendor })), 'TMS_Maintenance');
}
