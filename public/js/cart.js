/* Cart page: lines with qty controls + summary */
(function () {
  const root = document.getElementById('cart-root');

  async function init() {
    try { await App.initChrome(); } catch {}
    await render();
  }

  async function cartItems() {
    const raw = App.getCart();
    if (!raw.length) return [];
    const data = await App.getProducts();
    const bySlug = new Map(data.products.map((p) => [p.slug, p]));
    return raw
      .map((i) => ({ ...i, product: bySlug.get(i.slug) }))
      .filter((i) => i.product);
  }

  async function render() {
    const items = await cartItems();
    if (!items.length) {
      root.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <h3>Your cart is empty</h3>
          <a class="btn btn-dark" href="/shop">Start shopping</a>
        </div>`;
      return;
    }

    const total = items.reduce((s, i) => s + i.product.price * i.qty, 0);

    root.innerHTML = `
      <div>${items.map((i) => line(i)).join('')}</div>
      <aside class="summary-card">
        <h2 style="margin-top:0">Summary</h2>
        <div class="summary-row"><span>Items</span><span id="sum-items">${items.reduce((s, i) => s + i.qty, 0)}</span></div>
        <div class="summary-row total"><span>Total</span><span id="sum-total">${App.formatINR(total)}</span></div>
        <button class="btn btn-accent btn-block" id="checkout-btn">Checkout with UPI</button>
        <p class="summary-note">Payment is handled securely by Razorpay. You can pay via UPI, cards, net-banking or wallets.</p>
      </aside>`;

    // bind qty controls
    items.forEach((i) => {
      const key = `${i.slug}|${i.size}|${i.color}`;
      const minus = document.getElementById('m-' + key);
      const plus = document.getElementById('p-' + key);
      const qtyEl = document.getElementById('q-' + key);
      const remove = document.getElementById('r-' + key);
      const lineTotal = document.getElementById('t-' + key);
      const maxQty = Math.min(20, i.product.stock);
      if (minus) minus.addEventListener('click', () => {
        App.setQty(i.slug, i.size, i.color, i.qty - 1);
        render();
      });
      if (plus) plus.addEventListener('click', () => {
        if (i.qty < maxQty) { App.setQty(i.slug, i.size, i.color, i.qty + 1); render(); }
      });
      if (remove) remove.addEventListener('click', () => {
        App.removeFromCart(i.slug, i.size, i.color);
        render();
      });
    });

    document.getElementById('checkout-btn').addEventListener('click', () => {
      window.location.href = '/checkout';
    });
  }

  function line(i) {
    const p = i.product;
    const img = p.images && p.images[0] ? p.images[0] : '/assets/hero.svg';
    const key = `${i.slug}|${i.size}|${i.color}`;
    const opts = [i.size, i.color].filter(Boolean).join(' / ');
    const maxQty = Math.min(20, p.stock);
    return `
      <div class="cart-line">
        <img src="${App.esc(img)}" alt="${App.esc(p.name)}" onerror="this.src='/assets/hero.svg'" />
        <div class="meta">
          <a class="name" href="/product?slug=${App.esc(p.slug)}">${App.esc(p.name)}</a>
          <div class="note">${App.esc(opts || 'One size')}</div>
          <div class="unit">${App.formatINR(p.price)} each</div>
        </div>
        <div class="actions">
          <div style="display:flex;align-items:center;gap:8px">
            <button class="qty-step" id="m-${key}" ${i.qty <= 1 ? 'disabled' : ''}>&minus;</button>
            <span class="qty-val" id="q-${key}">${i.qty}</span>
            <button class="qty-step" id="p-${key}" ${i.qty >= maxQty ? 'disabled' : ''}>+</button>
          </div>
          <span class="line-total" id="t-${key}">${App.formatINR(p.price * i.qty)}</span>
          <button class="remove-link" id="r-${key}">Remove</button>
        </div>
      </div>`;
  }

  init();
})();