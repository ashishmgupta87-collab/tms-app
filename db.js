const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── AUTH ────────────────────────────────────────────────────
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

// Local cache for offline support
const cache = {
  get(k) { try { return JSON.parse(localStorage.getItem('tms_' + k) || '[]'); } catch { return []; } },
  set(k, v) { try { localStorage.setItem('tms_' + k, JSON.stringify(v)); } catch {} }
};

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
      // Fallback to local only
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
    try {
      const { error } = await db.from(table).delete().eq('id', id);
      if (error) throw error;
    } catch (e) {
      console.warn('Delete offline:', e.message);
    }
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
