/* Shared storefront helpers: config, cart (localStorage), formatting */
(function () {
  const CART_KEY = 'cloth_cart';
  let config = null;
  let productsCache = null;

  window.App = {};

  App.formatINR = (paise) =>
    '₹' + (paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  App.esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  async function api(path) {
    const res = await fetch(path);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && data.error) || 'Request failed');
    return data;
  }

  App.getConfig = async () => {
    if (config) return config;
    config = await api('/api/config');
    return config;
  };

  App.getProducts = async () => {
    if (productsCache) return productsCache;
    productsCache = await api('/api/products');
    return productsCache;
  };

  App.getProduct = async (slug) => (await api('/api/products?slug=' + encodeURIComponent(slug)));

  App.clearProductsCache = () => { productsCache = null; };

  /* ---------- Cart ---------- */
  App.getCart = () => {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
    catch { return []; }
  };

  App.saveCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    App.updateCartBadge();
  };

  App.cartCount = () => App.getCart().reduce((n, i) => n + i.qty, 0);

  App.addToCart = (slug, size, color, qty) => {
    const cart = App.getCart();
    const existing = cart.find((i) => i.slug === slug && i.size === size && i.color === color);
    if (existing) existing.qty += qty;
    else cart.push({ slug, size, color, qty });
    App.saveCart(cart);
  };

  App.removeFromCart = (slug, size, color) => {
    App.saveCart(App.getCart().filter((i) =>
      !(i.slug === slug && i.size === size && i.color === color)));
  };

  App.setQty = (slug, size, color, qty) => {
    const cart = App.getCart();
    const item = cart.find((i) =>
      i.slug === slug && i.size === size && i.color === color);
    if (!item) return;
    if (qty <= 0) App.removeFromCart(slug, size, color);
    else { item.qty = Math.min(qty, 20); App.saveCart(cart); }
  };

  App.updateCartBadge = () => {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    const n = App.cartCount();
    badge.textContent = n;
    badge.classList.toggle('is-empty', n === 0);
  };

  App.toast = (msgStr) => {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msgStr;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 2600);
  };

  /* Shared header/footer fill-in */
  App.initChrome = async () => {
    App.updateCartBadge();
    let cfg;
    try { cfg = await App.getConfig(); } catch { cfg = {}; }

    document.querySelectorAll('[data-role="brand"]').forEach((el) => {
      el.textContent = cfg.brand || 'Your Brand';
    });

    const announce = document.querySelector('[data-role="announcement"]');
    if (announce) {
      if (cfg.announcement) announce.textContent = cfg.announcement;
      else announce.parentNode && announce.parentNode.removeChild(announce);
    }

    const footerText = document.querySelector('[data-role="footer-text"]');
    if (footerText) footerText.textContent = cfg.footerText || '';
    const support = document.querySelector('[data-role="support-phone"]');
    if (support) {
      if (cfg.supportPhone) { support.textContent = 'Order support: ' + cfg.supportPhone; support.href = 'tel:' + cfg.supportPhone; }
      else support.parentNode && support.parentNode.removeChild(support);
    }
  };

  /* Link shop search */
  App.goShop = (preset) => {
    const url = preset ? '/shop?category=' + encodeURIComponent(preset) : '/shop';
    window.location.href = url;
  };
})();