(function () {
  'use strict';

  var page = window.location.pathname.split('/').pop() || 'index.html';

  // ── Inject CSS once ──────────────────────
  if (!document.getElementById('og-nav-style')) {
    var style = document.createElement('style');
    style.id = 'og-nav-style';
    style.textContent = [
      ':root{--nav-h:62px}',
      '.og-skip{position:absolute;top:-100px;left:8px;z-index:9999;background:var(--accent);color:#fff;padding:8px 16px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none}',
      '.og-skip:focus{top:8px}',
      '',
      '/* Top Nav */',
      '.og-nav{position:sticky;top:0;z-index:1000;height:var(--nav-h);background:rgba(255,255,255,.94);border-bottom:1px solid var(--border);backdrop-filter:blur(18px) saturate(1.4)}',
      '[data-theme="dark"] .og-nav{background:rgba(8,11,19,.92)}',
      '.og-nav-inner{height:100%;display:flex;align-items:center;justify-content:space-between;width:min(1280px,calc(100% - 32px));margin:0 auto;gap:16px}',
      '.og-brand{display:flex;align-items:center;gap:10px;font-family:"Outfit",sans-serif;font-weight:800;font-size:19px;color:var(--text);text-decoration:none;flex-shrink:0}',
      '.og-logo{width:34px;height:34px;border-radius:9px;background:var(--primary);color:var(--bg);display:grid;place-items:center;font-size:18px;flex-shrink:0}',
      '.og-nav-links{display:flex;align-items:center;gap:2px;flex:1;justify-content:center}',
      '.og-nav-link{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;border-radius:8px;color:var(--text2);font-size:14px;font-weight:700;text-decoration:none;transition:all .15s;white-space:nowrap}',
      '.og-nav-link:hover,.og-nav-link.active{background:var(--bg2);color:var(--text)}',
      '.og-nav-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}',
      '.og-theme-btn{width:36px;height:36px;border:1.5px solid var(--border);border-radius:8px;background:var(--card);color:var(--text2);display:grid;place-items:center;cursor:pointer;transition:all .15s;font-size:18px}',
      '.og-theme-btn:hover{color:var(--text);background:var(--bg2)}',
      '.og-login-btn{height:36px;padding:0 18px;border:1.5px solid var(--border);border-radius:8px;background:var(--card);color:var(--text);font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;text-decoration:none;transition:all .15s}',
      '.og-login-btn:hover{border-color:var(--border2);box-shadow:0 2px 8px rgba(16,21,37,.05)}',
      '.og-cta-btn{height:36px;padding:0 18px;border:none;border-radius:999px;background:var(--accent);color:#fff;font-size:13px;font-weight:800;display:inline-flex;align-items:center;gap:6px;text-decoration:none;transition:all .2s}',
      '.og-cta-btn:hover{box-shadow:0 4px 20px rgba(124,58,237,.35);transform:translateY(-1px)}',
      '.og-menu-btn{width:36px;height:36px;border:1.5px solid var(--border);border-radius:8px;background:var(--card);color:var(--text2);display:none;place-items:center;cursor:pointer;transition:all .15s;font-size:18px}',
      '.og-menu-btn:hover{color:var(--text);background:var(--bg2)}',
      '',
      '/* Layout */',
      '.og-layout{display:flex;min-height:calc(100vh - var(--nav-h))}',
      '.og-main{flex:1;min-width:0;width:100%}',
      '',
      '/* Sidebar */',
      '.og-sidebar{width:230px;position:sticky;top:var(--nav-h);height:calc(100vh - var(--nav-h));border-right:1px solid var(--border);background:var(--bg);display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;transition:width .25s,margin .25s}',
      '.og-sidebar.collapsed{width:0;margin-left:-230px;overflow:hidden;border-right-color:transparent}',
      '.og-sidebar-wrap{position:relative;display:flex;flex-direction:column;height:100%;min-width:230px}',
      '.og-sidebar-scroll{flex:1;overflow-y:auto;padding:12px 8px 8px}',
      '.og-sidebar-section{padding:14px 10px 5px;color:var(--text3);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px}',
      '.og-sidebar-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:9px;color:var(--text2);font-size:13.5px;font-weight:700;text-decoration:none;transition:all .15s}',
      '.og-sidebar-item:hover,.og-sidebar-item.active{background:var(--bg2);color:var(--text)}',
      '.og-sidebar-icon{width:30px;height:30px;border:1px solid var(--border);border-radius:8px;background:var(--bg2);display:grid;place-items:center;color:var(--text3);flex-shrink:0}',
      '.og-sidebar-icon i{font-size:16px}',
      '.og-sidebar-footer{padding:10px 8px 14px;border-top:1px solid var(--border)}',
      '.og-sidebar-login{display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;border-radius:999px;background:var(--accent);color:#fff;font-weight:800;font-size:13px;text-decoration:none;transition:all .2s}',
      '.og-sidebar-login:hover{opacity:.92}',
      '.og-sidebar-toggle{position:absolute;top:12px;right:-14px;width:28px;height:28px;border:1px solid var(--border);border-radius:50%;background:var(--card);color:var(--text2);display:grid;place-items:center;cursor:pointer;z-index:5;transition:all .2s;box-shadow:0 2px 8px rgba(16,21,37,.05)}',
      '.og-sidebar-toggle:hover{color:var(--text);border-color:var(--border2)}',
      '.og-sidebar.collapsed .og-sidebar-toggle{right:-14px;transform:rotate(180deg)}',
      '',
      '/* Drawer */',
      '.og-drawer-overlay{position:fixed;inset:0;z-index:1999;background:rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .3s}',
      '.og-drawer-overlay.show{opacity:1;pointer-events:auto}',
      '.og-drawer{position:fixed;top:0;right:0;width:300px;height:100dvh;z-index:2000;background:var(--card);border-left:1px solid var(--border);transform:translateX(100%);transition:transform .3s;overflow-y:auto}',
      '.og-drawer.open{transform:translateX(0)}',
      '.og-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:20px 16px 8px}',
      '.og-drawer-body{padding:8px 16px 24px}',
      '.og-drawer-section{padding:14px 8px 5px;color:var(--text3);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.4px}',
      '.og-drawer-link{display:flex;align-items:center;gap:10px;padding:10px 8px;border-radius:9px;color:var(--text2);font-size:14px;font-weight:700;text-decoration:none}',
      '.og-drawer-link:hover,.og-drawer-link.active{background:var(--bg2);color:var(--text)}',
      '.og-drawer-link i{width:20px;text-align:center}',
      '',
      '/* Mobile bottom nav */',
      '.og-mobile-nav{display:none;position:fixed;bottom:0;left:0;right:0;z-index:500;height:64px;background:var(--card);border-top:1px solid var(--border);justify-content:space-around;align-items:center;padding:0 6px 6px}',
      '.og-mobile-nav a{display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;border-radius:8px;color:var(--text3);font-size:10px;font-weight:600;text-decoration:none;transition:all .15s;min-width:48px}',
      '.og-mobile-nav a:hover,.og-mobile-nav a.active{color:var(--accent)}',
      '.og-mobile-nav a svg{width:22px;height:22px}',
      '.og-mobile-nav .create-btn{width:44px;height:44px;border-radius:50%;background:var(--accent);color:#fff;display:grid;place-items:center;margin-top:-12px;box-shadow:0 4px 16px rgba(124,58,237,.3)}',
      '.og-mobile-nav .create-btn svg{width:22px;height:22px}',
      '',
      '@media(max-width:1024px){.og-sidebar{width:200px}}',
      '@media(max-width:768px){.og-nav-links{display:none}.og-menu-btn{display:grid}.og-sidebar{display:none}.og-mobile-nav{display:flex}.og-login-btn{display:none}.og-nav-inner{width:calc(100% - 16px)}}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Helpers ──────────────────────────────
  function a(label, href, icon, active) {
    var act = active ? ' active' : '';
    if (href === page) act = ' active';
    return '<a href="' + href + '" class="og-nav-link' + act + '"><i class="' + icon + '"></i>' + label + '</a>';
  }
  function sa(label, href, icon, active) {
    var act = active ? ' active' : '';
    if (href === page) act = ' active';
    return '<a href="' + href + '" class="og-sidebar-item' + act + '"><span class="og-sidebar-icon"><i class="' + icon + '"></i></span>' + label + '</a>';
  }
  function da(label, href, icon, active) {
    var act = active ? ' active' : '';
    if (href === page) act = ' active';
    return '<a href="' + href + '" class="og-drawer-link' + act + '"><i class="' + icon + '"></i>' + label + '</a>';
  }

  // ── Build HTML strings ───────────────────
  var navHTML = [
    '<nav class="og-nav" role="navigation" aria-label="Main">',
      '<a href="#og-main-content" class="og-skip">Skip to content</a>',
      '<div class="og-nav-inner">',
        '<a href="index.html" class="og-brand"><span class="og-logo">O</span>OgaPay</a>',
        '<div class="og-nav-links">',
          a('Home','index.html','ti ti-home'),
          a('Tasks','tasks.html','ti ti-briefcase'),
          a('Deals','store.html','ti ti-discount-2'),
          a('Communities','communities.html','ti ti-users-group'),
          a('FAQ','faq.html','ti ti-help-circle'),
        '</div>',
        '<div class="og-nav-actions">',
          '<button class="og-theme-btn" id="ogThemeBtn" aria-label="Toggle theme"><i class="ti ti-sun"></i></button>',
          '<a href="login.html" class="og-login-btn"><i class="ti ti-login"></i>Login</a>',
          '<a href="login.html?signup=1" class="og-cta-btn">Get Started <i class="ti ti-arrow-right"></i></a>',
          '<button class="og-menu-btn" id="ogMenuBtn" aria-label="Open menu"><i class="ti ti-menu-2"></i></button>',
        '</div>',
      '</div>',
    '</nav>',
  ].join('\n');

  var sidebarHTML = [
    '<aside class="og-sidebar" id="ogSidebar" role="navigation" aria-label="Side">',
      '<div class="og-sidebar-wrap">',
        '<button class="og-sidebar-toggle" id="ogSidebarToggle" aria-label="Toggle sidebar"><i class="ti ti-chevron-left"></i></button>',
        '<div class="og-sidebar-scroll">',
          '<div class="og-sidebar-section">Tasks</div>',
          sa('Browse All Tasks','tasks.html','ti ti-briefcase'),
          sa('Job Monitor','monitor.html','ti ti-eye'),
          '<div class="og-sidebar-section">Deals</div>',
          sa('Blog','blog.html','ti ti-news'),
          sa('Vault','vault.html','ti ti-building-bank'),
          '<div class="og-sidebar-section">Resources</div>',
          sa('FAQ','faq.html','ti ti-help-circle'),
          sa('Support','support.html','ti ti-headset'),
        '</div>',
        '<div class="og-sidebar-footer">',
          '<a href="login.html" class="og-sidebar-login"><i class="ti ti-login"></i> Login</a>',
        '</div>',
      '</div>',
    '</aside>',
  ].join('\n');

  var drawerHTML = [
    '<div class="og-drawer-overlay" id="ogDrawerOverlay"></div>',
    '<aside class="og-drawer" id="ogDrawer" role="dialog" aria-label="Menu">',
      '<div class="og-drawer-head">',
        '<a class="og-brand" href="index.html"><span class="og-logo">O</span>OgaPay</a>',
        '<button class="og-theme-btn" id="ogDrawerClose" style="border:none;background:transparent;font-size:20px"><i class="ti ti-x"></i></button>',
      '</div>',
      '<div class="og-drawer-body">',
        '<div class="og-drawer-section">Navigate</div>',
        da('Home','index.html','ti ti-home'),
        da('Tasks','tasks.html','ti ti-briefcase'),
        da('Deals','store.html','ti ti-discount-2'),
        da('Communities','communities.html','ti ti-users-group'),
        da('FAQ','faq.html','ti ti-help-circle'),
        '<div class="og-drawer-section">Tasks</div>',
        da('Browse All Tasks','tasks.html','ti ti-briefcase'),
        da('Job Monitor','monitor.html','ti ti-eye'),
        '<div class="og-drawer-section">Deals</div>',
        da('Blog','blog.html','ti ti-news'),
        da('Vault','vault.html','ti ti-building-bank'),
        '<div class="og-drawer-section">Resources</div>',
        da('FAQ','faq.html','ti ti-help-circle'),
        da('Support','support.html','ti ti-headset'),
        '<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px">',
          '<a href="login.html" class="og-login-btn" style="justify-content:center;height:44px"><i class="ti ti-login"></i>Login</a>',
          '<a href="login.html?signup=1" class="og-cta-btn" style="justify-content:center;height:44px">Get Started <i class="ti ti-arrow-right"></i></a>',
        '</div>',
      '</div>',
    '</aside>',
  ].join('\n');

  var mobileNavHTML = [
    '<nav class="og-mobile-nav" aria-label="Mobile">',
      '<a href="index.html"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg><span>Home</span></a>',
      '<a href="tasks.html"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13H4V7Z"/><path d="M9 5V3h6v2M8 11h8"/></svg><span>Tasks</span></a>',
      '<a href="post-task.html" class="create-btn"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></a>',
      '<a href="store.html"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></svg><span>Deals</span></a>',
      '<a href="login.html"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Login</span></a>',
    '</nav>',
  ].join('\n');

  // ── Inject into page ─────────────────────
  function init() {
    // Don't inject twice
    if (document.getElementById('og-nav-injected')) return;
    var marker = document.createElement('meta');
    marker.id = 'og-nav-injected';
    document.head.appendChild(marker);

    // Insert nav at top of body
    var body = document.body;
    var navEl = document.createElement('div');
    navEl.innerHTML = navHTML;
    body.insertBefore(navEl.firstElementChild, body.firstChild);

    // Wrap remaining content in layout + sidebar + main
    var layout = document.createElement('div');
    layout.className = 'og-layout';

    var sidebarEl = document.createElement('div');
    sidebarEl.innerHTML = sidebarHTML;
    layout.appendChild(sidebarEl.firstElementChild);

    var mainEl = document.createElement('main');
    mainEl.className = 'og-main';
    mainEl.id = 'og-main-content';

    // Move all child nodes (except the nav we just added) into main
    var children = Array.from(body.children);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.classList && (child.classList.contains('og-nav') || child.classList.contains('og-mobile-nav') || child.classList.contains('og-drawer') || child.classList.contains('og-drawer-overlay'))) {
        continue; // skip nav, mobile nav, drawer elements
      }
      mainEl.appendChild(child);
    }

    layout.appendChild(mainEl);

    // Also handle ogapay-shell wrapper - if it exists, unwrap its children
    var shell = document.getElementById('ogapay-shell');
    if (shell && mainEl.contains(shell)) {
      var shellChildren = Array.from(shell.children);
      for (var j = 0; j < shellChildren.length; j++) {
        mainEl.insertBefore(shellChildren[j], shell);
      }
      mainEl.removeChild(shell);
    }

    body.insertBefore(layout, body.querySelector('.og-mobile-nav') || null);

    // Append drawer
    var drawerEl = document.createElement('div');
    drawerEl.innerHTML = drawerHTML;
    while (drawerEl.firstChild) {
      body.appendChild(drawerEl.firstChild);
    }

    // Append mobile nav at end
    var mobEl = document.createElement('div');
    mobEl.innerHTML = mobileNavHTML;
    body.appendChild(mobEl.firstElementChild);

    // Add padding-bottom to body for mobile nav
    body.style.paddingBottom = '64px';

    // ── Theme ──
    (function initTheme() {
      var saved;
      try { saved = localStorage.getItem('ogapay-theme'); } catch(e) {}
      var theme = saved || document.documentElement.getAttribute('data-theme') || 'light';
      document.documentElement.setAttribute('data-theme', theme);
      var el = document.querySelector('#ogThemeBtn i');
      if (el) el.className = theme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
    })();

    document.getElementById('ogThemeBtn')?.addEventListener('click', function() {
      var h = document.documentElement;
      var cur = h.getAttribute('data-theme') || 'light';
      var next = cur === 'dark' ? 'light' : 'dark';
      h.setAttribute('data-theme', next);
      try { localStorage.setItem('ogapay-theme', next); } catch(e) {}
      var el = document.querySelector('#ogThemeBtn i');
      if (el) el.className = next === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
    });

    // ── Sidebar toggle ──
    document.getElementById('ogSidebarToggle')?.addEventListener('click', function() {
      document.getElementById('ogSidebar')?.classList.toggle('collapsed');
    });

    // ── Drawer ──
    function openDrawer() {
      document.getElementById('ogDrawer')?.classList.add('open');
      document.getElementById('ogDrawerOverlay')?.classList.add('show');
      document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
      document.getElementById('ogDrawer')?.classList.remove('open');
      document.getElementById('ogDrawerOverlay')?.classList.remove('show');
      document.body.style.overflow = '';
    }
    document.getElementById('ogMenuBtn')?.addEventListener('click', openDrawer);
    document.getElementById('ogDrawerOverlay')?.addEventListener('click', closeDrawer);
    document.getElementById('ogDrawerClose')?.addEventListener('click', closeDrawer);
    document.querySelectorAll('.og-drawer-link').forEach(function(el) {
      el.addEventListener('click', closeDrawer);
    });

    // ── Skip link ──
    document.querySelector('.og-skip')?.addEventListener('click', function(e) {
      e.preventDefault();
      var m = document.getElementById('og-main-content');
      if (m) { m.setAttribute('tabindex', '-1'); m.focus(); setTimeout(function() { m.removeAttribute('tabindex'); }, 100); }
    });
  }

  // ── Run ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
