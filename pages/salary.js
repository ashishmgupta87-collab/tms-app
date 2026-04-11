// ─── SALARY ───────────────────────────────────────────────
async function renderSalary() {
  const el = document.getElementById('pg-salary');
  el.innerHTML = `<div class="pg-header"><div class="pg-title">Driver Salary</div><div class="topbar-row"><button class="btn btn-amber" onclick="exportSalary()">Export Excel</button><button class="btn btn-primary" onclick="openModal('salary')">+ Log salary</button></div></div><div class="card"><div class="tbl-wrap"><table><thead><tr><th>Driver</th><th>Truck</th><th>Trip / Month</th><th>Days</th><th>Rate/day</th><th>DA</th><th>Advance</th><th>Net payable</th><th>Status</th><th>Actions</th></tr></thead><tbody id="salary-body"><tr><td colspan="10" class="empty-state">Loading...</td></tr></tbody></table></div></div>`;
  const data = await DB.getAll('salary');
  document.getElementById('salary-body').innerHTML = data.length
    ? data.map(s => {
        const net = Math.max(0, (Number(s.days||0)*Number(s.rate||0)) + Number(s.da||0) - Number(s.advance||0));
        return `<tr>
          <td><strong>${s.driver_name||'-'}</strong></td><td>${s.truck_no||'-'}</td><td>${s.trip_date||'-'}</td>
          <td>${s.days||0}</td><td>${rupee(s.rate)}</td><td>${rupee(s.da)}</td><td>${rupee(s.advance)}</td>
          <td><strong>${rupee(net)}</strong></td>
          <td>${badge(s.status||'Pending', s.status==='Paid'?'b-green':'b-amber')}</td>
          <td class="action-btns">
            <button class="btn btn-sm" onclick='openModal("salary", ${JSON.stringify(s)})'>Edit</button>
            <button class="btn btn-sm btn-danger" onclick="delRecord('salary','${s.id}',renderSalary)">Del</button>
          </td></tr>`;
      }).join('')
    : emptyState('No salary records yet.');
}

async function salaryForm(d = {}) {
  const [drivers, trucks] = await Promise.all([DB.getAll('drivers'), DB.getAll('fleet')]);
  return `<div class="form-grid">
    <div class="form-group"><label>Driver*</label><select id="f-driver_name"><option value="">Select...</option>${drivers.map(dr=>`<option value="${dr.name}" ${d.driver_name===dr.name?'selected':''}>${dr.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>Truck no.</label><select id="f-truck_no"><option value="">Select...</option>${trucks.map(t=>`<option value="${t.truck_no}" ${d.truck_no===t.truck_no?'selected':''}>${t.truck_no}</option>`).join('')}</select></div>
    <div class="form-group"><label>Trip / month</label><input id="f-trip_date" value="${d.trip_date||''}" placeholder="e.g. Apr 2026"></div>
    <div class="form-group"><label>Days worked</label><input id="f-days" type="number" value="${d.days||''}"></div>
    <div class="form-group"><label>Rate per day (₹)</label><input id="f-rate" type="number" value="${d.rate||''}"></div>
    <div class="form-group"><label>DA (₹)</label><input id="f-da" type="number" value="${d.da||0}"></div>
    <div class="form-group"><label>Advance deduct (₹)</label><input id="f-advance" type="number" value="${d.advance||0}"></div>
    <div class="form-group"><label>Status</label><select id="f-status"><option ${d.status==='Pending'?'selected':''}>Pending</option><option ${d.status==='Paid'?'selected':''}>Paid</option></select></div>
  </div>`;
}

async function saveSalary(id) {
  const record = { driver_name: g('f-driver_name'), truck_no: g('f-truck_no'), trip_date: g('f-trip_date'), days: g('f-days')||0, rate: g('f-rate')||0, da: g('f-da')||0, advance: g('f-advance')||0, status: g('f-status') };
  id ? await DB.update('salary', id, record) : await DB.insert('salary', record);
  renderSalary();
}

async function exportSalary() {
  const data = await DB.getAll('salary');
  exportExcel(data.map(s => ({ 'Driver': s.driver_name, 'Truck': s.truck_no, 'Period': s.trip_date, 'Days': s.days, 'Rate': s.rate, 'DA': s.da, 'Advance': s.advance, 'Net': Math.max(0,(s.days*s.rate)+Number(s.da)-Number(s.advance)), 'Status': s.status })), 'TMS_Salary');
}

// ─── P&L REPORT ───────────────────────────────────────────
async function renderPL() {
  const el = document.getElementById('pg-pl');
  el.innerHTML = `<div class="pg-header"><div class="pg-title">P&amp;L Report</div><div class="topbar-row"><select id="pl-month" onchange="refreshPL()" style="padding:7px 10px;border:0.5px solid var(--border-color);border-radius:8px;font-size:12px;background:var(--bg-primary);color:var(--text-primary)"></select><button class="btn btn-success" onclick="exportPLPDF()">Export PDF</button><button class="btn btn-amber" onclick="exportPLExcel()">Export Excel</button></div></div><div class="metrics" id="pl-metrics"></div><div class="grid2"><div class="card"><div class="card-title">Revenue by truck</div><div id="pl-rev-bars"></div></div><div class="card"><div class="card-title">Expense breakdown</div><div id="pl-exp-bars"></div></div></div><div class="card"><div class="card-title">Per-truck P&amp;L</div><div class="tbl-wrap"><table><thead><tr><th>Truck</th><th>Trips</th><th>Revenue</th><th>Diesel</th><th>Toll</th><th>DA</th><th>Maint.</th><th>Total exp.</th><th>Net profit</th><th>Margin</th></tr></thead><tbody id="pl-truck-body"></tbody></table></div></div>`;
  await initPLMonths();
  await refreshPL();
}

async function initPLMonths() {
  const [trips, invoices] = await Promise.all([DB.getAll('trips'), DB.getAll('billing')]);
  const months = new Set();
  [...trips, ...invoices].forEach(r => { if (r.date) { const d = new Date(r.date); if (!isNaN(d)) months.add(d.getFullYear() + '-' + (d.getMonth()+1).toString().padStart(2,'0')); }});
  const now = new Date();
  months.add(now.getFullYear() + '-' + (now.getMonth()+1).toString().padStart(2,'0'));
  const sel = document.getElementById('pl-month');
  if (!sel) return;
  sel.innerHTML = [...months].sort().reverse().map(m => { const [y,mo] = m.split('-'); return `<option value="${m}">${new Date(y,mo-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</option>`; }).join('');
}

async function refreshPL() {
  const sel = document.getElementById('pl-month');
  if (!sel) return;
  const [yr, mo] = sel.value.split('-').map(Number);
  const inMonth = arr => arr.filter(r => { if (!r.date) return false; const d = new Date(r.date); return d.getFullYear()===yr && d.getMonth()+1===mo; });
  const [allTrips, allInvoices, allMaint, trucks] = await Promise.all([DB.getAll('trips'), DB.getAll('billing'), DB.getAll('maintenance'), DB.getAll('fleet')]);
  const trips = inMonth(allTrips), invoices = inMonth(allInvoices), maint = inMonth(allMaint);
  const totalRev = invoices.reduce((s,i)=>s+Number(i.amount||0),0);
  const totalDiesel = trips.reduce((s,t)=>s+Number(t.diesel||0),0);
  const totalToll = trips.reduce((s,t)=>s+Number(t.toll||0),0);
  const totalDA = trips.reduce((s,t)=>s+Number(t.da||0),0);
  const totalMisc = trips.reduce((s,t)=>s+Number(t.misc||0)+Number(t.loading_exp||0)+Number(t.unloading_exp||0),0);
  const totalMaint = maint.reduce((s,m)=>s+Number(m.cost||0),0);
  const totalExp = totalDiesel+totalToll+totalDA+totalMisc+totalMaint;
  const profit = totalRev-totalExp;
  const margin = totalRev>0?Math.round(profit/totalRev*100):0;

  document.getElementById('pl-metrics').innerHTML = `
    <div class="metric"><div class="metric-lbl">Revenue</div><div class="metric-val">${rupee(totalRev)}</div><div class="metric-sub">${invoices.length} invoices</div></div>
    <div class="metric"><div class="metric-lbl">Expenses</div><div class="metric-val">${rupee(totalExp)}</div><div class="metric-sub">${trips.length} trips</div></div>
    <div class="metric"><div class="metric-lbl">Net profit</div><div class="metric-val" style="color:${profit>=0?'#27500A':'#A32D2D'}">${rupee(profit)}</div></div>
    <div class="metric"><div class="metric-lbl">Margin</div><div class="metric-val" style="color:${margin>=0?'#27500A':'#A32D2D'}">${margin}%</div></div>`;

  const revByTruck = {};
  invoices.forEach(i => { if (i.truck_no) revByTruck[i.truck_no] = (revByTruck[i.truck_no]||0)+Number(i.amount||0); });
  const topRev = Object.entries(revByTruck).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxRev = topRev.length ? topRev[0][1] : 1;
  document.getElementById('pl-rev-bars').innerHTML = topRev.length
    ? topRev.map(([t,amt])=>`<div class="pl-bar-row"><div class="pl-bar-label">${t}</div><div class="pl-bar-track"><div class="pl-bar-fill" style="width:${Math.round(amt/maxRev*100)}%;background:#378ADD"></div></div><div class="pl-bar-val">${rupee(amt)}</div></div>`).join('')
    : '<div class="empty-state">No revenue data</div>';

  const expItems = [['Diesel',totalDiesel,'#EF9F27'],['Toll',totalToll,'#D85A30'],['Driver DA',totalDA,'#7F77DD'],['Maintenance',totalMaint,'#1D9E75'],['Misc',totalMisc,'#888780']];
  const maxExp = Math.max(...expItems.map(e=>e[1]),1);
  document.getElementById('pl-exp-bars').innerHTML = expItems.map(([lbl,amt,col])=>`<div class="pl-bar-row"><div class="pl-bar-label">${lbl}</div><div class="pl-bar-track"><div class="pl-bar-fill" style="width:${Math.round(amt/maxExp*100)}%;background:${col}"></div></div><div class="pl-bar-val">${rupee(amt)}</div></div>`).join('');

  const truckPL = trucks.map(t => {
    const tTrips=trips.filter(r=>r.truck_no===t.truck_no);
    const tRev=invoices.filter(i=>i.truck_no===t.truck_no).reduce((s,i)=>s+Number(i.amount||0),0);
    const tExp=tTrips.reduce((s,r)=>s+Number(r.diesel||0)+Number(r.toll||0)+Number(r.da||0)+Number(r.misc||0),0)+maint.filter(m=>m.truck_no===t.truck_no).reduce((s,m)=>s+Number(m.cost||0),0);
    const tP=tRev-tExp; const tm=tRev>0?Math.round(tP/tRev*100):0;
    return {truck:t.truck_no,trips:tTrips.length,rev:tRev,diesel:tTrips.reduce((s,r)=>s+Number(r.diesel||0),0),toll:tTrips.reduce((s,r)=>s+Number(r.toll||0),0),da:tTrips.reduce((s,r)=>s+Number(r.da||0),0),maint:maint.filter(m=>m.truck_no===t.truck_no).reduce((s,m)=>s+Number(m.cost||0),0),exp:tExp,profit:tP,margin:tm};
  }).filter(r=>r.trips>0||r.rev>0).sort((a,b)=>b.profit-a.profit);

  document.getElementById('pl-truck-body').innerHTML = truckPL.length
    ? truckPL.map(r=>`<tr><td><strong>${r.truck}</strong></td><td>${r.trips}</td><td>${rupee(r.rev)}</td><td>${rupee(r.diesel)}</td><td>${rupee(r.toll)}</td><td>${rupee(r.da)}</td><td>${rupee(r.maint)}</td><td>${rupee(r.exp)}</td><td style="color:${r.profit>=0?'#27500A':'#A32D2D'}"><strong>${rupee(r.profit)}</strong></td><td>${badge(r.margin+'%',r.margin>=20?'b-green':r.margin>=0?'b-amber':'b-red')}</td></tr>`).join('')
    : emptyState('No data for this period. Add trips and invoices first.');
}

async function exportPLExcel() {
  const sel = document.getElementById('pl-month');
  if (!sel) return;
  const [yr,mo] = sel.value.split('-').map(Number);
  const trips = (await DB.getAll('trips')).filter(t=>{if(!t.date)return false;const d=new Date(t.date);return d.getFullYear()===yr&&d.getMonth()+1===mo;});
  const invoices = (await DB.getAll('billing')).filter(i=>{if(!i.date)return false;const d=new Date(i.date);return d.getFullYear()===yr&&d.getMonth()+1===mo;});
  exportExcel(invoices.map(i=>({Invoice:i.invoice_no,Truck:i.truck_no,Client:i.client,Amount:i.amount,Date:i.date,Status:i.status})),'TMS_PL_'+sel.value);
}

async function exportPLPDF() {
  const sel = document.getElementById('pl-month');
  if (!sel) return;
  const [yr,mo] = sel.value.split('-').map(Number);
  const monthLabel = new Date(yr,mo-1,1).toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  const inMonth = arr => arr.filter(r=>{if(!r.date)return false;const d=new Date(r.date);return d.getFullYear()===yr&&d.getMonth()+1===mo;});
  const [allTrips,allInvoices,allMaint,trucks,company] = await Promise.all([DB.getAll('trips'),DB.getAll('billing'),DB.getAll('maintenance'),DB.getAll('fleet'),DB.getAll('company')]);
  const trips=inMonth(allTrips),invoices=inMonth(allInvoices),maint=inMonth(allMaint);
  const co = company[0]||{};
  const totalRev=invoices.reduce((s,i)=>s+Number(i.amount||0),0);
  const totalDiesel=trips.reduce((s,t)=>s+Number(t.diesel||0),0);
  const totalToll=trips.reduce((s,t)=>s+Number(t.toll||0),0);
  const totalDA=trips.reduce((s,t)=>s+Number(t.da||0),0);
  const totalMisc=trips.reduce((s,t)=>s+Number(t.misc||0)+Number(t.loading_exp||0)+Number(t.unloading_exp||0),0);
  const totalMaint=maint.reduce((s,m)=>s+Number(m.cost||0),0);
  const totalExp=totalDiesel+totalToll+totalDA+totalMisc+totalMaint;
  const profit=totalRev-totalExp;
  const margin=totalRev>0?Math.round(profit/totalRev*100):0;
  const truckRows=trucks.map(t=>{const tT=trips.filter(r=>r.truck_no===t.truck_no);const tR=invoices.filter(i=>i.truck_no===t.truck_no).reduce((s,i)=>s+Number(i.amount||0),0);const tE=tT.reduce((s,r)=>s+Number(r.diesel||0)+Number(r.toll||0)+Number(r.da||0)+Number(r.misc||0),0)+maint.filter(m=>m.truck_no===t.truck_no).reduce((s,m)=>s+Number(m.cost||0),0);const tP=tR-tE;return tT.length>0||tR>0?`<tr><td>${t.truck_no}</td><td>${tT.length}</td><td>₹${tR.toLocaleString('en-IN')}</td><td>₹${tE.toLocaleString('en-IN')}</td><td style="color:${tP>=0?'green':'red'}">₹${tP.toLocaleString('en-IN')}</td></tr>`:null;}).filter(Boolean).join('');
  const win=window.open('','_blank','width=860,height=1000');
  if(!win){showToast('Allow popups to export PDF','error');return;}
  win.document.write(`<!DOCTYPE html><html><head><title>P&L ${monthLabel}</title><style>body{font-family:Arial,sans-serif;padding:40px;color:#1a1a1a;max-width:760px;margin:0 auto}h1{font-size:22px;color:#185FA5;margin-bottom:2px}h2{font-size:14px;color:#666;font-weight:400;margin-bottom:24px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px}.m{background:#f5f7fa;border-radius:8px;padding:14px}.m-l{font-size:11px;color:#888;margin-bottom:3px}.m-v{font-size:20px;font-weight:700}table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px}th{background:#E6F1FB;color:#0C447C;padding:9px 12px;text-align:left;font-size:11px}td{padding:9px 12px;border-bottom:1px solid #eee}.footer{margin-top:32px;padding-top:14px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center}@media print{button{display:none}}</style></head><body>
  <h1>${co.name||'TMS Pro'} — P&L Report</h1><h2>${monthLabel}</h2>
  <div class="grid"><div class="m"><div class="m-l">Revenue</div><div class="m-v">₹${totalRev.toLocaleString('en-IN')}</div></div><div class="m"><div class="m-l">Expenses</div><div class="m-v">₹${totalExp.toLocaleString('en-IN')}</div></div><div class="m"><div class="m-l">Net Profit</div><div class="m-v" style="color:${profit>=0?'green':'red'}">₹${profit.toLocaleString('en-IN')}</div></div><div class="m"><div class="m-l">Margin</div><div class="m-v">${margin}%</div></div></div>
  <h3 style="font-size:13px;font-weight:600;margin-bottom:8px">Expense summary</h3>
  <table><thead><tr><th>Category</th><th>Amount (₹)</th></tr></thead><tbody><tr><td>Diesel</td><td>₹${totalDiesel.toLocaleString('en-IN')}</td></tr><tr><td>Toll</td><td>₹${totalToll.toLocaleString('en-IN')}</td></tr><tr><td>Driver DA</td><td>₹${totalDA.toLocaleString('en-IN')}</td></tr><tr><td>Maintenance</td><td>₹${totalMaint.toLocaleString('en-IN')}</td></tr><tr><td>Misc/Loading</td><td>₹${totalMisc.toLocaleString('en-IN')}</td></tr><tr style="font-weight:700;background:#f8f8f8"><td>Total</td><td>₹${totalExp.toLocaleString('en-IN')}</td></tr></tbody></table>
  ${truckRows?`<h3 style="font-size:13px;font-weight:600;margin-bottom:8px">Per-truck performance</h3><table><thead><tr><th>Truck</th><th>Trips</th><th>Revenue</th><th>Expenses</th><th>Net Profit</th></tr></thead><tbody>${truckRows}</tbody></table>`:''}
  <div class="footer">Generated on ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} — TMS Pro</div>
  <br><button onclick="window.print()" style="padding:10px 24px;background:#185FA5;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px">Print / Save as PDF</button></body></html>`);
  win.document.close();
}

// ─── IMPORT ───────────────────────────────────────────────
function renderImport() {
  const el = document.getElementById('pg-import');
  el.innerHTML = `<div class="pg-header"><div class="pg-title">Import from Excel</div></div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px">
    ${['fleet','drivers','trips','billing'].map(type=>`<div class="card"><div class="card-title">Import ${type}</div><p style="font-size:12px;color:var(--text-secondary);margin-bottom:12px">Upload .xlsx or .csv file</p><div class="upload-zone" onclick="document.getElementById('file-${type}').click()">Click to select file</div><input type="file" id="file-${type}" accept=".xlsx,.xls,.csv" style="display:none" onchange="handleImport(event,'${type}')"><div id="import-result-${type}" style="margin-top:10px;font-size:12px"></div></div>`).join('')}
  </div>
  <div class="card" style="margin-top:0"><div class="card-title">Download templates</div><div style="display:flex;gap:10px;flex-wrap:wrap">${['fleet','drivers','trips','billing'].map(t=>`<button class="btn" onclick="downloadTemplate('${t}')">${t} template</button>`).join('')}</div></div>`;
}

async function handleImport(event, type) {
  const file = event.target.files[0]; if (!file) return;
  const res = document.getElementById('import-result-' + type);
  res.textContent = 'Reading...';
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      if (!rows.length) { res.textContent = 'No data found.'; return; }
      const maps = {
        fleet: r => ({ truck_no: r['Truck No']||r['truck_no']||r['TruckNo'], make: r['Make']||r['make'], model: r['Model']||r['model'], wheel_type: r['Wheel Type']||r['WheelType'], load_cap: r['Load Cap']||r['load_cap']||null, insurance_exp: r['Insurance Exp']||null, fitness_exp: r['Fitness Exp']||null, permit_exp: r['Permit Exp']||null, puc_exp: r['PUC Exp']||null, status: r['Status']||'Active' }),
        drivers: r => ({ name: r['Name']||r['name'], mobile: r['Mobile']||r['Phone']||'', licence_no: r['Licence No']||r['License No']||'', licence_exp: r['Licence Exp']||null, daily_rate: r['Daily Rate']||0, status: r['Status']||'Active' }),
        trips: r => ({ truck_no: r['Truck']||r['Truck No']||r['truck_no'], from_location: r['From']||'', to_location: r['To']||'', date: r['Date']||null, distance: r['Distance']||null, diesel: r['Diesel']||0, toll: r['Toll']||0, da: r['DA']||0, advance: r['Advance']||0, misc: r['Misc']||0, bill_amt: r['Bill Amt']||r['Amount']||0, status: r['Status']||'Completed' }),
        billing: r => ({ invoice_no: r['Invoice No']||r['InvoiceNo']||'INV-'+Date.now(), truck_no: r['Truck']||r['Truck No']||'', client: r['Client']||r['Party']||'', route: r['Route']||'', amount: r['Amount']||0, date: r['Date']||null, status: r['Status']||'Pending' })
      };
      const dbTable = type === 'drivers' ? 'drivers' : type;
      let added = 0;
      for (const row of rows) {
        const record = maps[type](row);
        const key = type === 'fleet' ? 'truck_no' : type === 'drivers' ? 'name' : type === 'billing' ? 'invoice_no' : null;
        if (key && !record[key]) continue;
        await DB.insert(dbTable, record); added++;
      }
      res.innerHTML = `<span style="color:#27500A">Imported ${added} records successfully.</span>`;
      event.target.value = '';
    } catch (err) { res.innerHTML = `<span style="color:#A32D2D">Error: ${err.message}</span>`; }
  };
  reader.readAsArrayBuffer(file);
}

function downloadTemplate(type) {
  const templates = {
    fleet: [{'Truck No':'GJ-01-T 0001','Make':'Tata','Model':'407','Wheel Type':'10 tyre','Load Cap':'10','Insurance Exp':'2026-12-31','Fitness Exp':'2026-06-30','Permit Exp':'2026-09-30','PUC Exp':'2026-04-30','Status':'Active'}],
    drivers: [{'Name':'Ramesh Patel','Mobile':'9876543210','Licence No':'GJ01 2020012345','Licence Exp':'2027-05-15','Daily Rate':'500','Status':'Active'}],
    trips: [{'Truck':'GJ-01-T 0001','Driver':'Ramesh Patel','Date':'2026-04-10','From':'Ahmedabad','To':'Mumbai','Distance':'530','Diesel':'8000','Toll':'1200','DA':'500','Advance':'2000','Misc':'300','Bill Amt':'25000','Status':'Completed'}],
    billing: [{'Invoice No':'INV-00001','Truck':'GJ-01-T 0001','Client':'ABC Traders','Route':'Ahmedabad to Mumbai','Amount':'25000','Date':'2026-04-10','Status':'Pending'}]
  };
  const ws = XLSX.utils.json_to_sheet(templates[type]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'TMS_' + type + '_template.xlsx');
}

// ─── COMPANY ──────────────────────────────────────────────
async function renderCompany() {
  const el = document.getElementById('pg-company');
  const data = (await DB.getAll('company'))[0] || {};
  el.innerHTML = `<div class="pg-header"><div class="pg-title">Company Details</div></div>
  <div class="card" style="max-width:600px">
    <div class="form-grid-2">
      <div class="form-group"><label>Company name*</label><input id="f-name" value="${data.name||''}"></div>
      <div class="form-group"><label>Phone</label><input id="f-phone" value="${data.phone||''}"></div>
      <div class="form-group"><label>Email</label><input id="f-email" value="${data.email||''}"></div>
      <div class="form-group"><label>GSTIN</label><input id="f-gstin" value="${data.gstin||''}"></div>
      <div class="form-group"><label>PAN</label><input id="f-pan" value="${data.pan||''}"></div>
      <div class="form-group"><label>City</label><input id="f-city" value="${data.city||''}"></div>
      <div class="form-group" style="grid-column:1/-1"><label>Address</label><textarea id="f-address">${data.address||''}</textarea></div>
    </div>
    <button class="btn btn-primary" onclick="saveCompanyDirect('${data.id||''}')">Save company details</button>
  </div>`;
}

function companyForm(d = {}) { return ''; }

async function saveCompanyDirect(id) {
  const record = { name: g('f-name'), phone: g('f-phone'), email: g('f-email'), gstin: g('f-gstin'), pan: g('f-pan'), city: g('f-city'), address: g('f-address') };
  if (!record.name) { showToast('Company name required', 'error'); return; }
  id ? await DB.update('company', id, record) : await DB.insert('company', record);
  showToast('Company details saved!');
}

async function saveCompany(id) { await saveCompanyDirect(id); }
