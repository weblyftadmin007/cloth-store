/* Shop page: filters, search, sort over the full catalog */
(function () {
  const state = {
    all: [],
    category: new URLSearchParams(location.search).get('category') || '',
    query: '',
    sort: 'default',
  };

  const grid = document.getElementById('shop-grid');
  const empty = document.getElementById('empty-state');
  const countEl = document.getElementById('result-count');
  const chips = document.getElementById('category-chips');
  const allChip = document.getElementById('all-chip');
  const searchEl = document.getElementById('search-input');
  const sortEl = document.getElementById('sort-select');

  async function init() {
    try { await App.initChrome(); } catch {}
    try {
      const data = await App.getProducts();
      state.all = data.products;
      renderChips(data.categories);
      bindEvents();
      apply();
    } catch (e) {
      grid.innerHTML = '<div class="empty-state"><h3>Could not load products</h3></div>';
    }
  }

  function renderChips(categories) {
    allChip.classList.toggle('active', state.category === '');
    chips.innerHTML = categories
      .map((c) => `<button class="chip ${c === state.category ? 'active' : ''}" data-chip="${App.esc(c)}">${App.esc(c)}</button>`)
      .join('');
    chips.querySelectorAll('[data-chip]').forEach((el) =>
      el.addEventListener('click', () => {
        state.category = el.dataset.chip;
        chips.querySelectorAll('[data-chip]').forEach((x) => x.classList.toggle('active', x.dataset.chip === state.category));
        allChip.classList.remove('active');
        apply();
      }));
    allChip.addEventListener('click', () => {
      state.category = '';
      allChip.classList.add('active');
      chips.querySelectorAll('[data-chip]').forEach((x) => x.classList.remove('active'));
      apply();
    });
  }

  function bindEvents() {
    let t;
    searchEl.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.query = searchEl.value.trim().toLowerCase(); apply(); }, 200);
    });
    sortEl.addEventListener('change', () => { state.sort = sortEl.value; apply(); });
  }

  function filtered() {
    let items = state.all.filter((p) => {
      const inCat = !state.category || p.category === state.category;
      const q = state.query;
      const inQ = !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      return inCat && inQ;
    });
    if (state.sort === 'price-asc') items = [...items].sort((a, b) => a.price - b.price);
    else if (state.sort === 'price-desc') items = [...items].sort((a, b) => b.price - a.price);
    else if (state.sort === 'name') items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    else items = [...items].sort((a, b) => (b.featured - a.featured) || (b.stock - a.stock));
    return items;
  }

  function card(p) {
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

  function apply() {
    const items = filtered();
    countEl.textContent = items.length
      ? `${items.length} item${items.length > 1 ? 's' : ''}${state.category ? ' in ' + state.category : ''}`
      : '';
    grid.innerHTML = items.map(card).join('');
    empty.style.display = items.length ? 'none' : 'block';
  }

  init();
})();