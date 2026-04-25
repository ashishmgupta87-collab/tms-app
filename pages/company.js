async function renderCompany() {
  const el = document.getElementById('pg-company');
  const data = (await DB.getAll('company'))[0] || {};

  el.innerHTML = `
    <div class="pg-header"><div class="pg-title">Company Details</div></div>
    <div style="display:grid;grid-template-columns:1fr 340px;gap:16px;align-items:start">
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Business information</div>
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
      </div>

      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Logo &amp; branding</div>

        <!-- Logo preview -->
        <div id="logo-preview-wrap" style="margin-bottom:14px;text-align:center">
          ${data.logo_url
            ? `<img src="${data.logo_url}" id="logo-preview" style="max-height:80px;max-width:200px;object-fit:contain;border-radius:8px;border:0.5px solid var(--border-color);padding:8px;background:var(--bg-primary)">`
            : `<div id="logo-placeholder" style="height:80px;border:1.5px dashed var(--border-color);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--text-tertiary)">No logo uploaded</div>`
          }
        </div>

        <!-- Upload button -->
        <div class="form-group" style="margin-bottom:12px">
          <label>Upload logo</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="file" id="logo-file-input" accept="image/*" style="display:none" onchange="handleLogoUpload(event,'${data.id||''}')">
            <button class="btn" style="width:100%" onclick="document.getElementById('logo-file-input').click()">
              Choose image (PNG, JPG, SVG)
            </button>
            ${data.logo_url ? `<button class="btn btn-danger btn-sm" onclick="removeLogo('${data.id||''}')">Remove</button>` : ''}
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Max 2MB. Recommended: square image, at least 200×200px</div>
        </div>

        <!-- Brand colour -->
        <div class="form-group" style="margin-bottom:14px">
          <label>Brand colour</label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="color" id="f-brand_color" value="${data.brand_color||'#185FA5'}"
              style="width:40px;height:36px;border:0.5px solid var(--border-color);border-radius:8px;cursor:pointer;padding:2px"
              onchange="previewBrandColor(this.value)">
            <input id="f-brand_color_hex" value="${data.brand_color||'#185FA5'}"
              style="flex:1;padding:7px 10px;border:0.5px solid var(--border-color);border-radius:8px;font-size:12px;background:var(--bg-primary);color:var(--text-primary)"
              oninput="syncColorPicker(this.value)">
            <button class="btn btn-sm" onclick="resetBrandColor()">Reset</button>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">Applied to buttons, active menu and invoice headers</div>
        </div>

        <button class="btn btn-primary" style="width:100%" onclick="saveBranding('${data.id||''}')">Apply branding</button>

        <div style="margin-top:12px;padding:10px;background:var(--bg-secondary);border-radius:8px;font-size:11px;color:var(--text-secondary)">
          Your logo will appear in the sidebar and on all PDF invoices. Brand colour updates the app theme instantly.
        </div>
      </div>
    </div>`;

  // Apply saved brand color on load
  if (data.brand_color) applyBrandColor(data.brand_color);
}

async function handleLogoUpload(event, companyId) {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Image must be under 2MB', 'error'); return; }

  showToast('Uploading logo...');

  // Convert to base64 and store in company table
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result; // data:image/png;base64,...

    // Update preview immediately
    const wrap = document.getElementById('logo-preview-wrap');
    wrap.innerHTML = `<img src="${base64}" id="logo-preview" style="max-height:80px;max-width:200px;object-fit:contain;border-radius:8px;border:0.5px solid var(--border-color);padding:8px;background:var(--bg-primary)">`;

    // Save to database
    const companies = await DB.getAll('company');
    if (companies.length > 0) {
      await DB.update('company', companies[0].id, { logo_url: base64 });
    } else {
      await DB.insert('company', { logo_url: base64 });
    }

    showToast('Logo saved!');
    updateSidebarBranding();
  };
  reader.readAsDataURL(file);
}

async function removeLogo(companyId) {
  if (!confirm('Remove logo?')) return;
  const companies = await DB.getAll('company');
  if (companies.length > 0) {
    await DB.update('company', companies[0].id, { logo_url: null });
  }
  showToast('Logo removed');
  renderCompany();
  updateSidebarBranding();
}

function previewBrandColor(val) {
  document.getElementById('f-brand_color_hex').value = val;
  applyBrandColor(val);
}

function syncColorPicker(val) {
  if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
    document.getElementById('f-brand_color').value = val;
    applyBrandColor(val);
  }
}

function resetBrandColor() {
  const defaultColor = '#185FA5';
  document.getElementById('f-brand_color').value = defaultColor;
  document.getElementById('f-brand_color_hex').value = defaultColor;
  applyBrandColor(defaultColor);
}

function applyBrandColor(color) {
  // Convert hex to RGB for rgba usage
  const r = parseInt(color.slice(1,3),16);
  const g = parseInt(color.slice(3,5),16);
  const b = parseInt(color.slice(5,7),16);
  // Darken for hover
  const darken = c => Math.max(0, c - 30);

  const root = document.documentElement;
  root.style.setProperty('--brand', color);
  root.style.setProperty('--brand-dark', `rgb(${darken(r)},${darken(g)},${darken(b)})`);
  root.style.setProperty('--brand-light', `rgba(${r},${g},${b},0.1)`);
  root.style.setProperty('--brand-border', `rgba(${r},${g},${b},0.3)`);
}

async function saveBranding(companyId) {
  const color = document.getElementById('f-brand_color')?.value || '#185FA5';
  const companies = await DB.getAll('company');
  if (companies.length > 0) {
    await DB.update('company', companies[0].id, { brand_color: color });
  } else {
    await DB.insert('company', { brand_color: color });
  }
  showToast('Branding saved and applied!');
  updateSidebarBranding();
}

async function updateSidebarBranding() {
  const data = (await DB.getAll('company'))[0] || {};

  // Update sidebar company name
  const titleEl = document.querySelector('.sb-logo-title');
  const subEl = document.querySelector('.sb-logo-sub');
  if (titleEl && data.name) titleEl.textContent = data.name;
  if (subEl && data.city) subEl.textContent = data.city;

  // Update logo in sidebar
  let logoEl = document.getElementById('sb-logo-img');
  if (data.logo_url) {
    if (!logoEl) {
      logoEl = document.createElement('img');
      logoEl.id = 'sb-logo-img';
      logoEl.style.cssText = 'width:36px;height:36px;object-fit:contain;border-radius:6px;margin-bottom:6px;display:block';
      const logoWrap = document.querySelector('.sb-logo');
      logoWrap.insertBefore(logoEl, logoWrap.firstChild);
    }
    logoEl.src = data.logo_url;
  } else if (logoEl) {
    logoEl.remove();
  }

  // Update browser tab title
  if (data.name) document.title = data.name + ' — TMS';

  // Apply brand color
  if (data.brand_color) applyBrandColor(data.brand_color);
}

function companyForm(d = {}) { return ''; }

async function saveCompanyDirect(id) {
  const record = {
    name: g('f-name'), phone: g('f-phone'), email: g('f-email'),
    gstin: g('f-gstin'), pan: g('f-pan'), city: g('f-city'), address: g('f-address')
  };
  if (!record.name) { showToast('Company name required', 'error'); return; }
  const companies = await DB.getAll('company');
  if (companies.length > 0) {
    await DB.update('company', companies[0].id, record);
  } else {
    await DB.insert('company', record);
  }
  showToast('Company details saved!');
  updateSidebarBranding();
}

async function saveCompany(id) { await saveCompanyDirect(id); }
