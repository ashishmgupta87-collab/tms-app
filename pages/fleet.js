async function renderFleet(search = '') {
  const el = document.getElementById('pg-fleet');
  el.innerHTML = `<div class="pg-header"><div class="pg-title">Fleet &amp; Trucks</div><div class="topbar-row"><input class="search-bar" placeholder="Search truck..." oninput="renderFleet(this.value)" value="${search}"><button class="btn btn-amber" onclick="exportFleet()">Export Excel</button><button class="btn btn-primary" onclick="openModal('fleet')">+ Add truck</button></div></div><div class="card"><div class="tbl-wrap"><table><thead><tr><th>Truck no.</th><th>Make / Model</th><th>Wheel type</th><th>Load cap</th><th>Insurance</th><th>Fitness</th><th>Permit</th><th>PUC</th><th>Tax</th><th>Status</th><th>Actions</th></tr></thead><tbody id="fleet-body"><tr><td colspan="11" class="empty-state">Loading...</td></tr></tbody></table></div></div>`;

  const data = (await DB.getAll('fleet')).filter(t => !search || (t.truck_no + t.make).toLowerCase().includes(search.toLowerCase()));

  document.getElementById('fleet-body').innerHTML = data.length
    ? data.map(t => `<tr>
        <td><strong>${t.truck_no}</strong></td>
        <td>${t.make} ${t.model || ''}</td>
        <td>${t.wheel_type || '-'}</td>
        <td>${t.load_cap ? t.load_cap + 'T' : '-'}</td>
        <td>${badge(expLabel(t.insurance_exp), expClass(t.insurance_exp))}</td>
        <td>${badge(expLabel(t.fitness_exp), expClass(t.fitness_exp))}</td>
        <td>${badge(expLabel(t.permit_exp), expClass(t.permit_exp))}</td>
        <td>${badge(expLabel(t.puc_exp), expClass(t.puc_exp))}</td>
        <td>${badge(expLabel(t.tax_exp), expClass(t.tax_exp))}</td>
        <td>${badge(t.status || 'Active', t.status === 'Active' ? 'b-green' : 'b-gray')}</td>
        <td class="action-btns">
          <button class="btn btn-sm" onclick='openModal("fleet", ${JSON.stringify(t)})'>Edit</button>
          <button class="btn btn-sm btn-danger" onclick="delRecord('fleet','${t.id}',renderFleet)">Del</button>
        </td>
      </tr>`).join('')
    : emptyState('No trucks added yet. Click "+ Add truck" to start.');
}

function fleetForm(d = {}) {
  return `<div class="form-grid">
    <div class="form-group"><label>Truck number*</label><input id="f-truck_no" value="${d.truck_no || ''}" placeholder="GJ-01-T 0000"></div>
    <div class="form-group"><label>Make*</label><input id="f-make" value="${d.make || ''}" placeholder="Tata, Ashok Leyland..."></div>
    <div class="form-group"><label>Model</label><input id="f-model" value="${d.model || ''}" placeholder="407, 1109..."></div>
    <div class="form-group"><label>Wheel type</label><select id="f-wheel_type"><option ${d.wheel_type === '6 tyre' ? 'selected' : ''}>6 tyre</option><option ${d.wheel_type === '10 tyre' ? 'selected' : ''}>10 tyre</option><option ${d.wheel_type === '12 tyre' ? 'selected' : ''}>12 tyre</option><option ${d.wheel_type === '18 tyre' ? 'selected' : ''}>18 tyre</option></select></div>
    <div class="form-group"><label>Loading wt (T)</label><input id="f-load_cap" type="number" value="${d.load_cap || ''}"></div>
    <div class="form-group"><label>Unloading wt (T)</label><input id="f-unload_cap" type="number" value="${d.unload_cap || ''}"></div>
    <div class="form-group"><label>Insurance exp.</label><input id="f-insurance_exp" type="date" value="${d.insurance_exp || ''}"></div>
    <div class="form-group"><label>Fitness exp.</label><input id="f-fitness_exp" type="date" value="${d.fitness_exp || ''}"></div>
    <div class="form-group"><label>Permit exp.</label><input id="f-permit_exp" type="date" value="${d.permit_exp || ''}"></div>
    <div class="form-group"><label>PUC exp.</label><input id="f-puc_exp" type="date" value="${d.puc_exp || ''}"></div>
    <div class="form-group"><label>Tax exp.</label><input id="f-tax_exp" type="date" value="${d.tax_exp || ''}"></div>
    <div class="form-group"><label>Status</label><select id="f-status"><option ${d.status === 'Active' ? 'selected' : ''}>Active</option><option ${d.status === 'Idle' ? 'selected' : ''}>Idle</option><option ${d.status === 'In Repair' ? 'selected' : ''}>In Repair</option></select></div>
  </div>`;
}

async function saveFleet(id) {
  if (!g('f-truck_no') || !g('f-make')) throw new Error('Truck number and make are required.');
  const record = { truck_no: g('f-truck_no'), make: g('f-make'), model: g('f-model'), wheel_type: g('f-wheel_type'), load_cap: g('f-load_cap') || null, unload_cap: g('f-unload_cap') || null, insurance_exp: g('f-insurance_exp') || null, fitness_exp: g('f-fitness_exp') || null, permit_exp: g('f-permit_exp') || null, puc_exp: g('f-puc_exp') || null, tax_exp: g('f-tax_exp') || null, status: g('f-status') };
  id ? await DB.update('fleet', id, record) : await DB.insert('fleet', record);
  renderFleet();
}

async function exportFleet() {
  const data = await DB.getAll('fleet');
  exportExcel(data.map(t => ({ 'Truck No': t.truck_no, 'Make': t.make, 'Model': t.model, 'Wheel Type': t.wheel_type, 'Load Cap (T)': t.load_cap, 'Insurance Exp': t.insurance_exp, 'Fitness Exp': t.fitness_exp, 'Permit Exp': t.permit_exp, 'PUC Exp': t.puc_exp, 'Tax Exp': t.tax_exp, 'Status': t.status })), 'TMS_Fleet');
}
