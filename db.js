const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── AUTH ─────────────────────────────────────────────────
const Auth = {
  async getUser() {
    const { data: { user } } = await db.auth.getUser();
    return user;
  },
  async getSession() {
    const { data: { session } } = await db.auth.getSession();
    return session;
  },
  async signOut() {
    await db.auth.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
  },
  async requireAuth() {
    const session = await this.getSession();
    if (!session) { window.location.href = 'login.html'; return null; }
    return session.user;
  }
};

db.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') window.location.href = 'login.html';
});

// ─── ROLES ────────────────────────────────────────────────
const Roles = {
  _cache: null,

  async get() {
    if (this._cache) return this._cache;
    const user = await Auth.getUser();
    if (!user) return 'driver';
    try {
      const { data, error } = await db.from('user_roles').select('role').eq('user_id', user.id).single();
      if (error || !data) { this._cache = 'driver'; return 'driver'; }
      this._cache = data.role;
      return data.role;
    } catch { this._cache = 'driver'; return 'driver'; }
  },

  async isOwner() { return await this.get() === 'owner'; },
  async isAccountant() { const r = await this.get(); return r === 'owner' || r === 'accountant'; },
  async isDriver() { return true; },

  // Apply visibility rules to sidebar and UI elements
  async applyUI() {
    const role = await this.get();

    // Show role badge in sidebar
    const badge = document.getElementById('role-badge');
    if (badge) {
      badge.textContent = role.charAt(0).toUpperCase() + role.slice(1);
      badge.className = 'role-badge rb-' + role;
    }

    // Hide modules based on role
    if (role === 'driver') {
      // Drivers: only trips and salary (their own)
      const hidePages = ['fleet', 'drivers', 'maintenance', 'billing', 'pl', 'import', 'company'];
      hidePages.forEach(p => {
        const items = document.querySelectorAll('.sb-item');
        items.forEach(i => {
          const labels = { fleet: 'Fleet & Trucks', drivers: 'Drivers', maintenance: 'Maintenance', billing: 'Billing & Accounts', pl: 'P&L Report', import: 'Import from Excel', company: 'Company Details' };
          if (i.textContent.trim() === labels[p]) i.style.display = 'none';
        });
      });
      // Hide section headers that are now empty
      document.querySelectorAll('.sb-sec').forEach(sec => {
        const next = sec.nextElementSibling;
        if (next && next.style.display === 'none') sec.style.display = 'none';
      });
    }

    if (role === 'accountant') {
      // Accountants: hide fleet details edit, drivers edit, company settings
      const hidePages = ['import', 'company'];
      hidePages.forEach(p => {
        const labels = { import: 'Import from Excel', company: 'Company Details' };
        document.querySelectorAll('.sb-item').forEach(i => {
          if (i.textContent.trim() === labels[p]) i.style.display = 'none';
        });
      });
    }

    // Store role globally
    window._userRole = role;
  },

  canDelete() { return window._userRole === 'owner'; },
  canEdit() { return window._userRole === 'owner' || window._userRole === 'accountant'; },
  canViewFinance() { return window._userRole === 'owner' || window._userRole === 'accountant'; },
};

// ─── LOCAL CACHE ──────────────────────────────────────────
const cache = {
  get(k) { try { return JSON.parse(localStorage.getItem('tms_' + k) || '[]'); } catch { return []; } },
  set(k, v) { try { localStorage.setItem('tms_' + k, JSON.stringify(v)); } catch {} }
};

// ─── DB OPERATIONS ────────────────────────────────────────
const DB = {
  async getAll(table) {
    try {
      const { data, error } = await db.from(table).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      cache.set(table, data);
      return data || [];
    } catch (e) {
      console.warn('Supabase offline, using cache:', e.message);
      return cache.get(table);
    }
  },

  async insert(table, record) {
    try {
      const { data, error } = await db.from(table).insert([record]).select();
      if (error) throw error;
      const cached = cache.get(table);
      cached.unshift(data[0]);
      cache.set(table, cached);
      return data[0];
    } catch (e) {
      const cached = cache.get(table);
      const local = { ...record, id: 'local_' + Date.now(), created_at: new Date().toISOString() };
      cached.unshift(local);
      cache.set(table, cached);
      showToast('Saved locally (offline mode)', 'warning');
      return local;
    }
  },

  async update(table, id, record) {
    try {
      const { data, error } = await db.from(table).update(record).eq('id', id).select();
      if (error) throw error;
      const cached = cache.get(table);
      const idx = cached.findIndex(r => r.id === id);
      if (idx > -1) cached[idx] = { ...cached[idx], ...record };
      cache.set(table, cached);
      return data[0];
    } catch (e) {
      const cached = cache.get(table);
      const idx = cached.findIndex(r => r.id === id);
      if (idx > -1) cached[idx] = { ...cached[idx], ...record };
      cache.set(table, cached);
      showToast('Updated locally (offline mode)', 'warning');
      return cached[idx];
    }
  },

  async delete(table, id) {
    if (!Roles.canDelete()) { showToast('Only owners can delete records', 'error'); return; }
    try {
      const { error } = await db.from(table).delete().eq('id', id);
      if (error) throw error;
    } catch (e) { console.warn('Delete error:', e.message); }
    const cached = cache.get(table).filter(r => r.id !== id);
    cache.set(table, cached);
  },

  async checkConnection() {
    try {
      const { error } = await db.from('fleet').select('id').limit(1);
      return !error;
    } catch { return false; }
  }
};
