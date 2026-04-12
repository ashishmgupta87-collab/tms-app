const pageRenderers = {
  dashboard: renderDashboard,
  fleet: renderFleet,
  drivers: renderDrivers,
  trips: renderTrips,
  maintenance: renderMaint,
  billing: renderBilling,
  salary: renderSalary,
  pl: renderPL,
  import: renderImport,
  company: renderCompany
};

const pageLabels = {
  dashboard: 'Dashboard', fleet: 'Fleet & Trucks', drivers: 'Drivers',
  trips: 'Trips & Routes', maintenance: 'Maintenance', billing: 'Billing & Accounts',
  salary: 'Driver Salary', pl: 'P&L Report', import: 'Import from Excel', company: 'Company Details'
};

function nav(page) {
  document.querySelectorAll('.pg').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  const pg = document.getElementById('pg-' + page);
  if (pg) pg.classList.add('active');
  document.querySelectorAll('.sb-item').forEach(i => {
    if (i.textContent.trim() === pageLabels[page]) i.classList.add('active');
  });
  if (pageRenderers[page]) pageRenderers[page]();
}

async function updateSyncStatus() {
  const dot = document.getElementById('sync-dot');
  const txt = document.getElementById('sync-text');
  const online = await DB.checkConnection();
  dot.className = 'sync-dot ' + (online ? 'online' : 'offline');
  txt.textContent = online ? 'Cloud synced' : 'Offline mode';
}

async function init() {
  const user = await Auth.requireAuth();
  if (!user) return;
  const emailEl = document.getElementById('user-email');
  if (emailEl) emailEl.textContent = user.email;
  await updateSyncStatus();
  setInterval(updateSyncStatus, 30000);
  renderDashboard();
}

window.addEventListener('DOMContentLoaded', init);
