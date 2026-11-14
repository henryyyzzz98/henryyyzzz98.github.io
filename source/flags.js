// ---------- Flag pictures (drawn in SVG, so they work offline and on Windows) ----------
// Windows can't draw flag emoji (it shows letters like "CH"), so every flag is drawn here.
const FLAG_SVG = (() => {
  const W = 60, H = 40;
  const hs = (...c) => c.map((col, i) => `<rect y="${i * H / c.length}" width="${W}" height="${H / c.length + 0.3}" fill="${col}"/>`).join('');
  const vs = (...c) => c.map((col, i) => `<rect x="${i * W / c.length}" width="${W / c.length + 0.3}" height="${H}" fill="${col}"/>`).join('');
  const nordic = (bg, cr, inner) => `<rect width="60" height="40" fill="${bg}"/><rect x="16" width="10" height="40" fill="${cr}"/><rect y="15" width="60" height="10" fill="${cr}"/>${inner ? `<rect x="18.5" width="5" height="40" fill="${inner}"/><rect y="17.5" width="60" height="5" fill="${inner}"/>` : ''}`;
  const star = (cx, cy, r, col, rot = 0) => { let p = ''; for (let i = 0; i < 10; i++) { const a = (i * 36 + rot - 90) * Math.PI / 180, rr = i % 2 ? r * 0.4 : r; p += (cx + Math.cos(a) * rr).toFixed(2) + ',' + (cy + Math.sin(a) * rr).toFixed(2) + ' '; } return `<polygon points="${p}" fill="${col}"/>`; };
  const ujack = (w, h) => `<svg width="${w}" height="${h}" viewBox="0 0 60 40" preserveAspectRatio="none"><rect width="60" height="40" fill="#012169"/><path d="M0,0 60,40 M60,0 0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 60,40 M60,0 0,40" stroke="#C8102E" stroke-width="2.6"/><path d="M30,0V40M0,20H60" stroke="#fff" stroke-width="12"/><path d="M30,0V40M0,20H60" stroke="#C8102E" stroke-width="7"/></svg>`;
  const crescent = (cx, cy, r, bg, col) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/><circle cx="${cx + r * 0.28}" cy="${cy}" r="${r * 0.8}" fill="${bg}"/>`;
  const F = {
    FR: vs('#0055A4', '#fff', '#EF4135'), IT: vs('#009246', '#fff', '#CE2B37'), IE: vs('#169B62', '#fff', '#FF883E'), BE: vs('#000', '#FAE042', '#ED2939'),
    DE: hs('#000', '#DD0000', '#FFCE00'), NL: hs('#AE1C28', '#fff', '#21468B'), RU: hs('#fff', '#0039A6', '#D52B1E'), HU: hs('#CD2A3E', '#fff', '#436F4D'),
    AT: hs('#ED2939', '#fff', '#ED2939'), EE: hs('#0072CE', '#000', '#fff'), MC: hs('#CE1126', '#fff'), ID: hs('#CE1126', '#fff'), PL: hs('#fff', '#DC143C'),
    LU: hs('#ED2939', '#fff', '#00A1DE'), CO: `<rect width="60" height="20" fill="#FCD116"/><rect y="20" width="60" height="10" fill="#003893"/><rect y="30" width="60" height="10" fill="#CE1126"/>`,
    ES: `<rect width="60" height="40" fill="#AA151B"/><rect y="10" width="60" height="20" fill="#F1BF00"/>`,
    TH: hs('#A51931', '#F4F5F8', '#2D2A4A', '#2D2A4A', '#F4F5F8', '#A51931'),
    RB: vs('#007A3D', '#fff', '#007A3D'), NG: vs('#008751', '#fff', '#008751'),
    SE: nordic('#006AA7', '#FECC00'), DK: nordic('#C8102E', '#fff'), FI: nordic('#fff', '#003580'), NO: nordic('#BA0C2F', '#fff', '#00205B'),
    CH: `<rect width="60" height="40" fill="#DA291C"/><rect x="26" y="9" width="8" height="22" fill="#fff"/><rect x="19" y="16" width="22" height="8" fill="#fff"/>`,
    JP: `<rect width="60" height="40" fill="#fff"/><circle cx="30" cy="20" r="12" fill="#BC002D"/>`,
    GB: `<rect width="60" height="40" fill="#012169"/><path d="M0,0 60,40 M60,0 0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 60,40 M60,0 0,40" stroke="#C8102E" stroke-width="2.6"/><path d="M30,0V40M0,20H60" stroke="#fff" stroke-width="12"/><path d="M30,0V40M0,20H60" stroke="#C8102E" stroke-width="7"/>`,
    US: [...Array(13)].map((_, i) => `<rect y="${i * 40 / 13}" width="60" height="${40 / 13 + 0.2}" fill="${i % 2 ? '#fff' : '#B22234'}"/>`).join('') + `<rect width="26" height="21.5" fill="#3C3B6E"/>` + [...Array(20)].map((_, i) => `<circle cx="${2.6 + (i % 5) * 5.2 + (Math.floor(i / 5) % 2) * 2.6}" cy="${2.6 + Math.floor(i / 5) * 5.3}" r="1" fill="#fff"/>`).join(''),
    CA: `<rect width="60" height="40" fill="#fff"/><rect width="15" height="40" fill="#D80621"/><rect x="45" width="15" height="40" fill="#D80621"/><path fill="#D80621" d="M30 8l2.2 4 2.6-1.2-1 6.2 3.6-3.4.8 2 3.6-.6-1.2 3.8 1.6.8-5.6 4.4.6 2.2-5.2-.8.2 5.4h-2.4l.2-5.4-5.2.8.6-2.2-5.6-4.4 1.6-.8-1.2-3.8 3.6.6.8-2 3.6 3.4-1-6.2 2.6 1.2z"/>`,
    BR: `<rect width="60" height="40" fill="#009C3B"/><polygon points="30,4 56,20 30,36 4,20" fill="#FFDF00"/><circle cx="30" cy="20" r="8.5" fill="#002776"/><path d="M21.8 18.5 Q30 16 38.2 21.5" stroke="#fff" stroke-width="1.4" fill="none"/>`,
    AR: hs('#74ACDF', '#fff', '#74ACDF') + `<circle cx="30" cy="20" r="3.5" fill="#F6B40E"/>`,
    UY: [...Array(9)].map((_, i) => `<rect y="${i * 40 / 9}" width="60" height="${40 / 9 + 0.2}" fill="${i % 2 ? '#0038A8' : '#fff'}"/>`).join('') + `<rect width="22" height="22.2" fill="#fff"/><circle cx="11" cy="11" r="5.5" fill="#FCD116"/>`,
    MX: vs('#006847', '#fff', '#CE1126') + `<circle cx="30" cy="20" r="4.5" fill="#8C5A2B"/><circle cx="30" cy="20" r="2.4" fill="#2E7D32"/>`,
    PT: `<rect width="60" height="40" fill="#FF0000"/><rect width="24" height="40" fill="#006600"/><circle cx="24" cy="20" r="7" fill="#FFCC00"/><circle cx="24" cy="20" r="4.5" fill="#FF0000"/><rect x="21.5" y="16.5" width="5" height="6" rx="1" fill="#fff"/>`,
    AU: `<rect width="60" height="40" fill="#012169"/><g transform="scale(.5)">${'<path d="M0,0 60,40 M60,0 0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 60,40 M60,0 0,40" stroke="#C8102E" stroke-width="2.6"/><path d="M30,0V40M0,20H60" stroke="#fff" stroke-width="12"/><path d="M30,0V40M0,20H60" stroke="#C8102E" stroke-width="7"/>'}</g>` + star(15, 31, 4, '#fff') + star(45, 8, 2, '#fff') + star(39, 18, 2, '#fff') + star(51, 16, 2, '#fff') + star(45, 32, 2, '#fff') + star(48.5, 23, 1.2, '#fff'),
    NZ: `<rect width="60" height="40" fill="#012169"/><g transform="scale(.5)">${'<path d="M0,0 60,40 M60,0 0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 60,40 M60,0 0,40" stroke="#C8102E" stroke-width="2.6"/><path d="M30,0V40M0,20H60" stroke="#fff" stroke-width="12"/><path d="M30,0V40M0,20H60" stroke="#C8102E" stroke-width="7"/>'}</g>` + star(45, 9, 2.8, '#fff') + star(45, 9, 1.9, '#C8102E') + star(39, 19, 2.8, '#fff') + star(39, 19, 1.9, '#C8102E') + star(51, 17, 2.4, '#fff') + star(51, 17, 1.6, '#C8102E') + star(45, 32, 2.9, '#fff') + star(45, 32, 2, '#C8102E'),
    ZA: `<rect width="60" height="40" fill="#fff"/><rect width="60" height="20" fill="#E03C31"/><rect y="20" width="60" height="20" fill="#001489"/><path d="M0,0 L30,20 L0,40 Z" fill="#fff"/><path d="M0,0 L24,16 H60 V24 H24 L0,40Z" fill="#fff"/><path d="M0,3 L22,17.5 H60 V22.5 H22 L0,37Z" fill="#007749"/><path d="M0,6 L18,20 L0,34Z" fill="#FFB81C"/><path d="M0,8.5 L15,20 L0,31.5Z" fill="#000"/>`,
    CN: `<rect width="60" height="40" fill="#EE1C25"/>` + star(10, 10, 6, '#FFFF00') + star(20, 4, 2, '#FFFF00', 20) + star(24, 8, 2, '#FFFF00', 40) + star(24, 13, 2, '#FFFF00') + star(20, 17, 2, '#FFFF00', 20),
    KR: `<rect width="60" height="40" fill="#fff"/><circle cx="30" cy="20" r="10" fill="#0047A0"/><path d="M21.7 14.4 A10 10 0 0 1 38.3 25.6 A5 5 0 0 1 30 20 A5 5 0 0 0 21.7 14.4Z" fill="#CD2E3A"/><g fill="#000"><rect x="8" y="5" width="9" height="1.5" transform="rotate(34 12 6)"/><rect x="8" y="8" width="9" height="1.5" transform="rotate(34 12 9)"/><rect x="43" y="31" width="9" height="1.5" transform="rotate(34 47 32)"/><rect x="43" y="34" width="9" height="1.5" transform="rotate(34 47 35)"/><rect x="43" y="5" width="9" height="1.5" transform="rotate(-34 47 6)"/><rect x="8" y="31" width="9" height="1.5" transform="rotate(-34 12 32)"/></g>`,
    IN: hs('#FF9933', '#fff', '#138808') + `<circle cx="30" cy="20" r="4.6" fill="none" stroke="#000080" stroke-width="1"/><circle cx="30" cy="20" r="1" fill="#000080"/>`,
    TR: `<rect width="60" height="40" fill="#E30A17"/>${crescent(23, 20, 9.5, '#E30A17', '#fff')}` + star(35, 20, 4.4, '#fff', 18),
    AZ: hs('#00B5E2', '#EF3340', '#509E2F') + crescent(29, 20, 4.8, '#EF3340', '#fff') + star(35, 20, 2.2, '#fff'),
    SG: `<rect width="60" height="40" fill="#fff"/><rect width="60" height="20" fill="#EF3340"/>${crescent(12, 10, 6, '#EF3340', '#fff')}` + [0, 1, 2, 3, 4].map(i => { const a = (i * 72 - 90) * Math.PI / 180; return star(19.5 + Math.cos(a) * 3.6, 10 + Math.sin(a) * 3.6, 1.3, '#fff'); }).join(''),
    MY: [...Array(14)].map((_, i) => `<rect y="${i * 40 / 14}" width="60" height="${40 / 14 + 0.2}" fill="${i % 2 ? '#fff' : '#CC0001'}"/>`).join('') + `<rect width="30" height="22.9" fill="#010066"/>${crescent(11, 11.5, 7, '#010066', '#FFCC00')}` + star(21.5, 11.5, 5.2, '#FFCC00'),
    BH: `<rect width="60" height="40" fill="#CE1126"/><path d="M0,0H18L24,2L18,4L24,6L18,8L24,10L18,12L24,14L18,16L24,18L18,20L24,22L18,24L24,26L18,28L24,30L18,32L24,34L18,36L24,38L18,40H0Z" fill="#fff"/>`,
    QA: `<rect width="60" height="40" fill="#8A1538"/><path d="M0,0H16L22,2.2L16,4.4L22,6.6L16,8.8L22,11L16,13.3L22,15.5L16,17.7L22,20L16,22.2L22,24.4L16,26.6L22,28.8L16,31L22,33.3L16,35.5L22,37.7L16,40H0Z" fill="#fff"/>`,
    SA: `<rect width="60" height="40" fill="#006C35"/><path d="M14 15h32M16 18h28" stroke="#fff" stroke-width="2"/><path d="M15 27h28l3-2" stroke="#fff" stroke-width="1.6" fill="none"/>`,
    AE: `<rect width="60" height="40" fill="#fff"/><rect width="60" height="13.4" fill="#00732F"/><rect y="26.6" width="60" height="13.4" fill="#000"/><rect width="16" height="40" fill="#FF0000"/>`,
    IL: `<rect width="60" height="40" fill="#fff"/><rect y="5" width="60" height="5" fill="#0038B8"/><rect y="30" width="60" height="5" fill="#0038B8"/><polygon points="30,13 36,23.5 24,23.5" fill="none" stroke="#0038B8" stroke-width="1.6"/><polygon points="30,27 36,16.5 24,16.5" fill="none" stroke="#0038B8" stroke-width="1.6"/>`,
    CZ: `<rect width="60" height="40" fill="#D7141A"/><rect width="60" height="20" fill="#fff"/><path d="M0,0 L30,20 L0,40Z" fill="#11457E"/>`,
    CL: `<rect width="60" height="40" fill="#D52B1E"/><rect width="60" height="20" fill="#fff"/><rect width="20" height="20" fill="#0039A6"/>` + star(10, 10, 5, '#fff'),
    VE: hs('#FFCC00', '#00247D', '#CF142B') + [...Array(8)].map((_, i) => { const a = (200 + i * 20) * Math.PI / 180; return star(30 + Math.cos(a) * 9, 22 + Math.sin(a) * 9, 1.4, '#fff'); }).join(''),
    MA: `<rect width="60" height="40" fill="#C1272D"/><polygon points="30,11 32.6,25.5 20.5,16.5 39.5,16.5 27.4,25.5" fill="none" stroke="#006233" stroke-width="1.6"/>`,
    ZW: [...Array(7)].map((_, i) => `<rect y="${i * 40 / 7}" width="60" height="${40 / 7 + 0.2}" fill="${['#006400', '#FFD200', '#D40000', '#000', '#D40000', '#FFD200', '#006400'][i]}"/>`).join('') + `<path d="M0,0 L24,20 L0,40Z" fill="#fff" stroke="#000" stroke-width="1"/>` + star(8, 20, 4, '#D40000'),
    LI: hs('#002B7F', '#CE1126') + `<path d="M10 12h8l-1 3h-6z" fill="#FFD83D"/>`,
    RH: vs('#007A3D', '#fff', '#007A3D'),
    MO: hs('#CE1126', '#fff'),
  };
  F.EN = `<rect width="60" height="40" fill="#fff"/><rect x="26" width="8" height="40" fill="#CE1124"/><rect y="16" width="60" height="8" fill="#CE1124"/>`;
  const cache = {};
  return cc => {
    if (!cc) return null; cc = String(cc).toUpperCase(); if (cc === 'UK') cc = 'GB'; if (cc === 'GB-ENG') cc = 'EN';
    if (!F[cc]) return null;
    if (!cache[cc]) cache[cc] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40" width="60" height="40" preserveAspectRatio="none">${F[cc]}</svg>`);
    return cache[cc];
  };
})();
// <img> for a country code, falling back to the emoji when there's no drawing for it
function flagImg(cc, cls = '') { const u = FLAG_SVG(cc); return u ? `<img class="dkfl ${cls}" src="${u}" alt="${cc}" title="${cc}">` : `<span class="dkfe ${cls}">${flag(cc)}</span>`; }
// Swap any flag emoji that ends up in the page for the drawn flag (emoji = two regional-indicator letters).
(function () {
  const RX = /(\uD83C[\uDDE6-\uDDFF]){2}/g, RT = /(\uD83C[\uDDE6-\uDDFF]){2}/;
  const codeOf = s => String.fromCharCode(s.codePointAt(0) - 0x1F1E6 + 65) + String.fromCharCode(s.codePointAt(2) - 0x1F1E6 + 65);
  const fix = root => {
    if (!root || !root.ownerDocument && root !== document) return;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => RT.test(n.nodeValue) && !(n.parentElement && n.parentElement.closest('option,textarea,title,script,style,select')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
    const nodes = []; while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(n => { RX.lastIndex = 0; const frag = document.createDocumentFragment(); let last = 0, m; const s = n.nodeValue;
      while ((m = RX.exec(s))) { const u = FLAG_SVG(codeOf(m[0])); if (!u) continue; frag.append(s.slice(last, m.index)); const img = document.createElement('img'); img.className = 'dkfl emj'; img.src = u; img.alt = codeOf(m[0]); frag.append(img); last = m.index + m[0].length; }
      if (last) { frag.append(s.slice(last)); n.replaceWith(frag); } });
  };
  const start = () => { fix(document.body); new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(nd => { if (nd.nodeType === 1) fix(nd); else if (nd.nodeType === 3 && nd.parentNode) fix(nd.parentNode); }))).observe(document.body, { childList: true, subtree: true, characterData: false }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
