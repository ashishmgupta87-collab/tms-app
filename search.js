const GlobalSearch = {
  _open: false,
  _results: [],
  _filter: 'all',
  _focused: -1,

  init() {
    // Wire up keyboard shortcuts only — HTML is already in index.html
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); this.open(); }
      if (e.key === 'Escape' && this._open) this.close();
      if (e.key === 'ArrowDown' && this._open) { e.preventDefault(); this.navigate(1); }
      if (e.key === 'ArrowUp' && this._open) { e.preventDefault(); this.navigate(-1); }
      if (e.key === 'Enter' && this._open) this.selectFocused();
    });
  },

  setFilter(f, el) {
    this._filter = f;
    this._focused = -1;
    document.querySelectorAll('.gs-filter').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    const val = document.getElementById('gs-input')?.value || '';
    if (val.length >= 1) this.search(val);
    else this.renderEmpty();
  },

  open() {
    this._open = true;
    this._focused = -1;
    document.getElementById('gs-overlay').classList.add('open');
    document.getElementById('gs-panel').classList.add('open');
    setTimeout(() => document.getElementById('gs-input')?.focus(), 50);
    this.renderEmpty();
  },

  close() {
    this._open = false;
    this._focused = -1;
    document.getElementById('gs-overlay').classList.remove('open');
    document.getElementById('gs-panel').classList.remove('open');
    const inp = document.getElementById('gs-input');
    if (inp) inp.value = '';
    document.getElementById('gs-results').innerHTML = '';
  },

  renderEmpty() {
    document.getElementById('gs-results').innerHTML = '';
    document.getElementById('gs-footer').textContent = 'Type to search across all modules';
  },

  async search(query) {
    query = (query || '').trim().toLowerCase();
    if (query.length < 1) { this.renderEmpty(); return; }

    const [fleet, drivers, trips, billing] = await Promise.all([
      DB.getAll('fleet'), DB.getAll('drivers'), DB.getAll('trips'), DB.getAll('billing')
    ]);

    const results = [];

    if (this._filter === 'all' || this._filter === 'fleet') {
      fleet.filter(t =>
        (t.truck_no||'').toLowerCase().includes(query) ||
        (t.make||'').toLowerCase().includes(query) ||
        (t.model||'').toLowerCase().includes(query)
      ).forEach(t => results.push({
        type: 'fleet', icon: 'Tr',
        title: t.truck_no,
        sub: `${t.make} ${t.model||''} · ${t.wheel_type||''} · ${t.status||'Active'}`,
        tag: t.status || 'Active',
        tagClass: t.status === 'Active' ? 'gs-tag-green' : 'gs-tag-gray',
        action: () => { nav('fleet'); this.close(); }
      }));
    }

    if (this._filter === 'all' || this._filter === 'drivers') {
      drivers.filter(d =>
        (d.name||'').toLowerCase().includes(query) ||
        (d.mobile||'').toLowerCase().includes(query) ||
        (d.licence_no||'').toLowerCase().includes(query)
      ).forEach(d => results.push({
        type: 'drivers', icon: 'Dr',
        title: d.name,
        sub: `${d.mobile||'-'} · Licence: ${d.licence_no||'-'}`,
        tag: d.status || 'Active',
        tagClass: d.status === 'Active' ? 'gs-tag-green' : 'gs-tag-gray',
        action: () => { nav('drivers'); this.close(); }
      }));
    }

    if (this._filter === 'all' || this._filter === 'trips') {
      trips.filter(t =>
        (t.truck_no||'').toLowerCase().includes(query) ||
        (t.from_location||'').toLowerCase().includes(query) ||
        (t.to_location||'').toLowerCase().includes(query)
      ).forEach(t => results.push({
        type: 'trips', icon: 'Tp',
        title: `${t.truck_no} · ${t.from_location||'-'} → ${t.to_location||'-'}`,
        sub: `${fmtDate(t.date)} · Bill: ${rupee(t.bill_amt)}`,
        tag: t.status || 'On Route',
        tagClass: t.status === 'Completed' ? 'gs-tag-green' : t.status === 'Delayed' ? 'gs-tag-red' : 'gs-tag-blue',
        action: () => { nav('trips'); this.close(); }
      }));
    }

    if (this._filter === 'all' || this._filter === 'billing') {
      billing.filter(i =>
        (i.invoice_no||'').toLowerCase().includes(query) ||
        (i.client||'').toLowerCase().includes(query) ||
        (i.truck_no||'').toLowerCase().includes(query) ||
        (i.route||'').toLowerCase().includes(query)
      ).forEach(i => results.push({
        type: 'billing', icon: 'In',
        title: `${i.invoice_no} · ${i.client||'-'}`,
        sub: `${i.route||'-'} · ${rupee(i.amount)} · ${fmtDate(i.date)}`,
        tag: i.status || 'Pending',
        tagClass: i.status === 'Paid' ? 'gs-tag-green' : i.status === 'Overdue' ? 'gs-tag-red' : 'gs-tag-amber',
        action: () => { nav('billing'); this.close(); }
      }));
    }

    this._results = results;
    this._focused = results.length > 0 ? 0 : -1;
    this.render(query, results);
  },

  render(query, results) {
    const el = document.getElementById('gs-results');
    const footer = document.getElementById('gs-footer');
    if (!results.length) {
      el.innerHTML = `<div class="gs-empty">No results for "<strong>${query}</strong>"</div>`;
      footer.textContent = '0 results';
      return;
    }
    const typeLabels = { fleet: 'Trucks', drivers: 'Drivers', trips: 'Trips', billing: 'Invoices' };
    let html = '', lastType = null;
    results.slice(0, 12).forEach((r, i) => {
      if (r.type !== lastType) { html += `<div class="gs-group-label">${typeLabels[r.type]}</div>`; lastType = r.type; }
      const focused = i === this._focused ? 'focused' : '';
      const esc = s => String(s).replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const hl = s => esc(s).replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi'), m => `<mark>${m}</mark>`);
      html += `<div class="gs-item ${focused}" onclick="GlobalSearch.select(${i})" onmouseover="GlobalSearch._hover(${i})">
        <div class="gs-item-icon gs-icon-${r.type}">${r.icon}</div>
        <div class="gs-item-body">
          <div class="gs-item-title">${hl(r.title)}</div>
          <div class="gs-item-sub">${esc(r.sub)}</div>
        </div>
        <span class="gs-tag ${r.tagClass}">${r.tag}</span>
      </div>`;
    });
    el.innerHTML = html;
    footer.textContent = `${results.length} result${results.length !== 1 ? 's' : ''} — press Enter to open`;
    this._updateFocus();
  },

  _hover(i) { this._focused = i; this._updateFocus(); },

  _updateFocus() {
    document.querySelectorAll('.gs-item').forEach((el, idx) => el.classList.toggle('focused', idx === this._focused));
  },

  navigate(dir) {
    const max = Math.min(this._results.length, 12) - 1;
    this._focused = Math.max(0, Math.min(max, this._focused + dir));
    this._updateFocus();
    // Scroll focused item into view
    const items = document.querySelectorAll('.gs-item');
    if (items[this._focused]) items[this._focused].scrollIntoView({ block: 'nearest' });
  },

  select(i) { if (this._results[i]) this._results[i].action(); },
  selectFocused() { if (this._focused >= 0) this.select(this._focused); }
};
