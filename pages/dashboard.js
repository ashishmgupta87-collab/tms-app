async function renderDashboard() {
  const el = document.getElementById('pg-dashboard');
  el.innerHTML = `<div class="pg-header"><div class="pg-title">Dashboard</div><div id="dash-date" class="pg-date"></div></div><div class="metrics" id="dash-metrics"><div class="metric"><div class="metric-lbl">Loading...</div><div class="metric-val">—</div></div></div><div class="grid2"><div class="card"><div class="card-title">Recent trips</div><div class="tbl-wrap"><table><thead><tr><th>Truck</th><th>Route</th><th>Driver</th><th>Amount</th><th>Status</th></tr></thead><tbody id="dash-trips"></tbody></table></div></div><div class="card"><div class="card-title">Alerts &amp; reminders</div><div id="dash-alerts"><div class="empty-state">Loading...</div></div></div></div>`;

  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  const [trucks, drivers, trips, invoices, maint] = await Promise.all([
    DB.getAll('fleet'), DB.getAll('drivers'), DB.getAll('trips'), DB.getAll('billing'), DB.getAll('maintenance')
  ]);

  const totalRev = invoices.reduce((s, i) => s + Number(i.amount || 0), 0);
  const pending = invoices.filter(i => i.status === 'Pending').reduce((s, i) => s + Number(i.amount || 0), 0);
  const totalExp = trips.reduce((s, t) => s + Number(t.diesel || 0) + Number(t.toll || 0) + Number(t.da || 0) + Number(t.misc || 0), 0)
    + maint.reduce((s, m) => s + Number(m.cost || 0), 0);

  document.getElementById('dash-metrics').innerHTML = `
    <div class="metric"><div class="metric-lbl">Total trucks</div><div class="metric-val">${trucks.length}</div><div class="metric-sub">${trucks.filter(t => t.status === 'Active').length} active</div></div>
    <div class="metric"><div class="metric-lbl">Total drivers</div><div class="metric-val">${drivers.length}</div><div class="metric-sub">${trips.length} trips logged</div></div>
    <div class="metric"><div class="metric-lbl">Total billed</div><div class="metric-val">${rupee(totalRev)}</div><div class="metric-sub">${invoices.length} invoices</div></div>
    <div class="metric"><div class="metric-lbl">Pending bills</div><div class="metric-val">${rupee(pending)}</div><div class="metric-sub">${invoices.filter(i => i.status === 'Pending').length} due</div></div>`;

  const dmap = Object.fromEntries(drivers.map(d => [d.id, d.name]));
  const recent = trips.slice(0, 6);
  document.getElementById('dash-trips').innerHTML = recent.length
    ? recent.map(t => `<tr><td>${t.truck_no}</td><td>${t.from_location || '-'} → ${t.to_location || '-'}</td><td>${dmap[t.driver_id] || '-'}</td><td>${rupee(t.bill_amt)}</td><td>${badge(t.status || '-', t.status === 'Completed' ? 'b-green' : t.status === 'On Route' ? 'b-blue' : 'b-amber')}</td></tr>`).join('')
    : emptyState('No trips yet');

  const alerts = [];
  trucks.forEach(t => {
    [['insurance_exp', 'insurance'], ['fitness_exp', 'fitness cert'], ['permit_exp', 'permit'], ['puc_exp', 'PUC']].forEach(([f, label]) => {
      if (daysUntil(t[f]) < 30) alerts.push({ type: daysUntil(t[f]) < 0 ? 'danger' : 'amber', text: `${t.truck_no} — ${label} ${expLabel(t[f])}` });
    });
  });
  drivers.forEach(d => { if (daysUntil(d.licence_exp) < 60) alerts.push({ type: 'amber', text: `${d.name} — licence ${expLabel(d.licence_exp)}` }); });

  document.getElementById('dash-alerts').innerHTML = alerts.length
    ? alerts.slice(0, 7).map(a => `<div class="alert-item"><div class="alert-dot d-${a.type}"></div><div class="alert-text">${a.text}</div></div>`).join('')
    : '<div class="empty-state">No alerts — all good!</div>';
}
