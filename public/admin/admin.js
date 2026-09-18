/* Admin panel logic: login, dashboard, product/order/settings management */
(function () {
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');
  const viewRoot = document.getElementById('view-root');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalPanel = document.getElementById('modal-panel');

  let products = [];
  let orders = [];
  let settings = {};
  let currentView = 'dashboard';

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtINR(p) { return '₹' + (Number(p) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  function toast(msg) {
    let el = document.querySelector('.toast-a');
    if (!el) { el = document.createElement('div'); el.className = 'toast-a'; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2400);
  }
  async function api(path, opts) {
    const res = await fetch(path, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || 'Request failed');
    return data;
  }

  /* ---------- bootstrap ---------- */
  async function boot() {
    try {
      await api('/api/me');
      enterApp();
    } catch {
      showLogin();
    }
  }

  function showLogin() {
    loginView.style.display = 'grid';
    appView.style.display = 'none';
    document.getElementById('login-pass').focus();
  }

  function enterApp() {
    loginView.style.display = 'none';
    appView.style.display = 'grid';
    nav();
  }

  /* ---------- login ---------- */
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('login-pass').value;
    try {
      await api('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      enterApp();
    } catch (err) {
      toast(err.message || 'Login failed');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    showLogin();
  });

  /* ---------- navigation ---------- */
  function nav() {
    const hash = (location.hash || '#dashboard').slice(1);
    currentView = hash;
    document.querySelectorAll('.nav-item[data-nav]').forEach((el) =>
      el.classList.toggle('active', el.dataset.nav === currentView));
    render(currentView);
  }
  document.querySelectorAll('.nav-item[data-nav]').forEach((el) =>
    el.addEventListener('click', nav));
  window.addEventListener('hashchange', nav);

  /* ---------- renderers ---------- */
  async function render(view) {
    viewRoot.innerHTML = '<div class="empty-hint">Loading…</div>';
    try { await loadData(view); } catch (e) { viewRoot.innerHTML = `<div class="empty-hint">${esc(e.message)}</div>`; return; }
    if (view === 'dashboard') renderDashboard();
    else if (view === 'products') renderProducts();
    else if (view === 'orders') renderOrders();
    else if (view === 'settings') renderSettings();
  }

  async function loadData(view) {
    if (view === 'dashboard' || view === 'products') {
      const d = await api('/api/admin/products');
      products = d.products;
    }
    if (view === 'dashboard' || view === 'orders') {
      const d = await api('/api/admin/orders');
      orders = d.orders;
    }
    if (view === 'settings') {
      const d = await api('/api/admin/settings');
      settings = d.settings;
    }
    if (view === 'dashboard') {
      try { settings = (await api('/api/admin/settings')).settings; } catch {}
    }
  }

  function renderDashboard() {
    const revenue = orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.amount, 0);
    const paid = orders.filter((o) => o.status === 'paid').length;
    const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5);
    viewRoot.innerHTML = `
      <div class="page-head"><div><h1>Dashboard</h1><p class="hint">A quick look at your store's health.</p></div></div>
      <div class="stats">
        <div class="stat-card"><div class="label">Total revenue (paid)</div><div class="value">${fmtINR(revenue)}</div></div>
        <div class="stat-card"><div class="label">Orders</div><div class="value">${orders.length}</div></div>
        <div class="stat-card"><div class="label">Products</div><div class="value">${products.length}</div></div>
        <div class="stat-card"><div class="label">Low stock (&le;5)</div><div class="value">${lowStock.length}</div></div>
      </div>
      <div class="panel">
        <h3 class="panel-title">Recent orders</h3>
        ${orderTable(orders.slice(0, 6), true)}
      </div>
      <div class="panel">
        <h3 class="panel-title">Low stock products</h3>
        ${lowStock.length ? productTable(lowStock) : '<div class="empty-hint">All products are well stocked.</div>'}
      </div>`;
  }

  function renderProducts() {
    viewRoot.innerHTML = `
      <div class="page-head"><div><h1>Products</h1><p class="hint">${products.length} products · changes appear on the store instantly.</p></div>
        <button class="btn-a" id="add-product-btn">+ New product</button></div>
      <div class="panel">${productTable(products)}</div>`;
    document.getElementById('add-product-btn').addEventListener('click', () => openProductModal(null));
    document.querySelectorAll('[data-edit]').forEach((el) =>
      el.addEventListener('click', () => openProductModal(Number(el.dataset.edit))));
    document.querySelectorAll('[data-del]').forEach((el) =>
      el.addEventListener('click', () => deleteProduct(Number(el.dataset.del))));
  }

  function productTable(list) {
    return list.length ? `
      <table class="tbl">
        <thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map((p) => `
          <tr>
            <td class="thumb"><img src="${esc(p.images && p.images[0] || '/assets/hero.svg')}" onerror="this.src='/assets/hero.svg'" /></td>
            <td><strong>${esc(p.name)}</strong></td>
            <td>${esc(p.category)}</td>
            <td>${fmtINR(p.price)}</td>
            <td>${p.stock}${p.stock <= 5 ? ' <span class="tag red">low</span>' : ''}</td>
            <td>${p.active ? '<span class="tag green">live</span>' : '<span class="tag grey">hidden</span>'}</td>
            <td><div class="link-row"><button class="link-btn" data-edit="${p.id}">Edit</button><button class="link-btn danger" data-del="${p.id}">Delete</button></div></td>
          </tr>`).join('')}</tbody>
      </table>` : '<div class="empty-hint">No products yet. Add your first one.</div>';
  }

  function renderOrders() {
    viewRoot.innerHTML = `
      <div class="page-head"><div><h1>Orders</h1><p class="hint">${orders.length} total orders · ${fmtINR(orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.amount, 0))} received.</p></div></div>
      <div class="panel">${orderTable(orders)}</div>`;
    document.querySelectorAll('[data-status]').forEach((el) =>
      el.addEventListener('change', async (e) => {
        const id = e.target.dataset.status;
        try {
          await api('/api/admin/orders/' + id, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status: e.target.value }),
          });
          toast('Order updated');
          render('orders');
        } catch (err) { toast(err.message); }
      }));
    document.querySelectorAll('[data-detail]').forEach((el) =>
      el.addEventListener('click', () => openOrderModal(Number(el.dataset.detail))));
  }

  function orderTable(list, compact) {
    if (!list.length) return '<div class="empty-hint">No orders yet.</div>';
    const statusEl = (o) => compact
      ? `<span class="tag ${o.status === 'paid' ? 'green' : 'grey'}">${esc(o.status)}</span>`
      : `<select class="field-a" style="width:auto;display:inline-block" data-status="${o.id}">
           ${['created', 'paid', 'shipped', 'delivered', 'cancelled'].map((s) =>
             `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
         </select>`;
    return `
      <table class="tbl">
        <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
        <tbody>${list.map((o) => {
          const c = o.customer || {};
          const names = (o.items || []).slice(0, 2).map((i) => i.name).join(', ');
          const more = o.items.length > 2 ? ` +${o.items.length - 2} more` : '';
          return `<tr>
            <td><button class="link-btn" data-detail="${o.id}">${esc(o.orderId)}</button></td>
            <td>${esc(c.name || '—')}<br/><span class="hint">${esc(c.phone || '')}</span></td>
            <td class="hint">${esc(names)}${more}</td>
            <td><strong>${fmtINR(o.amount)}</strong></td>
            <td>${statusEl(o)}</td>
            <td class="hint">${esc((o.createdAt || '').slice(0, 16).replace('T', ' '))}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  function renderSettings() {
    const f = (k) => settings[k] !== undefined ? settings[k] : '';
    viewRoot.innerHTML = `
      <div class="page-head"><div><h1>Settings</h1><p class="hint">Store-wide text used across the storefront.</p></div></div>
      <div class="panel">
        <h3 style="margin:0 0 12px">Storefront</h3>
        <div class="form-grid-2">
          <div class="field-a"><label>Brand name</label><input id="set-brand" value="${esc(f('brand'))}" /></div>
          <div class="field-a"><label>Announcement bar</label><input id="set-announcement" value="${esc(f('announcement'))}" placeholder="Free shipping on orders over Rs 1999" /></div>
          <div class="field-a"><label>Hero title</label><input id="set-heroTitle" value="${esc(f('heroTitle'))}" /></div>
          <div class="field-a"><label>Hero subtitle</label><input id="set-heroSub" value="${esc(f('heroSub'))}" /></div>
          <div class="field-a"><label>Hero image URL</label><input id="set-heroImage" value="${esc(f('heroImage'))}" placeholder="/assets/hero.svg" /></div>
          <div class="field-a"><label>Support phone</label><input id="set-supportPhone" value="${esc(f('supportPhone'))}" placeholder="+91 98765 43210" /></div>
          <div class="field-a"><label>Footer text</label><input id="set-footerText" value="${esc(f('footerText'))}" /></div>
        </div>
        <h3 style="margin:24px 0 12px">Cloudinary (for image uploads in admin)</h3>
        <div class="form-grid-2">
          <div class="field-a"><label>Cloud Name</label><input id="set-cloudinaryCloudName" value="${esc(f('cloudinaryCloudName'))}" placeholder="your_cloud_name" /></div>
          <div class="field-a"><label>Upload Preset (unsigned)</label><input id="set-cloudinaryUploadPreset" value="${esc(f('cloudinaryUploadPreset'))}" placeholder="your_unsigned_preset" /></div>
        </div>
        <button class="btn-a" id="save-settings">Save settings</button>
      </div>`;
    document.getElementById('save-settings').addEventListener('click', async () => {
      const payload = {
        brand: document.getElementById('set-brand').value,
        announcement: document.getElementById('set-announcement').value,
        heroTitle: document.getElementById('set-heroTitle').value,
        heroSub: document.getElementById('set-heroSub').value,
        heroImage: document.getElementById('set-heroImage').value,
        supportPhone: document.getElementById('set-supportPhone').value,
        footerText: document.getElementById('set-footerText').value,
        cloudinaryCloudName: document.getElementById('set-cloudinaryCloudName').value,
        cloudinaryUploadPreset: document.getElementById('set-cloudinaryUploadPreset').value,
      };
      try {
        await api('/api/admin/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
        settings = payload;
        toast('Settings saved');
      } catch (err) { toast(err.message); }
    });
  }

  /* ---------- product modal ---------- */
  function openProductModal(id) {
    const p = products.find((x) => x.id === id);
    const title = p ? 'Edit product' : 'New product';
    const sizes = (p && p.sizes || []).join(', ');
    const colors = (p && p.colors || []).join(', ');
    const images = (p && p.images || []).join('\n');
    modalPanel.innerHTML = `
      <h2>${title}</h2>
      <div class="form-grid-2">
        <div class="field-a"><label>Name *</label><input id="p-name" value="${esc(p && p.name || '')}" placeholder="Classic Cotton Tee" /></div>
        <div class="field-a"><label>Category</label><input id="p-category" value="${esc(p && p.category || 'Tees')}" placeholder="Tees" list="cat-list" />
          <datalist id="cat-list"><option value="Tees"><option value="Hoodies"><option value="Shirts"><option value="Jackets"><option value="Bottoms"><option value="Accessories"></datalist></div>
        <div class="field-a"><label>Price (INR) *</label><input id="p-price" type="number" min="0" value="${p ? (p.price / 100) : ''}" placeholder="799" /></div>
        <div class="field-a"><label>Stock</label><input id="p-stock" type="number" min="0" value="${p ? p.stock : 0}" /></div>
        <div class="field-a"><label>Sizes (comma separated)</label><input id="p-sizes" value="${esc(sizes)}" placeholder="S, M, L, XL, XXL" /></div>
        <div class="field-a"><label>Colors (comma separated)</label><input id="p-colors" value="${esc(colors)}" placeholder="White, Black, Navy" /></div>
      </div>
      <div class="field-a"><label>Description</label><textarea id="p-desc" rows="3">${esc(p && p.description || '')}</textarea></div>
      <div class="field-a"><label>Image URLs (one per line)</label>
        <textarea id="p-images" rows="3" placeholder="/assets/p/classic-cotton-tee.svg">${esc(images)}</textarea>
      </div>
      <div class="field-a">
        <label>Upload image (goes to Cloudinary)</label>
        <button type="button" class="btn-a" id="cloudinary-upload-btn" style="width:auto">Open Cloudinary Upload</button>
        <div class="hint" style="margin-top:6px">Configure Cloud Name & Upload Preset in Settings → Cloudinary section</div>
        <div class="field-a" style="margin-top:8px"><label>Cloud Name</label><input id="cloudinary-cloud-name" type="text" value="${esc(settings.cloudinaryCloudName || '')}" placeholder="your_cloud_name" /></div>
        <div class="field-a"><label>Upload Preset (unsigned)</label><input id="cloudinary-upload-preset" type="text" value="${esc(settings.cloudinaryUploadPreset || '')}" placeholder="your_unsigned_preset" /></div>
        <div class="upload-preview" id="upload-preview"></div>
      </div>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" id="p-featured" ${p && p.featured ? 'checked' : ''} /> Featured on home page</label>
      <label style="display:flex;gap:8px;align-items:center;margin:6px 0 14px"><input type="checkbox" id="p-active" ${!p || p.active ? 'checked' : ''} /> Visible in store</label>
      <div class="modal-actions">
        <button class="btn-ghost" id="modal-cancel">Cancel</button>
        <button class="btn-a" id="modal-save">${p ? 'Save changes' : 'Create product'}</button>
      </div>`;

    modalBackdrop.classList.add('show');
    setupUpload();

    document.getElementById('modal-cancel').addEventListener('click', closeModal);

    document.getElementById('modal-save').addEventListener('click', async () => {
      const payload = {
        name: document.getElementById('p-name').value.trim(),
        category: document.getElementById('p-category').value.trim() || 'Tees',
        price: document.getElementById('p-price').value,
        stock: document.getElementById('p-stock').value,
        sizes: document.getElementById('p-sizes').value.split(',').map((s) => s.trim()).filter(Boolean),
        colors: document.getElementById('p-colors').value.split(',').map((s) => s.trim()).filter(Boolean),
        description: document.getElementById('p-desc').value.trim(),
        images: document.getElementById('p-images').value.split('\n').map((s) => s.trim()).filter(Boolean),
        featured: document.getElementById('p-featured').checked,
        active: document.getElementById('p-active').checked,
      };
      if (!payload.name || !payload.price) { toast('Name and price are required'); return; }
      try {
        await api('/api/admin/products' + (id ? '/' + id : ''), {
          method: id ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast(id ? 'Product updated' : 'Product created');
        closeModal();
        render('products');
      } catch (err) { toast(err.message); }
    });
  }

  function setupUpload() {
    const btn = document.getElementById('cloudinary-upload-btn');
    const preview = document.getElementById('upload-preview');
    const cloudNameInput = document.getElementById('cloudinary-cloud-name');
    const presetInput = document.getElementById('cloudinary-upload-preset');

    let widget = null;

    function initWidget() {
      if (!window.cloudinary) return;
      const cloudName = cloudNameInput.value.trim();
      const preset = presetInput.value.trim();
      if (!cloudName || !preset) return;
      widget = cloudinary.createUploadWidget(
        { cloudName, uploadPreset: preset, sources: ['local', 'url', 'camera'], maxFiles: 10 },
        (error, result) => {
          if (!error && result.event === 'success') {
            const url = result.info.secure_url;
            const ta = document.getElementById('p-images');
            ta.value = ta.value.trim() ? ta.value.trim() + '\n' + url : url;
            preview.innerHTML += `<img src="${esc(url)}" onerror="this.remove()" style="max-width:120px;margin:4px" />`;
            toast('Image uploaded to Cloudinary');
          } else if (error) {
            toast(error.message || 'Upload failed');
          }
        }
      );
    }

    cloudNameInput.addEventListener('input', initWidget);
    presetInput.addEventListener('input', initWidget);
    initWidget();

    btn.addEventListener('click', () => {
      if (!widget) {
        initWidget();
        if (!widget) { toast('Set Cloud Name and Upload Preset first'); return; }
      }
      widget.open();
    });
  }

  function closeModal() { modalBackdrop.classList.remove('show'); }
  modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

  function deleteProduct(id) {
    const p = products.find((x) => x.id === id);
    if (!window.confirm(`Delete "${p ? p.name : 'product'}" permanently?`)) return;
    api('/api/admin/products/' + id, { method: 'DELETE' })
      .then(() => { toast('Product deleted'); render('products'); })
      .catch((err) => toast(err.message));
  }

  function openOrderModal(id) {
    const o = orders.find((x) => x.id === id);
    if (!o) return;
    const c = o.customer || {};
    const rows = (o.items || []).map((i) => `
      <div class="mini-line" style="padding:8px 0;border-bottom:1px dashed #2a2f38">
        <span style="color:var(--amut)">${esc(i.name)} · ${esc(i.size)} ${esc(i.color)} × ${i.qty}</span>
        <span>${fmtINR(i.price * i.qty)}</span>
      </div>`).join('');
    modalPanel.innerHTML = `
      <h2>Order ${esc(o.orderId)}</h2>
      <div class="hint" style="margin:-8px 0 14px">Created ${esc((o.createdAt || '').replace('T', ' '))}</div>
      <p style="margin:0 0 6px"><strong>${esc(c.name || '—')}</strong> · ${esc(c.phone || '')}</p>
      <p style="margin:0 0 14px;color:var(--amut)">${esc([c.address, c.city, c.state, c.pin].filter(Boolean).join(', '))}${c.email ? '<br/>' + esc(c.email) : ''}</p>
      ${rows}
      <div style="display:flex;justify-content:space-between;font-weight:700;padding-top:12px">
        <span>Total</span><span>${fmtINR(o.amount)}</span>
      </div>
      <p class="hint" style="margin-top:14px">Payment id: ${esc(o.razorpayPaymentId || '—')} &nbsp;·&nbsp; Status: <strong>${esc(o.status)}</strong></p>
      <div class="modal-actions"><button class="btn-ghost" onclick="document.getElementById('modal-backdrop').classList.remove('show')">Close</button></div>`;
    modalBackdrop.classList.add('show');
  }

  boot();
})();