(function () {
  'use strict';

  const API_BASE = (window.OGAPAY_API_BASE || localStorage.getItem('ogapay_api_base') || 'https://ogapay-production.up.railway.app/api/v1').replace(/\/$/, '');
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

  async function hydrateHome() {
    if (document.body.dataset.page !== 'index.html') return;
    try {
      const data = unwrap(await api('/tasks?limit=3'));
      const tasks = Array.isArray(data) ? data : (data.tasks || []);

      const counters = document.querySelectorAll('.analytics-card .stat strong, .platform-card .stat strong');
      if (counters[0]) counters[0].textContent = String(tasks.length);
      if (counters[1]) counters[1].textContent = money(tasks.reduce((sum, task) => sum + Number(task.reward || 0), 0), tasks[0]?.currency || 'NGN');
      if (counters[2]) counters[2].textContent = String(tasks.reduce((sum, task) => sum + Number(task.currentWorkers || 0), 0));

      const track = document.querySelector('.jobs-track');
      if (!track || !tasks.length) return;

      track.innerHTML = tasks.map((task) => {
        const maxWorkers = Number(task.maxWorkers || 1);
        const currentWorkers = Number(task.currentWorkers || 0);
        const openWorkers = Math.max(maxWorkers - currentWorkers, 0);
        const percent = Math.min(Math.round((currentWorkers / maxWorkers) * 100), 100);
        const category = task.category || 'Task';
        const poster = task.poster?.username || task.poster?.firstName || 'OgaPay';
        const initialsText = initials(task.poster || { firstName: poster, lastName: category });
        return `
          <article class="job-card">
            <div class="job-top"><div class="avatar">${escapeHtml(initialsText)}</div><div><div class="listed">Listed by</div><div class="job-name">${escapeHtml(poster)}</div></div></div>
            <div class="job-body">
              <span class="category-pill">${escapeHtml(category.replace(/_/g, ' '))}</span>
              <div class="progress-line"><span>Progress</span><strong>${currentWorkers}/${maxWorkers}</strong></div>
              <div class="progress ${percent >= 60 ? 'good' : 'warn'}"><span style="width:${percent}%"></span></div>
              <div class="dot-indicators"><span><span class="dot dot-green"></span>Submissions ${currentWorkers}</span><span><span class="dot dot-yellow"></span>Open ${openWorkers}</span><span><span class="dot dot-blue"></span>Status ${escapeHtml(task.status || 'OPEN')}</span></div>
              <div class="reward"><div><strong>${money(task.reward, task.currency)}</strong><small>PER COMPLETION</small></div></div>
              <div class="job-tags">${escapeHtml([category, ...(task.tags || [])].filter(Boolean).join(' | '))}</div>
              <div class="about"><div class="about-head"><span class="about-left">About this task</span><span class="about-timer">~${task.estimatedTime || 5} min</span></div><p>${escapeHtml(task.description || task.instructions || 'Complete this task and submit proof.')}</p></div>
              <a class="job-cta" href="tasks.html">View Task</a>
            </div>
          </article>
        `;
      }).join('');
    } catch (e) {}
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

  async function hydrateStore() {
    if (document.body.dataset.page !== 'store.html') return;
    const grid = document.querySelector('.grid.cols-3');
    if (!grid) return;
    try {
      const data = unwrap(await api('/store?limit=12'));
      const items = Array.isArray(data) ? data : [];
      if (!items.length) return;
      grid.innerHTML = items.map((item) => `
        <article class="card">
          <div class="row space"><span class="badge">${escapeHtml(item.category || 'Deal')}</span><span class="badge">${money(item.price, item.currency || 'NGN')}</span></div>
          <h3>${escapeHtml(item.name)}</h3>
          <p class="muted">${escapeHtml(item.description || 'Available in the OgaPay store.')}</p>
          <button class="btn primary" data-live-buy="${item.id}"><i class="ti ti-shopping-cart"></i>Buy</button>
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
        <tr><td>#${w.rank}</td><td>${escapeHtml(w.user?.username || w.user?.firstName || 'Worker')}</td><td>${money(w.totalEarned, 'NGN')}</td><td>${w.tasksCompleted || 0}</td></tr>
      `).join('');
    } catch (e) {}
  }

  async function hydrateProfile() {
    if (document.body.dataset.page !== 'profile.html' || !token()) return;
    try {
      const profile = unwrap(await api('/users/me'));
      updateUserChrome(profile);
      document.querySelectorAll('h1').forEach((h1) => {
        if (/profile/i.test(h1.textContent)) h1.textContent = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.username || 'My Profile';
      });
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

  function bindActions() {
    document.addEventListener('click', async (event) => {
      const apply = event.target.closest('[data-live-apply]');
      const join = event.target.closest('[data-live-join]');
      const buy = event.target.closest('[data-live-buy]');
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
        if (buy) {
          if (!token()) return location.href = 'login.html';
          await api(`/store/${buy.dataset.liveBuy}/purchase`, { method: 'POST', body: JSON.stringify({ quantity: 1 }) });
          say('Purchase successful');
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

  window.OgaPayLive = { API_BASE, api, unwrap, saveSession, setAuthState, money };

  document.addEventListener('DOMContentLoaded', () => {
    bindActions();
    hydrateAuth()
      .finally(() => Promise.allSettled([
        hydrateTasks(),
        hydrateHome(),
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
      ]));
  });
})();
