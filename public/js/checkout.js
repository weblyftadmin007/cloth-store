/* Checkout: delivery details + Razorpay Checkout (UPI) integration */
(function () {
  const root = document.getElementById('checkout-root');
  let items = [];

  async function init() {
    try { await App.initChrome(); } catch {}
    const raw = App.getCart();
    if (!raw.length) {
      root.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Your cart is empty</h3><a class="btn btn-dark" href="/shop">Start shopping</a></div>';
      return;
    }
    try {
      const data = await App.getProducts();
      const bySlug = new Map(data.products.map((p) => [p.slug, p]));
      items = raw.map((i) => ({ ...i, product: bySlug.get(i.slug) })).filter((i) => i.product);
      if (!items.length) {
        root.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Your cart only has items that are no longer available</h3></div>';
        return;
      }
      render();
    } catch {
      root.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Could not load checkout details</h3></div>';
    }
  }

  function render() {
    const total = items.reduce((s, i) => s + i.product.price * i.qty, 0);
    root.innerHTML = `
      <section class="checkout-col">
        <h2>Delivery details</h2>
        <form class="form-grid" id="delivery-form" autocomplete="off">
          <div class="field"><label>Full name *</label><input id="c-name" required placeholder="Your name" /></div>
          <div class="field"><label>Phone number *</label><input id="c-phone" required placeholder="10-digit mobile" inputmode="numeric" maxlength="12" /></div>
          <div class="field full"><label>Email</label><input id="c-email" type="email" placeholder="you@example.com" /></div>
          <div class="field full"><label>Street address *</label><input id="c-address" required placeholder="House no, street, area" /></div>
          <div class="field"><label>City *</label><input id="c-city" required /></div>
          <div class="field"><label>State / Province *</label><input id="c-state" required /></div>
          <div class="field"><label>PIN code *</label><input id="c-pin" required inputmode="numeric" maxlength="6" /></div>
        </form>
      </section>
      <aside class="summary-card">
        <h2 style="margin-top:0">Order summary</h2>
        ${items.map((i) => `<div class="mini-line"><span class="nm">${App.esc(i.product.name)} ${i.size ? '· ' + App.esc(i.size) : ''} × ${i.qty}</span><span>${App.formatINR(i.product.price * i.qty)}</span></div>`).join('')}
        <div class="summary-row total"><span>Total</span><span>${App.formatINR(total)}</span></div>
        <button class="btn btn-accent btn-block" id="pay-btn">Pay with Razorpay (UPI)</button>
        <p class="summary-note" id="pay-note">Secure checkout by Razorpay. UPI, cards, net-banking and popular wallets are accepted.</p>
      </aside>`;

    document.getElementById('pay-btn').addEventListener('click', startPayment);
  }

  function validate() {
    const name = document.getElementById('c-name').value.trim();
    const phone = document.getElementById('c-phone').value.trim();
    const address = document.getElementById('c-address').value.trim();
    const city = document.getElementById('c-city').value.trim();
    const state = document.getElementById('c-state').value.trim();
    const pin = document.getElementById('c-pin').value.trim();
    if (!name || !phone || !address || !city || !state || !pin) {
      App.toast('Please fill all required fields');
      return null;
    }
    if (!/^[0-9]{10}$/.test(phone.replace(/\D/g, '').slice(-10)) && phone.replace(/\D/g, '').length < 10) {
      App.toast('Please enter a valid 10-digit phone number');
      return null;
    }
    return {
      name,
      phone: phone.replace(/\D/g, '').slice(-10),
      email: document.getElementById('c-email').value.trim(),
      address,
      city,
      state,
      pin,
    };
  }

  function loadRazorpayScript() {
    return new Promise((resolve, reject) => {
      if (window.Razorpay) return resolve(window.Razorpay);
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(window.Razorpay);
      s.onerror = () => reject(new Error('Could not load payment gateway'));
      document.head.appendChild(s);
    });
  }

  async function startPayment() {
    const customer = validate();
    if (!customer) return;

    const btn = document.getElementById('pay-btn');
    const note = document.getElementById('pay-note');
    btn.disabled = true;
    btn.textContent = 'Preparing payment...';

    try {
      const payload = {
        items: items.map((i) => ({ slug: i.slug, size: i.size, color: i.color, qty: i.qty })),
        customer,
      };
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error((data && data.error) || 'Could not create order');

      const Razorpay = await loadRazorpayScript();

      const rp = new Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: 'INR',
        name: document.querySelector('[data-role="brand"]').textContent || 'Your Brand',
        description: 'Order ' + data.orderId,
        order_id: data.razorpayOrderId,
        prefill: { name: customer.name, email: customer.email, contact: customer.phone },
        notes: { orderId: data.orderId },
        theme: { color: '#9a7b4f' },
        handler: async (resp) => {
          try {
            const v = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
              }),
            });
            const vd = await v.json().catch(() => null);
            if (!v.ok) throw new Error((vd && vd.error) || 'Verification failed');

            App.saveCart([]);
            window.location.href = '/order-success?order_id=' + encodeURIComponent(vd.orderId || data.orderId);
          } catch (e) {
            App.toast('Payment received but we could not confirm it. We will reach out.');
            btn.disabled = false;
            btn.textContent = 'Pay with Razorpay (UPI)';
          }
        },
        modal: { ondismiss: () => {
          btn.disabled = false;
          btn.textContent = 'Pay with Razorpay (UPI)';
        } },
      });
      rp.open();
    } catch (e) {
      App.toast(e.message || 'Checkout failed, please try again');
      btn.disabled = false;
      btn.textContent = 'Pay with Razorpay (UPI)';
    }
  }

  init();
})();