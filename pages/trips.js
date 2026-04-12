async function renderTrips(search = '') {
  const el = document.getElementById('pg-trips');
  el.innerHTML = `
    <div class="pg-header">
      <div class="pg-title">Trips &amp; Routes</div>
      <div class="topbar-row">
        <input class="search-bar" placeholder="Search..." oninput="renderTrips(this.value)" value="${search}">
        <button class="btn btn-amber" onclick="exportTrips()">Export Excel</button>
        <button class="btn btn-primary" onclick="openModal('trip')">+ New trip</button>
      </div>
    </div>
    ${DateFilter.html('trips-df', 'renderTripsTable()')}
    <div class="card">
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Truck</th><th>Driver</th><th>From</th><th>To</th><th>Km</th><th>Diesel</th><th>Toll</th><th>DA</th><th>Advance</th><th>Misc</th><th>Bill amt</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="trips-body"><tr><td colspan="14" class="empty-state">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>`;
  await renderTripsTable(search);
}

async function renderTripsTable(search = '') {
  const [trips, drivers] = await Promise.all([DB.getAll('trips'), DB.getAll('drivers')]);
  const dmap = Object.fromEntries(drivers.map(d => [d.id, d.name]));

  let filtered = DateFilter.apply(trips, 'date', 'trips-df');
  if (search) filtered = filtered.filter(t =>
    (t.truck_no + (t.from_location || '') + (t.to_location || '')).toLowerCase().includes(search.toLowerCase())
  );

  // Summary stats
  const totalBill = filtered.reduce((s, t) => s + Number(t.bill_amt || 0), 0);
  const totalExp = filtered.reduce((s, t) => s + Number(t.diesel || 0) + Number(t.toll || 0) + Number(t.da || 0) + Number(t.misc || 0), 0);
  DateFilter.updateSummary('trips-df', null, '');
  const summaryEl = document.getElementById('trips-df-summary');
  if (summaryEl) summaryEl.innerHTML = `<span style="color:var(--text-secondary)">${filtered.length} trips &nbsp;·&nbsp; Billed: <strong>${rupee(totalBill)}</strong> &nbsp;·&nbsp; Expenses: <strong>${rupee(totalExp)}</strong></span>`;

  document.getElementById('trips-body').innerHTML = filtered.length
    ? filtered.map(t => `<tr>
        <td><strong>${t.truck_no}</strong></td>
        <td>${dmap[t.driver_id] || '-'}</td>
        <td>${t.from_location || '-'}</td><td>${t.to_location || '-'}</td>
        <td>${t.distance || '-'}</td>
        <td>${rupee(t.diesel)}</td><td>${rupee(t.toll)}</td><td>${rupee(t.da)}</td>
        <td>${rupee(t.advance)}</td><td>${rupee(t.misc)}</td>
        <td><strong>${rupee(t.bill_amt)}</strong></td>
        <td>${fmtDate(t.date)}</td>
        <td>${badge(t.status || '-', t.status === 'Completed' ? 'b-green' : t.status === 'On Route' ? 'b-blue' : 'b-amber')}</td>
        <td class="action-btns">
          <button class="btn btn-sm" onclick='openModal("trip", ${JSON.stringify(t)})'>Edit</button>
          <button class="btn btn-sm btn-danger" onclick="delRecord('trips','${t.id}',renderTrips)">Del</button>
        </td>
      </tr>`).join('')
    : emptyState('No trips found for selected period.');
}

async function tripForm(d = {}) {
  const [trucks, drivers] = await Promise.all([DB.getAll('fleet'), DB.getAll('drivers')]);
  return `<div class="form-grid">
    <div class="form-group"><label>Truck no.*</label><select id="f-truck_no"><option value="">Select...</option>${trucks.map(t => `<option value="${t.truck_no}" ${d.truck_no === t.truck_no ? 'selected' : ''}>${t.truck_no}</option>`).join('')}</select></div>
    <div class="form-group"><label>Driver</label><select id="f-driver_id"><option value="">Select...</option>${drivers.map(dr => `<option value="${dr.id}" ${d.driver_id === dr.id ? 'selected' : ''}>${dr.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>Date*</label><input id="f-date" type="date" value="${d.date || ''}"></div>
    <div class="form-group"><label>Loading point</label><input id="f-from_location" value="${d.from_location || ''}" placeholder="City A"></div>
    <div class="form-group"><label>Unloading point</label><input id="f-to_location" value="${d.to_location || ''}" placeholder="City B"></div>
    <div class="form-group"><label>Distance (km)</label><input id="f-distance" type="number" value="${d.distance || ''}"></div>
    <div class="form-group"><label>Diesel (₹)</label><input id="f-diesel" type="number" value="${d.diesel || 0}"></div>
    <div class="form-group"><label>Toll (₹)</label><input id="f-toll" type="number" value="${d.toll || 0}"></div>
    <div class="form-group"><label>Driver DA (₹)</label><input id="f-da" type="number" value="${d.da || 0}"></div>
    <div class="form-group"><label>Advance (₹)</label><input id="f-advance" type="number" value="${d.advance || 0}"></div>
    <div class="form-group"><label>Loading exp (₹)</label><input id="f-loading_exp" type="number" value="${d.loading_exp || 0}"></div>
    <div class="form-group"><label>Unloading exp (₹)</label><input id="f-unloading_exp" type="number" value="${d.unloading_exp || 0}"></div>
    <div class="form-group"><label>Misc (₹)</label><input id="f-misc" type="number" value="${d.misc || 0}"></div>
    <div class="form-group"><label>Bill amount (₹)*</label><input id="f-bill_amt" type="number" value="${d.bill_amt || ''}"></div>
    <div class="form-group"><label>Status</label><select id="f-status"><option ${d.status === 'On Route' ? 'selected' : ''}>On Route</option><option ${d.status === 'Completed' ? 'selected' : ''}>Completed</option><option ${d.status === 'Delayed' ? 'selected' : ''}>Delayed</option></select></div>
  </div>`;
}

async function saveTrip(id) {
  if (!g('f-truck_no')) throw new Error('Truck is required.');
  const record = { truck_no: g('f-truck_no'), driver_id: g('f-driver_id') || null, date: g('f-date') || null, from_location: g('f-from_location'), to_location: g('f-to_location'), distance: g('f-distance') || null, diesel: g('f-diesel') || 0, toll: g('f-toll') || 0, da: g('f-da') || 0, advance: g('f-advance') || 0, loading_exp: g('f-loading_exp') || 0, unloading_exp: g('f-unloading_exp') || 0, misc: g('f-misc') || 0, bill_amt: g('f-bill_amt') || 0, status: g('f-status') };
  id ? await DB.update('trips', id, record) : await DB.insert('trips', record);
  renderTrips();
}

async function exportTrips() {
  const trips = await DB.getAll('trips');
  const filtered = DateFilter.apply(trips, 'date', 'trips-df');
  exportExcel(filtered.map(t => ({ 'Truck': t.truck_no, 'From': t.from_location, 'To': t.to_location, 'Date': t.date, 'Distance': t.distance, 'Diesel': t.diesel, 'Toll': t.toll, 'DA': t.da, 'Advance': t.advance, 'Misc': t.misc, 'Bill Amt': t.bill_amt, 'Status': t.status })), 'TMS_Trips');
}
