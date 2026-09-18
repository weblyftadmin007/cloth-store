/* Product detail page: size/color/qty selectors + add to cart */
(async function () {
  try { await App.initChrome(); } catch {}

  const slug = new URLSearchParams(location.search).get('slug');
  const root = document.getElementById('product-root');
  const crumb = document.getElementById('crumb-name');

  if (!slug) {
    root.innerHTML = '<div class="empty-state"><h3>No product specified</h3><a class="btn btn-dark" href="/shop">Browse shop</a></div>';
    return;
  }

  let product;
  try { product = await App.getProduct(slug); } catch {}

  if (!product) {
    root.innerHTML = '<div class="empty-state"><h3>Product not found</h3><a class="btn btn-dark" href="/shop">Browse shop</a></div>';
    return;
  }

  document.title = product.name + ' - Shop';
  crumb.textContent = product.name;
  document.querySelector('meta[name="description"]').setAttribute('content', product.description);

  const sel = { size: '', color: '', qty: 1 };
  const soldOut = product.stock === 0;

  const images = (product.images && product.images.length ? product.images : ['']);
  const imagePartial = (img) =>
    `<div class="gallery-main"><img src="${App.esc(img)}" alt="${App.esc(product.name)}"
        onerror="this.src='/assets/hero.svg'" /></div>`;

  root.innerHTML = `
    <div class="gallery">
      <div id="gallery-main">${imagePartial(images[0])}</div>
      ${images.length > 1 ? `<div class="thumbs">${images.map((img, i) =>
        `<img src="${App.esc(img)}" alt="view ${i + 1}" class="${i === 0 ? 'active' : ''}" data-i="${i}"
             onerror="this.style.display='none'" />`).join('')}</div>` : ''}
    </div>
    <div class="product-info">
      <span class="product-cat">${App.esc(product.category)}</span>
      <h1>${App.esc(product.name)}</h1>
      <div class="price">${App.formatINR(product.price)}</div>
      <div class="desc">${App.esc(product.description)}</div>
      ${product.sizes.length ? `
        <div class="option-group">
          <label>Size</label>
          <div class="option-tiles" id="size-tiles">
            ${product.sizes.map((s) => `<button class="option-tile" data-size="${App.esc(s)}">${App.esc(s)}</button>`).join('')}
          </div>
        </div>` : ''}
      ${product.colors.length ? `
        <div class="option-group">
          <label>Color</label>
          <div class="option-tiles" id="color-tiles">
            ${product.colors.map((c) => `<button class="option-tile swatch-tile" data-color="${App.esc(c)}"><span class="swatch" style="background:${swatchColor(c)}"></span>${App.esc(c)}</button>`).join('')}
          </div>
        </div>` : ''}
      <div class="qty-row">
        <button class="qty-step" id="qty-minus">&minus;</button>
        <span class="qty-val" id="qty-val">1</span>
        <button class="qty-step" id="qty-plus">+</button>
      </div>
      <button class="btn btn-dark btn-block" id="add-btn" ${soldOut ? 'disabled' : ''}>
        ${soldOut ? 'Out of stock' : 'Add to cart'}
      </button>
      <p class="stock-note ${soldOut ? 'stock-out' : 'stock-in'}">
        ${soldOut ? 'This item is currently sold out.' : product.stock <= 5 ? 'Only ' + product.stock + ' left in stock.' : 'In stock and ready to ship.'}
      </p>
    </div>`;

  function swatchColor(name) {
    const map = {
      white: '#f5f2ec', black: '#1c1c1c', navy: '#2b3a55', grey: '#9a9a9a',
      maroon: '#6e1f2e', forest: '#2f4632', burgundy: '#6d2332', cream: '#f2ead9', sand: '#d8c3a0',
      olive: '#5a5a3e', khaki: '#b3a37f', rust: '#a34b2a', brown: '#6b4a2f', beige: '#e6d9c2',
      lavender: '#c4b5d6', pink: '#e6a8b4', 'sky blue': '#a8c7e0', 'light blue': '#c2d8ea',
      'light wash': '#a9c3d9', 'mid wash': '#8fb4d6', 'mid blue': '#5d86ad', indigo: '#3b4a85',
      cobalt: '#2456c4', orange: '#d5712f', moss: '#6b7341', stone: '#b9b3a6', charcoal: '#4a4a4a',
      mustard: '#d8a13a', natural: '#e3d8c2', mixed: '#8d8d8d', 'red black': '#6e1f2e',
      'navy white': '#2b3a55', 'black white': '#1c1c1c', 'heather grey': '#b9b4ac',
    };
    return map[String(name).toLowerCase()] || '#8d8d8d';
  }

  // galleries
  const main = document.getElementById('gallery-main');
  document.querySelectorAll('.thumbs img').forEach((t) =>
    t.addEventListener('click', () => {
      const i = +t.dataset.i;
      main.innerHTML = imagePartial(images[i]);
      document.querySelectorAll('.thumbs img').forEach((x) => x.classList.toggle('active', +x.dataset.i === i));
    }));

  // size selection
  const sizeTiles = document.getElementById('size-tiles');
  if (sizeTiles) {
    sizeTiles.querySelectorAll('.option-tile').forEach((t) =>
      t.addEventListener('click', () => {
        if (product.sizes.length === 1) return;
        sizeTiles.querySelectorAll('.option-tile').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        sel.size = t.dataset.size;
        updateBtn();
      }));
    if (product.sizes.length === 1) {
      sizeTiles.querySelector('.option-tile').classList.add('active');
      sel.size = product.sizes[0];
    }
  }

  // color selection
  const colorTiles = document.getElementById('color-tiles');
  if (colorTiles) {
    colorTiles.querySelectorAll('.option-tile').forEach((t) =>
      t.addEventListener('click', () => {
        colorTiles.querySelectorAll('.option-tile').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        sel.color = t.dataset.color;
        updateBtn();
      }));
    if (product.colors.length === 1) {
      colorTiles.querySelector('.option-tile').classList.add('active');
      sel.color = product.colors[0];
    }
  }

  // quantity
  const qtyVal = document.getElementById('qty-val');
  document.getElementById('qty-plus').addEventListener('click', () => {
    sel.qty = Math.min(sel.qty + 1, product.stock || 1, 20);
    qtyVal.textContent = sel.qty;
  });
  document.getElementById('qty-minus').addEventListener('click', () => {
    sel.qty = Math.max(1, sel.qty - 1);
    qtyVal.textContent = sel.qty;
  });

  function updateBtn() {
    const btn = document.getElementById('add-btn');
    const needSize = product.sizes.length > 1 && !sel.size;
    const needColor = product.colors.length > 1 && !sel.color;
    btn.disabled = soldOut || needSize || needColor;
    if (soldOut) return;
    const parts = [];
    if (needSize) parts.push('Select a size');
    if (needColor) parts.push('Select a color');
    btn.textContent = parts.length ? parts.join(', ') : 'Add to cart';
  }
  updateBtn();

  document.getElementById('add-btn').addEventListener('click', () => {
    App.addToCart(product.slug, sel.size, sel.color, sel.qty);
    App.toast('Added to cart');
  });
})();