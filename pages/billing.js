async function renderBilling() {
  const el = document.getElementById('pg-billing');
  el.innerHTML = `<div class="pg-header"><div class="pg-title">Billing &amp; Accounts</div><div class="topbar-row"><button class="btn btn-amber" onclick="exportBilling()">Export Excel</button><button class="btn btn-primary" onclick="openModal('billing')">+ New invoice</button></div></div><div class="metrics" id="billing-metrics"></div><div class="card"><div class="card-title">Invoices</div><div class="tbl-wrap"><table><thead><tr><th>Invoice no.</th><th>Truck</th><th>Client</th><th>Route</th><th>Amount (₹)</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead><tbody id="billing-body"><tr><td colspan="8" class="empty-state">Loading...</td></tr></tbody></table></div></div>`;

  const data = await DB.getAll('billing');
  const total = data.reduce((s, i) => s + Number(i.amount || 0), 0);
  const paid = data.filter(i => i.status === 'Paid').reduce((s, i) => s + Number(i.amount || 0), 0);
  const pend = data.filter(i => i.status === 'Pending').reduce((s, i) => s + Number(i.amount || 0), 0);

  document.getElementById('billing-metrics').innerHTML = `
    <div class="metric"><div class="metric-lbl">Total billed</div><div class="metric-val">${rupee(total)}</div></div>
    <div class="metric"><div class="metric-lbl">Received</div><div class="metric-val">${rupee(paid)}</div></div>
    <div class="metric"><div class="metric-lbl">Pending</div><div class="metric-val">${rupee(pend)}</div></div>
    <div class="metric"><div class="metric-lbl">Invoices</div><div class="metric-val">${data.length}</div></div>`;

  document.getElementById('billing-body').innerHTML = data.length
    ? data.map(i => `<tr>
        <td><strong>${i.invoice_no || '-'}</strong></td>
        <td>${i.truck_no || '-'}</td><td>${i.client || '-'}</td><td>${i.route || '-'}</td>
        <td><strong>${rupee(i.amount)}</strong></td>
        <td>${fmtDate(i.date)}</td>
        <td>${badge(i.status || '-', i.status === 'Paid' ? 'b-green' : i.status === 'Pending' ? 'b-amber' : 'b-red')}</td>
        <td class="action-btns">
          <button class="btn btn-sm btn-success" onclick="printInvoice('${i.id}')">PDF</button>
          <button class="btn btn-sm" onclick='openModal("billing", ${JSON.stringify(i)})'>Edit</button>
          <button class="btn btn-sm btn-danger" onclick="delRecord('billing','${i.id}',renderBilling)">Del</button>
        </td>
      </tr>`).join('')
    : emptyState('No invoices yet.');
}

async function billingForm(d = {}) {
  const trucks = await DB.getAll('fleet');
  return `<div class="form-grid">
    <div class="form-group"><label>Invoice no.*</label><input id="f-invoice_no" value="${d.invoice_no || 'INV-' + Date.now().toString().slice(-5)}"></div>
    <div class="form-group"><label>Truck no.</label><select id="f-truck_no"><option value="">Select...</option>${trucks.map(t => `<option value="${t.truck_no}" ${d.truck_no === t.truck_no ? 'selected' : ''}>${t.truck_no}</option>`).join('')}</select></div>
    <div class="form-group"><label>Client name*</label><input id="f-client" value="${d.client || ''}"></div>
    <div class="form-group"><label>Route</label><input id="f-route" value="${d.route || ''}" placeholder="City A → City B"></div>
    <div class="form-group"><label>Amount (₹)*</label><input id="f-amount" type="number" value="${d.amount || ''}"></div>
    <div class="form-group"><label>Date</label><input id="f-date" type="date" value="${d.date || ''}"></div>
    <div class="form-group"><label>Status</label><select id="f-status"><option ${d.status === 'Pending' ? 'selected' : ''}>Pending</option><option ${d.status === 'Paid' ? 'selected' : ''}>Paid</option><option ${d.status === 'Overdue' ? 'selected' : ''}>Overdue</option></select></div>
  </div>`;
}

async function saveBilling(id) {
  if (!g('f-invoice_no') || !g('f-amount')) throw new Error('Invoice no. and amount required.');
  const record = { invoice_no: g('f-invoice_no'), truck_no: g('f-truck_no'), client: g('f-client'), route: g('f-route'), amount: g('f-amount') || 0, date: g('f-date') || null, status: g('f-status') };
  id ? await DB.update('billing', id, record) : await DB.insert('billing', record);
  renderBilling();
}

async function printInvoice(id) {
  const invoices = await DB.getAll('billing');
  const inv = invoices.find(i => i.id === id);
  if (!inv) return;
  const company = (await DB.getAll('company'))[0] || {};
  const win = window.open('', '_blank', 'width=820,height=950');
  if (!win) { showToast('Please allow popups to print PDF', 'error'); return; }
  win.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.invoice_no}</title>
  <style>body{font-family:Arial,sans-serif;padding:44px;color:#1a1a1a;max-width:720px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #185FA5;padding-bottom:18px;margin-bottom:28px}
  .co-name{font-size:22px;font-weight:700;color:#185FA5}.co-sub{font-size:12px;color:#666;margin-top:3px}
  .inv-title{font-size:26px;font-weight:700;color:#185FA5;text-align:right}
  .inv-meta{font-size:13px;color:#666;text-align:right;margin-top:4px}
  .info-row{display:flex;gap:40px;margin-bottom:28px;flex-wrap:wrap}
  .info-block label{font-size:10px;font-weight:700;color:#888;letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:4px}
  .info-block .val{font-size:15px;font-weight:600}
  .status-pill{display:inline-block;padding:5px 16px;border-radius:20px;font-size:12px;font-weight:600;background:${inv.status==='Paid'?'#EAF3DE':'#FAEEDA'};color:${inv.status==='Paid'?'#27500A':'#633806'}}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#E6F1FB;color:#0C447C;padding:10px 12px;text-align:left;font-size:11px;font-weight:700;letter-spacing:.05em}
  td{padding:12px;border-bottom:1px solid #eee;font-size:14px}
  .total-row td{font-weight:700;font-size:16px;background:#f5f5f5;border-top:2px solid #185FA5}
  .footer{margin-top:48px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center}
  .print-btn{margin-top:24px;padding:12px 28px;background:#185FA5;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:15px}
  @media print{.print-btn{display:none}}</style></head><body>
  <div class="header">
    <div><div class="co-name">${company.name || 'Your Company Name'}</div><div class="co-sub">${company.address || ''}</div>${company.gstin ? `<div class="co-sub">GSTIN: ${company.gstin}</div>` : ''}<div class="co-sub">${company.phone || ''}</div></div>
    <div><div class="inv-title">INVOICE</div><div class="inv-meta">${inv.invoice_no}</div><div class="inv-meta">${inv.date ? new Date(inv.date).toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'}) : ''}</div></div>
  </div>
  <div class="info-row">
    <div class="info-block"><label>Billed to</label><div class="val">${inv.client || '-'}</div></div>
    <div class="info-block"><label>Truck no.</label><div class="val">${inv.truck_no || '-'}</div></div>
    <div class="info-block"><label>Route</label><div class="val">${inv.route || '-'}</div></div>
    <div class="info-block"><label>Status</label><span class="status-pill">${inv.status || 'Pending'}</span></div>
  </div>
  <table><thead><tr><th>Description</th><th style="text-align:right">Amount (₹)</th></tr></thead>
  <tbody>
    <tr><td>Freight charges — ${inv.route || 'Transport service'}</td><td style="text-align:right">₹${Number(inv.amount||0).toLocaleString('en-IN')}</td></tr>
    <tr class="total-row"><td>Total payable</td><td style="text-align:right">₹${Number(inv.amount||0).toLocaleString('en-IN')}</td></tr>
  </tbody></table>
  <div class="footer">Thank you for your business. Please make payment within 30 days of invoice date.<br>${company.name || ''} | ${company.phone || ''} | ${company.email || ''}</div>
  <br><button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </body></html>`);
  win.document.close();
}

async function exportBilling() {
  const data = await DB.getAll('billing');
  exportExcel(data.map(i => ({ 'Invoice No': i.invoice_no, 'Truck': i.truck_no, 'Client': i.client, 'Route': i.route, 'Amount': i.amount, 'Date': i.date, 'Status': i.status })), 'TMS_Billing');
}
