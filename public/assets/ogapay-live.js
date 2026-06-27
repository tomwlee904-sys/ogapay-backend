(function () {
  'use strict';

  const API_BASE = (window.OGAPAY_API_BASE || localStorage.getItem('ogapay_api_base') || '/v1').replace(/\/$/, '');
  const tokenKey = 'ogapay_access_token';
  const refreshKey = 'ogapay_refresh_token';
  const userKey = 'ogapay_user';

  const money = (value, currency) => {
    const amount = Number(value || 0);
    if (currency === 'NGN') {
      return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);
    }
    return `${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${currency || ''}`.trim();
  };

  const token = () => localStorage.getItem(tokenKey);
  const authHeaders = () => token() ? { Authorization: `Bearer ${token()}` } : {};

  async function api(path, options) {
    const init = options || {};
    const headers = {
      Accept: 'application/json',
      ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
      ...(init.headers || {}),
    };
    const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    const text = await res.text();
    let json = {};
    try { json = text ? JSON.parse(text) : {}; } catch (e) { json = { message: text }; }
    if (!res.ok) throw new Error(json.message || `Request failed (${res.status})`);
    return json;
  }

  function unwrap(json) {
    return json && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json;
  }

  function setAuthState(isAuthed) {
    document.body.classList.toggle('is-authed', Boolean(isAuthed));
    document.body.setAttribute('data-auth', isAuthed ? 'authed' : 'public');
    localStorage.setItem('ogapay-authenticated', isAuthed ? 'true' : 'false');
  }

  function saveSession(json) {
    const payload = unwrap(json) || {};
    const session = payload.session || payload.tokens || payload;
    const access = session.accessToken || session.access_token || payload.accessToken || payload.token;
    const refresh = session.refreshToken || session.refresh_token;
    if (!access) throw new Error('No access token returned by API.');
    localStorage.setItem(tokenKey, access);
    if (refresh) localStorage.setItem(refreshKey, refresh);
    if (payload.user) localStorage.setItem(userKey, JSON.stringify(payload.user));
    setAuthState(true);
    return payload;
  }

  function say(text) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  }

  function initials(user) {
    const first = user?.firstName || user?.first_name || user?.username || 'O';
    const last = user?.lastName || user?.last_name || 'P';
    return `${String(first)[0] || 'O'}${String(last)[0] || 'P'}`.toUpperCase();
  }

  function updateUserChrome(user) {
    if (!user) return;
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.email || 'OgaPay user';
    document.querySelectorAll('.sb-user strong').forEach((el) => { el.textContent = name; });
    document.querySelectorAll('.avatar-mini').forEach((el) => { el.textContent = initials(user); });
    // Add My Products sidebar link if not present
    if (!document.querySelector('.sb-item[href*="my-products"]') && document.querySelector('.sb-label')) {
      const labels = document.querySelectorAll('.sb-label');
      let targetLabel = null;
      for (const l of labels) {
        if (l.textContent.includes('Business')) { targetLabel = l; break; }
      }
      if (targetLabel) {
        const link = document.createElement('a');
        link.className = 'sb-item';
        link.href = '#';
        link.innerHTML = '<span class="sb-icon"><i class="ti ti-building-store"></i></span>My Products';
        link.onclick = (e) => { e.preventDefault(); showMyProducts(); };
        targetLabel.after(link);
      }
    }
  }

  async function showMyProducts() {
    try {
      const data = unwrap(await api('/store/my-products'));
      const items = Array.isArray(data) ? data : [];
      const grid = document.querySelector('.grid.cols-3');
      if (!grid) return;
      if (!items.length) {
        grid.innerHTML = '<article class="card"><p class="muted">You have no products yet. Click "Add Product" to create one.</p></article>';
        return;
      }
      grid.innerHTML = items.map((item) => `
        <article class="card">
          ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" style="width:100%;height:180px;object-fit:cover;border-radius:8px;margin-bottom:10px;background:var(--bg2)" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="row space"><span class="badge">${escapeHtml(item.category || 'Deal')}</span><span class="badge">${money(item.price, item.currency || 'NGN')}</span></div>
          <h3>${escapeHtml(item.name)}</h3>
          <p class="muted small">Status: ${item.status} ${item.isActive ? '' : '(inactive)'}</p>
          <div class="row space">
            <button class="btn" data-live-delete-product="${item.id}" style="color:var(--gold)"><i class="ti ti-trash"></i></button>
            <button class="btn primary" onclick="showProductDetail('${item.id}')"><i class="ti ti-eye"></i>View</button>
          </div>
        </article>
      `).join('');
    } catch (e) {
      say('Failed to load your products: ' + e.message);
    }
  }

  async function showProductDetail(itemId) {
    try {
      const d = unwrap(await api('/store/' + itemId));
      const existing = document.getElementById('storeModal');
      if (existing) existing.remove();
      const overlay = document.createElement('div');
      overlay.id = 'storeModal';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px';
      overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
      overlay.innerHTML = `
        <div style="background:var(--card);border-radius:16px;padding:28px;width:min(600px,100%);max-height:90vh;overflow-y:auto">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
            <div><h2 style="margin:0;font-family:Outfit">${escapeHtml(d.title || d.name)}</h2>
            <span style="color:var(--text3);font-size:13px">by ${escapeHtml(d.seller || 'OgaPay')}</span></div>
            <button class="icon-btn" data-close-modal style="border:none;font-size:22px">&times;</button>
          </div>
          ${d.image ? `<img src="${escapeHtml(d.image)}" alt="" style="width:100%;max-height:300px;object-fit:cover;border-radius:10px;margin-bottom:16px;background:var(--bg2)">` : ''}
          <p style="color:var(--text2);line-height:1.6;margin:0 0 16px">${escapeHtml(d.description || '')}</p>
          <div class="row space" style="padding:14px 0;border-top:1px solid var(--border);align-items:center">
            <span style="font-size:22px;font-weight:800">${money(d.price, d.currency || 'NGN')}</span>
            <span class="badge">${escapeHtml(d.category || 'Deal')}</span>
          </div>
          <button class="btn primary" style="width:100%;padding:14px" data-live-buy="${d.id}"><i class="ti ti-shopping-cart"></i>Buy Now</button>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector('[data-close-modal]').onclick = () => overlay.remove();
    } catch (e) {
      say('Failed to load product: ' + e.message);
    }
  }

  function replaceGrid(selector, html) {
    const grid = document.querySelector(selector);
    if (grid) grid.innerHTML = html;
  }

  function emptyCard(message) {
    return `<article class="card"><p class="muted">${message}</p></article>`;
  }

  async function hydrateAuth() {
    if (!token()) {
      setAuthState(false);
      return;
    }
    setAuthState(true);
    try {
      const user = unwrap(await api('/auth/me'));
      updateUserChrome(user);
      localStorage.setItem(userKey, JSON.stringify(user));
    } catch (e) {
      localStorage.removeItem(tokenKey);
      localStorage.removeItem(refreshKey);
      setAuthState(false);
    }
  }

  async function hydrateTasks() {
    const page = document.body.dataset.page;
    if (page !== 'tasks.html') return;
    const grid = document.querySelector('.grid.cols-3');
    if (!grid) return;
    grid.innerHTML = emptyCard('Loading live tasks...');
    try {
      const data = unwrap(await api('/tasks?limit=24'));
      const tasks = Array.isArray(data) ? data : (data.tasks || []);
      if (!tasks.length) {
        grid.innerHTML = emptyCard('No open tasks are live yet. Posted tasks will appear here automatically.');
        return;
      }
      grid.innerHTML = tasks.map((task) => `
        <article class="card" data-cat="${String(task.category || 'OTHER').toLowerCase()}">
          <div class="row space"><span class="badge">${task.category || 'Task'}</span><span class="badge">${money(task.reward, task.currency)}</span></div>
          <h3>${escapeHtml(task.title)}</h3>
          <p class="muted">${escapeHtml(task.description || task.instructions || 'Complete the task and submit proof.')}</p>
          <div class="row space"><span class="small">${task.currentWorkers || 0}/${task.maxWorkers || 1} workers</span><button class="btn primary" data-live-apply="${task.id}"><i class="ti ti-send"></i>Apply</button></div>
        </article>
      `).join('');
    } catch (e) {
      grid.innerHTML = emptyCard(`Could not load live tasks: ${escapeHtml(e.message)}`);
    }
  }

  async function hydrateDashboard() {
    if (document.body.dataset.page !== 'dashboard.html' || !token()) return;
    try {
      const data = unwrap(await api('/dashboard/summary'));
      const cards = document.querySelectorAll('.grid.cols-4 .card .stat');
      const wallets = data.wallets || [];
      const ngn = wallets.find((w) => w.currency === 'NGN');
      const usdc = wallets.find((w) => w.currency === 'USDC');
      if (cards[0]) cards[0].textContent = money(ngn?.balance, 'NGN');
      if (cards[1]) cards[1].textContent = money(usdc?.balance, 'USDC');
      if (cards[2]) cards[2].textContent = data.metrics?.submissions ?? 0;
      if (cards[3]) cards[3].textContent = data.metrics?.unreadNotifications ?? 0;
    } catch (e) {
      say(e.message);
    }
  }

  async function hydrateWallet() {
    if (document.body.dataset.page !== 'wallet.html' || !token()) return;
    try {
      const balances = unwrap(await api('/wallet/balance'));
      const cards = document.querySelectorAll('.grid.cols-3 .card .stat');
      if (cards[0]) cards[0].textContent = money(balances.NGN?.balance, 'NGN');
      if (cards[1]) cards[1].textContent = money(balances.USDC?.balance, 'USDC');
      if (cards[2]) cards[2].textContent = money(Object.values(balances).reduce((sum, w) => sum + Number(w.lockedBalance || 0), 0), 'NGN');
    } catch (e) {
      say(e.message);
    }
  }

  async function hydrateCommunities() {
    if (!['communities.html', 'community.html'].includes(document.body.dataset.page)) return;
    const grid = document.querySelector('.grid.cols-3');
    if (!grid) return;
    try {
      const communities = unwrap(await api('/communities'));
      if (!Array.isArray(communities) || !communities.length) return;
      grid.innerHTML = communities.map((c) => `
        <article class="card">
          <div class="row space"><span class="badge">${c.tasks || 0} tasks</span><span class="badge">${Number(c.members || 0).toLocaleString()} members</span></div>
          <h3>${escapeHtml(c.name)}</h3>
          <p class="muted">Live OgaPay community workspace.</p>
          <button class="btn primary" data-live-join="${c.id}"><i class="ti ti-user-plus"></i>Join</button>
        </article>
      `).join('');
    } catch (e) {}
  }

  function initStorePage() {
    if (document.body.dataset.page !== 'store.html') return;
    const head = document.querySelector('.page-head');
    if (head && !head.querySelector('[data-add-product]')) {
      const btn = document.createElement('button');
      btn.className = 'btn primary nav-auth-only';
      btn.setAttribute('data-add-product', '');
      btn.innerHTML = '<i class="ti ti-plus"></i>Add Product';
      btn.onclick = () => {
        if (!token()) return location.href = 'login.html';
        showAddProductModal();
      };
      head.appendChild(btn);
    }
  }

  async function showAddProductModal() {
    const existing = document.getElementById('storeModal');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'storeModal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div style="background:var(--card);border-radius:16px;padding:28px;width:min(520px,100%);max-height:90vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2 style="margin:0;font-family:Outfit">Add Product</h2>
          <button class="icon-btn" data-close-modal style="border:none;font-size:22px">&times;</button>
        </div>
        <form id="productForm" style="display:grid;gap:14px">
          <input id="pfName" placeholder="Product name *" required style="padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg2);color:var(--text);width:100%">
          <textarea id="pfDesc" placeholder="Description" rows="3" style="padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg2);color:var(--text);width:100%"></textarea>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <input id="pfPrice" type="number" step="0.01" placeholder="Price *" required style="padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg2);color:var(--text)">
            <select id="pfCurrency" style="padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg2);color:var(--text)">
              <option value="NGN">NGN</option><option value="SOL">SOL</option><option value="USDC">USDC</option>
            </select>
          </div>
          <select id="pfCategory" required style="padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;background:var(--bg2);color:var(--text)">
            <option value="">Select category *</option>
            <option value="DESIGN">Design</option><option value="SOCIAL_MEDIA">Social Media</option>
            <option value="CONTENT_WRITING">Content Writing</option><option value="DATA_ENTRY">Data Entry</option>
            <option value="VIDEO">Video</option><option value="MUSIC">Music</option><option value="OTHER">Other</option>
          </select>
          <div style="border:2px dashed var(--border);border-radius:12px;padding:20px;text-align:center;cursor:pointer" id="pfDrop">
            <i class="ti ti-cloud-upload" style="font-size:32px;color:var(--text3)"></i>
            <p style="margin:6px 0 0;color:var(--text2);font-size:13px">Click to upload cover image</p>
            <input type="file" id="pfImage" accept="image/*" style="display:none">
            <img id="pfPreview" style="max-width:100%;max-height:200px;margin-top:10px;display:none;border-radius:8px">
          </div>
          <div id="pfStatus" style="color:var(--accent2);font-size:13px;display:none"></div>
          <button type="submit" id="pfSubmit" class="btn primary" style="padding:12px"><i class="ti ti-device-floppy"></i>Create Product</button>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-close-modal]').onclick = () => overlay.remove();

    let uploadedUrl = '';
    const drop = overlay.querySelector('#pfDrop');
    const fileInput = overlay.querySelector('#pfImage');
    const preview = overlay.querySelector('#pfPreview');
    const statusEl = overlay.querySelector('#pfStatus');

    drop.onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      statusEl.style.display = 'block';
      statusEl.textContent = 'Uploading image...';
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch(API_BASE + '/uploads/store', { method: 'POST', headers: { Authorization: 'Bearer ' + token() }, body: fd });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Upload failed');
        uploadedUrl = json.data?.url;
        preview.src = uploadedUrl;
        preview.style.display = 'block';
        statusEl.textContent = 'Image uploaded';
        statusEl.style.color = 'var(--accent2)';
      } catch (err) {
        statusEl.textContent = 'Upload failed: ' + err.message;
        statusEl.style.color = 'var(--gold)';
      }
    };

    const form = overlay.querySelector('#productForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = overlay.querySelector('#pfSubmit');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Creating...';
      statusEl.style.display = 'block';
      statusEl.textContent = 'Creating product...';
      statusEl.style.color = 'var(--accent2)';
      try {
        const name = overlay.querySelector('#pfName').value.trim();
        const description = overlay.querySelector('#pfDesc').value.trim();
        const price = overlay.querySelector('#pfPrice').value;
        const currency = overlay.querySelector('#pfCurrency').value;
        const category = overlay.querySelector('#pfCategory').value;
        if (!name || !price || !category) { throw new Error('Name, price, and category are required'); }
        const res = await api('/store/products', { method: 'POST', body: JSON.stringify({ name, description, price, currency, category, imageUrl: uploadedUrl || undefined }) });
        say('Product created!');
        overlay.remove();
        hydrateStore();
      } catch (err) {
        statusEl.textContent = err.message;
        statusEl.style.color = 'var(--gold)';
      }
      btn.disabled = false;
      btn.innerHTML = '<i class="ti ti-device-floppy"></i>Create Product';
    };
  }

  async function hydrateStore() {
    if (document.body.dataset.page !== 'store.html') return;
    initStorePage();
    const grid = document.querySelector('.grid.cols-3');
    if (!grid) return;
    try {
      const data = unwrap(await api('/store?limit=24'));
      const items = data?.items || (Array.isArray(data) ? data : []);
      if (!items.length) return;
      grid.innerHTML = items.map((item) => `
        <article class="card" style="cursor:pointer" onclick="showProductDetail('${escapeHtml(item.id)}')">
          ${item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title || item.name)}" style="width:100%;height:180px;object-fit:cover;border-radius:8px;margin-bottom:10px;background:var(--bg2)" loading="lazy" onerror="this.style.display='none'">` : ''}
          <div class="row space"><span class="badge">${escapeHtml(item.category || 'Deal')}</span><span class="badge">${money(item.price, item.currency || 'NGN')}</span></div>
          <h3>${escapeHtml(item.title || item.name)}</h3>
          <p class="muted">${escapeHtml((item.description || '').slice(0, 100))}</p>
          <div class="row space"><span class="small">by ${escapeHtml(item.seller || 'OgaPay')}</span><button class="btn primary" onclick="event.stopPropagation(); if(!token()){location.href='login.html'}else{this.closest('article').querySelector('[data-live-buy]')||this}" data-live-buy="${item.id}"><i class="ti ti-shopping-cart"></i>Buy</button></div>
        </article>
      `).join('');
    } catch (e) {}
  }

  async function hydrateLeaderboard() {
    if (document.body.dataset.page !== 'leaderboard.html') return;
    const table = document.querySelector('tbody');
    if (!table) return;
    try {
      const workers = unwrap(await api('/leaderboard/workers?limit=10'));
      if (!Array.isArray(workers) || !workers.length) return;
      table.innerHTML = workers.map((w) => `
        <tr><td>#${w.rank}</td><td>${w.user?.verifiedCreator ? '<i class="ti ti-certificate" style="color:var(--gold)" title="Verified Creator"></i> ' : ''}${escapeHtml(w.user?.username || w.user?.firstName || 'Worker')}</td><td>${money(w.totalEarned, 'NGN')}</td><td>${w.tasksCompleted || 0}</td></tr>
      `).join('');
    } catch (e) {}
  }

  async function hydrateKyc() {
    if (document.body.dataset.page !== 'kyc.html' || !token()) return;
    try {
      const kyc = unwrap(await api('/kyc/status'));
      const stat = document.querySelector('.stat');
      if (stat && kyc.status) stat.textContent = kyc.status;
    } catch (e) {}
  }

  async function hydrateNotifications() {
    if (document.body.dataset.page !== 'notifications.html' || !token()) return;
    const table = document.querySelector('tbody');
    try {
      const data = unwrap(await api('/notifications?limit=10'));
      const notes = data.notifications || [];
      if (table && notes.length) {
        table.innerHTML = notes.map((n) => `<tr><td>${escapeHtml(n.title)}</td><td>${escapeHtml(n.body || '')}</td><td>${n.isRead ? 'Read' : 'Unread'}</td></tr>`).join('');
      }
    } catch (e) {}
  }

  async function hydrateMyTasks() {
    if (document.body.dataset.page !== 'my-tasks.html' || !token()) return;
    const stats = document.querySelectorAll('.grid.cols-4 .card .stat');
    const table = document.querySelector('tbody');
    try {
      const data = unwrap(await api('/tasks/my/submissions?limit=20'));
      const submissions = Array.isArray(data) ? data : [];
      const pending = submissions.filter((s) => s.status === 'PENDING' && !s.submittedAt).length;
      const review = submissions.filter((s) => s.status === 'PENDING' && s.submittedAt).length;
      const approved = submissions.filter((s) => s.status === 'APPROVED').length;
      if (stats[0]) stats[0].textContent = pending;
      if (stats[1]) stats[1].textContent = review;
      if (stats[2]) stats[2].textContent = approved;
      if (table && submissions.length) {
        table.innerHTML = submissions.map((s) => `
          <tr>
            <td>${escapeHtml(s.task?.title || 'Task')}</td>
            <td>${escapeHtml(s.task?.category || 'Task')}</td>
            <td>${money(s.task?.reward, s.task?.currency || 'NGN')}</td>
            <td><span class="badge">${escapeHtml(s.status || 'PENDING')}</span></td>
            <td><button class="btn" data-live-submit="${s.task?.id || s.taskId}">View</button></td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  }

  async function hydrateReferrals() {
    if (document.body.dataset.page !== 'referrals.html' || !token()) return;
    try {
      const stats = unwrap(await api('/users/referrals/stats'));
      const statEls = document.querySelectorAll('.stat');
      if (statEls[0]) statEls[0].textContent = stats.referralCode || stats.code || '-';
      if (statEls[1]) statEls[1].textContent = stats.totalReferrals ?? stats.referralCount ?? 0;
      if (statEls[2]) statEls[2].textContent = money(stats.totalEarned || 0, 'NGN');
      document.querySelectorAll('[data-copy]').forEach((el) => {
        if (/join\?ref=/.test(el.getAttribute('data-copy') || '') && (stats.referralLink || stats.referralCode)) {
          el.setAttribute('data-copy', stats.referralLink || `${location.origin}/login.html?mode=signup&ref=${stats.referralCode}`);
        }
      });
    } catch (e) {}
  }

  async function hydrateAnalytics() {
    if (document.body.dataset.page !== 'analytics.html' || !token()) return;
    try {
      const summary = unwrap(await api('/dashboard/summary'));
      const statEls = document.querySelectorAll('.stat');
      if (statEls[0]) statEls[0].textContent = summary.metrics?.postedTasks ?? 0;
      if (statEls[1]) statEls[1].textContent = summary.metrics?.submissions ?? 0;
      if (statEls[2]) statEls[2].textContent = summary.metrics?.unreadNotifications ?? 0;
    } catch (e) {}
  }

  function initBlogPage() {
    if (document.body.dataset.page !== 'blog.html') return;
    const searchInput = document.getElementById('blogSearch')
    if (searchInput) {
      let timer
      searchInput.addEventListener('input', () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          const url = new URL(location.href)
          url.searchParams.set('search', searchInput.value)
          if (searchInput.value) url.searchParams.set('page', '1')
          else url.searchParams.delete('search')
          url.searchParams.set('_t', Date.now())
          history.replaceState(null, '', url.toString())
          hydrateBlog()
        }, 350)
      })
    }
  }

  function bindActions() {
    document.addEventListener('click', async (event) => {
      const apply = event.target.closest('[data-live-apply]');
      const join = event.target.closest('[data-live-join]');
      const buy = event.target.closest('[data-live-buy]');
      const del = event.target.closest('[data-live-delete-product]');
      const filterChip = event.target.closest('.filter-chip[data-category]');
      const pageBtn = event.target.closest('.page-btn[data-page]');
      if (filterChip) {
        const url = new URL(location.href)
        const cat = filterChip.dataset.category
        url.searchParams.set('category', cat)
        url.searchParams.set('page', '1')
        url.searchParams.set('_t', Date.now())
        history.replaceState(null, '', url.toString())
        hydrateBlog()
        return
      }
      if (pageBtn) {
        if (pageBtn.disabled) return
        const url = new URL(location.href)
        url.searchParams.set('page', pageBtn.dataset.page)
        url.searchParams.set('_t', Date.now())
        history.replaceState(null, '', url.toString())
        hydrateBlog()
        return
      }
      try {
        if (apply) {
          if (!token()) return location.href = 'login.html';
          apply.disabled = true;
          await api(`/tasks/${apply.dataset.liveApply}/apply`, { method: 'POST' });
          apply.innerHTML = '<i class="ti ti-check"></i>Applied';
          say('Application submitted');
        }
        if (join) {
          if (!token()) return location.href = 'login.html';
          await api(`/communities/${join.dataset.liveJoin}/join`, { method: 'POST' });
          join.innerHTML = '<i class="ti ti-check"></i>Joined';
          say('Joined community');
        }
        if (del) {
          if (!token()) return location.href = 'login.html';
          if (!confirm('Delete this product?')) return;
          try {
            await api('/store/products/' + del.dataset.liveDeleteProduct, { method: 'DELETE' });
            say('Product deleted');
            del.closest('article')?.remove();
          } catch (e) {
            say('Delete failed: ' + e.message);
          }
        }
        if (buy) {
          if (!token()) return location.href = 'login.html';
          buy.disabled = true;
          buy.innerHTML = '<span class="spinner"></span>';
          try {
            await api(`/store/${buy.dataset.liveBuy}/purchase`, { method: 'POST', body: JSON.stringify({ quantity: 1 }) });
            say('Purchase successful! Check your wallet.');
            const modal = document.getElementById('storeModal');
            if (modal) modal.remove();
            hydrateStore();
          } catch (e) {
            say('Purchase failed: ' + e.message);
          }
          buy.disabled = false;
          buy.innerHTML = '<i class="ti ti-shopping-cart"></i>Buy';
        }
      } catch (e) {
        say(e.message);
        if (apply) apply.disabled = false;
      }
    });
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  // ── Profile Editing ─────────────────────────

  const CATEGORIES = [
    'SOCIAL_MEDIA', 'DATA_ENTRY', 'CONTENT_WRITING', 'APP_TESTING',
    'SURVEY', 'DESIGN', 'TRANSLATION', 'WEB_RESEARCH', 'VIDEO_REVIEW', 'OTHER',
  ];

  const CATEGORY_LABELS = {
    SOCIAL_MEDIA: 'Social Media', DATA_ENTRY: 'Data Entry', CONTENT_WRITING: 'Content Writing',
    APP_TESTING: 'App Testing', SURVEY: 'Survey', DESIGN: 'Design',
    TRANSLATION: 'Translation', WEB_RESEARCH: 'Web Research', VIDEO_REVIEW: 'Video Review',
    OTHER: 'Other',
  };

  let profileData = null;
  function getEl(id) {
    return document.getElementById(id);
  }

  function $val(id, val) {
    const el = getEl(id);
    if (!el) return null;
    if (val !== undefined) el.value = val;
    return el.value;
  }

  function renderAvatar(profile) {
    const img = getEl('avatarImg');
    const initEl = getEl('avatarInitials');
    if (!img || !initEl) return;
    const url = profile.avatarUrl || profile.avatar || profile.picture;
    if (url && !url.startsWith('data:')) {
      img.src = url;
      img.style.display = 'block';
      initEl.style.display = 'none';
    } else {
      img.style.display = 'none';
      initEl.style.display = 'grid';
      initEl.textContent = initials(profile);
    }
  }

  function populateProfileForm(profile) {
    if (!profile) return;
    profileData = profile;
    const wp = profile.workerProfile || {};

    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username || 'My Profile';
    if (getEl('profileName')) getEl('profileName').textContent = fullName;
    if (getEl('displayName')) getEl('displayName').textContent = fullName;
    if (getEl('displayUsername')) getEl('displayUsername').textContent = '@' + (profile.username || 'username');
    if (getEl('displayJoined')) {
      const d = profile.createdAt ? new Date(profile.createdAt) : null;
      getEl('displayJoined').textContent = d ? d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '---';
    }

    if (getEl('sidebarName')) getEl('sidebarName').textContent = fullName;
    if (getEl('sidebarRole')) getEl('sidebarRole').textContent = profile.role || 'Worker';
    updateUserChrome(profile);

    $val('fieldFirstName', profile.firstName || '');
    $val('fieldLastName', profile.lastName || '');
    $val('fieldNickname', wp.nickname || '');
    $val('fieldPhone', profile.phone || '');
    $val('fieldEmail', profile.email || '');
    $val('fieldBio', wp.bio || '');
    $val('fieldDescription', wp.description || '');
    $val('fieldMoreAbout', wp.moreAbout || '');

    renderAvatar(profile);

    const badgeRow = getEl('badgeRow');
    if (badgeRow) {
      const badges = [];
      if (profile.verifiedCreator) badges.push('<span class="badge" style="background:var(--gold);color:#000;border-color:var(--gold)"><i class="ti ti-certificate"></i>Verified Creator</span>');
      if (profile.kyc?.status === 'APPROVED') badges.push('<span class="badge"><i class="ti ti-shield-check"></i>KYC verified</span>');
      if (wp.avgRating) badges.push(`<span class="badge">${wp.avgRating.toFixed(1)} rating</span>`);
      if (wp.level) badges.push(`<span class="badge">Level ${wp.level}</span>`);
      badgeRow.innerHTML = badges.join('');
    }

    const repStat = getEl('reputationStat');
    if (repStat) {
      const rate = wp.successRate != null ? wp.successRate : wp.avgRating || 0;
      const pct = typeof rate === 'number' ? Math.round((rate > 1 ? rate / 5 : rate) * 100) : 0;
      repStat.textContent = pct + '%';
      if (getEl('reputationDetail')) {
        getEl('reputationDetail').textContent = (wp.tasksCompleted || 0) + ' completed tasks' +
          (wp.totalRatings ? ', ' + wp.totalRatings + ' ratings' : '');
      }
      if (getEl('reputationBar')) getEl('reputationBar').style.width = Math.min(pct, 100) + '%';
    }

    renderCategories(wp.categories || []);
    renderSkills(wp.skills || []);
    renderPortfolio(wp.portfolio || []);
    renderPublicToggle(wp.isPublic !== false);

    getEl('saveBtn').disabled = false;
  }

  function renderCategories(selected) {
    const container = getEl('categoryChips');
    if (!container) return;
    container.innerHTML = CATEGORIES.map((cat) => {
      const sel = selected.includes(cat);
      return `<span class="chip${sel ? ' selected' : ''}" data-cat="${cat}">${CATEGORY_LABELS[cat] || cat}</span>`;
    }).join('');
  }

  function renderSkills(skills) {
    const container = document.querySelector('#skillsInput');
    if (!container) return;
    const input = getEl('skillsField');
    const existing = container.querySelectorAll('.tag');
    existing.forEach((t) => t.remove());
    skills.forEach((s) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.innerHTML = `${escapeHtml(s)} <span class="remove" data-skill="${escapeHtml(s)}">&times;</span>`;
      container.insertBefore(tag, input);
    });
  }

  function renderPortfolio(files) {
    const grid = getEl('portfolioGrid');
    if (!grid) return;
    if (!Array.isArray(files) || !files.length) {
      grid.innerHTML = '<p class="muted small">No portfolio items yet.</p>';
      return;
    }
    grid.innerHTML = files.map((f, i) => {
      const url = typeof f === 'string' ? f : (f.url || f.thumbnail || f);
      const isImage = /\.(png|jpg|jpeg|gif|webp)/i.test(url);
      return `<div class="portfolio-item"><button class="remove" data-portfolio-index="${i}">&times;</button>${
        isImage ? `<img src="${escapeHtml(url)}" alt="Portfolio ${i + 1}">` : `<div style="display:grid;place-items:center;height:100%"><i class="ti ti-file" style="font-size:32px;color:var(--text3)"></i><span class="small">${escapeHtml(f.name || 'File')}</span></div>`
      }</div>`;
    }).join('');
  }

  function renderPublicToggle(isPublic) {
    const toggle = getEl('publicToggle');
    if (!toggle) return;
    toggle.classList.toggle('on', isPublic);
  }

  function getFormData() {
    return {
      firstName: $val('fieldFirstName'),
      lastName: $val('fieldLastName'),
      phone: $val('fieldPhone'),
      nickname: $val('fieldNickname'),
      bio: $val('fieldBio'),
      description: $val('fieldDescription'),
      moreAbout: $val('fieldMoreAbout'),
      categories: profileData?.workerProfile?.categories || [],
      skills: profileData?.workerProfile?.skills || [],
      portfolio: profileData?.workerProfile?.portfolio || [],
      isPublic: profileData?.workerProfile?.isPublic !== false,
    };
  }

  async function saveProfile() {
    const btn = getEl('saveBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Saving...';
    try {
      const data = getFormData();
      const body = {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        nickname: data.nickname,
        bio: data.bio,
        description: data.description,
        moreAbout: data.moreAbout,
        categories: data.categories,
        skills: data.skills,
        portfolio: data.portfolio,
        isPublic: data.isPublic,
      };
      const result = unwrap(await api('/users/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }));
      if (result) {
        profileData = { ...profileData, ...result, workerProfile: { ...(profileData?.workerProfile || {}), ...result.workerProfile } };
        localStorage.setItem(userKey, JSON.stringify(profileData));
      }
      say('Profile saved');
    } catch (e) {
      say('Failed to save: ' + e.message);
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="ti ti-device-floppy"></i>Save Changes';
  }

  async function uploadAvatar(file) {
    const btn = getEl('avatarWrap');
    if (!btn) return;
    try {
      btn.style.opacity = '.5';
      const fd = new FormData();
      fd.append('avatar', file);
      const result = unwrap(await api('/users/avatar', { method: 'POST', body: fd }));
      if (profileData) profileData.avatarUrl = result.avatarUrl;
      renderAvatar(profileData);
      say('Avatar updated');
    } catch (e) {
      say('Upload failed: ' + e.message);
    }
    btn.style.opacity = '1';
  }

  async function uploadPortfolioFiles(files) {
    const portfolio = profileData?.workerProfile?.portfolio || [];
    const remaining = 10 - portfolio.length;
    if (remaining <= 0) { say('Max 10 portfolio items'); return; }
    const toUpload = Array.from(files).slice(0, remaining);
    for (const file of toUpload) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const result = unwrap(await api('/uploads/portfolio', { method: 'POST', body: fd }));
        portfolio.push({ url: result.url, name: result.name || file.name });
      } catch (e) {
        say('Upload failed: ' + file.name);
      }
    }
    profileData.workerProfile.portfolio = portfolio;
    renderPortfolio(portfolio);
    say(portfolio.length + ' portfolio items');
  }

  function initProfilePage() {
    if (document.body.dataset.page !== 'profile.html') return;

    const avatarInput = getEl('avatarInput');
    const avatarWrap = getEl('avatarWrap');
    if (avatarWrap) {
      avatarWrap.addEventListener('click', () => avatarInput?.click());
    }
    if (avatarInput) {
      avatarInput.addEventListener('change', (e) => {
        if (e.target.files?.[0]) uploadAvatar(e.target.files[0]);
      });
    }

    const saveBtn = getEl('saveBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveProfile);
    }

    const categoryContainer = getEl('categoryChips');
    if (categoryContainer) {
      categoryContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        const cat = chip.dataset.cat;
        const selected = profileData?.workerProfile?.categories || [];
        const idx = selected.indexOf(cat);
        if (idx >= 0) {
          selected.splice(idx, 1);
          chip.classList.remove('selected');
        } else if (selected.length < 3) {
          selected.push(cat);
          chip.classList.add('selected');
        } else {
          say('Max 3 categories');
        }
      });
    }

    const skillsField = getEl('skillsField');
    if (skillsField) {
      skillsField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
          e.preventDefault();
          const text = skillsField.value.trim();
          if (!text) return;
          const skills = profileData?.workerProfile?.skills || [];
          if (skills.includes(text)) { say('Already added'); return; }
          skills.push(text);
          profileData.workerProfile.skills = skills;
          renderSkills(skills);
          skillsField.value = '';
        }
      });
    }

    document.addEventListener('click', (e) => {
      const removeTag = e.target.closest('.tag .remove');
      if (removeTag && removeTag.dataset.skill) {
        const skills = profileData?.workerProfile?.skills || [];
        const idx = skills.indexOf(removeTag.dataset.skill);
        if (idx >= 0) skills.splice(idx, 1);
        renderSkills(skills);
      }
      const removePortfolio = e.target.closest('[data-portfolio-index]');
      if (removePortfolio) {
        const idx = parseInt(removePortfolio.dataset.portfolioIndex);
        const portfolio = profileData?.workerProfile?.portfolio || [];
        if (idx >= 0 && idx < portfolio.length) {
          portfolio.splice(idx, 1);
          renderPortfolio(portfolio);
        }
      }
    });

    const dropZone = getEl('portfolioDrop');
    const portfolioInput = getEl('portfolioInput');
    if (dropZone) {
      dropZone.addEventListener('click', () => portfolioInput?.click());
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent2)'; });
      dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '';
        if (e.dataTransfer.files.length) uploadPortfolioFiles(e.dataTransfer.files);
      });
    }
    if (portfolioInput) {
      portfolioInput.addEventListener('change', (e) => {
        if (e.target.files.length) uploadPortfolioFiles(e.target.files);
        e.target.value = '';
      });
    }

    const publicToggle = getEl('publicToggle');
    if (publicToggle) {
      publicToggle.addEventListener('click', () => {
        const isPublic = !publicToggle.classList.contains('on');
        publicToggle.classList.toggle('on', isPublic);
        if (profileData) profileData.workerProfile.isPublic = isPublic;
      });
    }

    const cancelBtn = getEl('cancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (profileData) populateProfileForm(profileData);
        cancelBtn.style.display = 'none';
      });
    }
  }

  async function hydrateProfileStore() {
    if (document.body.dataset.page !== 'profile.html' || !token()) return;
    try {
      const items = unwrap(await api('/store/my-products'));
      const list = Array.isArray(items) ? items : [];
      if (!list.length) return;
      const page = document.querySelector('.page');
      if (!page) return;
      const section = document.createElement('div');
      section.style.marginTop = '28px';
      section.innerHTML = '<h3 style="font-family:Outfit;margin:0 0 14px"><i class="ti ti-building-store"></i> My Store Products</h3>';
      const grid = document.createElement('div');
      grid.className = 'grid cols-3';
      grid.innerHTML = list.map(item => `
        <article class="card">
          ${item.imageUrl ? `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" style="width:100%;height:140px;object-fit:cover;border-radius:8px;margin-bottom:8px;background:var(--bg2)" loading="lazy" onerror="this.style.display='none'">` : ''}
          <h4 style="margin:0">${escapeHtml(item.name)}</h4>
          <p class="muted small">${money(item.price, item.currency || 'NGN')}</p>
        </article>
      `).join('');
      section.appendChild(grid);
      page.appendChild(section);
    } catch (e) {}
  }

  async function hydrateProfile() {
    if (document.body.dataset.page !== 'profile.html' || !token()) return;
    try {
      const profile = unwrap(await api('/users/me'));
      updateUserChrome(profile);
      populateProfileForm(profile);
      getEl('saveBtn').disabled = false;
      hydrateProfileStore();
    } catch (e) {
      say('Failed to load profile: ' + e.message);
    }
  }

  async function hydrateBlog() {
    if (document.body.dataset.page !== 'blog.html') return;
    const grid = document.getElementById('blogGrid')
    const pagination = document.getElementById('blogPagination')
    if (!grid) return
    const url = new URL(location.href)
    const params = new URLSearchParams(url.search)
    const category = params.get('category') || 'All'
    const search = params.get('search') || ''
    const page = params.get('page') || '1'
    const chips = document.querySelectorAll('.filter-chip')
    chips.forEach(chip => chip.classList.toggle('active', chip.dataset.category === category))
    const searchInput = document.getElementById('blogSearch')
    if (searchInput) searchInput.value = search
    grid.innerHTML = '<article class="card"><p class="muted">Loading posts...</p></article>'
    try {
      const qs = `?page=${page}&limit=12${category !== 'All' ? '&category=' + encodeURIComponent(category) : ''}${search ? '&search=' + encodeURIComponent(search) : ''}`
      const data = unwrap(await api('/blog' + qs))
      const posts = Array.isArray(data.posts) ? data.posts : []
      if (!posts.length) {
        grid.innerHTML = '<article class="card"><p class="muted">No posts found.</p></article>'
        pagination.innerHTML = ''
        return
      }
      grid.innerHTML = posts.map(post => {
        const authorName = post.author ? [post.author.firstName, post.author.lastName].filter(Boolean).join(' ') || post.author.username || 'OgaPay' : 'OgaPay'
        const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''
        const tags = post.tags ? (() => { try { return JSON.parse(post.tags) } catch (e) { return [] } })() : []
        const coverStyle = post.coverImage ? '' : `style="background:${post.coverColor || '#191C6B'};display:flex;align-items:center;justify-content:center;font-size:40px;color:rgba(255,255,255,.3)"`
        const coverContent = post.coverImage ? `<img class="blog-card-cover" src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}" loading="lazy" onerror="this.style.display='none'">` : `<div class="blog-card-cover" ${coverStyle}><i class="ti ti-news"></i></div>`
        return `<article class="blog-card" onclick="location.href='blog-post.html?slug=${encodeURIComponent(post.slug)}'" style="cursor:pointer">
          ${coverContent}
          <div class="blog-card-body">
            <span class="badge">${escapeHtml(post.category || 'General')}</span>
            ${tags.length ? tags.map(t => `<span class="badge" style="font-size:10px">${escapeHtml(t)}</span>`).join('') : ''}
            <h3>${escapeHtml(post.title)}</h3>
            <p>${escapeHtml(post.excerpt || '')}</p>
          </div>
          <div class="blog-card-footer">
            <span><i class="ti ti-user"></i>${escapeHtml(authorName)}</span>
            <span><i class="ti ti-calendar"></i>${escapeHtml(date)}</span>
            <span><i class="ti ti-eye"></i>${post.viewCount || 0}</span>
          </div>
        </article>`
      }).join('')
      const totalPages = data.totalPages || 1
      const currentPage = data.page || 1
      let pagesHtml = ''
      pagesHtml += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}><i class="ti ti-chevron-left"></i></button>`
      for (let i = 1; i <= totalPages; i++) {
        pagesHtml += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`
      }
      pagesHtml += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}><i class="ti ti-chevron-right"></i></button>`
      pagination.innerHTML = pagesHtml
    } catch (e) {
      grid.innerHTML = '<article class="card"><p class="muted">Failed to load posts.</p></article>'
    }
  }

  async function hydrateBlogPost() {
    if (document.body.dataset.page !== 'blog-post.html') return;
    const container = document.getElementById('postContent')
    if (!container) return
    const params = new URLSearchParams(location.search)
    const slug = params.get('slug')
    if (!slug) {
      container.innerHTML = '<article class="card"><p class="muted">No post specified.</p></article>'
      return
    }
    container.innerHTML = '<article class="card"><p class="muted">Loading post...</p></article>'
    try {
      const post = unwrap(await api('/blog/' + encodeURIComponent(slug)))
      if (!post) throw new Error('Not found')
      document.title = escapeHtml(post.title) + ' - OgaPay Blog'
      const authorName = post.author ? [post.author.firstName, post.author.lastName].filter(Boolean).join(' ') || post.author.username || 'OgaPay' : 'OgaPay'
      const date = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''
      const tags = post.tags ? (() => { try { return JSON.parse(post.tags) } catch (e) { return [] } })() : []
      const coverHtml = post.coverImage
        ? `<img class="post-cover" src="${escapeHtml(post.coverImage)}" alt="${escapeHtml(post.title)}" style="max-height:420px;object-fit:cover" loading="lazy">`
        : `<div class="post-cover" style="height:240px;border-radius:var(--radius);background:${post.coverColor || '#191C6B'};display:flex;align-items:center;justify-content:center;font-size:60px;color:rgba(255,255,255,.2);margin-bottom:24px"><i class="ti ti-news"></i></div>`
      container.innerHTML = `
        ${coverHtml}
        <div style="margin-bottom:16px"><span class="badge">${escapeHtml(post.category || 'General')}</span></div>
        <h1 class="post-title">${escapeHtml(post.title)}</h1>
        <div class="post-meta">
          <span><i class="ti ti-user"></i>${escapeHtml(authorName)}</span>
          <span class="dot"></span>
          <span><i class="ti ti-calendar"></i>${escapeHtml(date)}</span>
          <span class="dot"></span>
          <span><i class="ti ti-eye"></i>${post.viewCount || 0} views</span>
        </div>
        ${post.excerpt ? `<p style="color:var(--text2);font-size:17px;line-height:1.6;margin:0 0 24px;padding:16px 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)">${escapeHtml(post.excerpt)}</p>` : ''}
        <div class="post-content">${post.content || ''}</div>
        ${tags.length ? `<div class="post-tags">${tags.map(t => `<span class="badge">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      `
    } catch (e) {
      container.innerHTML = '<article class="card"><p class="muted">Post not found.</p></article>'
    }
  }

  window.OgaPayLive = { API_BASE, api, unwrap, saveSession, setAuthState, money };

  document.addEventListener('DOMContentLoaded', () => {
    bindActions();
    initProfilePage();
    initBlogPage();
    hydrateAuth()
      .finally(() => Promise.allSettled([
        hydrateTasks(),
        hydrateDashboard(),
        hydrateWallet(),
        hydrateCommunities(),
        hydrateStore(),
        hydrateLeaderboard(),
        hydrateProfile(),
        hydrateKyc(),
        hydrateNotifications(),
        hydrateMyTasks(),
        hydrateReferrals(),
        hydrateAnalytics(),
        hydrateBlog(),
        hydrateBlogPost(),
      ]));
  });
})();
