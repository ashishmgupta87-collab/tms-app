async function renderTeam() {
  const el = document.getElementById('pg-team');
  if (!el) return;

  el.innerHTML = '<div class="pg-header"><div class="pg-title">Team &amp; Roles</div></div><div class="card"><div class="empty-state">Loading...</div></div>';

  // Fetch role directly — don't rely on window._userRole timing
  const role = await Roles.get();
  window._userRole = role; // ensure it's set

  if (role !== 'owner') {
    el.innerHTML = `<div class="pg-header"><div class="pg-title">Team &amp; Roles</div></div><div class="card"><div class="empty-state">Only owners can manage team roles.</div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="pg-header">
      <div class="pg-title">Team &amp; Roles</div>
      <button class="btn btn-primary" onclick="openInviteModal()">+ Invite member</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:20px">
      <div class="role-info-card">
        <div class="ric-title">Owner</div>
        <div class="ric-desc">Full access to everything — all modules, delete records, P&L, company settings, and team management.</div>
        <span class="badge b-purple">Full access</span>
      </div>
      <div class="role-info-card">
        <div class="ric-title">Accountant</div>
        <div class="ric-desc">Can manage billing, salary, trips, maintenance and reports. Cannot delete records or change company settings.</div>
        <span class="badge b-blue">Finance access</span>
      </div>
      <div class="role-info-card">
        <div class="ric-title">Driver</div>
        <div class="ric-desc">Can only view their own trips and salary records. No access to fleet, billing, P&L or other modules.</div>
        <span class="badge b-gray">Limited access</span>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Team members</div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Name / Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody id="team-body"><tr><td colspan="4" class="empty-state">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>
    <div class="card" style="background:var(--amber-light);border-color:#FAC775">
      <div style="font-size:12px;color:var(--amber-dark)">
        <strong>How to add a team member:</strong> Click "+ Invite member", enter their email and select their role.
        They will receive a login invitation email from Supabase. Once they log in, their role is automatically applied.
        To change a role, use the dropdown in the table below.
      </div>
    </div>`;

  await loadTeamMembers();
}

async function loadTeamMembers() {
  const { data, error } = await db.from('user_roles').select('*').order('created_at');
  const tbody = document.getElementById('team-body');
  if (!tbody) return;
  if (error || !data || !data.length) {
    tbody.innerHTML = emptyState('No team members yet.');
    return;
  }
  tbody.innerHTML = data.map(m => `
    <tr>
      <td>
        <div style="font-weight:500">${m.name || m.email}</div>
        <div style="font-size:11px;color:var(--text-secondary)">${m.email}</div>
      </td>
      <td>
        <select class="role-select" onchange="updateRole('${m.user_id}', this.value)" style="padding:4px 8px;border:0.5px solid var(--border-color);border-radius:6px;font-size:12px;background:var(--bg-primary);color:var(--text-primary)">
          <option value="owner" ${m.role==='owner'?'selected':''}>Owner</option>
          <option value="accountant" ${m.role==='accountant'?'selected':''}>Accountant</option>
          <option value="driver" ${m.role==='driver'?'selected':''}>Driver</option>
        </select>
      </td>
      <td>${fmtDate(m.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="removeMember('${m.user_id}','${m.email}')">Remove</button>
      </td>
    </tr>`).join('');
}

async function updateRole(userId, newRole) {
  try {
    const { error } = await db.from('user_roles').update({ role: newRole }).eq('user_id', userId);
    if (error) throw error;
    showToast('Role updated successfully!');
  } catch (e) {
    showToast('Error updating role: ' + e.message, 'error');
  }
}

async function removeMember(userId, email) {
  if (!confirm(`Remove ${email} from the team? They will lose all access.`)) return;
  try {
    const { error } = await db.from('user_roles').delete().eq('user_id', userId);
    if (error) throw error;
    showToast('Member removed.');
    await loadTeamMembers();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function openInviteModal() {
  const modal = document.getElementById('modal-overlay');
  document.getElementById('modal-title').textContent = 'Invite team member';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-grid-2">
      <div class="form-group"><label>Full name</label><input id="f-inv-name" placeholder="e.g. Ramesh Patel"></div>
      <div class="form-group"><label>Email address*</label><input id="f-inv-email" type="email" placeholder="staff@yourcompany.com"></div>
      <div class="form-group"><label>Role*</label>
        <select id="f-inv-role">
          <option value="accountant">Accountant — billing, salary, trips</option>
          <option value="driver">Driver — view own trips and salary only</option>
          <option value="owner">Owner — full access</option>
        </select>
      </div>
    </div>
    <div style="background:var(--bg-secondary);border-radius:8px;padding:12px;font-size:12px;color:var(--text-secondary);margin-top:4px">
      An invitation email will be sent to the address above. The new member sets their own password when they first log in.
    </div>`;
  document.getElementById('modal-save-btn').textContent = 'Send invitation';
  document.getElementById('modal-save-btn').onclick = sendInvite;
  modal.classList.add('open');
}

async function sendInvite() {
  const email = g('f-inv-email');
  const name = g('f-inv-name');
  const role = g('f-inv-role');
  if (!email) { showToast('Email is required', 'error'); return; }

  const btn = document.getElementById('modal-save-btn');
  btn.textContent = 'Sending...'; btn.disabled = true;

  try {
    // Invite user via Supabase Auth Admin API (uses service role — done via Supabase dashboard)
    // Here we pre-register the role so it's ready when they sign up
    const { data: existing } = await db.from('user_roles').select('id').eq('email', email).single();
    if (existing) { showToast('This email already has access', 'error'); btn.textContent = 'Send invitation'; btn.disabled = false; return; }

    // Store pending role by email — will be linked when user signs up
    const { error } = await db.from('user_roles').insert([{
      user_id: '00000000-0000-0000-0000-' + Date.now().toString().padStart(12, '0'),
      email: email,
      role: role,
      name: name || email
    }]);
    if (error) throw error;

    closeModal();
    showToast(`Invitation role saved for ${email}. Now go to Supabase → Authentication → Users → Invite User and enter their email.`);
    await loadTeamMembers();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  } finally {
    btn.textContent = 'Send invitation'; btn.disabled = false;
  }
}
