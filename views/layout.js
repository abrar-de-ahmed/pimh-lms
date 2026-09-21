'use strict';
const { esc } = require('../lib/http-helpers');

const ICONS = {
  dashboard: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="6" height="7" rx="1"/><rect x="10" y="2" width="6" height="4" rx="1"/><rect x="10" y="8" width="6" height="8" rx="1"/><rect x="2" y="11" width="6" height="5" rx="1"/></svg>',
  courses: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4 h6 a2 2 0 0 1 2 2 v9 a2 2 0 0 0 -2 -2 H2 Z"/><path d="M16 4 h-6 a2 2 0 0 0 -2 2 v9 a2 2 0 0 1 2 -2 h6 Z"/></path></svg>',
  materials: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4.5 2.5h6l3 3v10a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-12a1 1 0 0 1 1-1Z"/><path d="M10.5 2.5v3h3"/></svg>',
  schedule: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="3" width="13" height="12" rx="1.5"/><path d="M2.5 7 h13"/><path d="M6 2 v3 M12 2 v3"/></svg>',
  grades: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="2.5" width="13" height="13" rx="1.5"/><path d="M6 9 l2 2 l4 -4.5"/></svg>',
  discussion: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 3.5 h13 v8 h-9 l-4 3 v-3 h0 v-8Z"/></svg>',
  announcements: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2.5 7 h4 l6 -4 v11 l-6 -4 h-4 Z"/><path d="M8 12 l1 3"/></svg>',
  notifications: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 2 a4 4 0 0 0 -4 4 v3 l-1.5 3 h11 L13 9 V6 a4 4 0 0 0 -4 -4 Z"/><path d="M7 15 a2 2 0 0 0 4 0"/></svg>',
  certificates: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="6.5" r="4"/><path d="M6.5 10 L5 16 l3.5 -1.5 L12 16 l-1.5 -6"/></svg>',
  profile: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="6" r="3"/><path d="M3 16 c0 -3.5 3 -5.5 6 -5.5 s6 2 6 5.5"/></svg>',
  users: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6" r="2.6"/><path d="M2 15 c0 -3 2 -4.6 4.5 -4.6 s4.5 1.6 4.5 4.6"/><circle cx="13" cy="6.5" r="2" opacity="0.6"/><path d="M12 9.6 c1.9 0.2 3.2 1.7 3.2 4.4" opacity="0.6"/></svg>',
  enrollment: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2.5" y="2.5" width="13" height="13" rx="1.5"/><path d="M6 9 l2 2 l4 -4.5"/></svg>',
  faculty: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2.5" width="10" height="13" rx="2"/><circle cx="9" cy="7.3" r="2"/><path d="M6 12.4 c0 -1.8 1.3 -2.8 3 -2.8 s3 1 3 2.8"/></svg>',
  activity: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="6.5"/><path d="M9 5.5 v4 l3 2"/></svg>',
  settings: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="2.6"/><path d="M9 2.5 v2 M9 14.5 v2 M2.5 9 h2 M14.5 9 h2 M4.5 4.5 l1.4 1.4 M12.1 12.1 l1.4 1.4 M13.5 4.5 l-1.4 1.4 M5.9 12.1 l-1.4 1.4"/></svg>',
  roster: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="6.5" cy="6" r="2.6"/><path d="M2 15 c0 -3 2 -4.6 4.5 -4.6 s4.5 1.6 4.5 4.6"/><circle cx="13" cy="6.5" r="2" opacity="0.6"/><path d="M12 9.6 c1.9 0.2 3.2 1.7 3.2 4.4" opacity="0.6"/></svg>',
};

function page({ title, bodyClass, headExtra, bodyHtml, bootJson, clientScripts }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
${headExtra || ''}
</head>
<body class="${bodyClass || ''}">
${bodyHtml}
${bootJson !== undefined ? `<script>window.__BOOT__ = ${JSON.stringify(bootJson).replace(/</g, '\\u003c')};</script>` : ''}
${(clientScripts || []).map((s) => `<script src="${s}"></script>`).join('\n')}
</body>
</html>`;
}

function sidebarLink(view, label, icon, extra) {
  return `<a class="sb-link" data-view="${view}">${ICONS[icon] || ''}${esc(label)}${extra || ''}</a>`;
}

function shell({ user, brandRole, brandGold, links, pageTitleDefault }) {
  const initials = user.initials;
  const avatarStyle = user.avatarUrl ? `background-image:url('${user.avatarUrl}'); background-size:cover;` : '';
  return `
<div class="app">
  <div class="overlay" id="overlay"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sb-brand${brandGold ? ' gold' : ''}">
      PIMH <span>Academy</span>
      <span class="sb-role">${esc(brandRole)}</span>
      <button class="sb-close" id="sbClose">&#10005;</button>
    </div>
    <nav class="sb-nav" id="sbNav">
      ${links}
    </nav>
    <div class="sb-foot">LMS System PIMH<br><span class="sb-credit">By CraftedMindss</span></div>
  </aside>
  <div class="main">
    <div class="topbar">
      <div style="display:flex; align-items:center; gap:14px;">
        <button class="menu-toggle" id="menuToggle">
          <svg width="22" height="22" viewBox="0 0 22 22"><path d="M3 6 h16 M3 11 h16 M3 16 h16" stroke="#1B2A2E" stroke-width="1.6"/></svg>
        </button>
        <h1 id="pageTitle">${esc(pageTitleDefault)}</h1>
      </div>
      <div class="tb-right">
        <div class="tb-name">${esc(user.name)}<small>${esc(user.title || user.role)}</small></div>
        <div class="tb-avatar${brandGold ? ' gold' : ''}" id="tbAvatar" style="${avatarStyle}">${user.avatarUrl ? '' : esc(initials)}</div>
        <button class="tb-logout" id="logoutBtn">Log out</button>
      </div>
    </div>
    <div class="content" id="content"></div>
  </div>
</div>
<div class="toast" id="toast"></div>
`;
}

module.exports = { page, sidebarLink, shell, ICONS };
