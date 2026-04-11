async function renderDrivers(search = '') {
  const el = document.getElementById('pg-drivers');
  el.innerHTML = `<div class="pg-header"><div class="pg-title">Drivers</div><div class="topbar-row"><input class="search-bar" placeholder="Search driver..." oninput="renderDrivers(this.value)" value="${search}"><button class="btn btn-amber" onclick="exportDrivers()">Export Excel</button><button class="btn btn-primary" onclick="openModal('driver')">+ Add driver</button></div></div><div class="card"><div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Mobile</th><th>Licence no.</th><th>Licence exp.</th><th>Assigned truck</th><th>Daily rate</th><th>Status</th><th>Actions</th></tr></thead><tbody id="drivers-body"><tr><td colspan="8" class="empty-state">Loading...</td></tr></tbody></table></div></div>`;

  const [data, trucks] = await Promise.all([DB.getAll('drivers'), DB.getAll('fleet')]);
  const filtered = data.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()));
  const tmap = Object.fromEntries(trucks.map(t => [t.id, t.truck_no]));

  document.getElementById('drivers-body').innerHTML = filtered.length
    ? filtered.map(d => `<tr>
        <td><strong>${d.name}</strong></td>
        <td>${d.mobile || '-'}</td>
        <td>${d.licence_no || '-'}</td>
        <td>${badge(expLabel(d.licence_exp), expClass(d.licence_exp))}</td>
        <td>${tmap[d.assigned_truck] || '-'}</td>
        <td>${rupee(d.daily_rate)}/day</td>
        <td>${badge(d.status || 'Active', d.status === 'Active' ? 'b-green' : 'b-gray')}</td>
        <td class="action-btns">
          <button class="btn btn-sm" onclick='openModal("driver", ${JSON.stringify(d)})'>Edit</button>
          <button class="btn btn-sm btn-danger" onclick="delRecord('drivers','${d.id}',renderDrivers)">Del</button>
        </td>
      </tr>`).join('')
    : emptyState('No drivers added yet.');
}

async function driverForm(d = {}) {
  const trucks = await DB.getAll('fleet');
  return `<div class="form-grid">
    <div class="form-group"><label>Full name*</label><input id="f-name" value="${d.name || ''}"></div>
    <div class="form-group"><label>Mobile</label><input id="f-mobile" value="${d.mobile || ''}"></div>
    <div class="form-group"><label>Licence no.</label><input id="f-licence_no" value="${d.licence_no || ''}"></div>
    <div class="form-group"><label>Licence exp.</label><input id="f-licence_exp" type="date" value="${d.licence_exp || ''}"></div>
    <div class="form-group"><label>Assigned truck</label><select id="f-assigned_truck"><option value="">-- None --</option>${trucks.map(t => `<option value="${t.id}" ${d.assigned_truck === t.id ? 'selected' : ''}>${t.truck_no}</option>`).join('')}</select></div>
    <div class="form-group"><label>Daily rate (₹)</label><input id="f-daily_rate" type="number" value="${d.daily_rate || ''}"></div>
    <div class="form-group"><label>Address</label><input id="f-address" value="${d.address || ''}"></div>
    <div class="form-group"><label>Status</label><select id="f-status"><option ${d.status === 'Active' ? 'selected' : ''}>Active</option><option ${d.status === 'Off Duty' ? 'selected' : ''}>Off Duty</option></select></div>
  </div>`;
}

async function saveDriver(id) {
  if (!g('f-name')) throw new Error('Name is required.');
  const record = { name: g('f-name'), mobile: g('f-mobile'), licence_no: g('f-licence_no'), licence_exp: g('f-licence_exp') || null, assigned_truck: g('f-assigned_truck') || null, daily_rate: g('f-daily_rate') || 0, address: g('f-address'), status: g('f-status') };
  id ? await DB.update('drivers', id, record) : await DB.insert('drivers', record);
  renderDrivers();
}

async function exportDrivers() {
  const data = await DB.getAll('drivers');
  exportExcel(data.map(d => ({ 'Name': d.name, 'Mobile': d.mobile, 'Licence No': d.licence_no, 'Licence Exp': d.licence_exp, 'Daily Rate': d.daily_rate, 'Status': d.status })), 'TMS_Drivers');
}
