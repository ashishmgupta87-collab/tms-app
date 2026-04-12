async function renderDashboard() {
  const el = document.getElementById('pg-dashboard');
  el.innerHTML = `
    <div class="pg-header">
      <div class="pg-title">Dashboard</div>
      <div id="dash-date" class="pg-date"></div>
    </div>
    <div class="metrics" id="dash-metrics"></div>
    <div class="grid2">
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
          Recent trips
          <span class="dash-link" onclick="nav('trips')" style="font-size:12px;color:#185FA5;cursor:pointer;font-weight:400">View all →</span>
        </div>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Truck</th><th>Route</th><th>Driver</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody id="dash-trips"></tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
          Alerts &amp; reminders
          <span class="dash-link" onclick="nav('fleet')" style="font-size:12px;color:#185FA5;cursor:pointer;font-weight:400">View fleet →</span>
        </div>
        <div id="dash-alerts"><div class="empty-state">Loading...</div></div>
      </div>
    </div>`;

  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
  });

  const [trucks, drivers, trips, invoices, maint] = await Promise.all([
    DB.getAll('fleet'), DB.getAll('drivers'), DB.getAll('trips'),
    DB.getAll('billing'), DB.getAll('maintenance')
  ]);

  const totalRev = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const pending = invoices.filter(i => i.status === 'Pending').reduce((s, i) => s + Number(i.amount || 0), 0);
  const activeTrucks = trucks.filter(t => t.status === 'Active').length;
  const pendingCount = invoices.filter(i => i.status === 'Pending').length;

  // Expiry alerts count
  let alertCount = 0;
  trucks.forEach(t => {
    ['insurance_exp','fitness_exp','permit_exp','puc_exp'].forEach(f => {
      if (daysUntil(t[f]) < 30) alertCount++;
    });
  });
  drivers.forEach(d => { if (daysUntil(d.licence_exp) < 60) alertCount++; });

  document.getElementById('dash-metrics').innerHTML = `
    <div class="metric metric-link" onclick="nav('fleet')" title="Go to Fleet">
      <div class="metric-lbl">Total trucks</div>
      <div class="metric-val">${trucks.length}</div>
      <div class="metric-sub">${activeTrucks} active &rarr;</div>
    </div>
    <div class="metric metric-link" onclick="nav('drivers')" title="Go to Drivers">
      <div class="metric-lbl">Total drivers</div>
      <div class="metric-val">${drivers.length}</div>
      <div class="metric-sub">${trips.length} trips logged &rarr;</div>
    </div>
    <div class="metric metric-link" onclick="nav('billing')" title="Go to Billing">
      <div class="metric-lbl">Total billed</div>
      <div class="metric-val">${rupee(totalRev)}</div>
      <div class="metric-sub">${invoices.length} invoices &rarr;</div>
    </div>
    <div class="metric metric-link" onclick="nav('billing')" title="Go to Billing">
      <div class="metric-lbl">Pending bills</div>
      <div class="metric-val">${rupee(pending)}</div>
      <div class="metric-sub">${pendingCount} due &rarr;</div>
    </div>`;

  const dmap = Object.fromEntries(drivers.map(d => [d.id, d.name]));
  const recent = trips.slice(0, 6);
  document.getElementById('dash-trips').innerHTML = recent.length
    ? recent.map(t => `
        <tr class="dash-trip-row" onclick="nav('trips')" style="cursor:pointer" title="Go to Trips">
          <td>${t.truck_no}</td>
          <td>${t.from_location || '-'} → ${t.to_location || '-'}</td>
          <td>${dmap[t.driver_id] || '-'}</td>
          <td>${rupee(t.bill_amt)}</td>
          <td>${badge(t.status || '-', t.status === 'Completed' ? 'b-green' : t.status === 'On Route' ? 'b-blue' : 'b-amber')}</td>
        </tr>`).join('')
    : emptyState('No trips yet — <span class="dash-link" onclick="event.stopPropagation();nav(\'trips\')" style="color:#185FA5;cursor:pointer">add your first trip →</span>');

  const alerts = [];
  trucks.forEach(t => {
    [['insurance_exp','insurance'],['fitness_exp','fitness cert'],['permit_exp','permit'],['puc_exp','PUC']].forEach(([f, label]) => {
      if (daysUntil(t[f]) < 30) alerts.push({
        type: daysUntil(t[f]) < 0 ? 'danger' : 'amber',
        text: `${t.truck_no} — ${label} ${expLabel(t[f])}`,
        page: 'fleet'
      });
    });
  });
  drivers.forEach(d => {
    if (daysUntil(d.licence_exp) < 60) alerts.push({
      type: 'amber',
      text: `${d.name} — licence ${expLabel(d.licence_exp)}`,
      page: 'drivers'
    });
  });

  document.getElementById('dash-alerts').innerHTML = alerts.length
    ? alerts.slice(0, 7).map(a => `
        <div class="alert-item alert-item-link" onclick="nav('${a.page}')" style="cursor:pointer" title="Go to ${a.page}">
          <div class="alert-dot d-${a.type}"></div>
          <div class="alert-text" style="flex:1">${a.text}</div>
          <div style="font-size:11px;color:#185FA5;flex-shrink:0">→</div>
        </div>`).join('')
    : '<div class="empty-state">No alerts — all good!</div>';
}
