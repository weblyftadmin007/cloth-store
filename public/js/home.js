/* Home page: hero config, featured products, category tiles */
(async function () {
  try { await App.initChrome(); } catch {}

  try {
    const cfg = await App.getConfig();
    document.querySelector('[data-hero-title]').textContent = cfg.heroTitle || 'Wear your story';
    document.querySelector('[data-hero-sub]').textContent = cfg.heroSub || '';
    const img = document.querySelector('[data-hero-image]');
    if (cfg.heroImage) img.src = cfg.heroImage;
  } catch {}
})();

function productCard(p) {
  const img = p.images && p.images[0] ? p.images[0] : '';
  const low = p.stock > 0 && p.stock <= 5;
  const soldOut = p.stock === 0;
  return `
    <a class="product-card" href="/product?slug=${App.esc(p.slug)}">
      <div class="product-thumb">
        ${p.featured ? '<span class="badge">Featured</span>' : ''}
        <img src="${App.esc(img)}" alt="${App.esc(p.name)}" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='block';" />
        <div class="skeleton thumb-skeleton" style="display:none"></div>
      </div>
      <div class="product-body">
        <span class="product-cat">${App.esc(p.category)}</span>
        <span class="product-name">${App.esc(p.name)}</span>
        <span class="product-price">${App.formatINR(p.price)}</span>
        ${soldOut ? '<span class="out-of-stock">Out of stock</span>' : (low ? '<span class="low-stock">Only a few left</span>' : '')}
      </div>
    </a>`;
}

(async function () {
  const grid = document.getElementById('featured-grid');
  try {
    const data = await App.getProducts();
    const featured = data.products.filter((p) => p.featured && p.stock > 0).slice(0, 4);
    const pool = featured.length
      ? featured
      : data.products.filter((p) => p.stock > 0).slice(0, 4);
    grid.innerHTML = pool.map(productCard).join('') || '<div class="empty-state"><h3>Nothing here yet</h3></div>';

    const catGrid = document.getElementById('category-grid');
    const tiles = ['Tees', 'Hoodies', 'Shirts', 'Jackets', 'Bottoms', 'Accessories']
      .filter((c) => data.categories.includes(c))
      .slice(0, 6);
    catGrid.innerHTML = tiles.length
      ? tiles.map((c) => `
        <a class="product-card" href="/shop?category=${encodeURIComponent(c)}">
          <div class="product-thumb">
            <img src="/assets/hero.svg" alt="${App.esc(c)}" style="filter:grayscale(0.7)" />
          </div>
          <div class="product-body"><span class="product-name">${App.esc(c)}</span></div>
        </a>`).join('')
      : '';
  } catch (e) {
    grid.innerHTML = '<div class="empty-state"><h3>Could not load products</h3><p>Check your Cloudflare setup.</p></div>';
  }
})();