(function () {
  'use strict';
  var BASE = window.TMB_ITEMS || [];
  var VARS = window.TMB_VARS, SLOTS = window.TMB_SLOTS, REFS = window.TMB_REFS, PLATS = window.TMB_PLATFORMS, GEN = window.TMB_GEN;
  var IMG_DIR = '素材/';
  var ORDER = ['douyin', 'xhs', 'sph', 'pyq'];
  var ACT = { A: ['a', 'A · 搜店名'], B: ['b', 'B · 点卡片'], C: ['c', 'C · 晒单邀友'] };
  var FIELDS = {
    douyin: [['post', '发布文案', 'long'], ['script', '分镜脚本', 'table'], ['tags', '话题', 'text'], ['pinA', '置顶评论 A · 试导流', 'long', '可能限流，和 B 并行测试'], ['pinB', '置顶评论 B · 店名合集', 'long'], ['pin', '置顶评论', 'long'], ['replies', '评论区回复', 'long']],
    xhs: [['title', '标题', 'long'], ['body', '正文', 'long'], ['tags', '话题标签', 'text'], ['pinA', '置顶评论 A · 试导流', 'long', '可能限流，和 B 并行测试'], ['pinB', '置顶评论 B · 店名合集', 'long'], ['pin', '置顶评论', 'long'], ['replies', '评论区话术 / 提示', 'long']],
    sph: [['title', '文章标题', 'text'], ['summary', '文章摘要', 'long'], ['body', '文章正文结构', 'long'], ['post', '视频描述', 'long'], ['script', '分镜脚本', 'table'], ['forward', '转发用户的朋友圈文案', 'long'], ['mount', '挂载：小程序', 'text'], ['article', '挂载：公众号文章', 'text'], ['tags', '话题', 'text']],
    pyq: [['v1', '文案 1', 'long'], ['v2', '文案 2', 'long'], ['v3', '文案 3', 'long'], ['pics', '配图', 'long'], ['timing', '发布时间', 'text']]
  };
  var SCRIPT_COLS = ['时长', '画面', '口播 / 字幕'];
  /* 登录与使用记录（auth.js，只在 claude.ai 里启用；其余情况 AUTH.active 为 false，一切照旧） */
  var AUTH = window.TMB_AUTH || null;
  function T(type, it, title) { if (AUTH && AUTH.active) try { AUTH.track(type, it ? it.id : '', title || (it ? resolve(it.title) : '')); } catch (e) {} }

  /* ---------- 存储（每个浏览器各存一份） ---------- */
  /* 门店：内置 78 家美团门店 + 自己新增的；改过的门店信息按 id 覆盖内置值 */
  function mergeStores(saved) {
    var base = (window.TMB_STORES || []).map(function (s) { return { id: s.id, vars: Object.assign({}, s.vars) }; });
    if (!base.length) base = [{ id: 's1', vars: defaults(VARS.store) }];
    (saved || []).forEach(function (sv) {
      var hit = base.filter(function (b) { return b.id === sv.id; })[0];
      if (hit) { Object.keys(sv.vars || {}).forEach(function (k) { if (sv.vars[k]) hit.vars[k] = sv.vars[k]; }); }
      else if (sv.id !== 's1') base.push(sv); /* 旧版的示例门店不再保留 */
    });
    return base;
  }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function defaults(list) { var o = {}; list.forEach(function (x) { o[x.k] = x.def; }); return o; }

  var state = {
    tab: load('tmb.tab', 'douyin'), acct: null, period: null, q: '',
    edits: load('tmb.edits', {}),
    custom: load('tmb.custom', []),
    stores: mergeStores(load('tmb.stores', null)),
    cur: load('tmb.cur', 's1'),
    prices: Object.assign(defaults(VARS.price), load('tmb.prices', {})),
    breaks: load('tmb.breaks', []),
    photos: {}, open: null, editing: {}, brk: null,
    /* 只有在 claude.ai 里打开时才有 window.claude，GitHub Pages 上这些按钮不出现 */
    ai: !!(window.claude && typeof window.claude.use === 'function')
  };
  if (ORDER.indexOf(state.tab) < 0) state.tab = 'douyin';
  if (!state.stores.some(function (s) { return s.id === state.cur; })) state.cur = state.stores[0].id;
  state.stores.forEach(function (s) { state.photos[s.id] = load('tmb.photos.' + s.id, {}); });

  function items() { return state.custom.concat(BASE); }
  function byId(id) { return items().filter(function (i) { return i.id === id; })[0]; }
  function store() { return state.stores.filter(function (s) { return s.id === state.cur; })[0]; }
  function allVars() { var v = Object.assign({}, state.prices, store().vars); if (!v['门店数']) v['门店数'] = String(state.stores.length); return v; }
  var LABELS = {}; VARS.store.concat(VARS.price).forEach(function (x) { LABELS[x.k] = x.label; });

  /* ---------- 文本与合规 ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  /* 选填的门店信息（楼层入口、营业时间、周边、商圈）没填时：只剩标签的那一段（用“｜”分隔）或那一行直接去掉，句子里的直接省略，
     复制出去的文案不会出现“营业时间 ｜”这种空白；必填的（店名、商场等）仍然显示【待填】 */
  var OPTIONAL = { '位置': 1, '营业时间': 1, '周边': 1, '区域': 1 };
  function missOpt(seg, v) { return (seg.match(/\{([^{}\n]+)\}/g) || []).filter(function (x) { var k = x.slice(1, -1); return OPTIONAL[k] && (k in v) && !v[k]; }); }
  function dropEmpty(s, v) {
    if (s.indexOf('{') < 0) return s;
    return s.split('\n').map(function (line) {
      var segs = line.split('｜'), keep = segs.filter(function (seg) {
        var miss = missOpt(seg, v); if (!miss.length) return true;
        var rest = seg; miss.forEach(function (x) { rest = rest.split(x).join(''); });
        return /\{[^{}\n]+\}/.test(rest) || rest.replace(/[\s📍⏰🕘🍜🚇🅿️：:，,。#·\-—]/g, '').length > 6;
      });
      if (!keep.length) return null;
      return keep.join('｜');
    }).filter(function (l) { return l !== null; }).join('\n');
  }
  function resolve(t) {
    var v = allVars();
    var s = dropEmpty(String(t == null ? '' : t), v);
    s = s.replace(/\{([^{}\n]+)\}/g, function (m, k) { if (!(k in v)) return m; return v[k] ? v[k] : OPTIONAL[k] ? '' : '【待填：' + (LABELS[k] || k) + '】'; });
    return s.replace(/(^|\s)#(?=\s|$)/g, '$1').replace(/ {2,}/g, ' ').replace(/，，/g, '，');
  }
  /* 当前门店没填的选填信息（提醒用，不阻塞复制） */
  function optMissing(it) {
    var v = allVars(), raw = JSON.stringify(it.f) + JSON.stringify(it.frames || []), out = [];
    Object.keys(OPTIONAL).forEach(function (k) { if (!v[k] && raw.indexOf('{' + k + '}') >= 0) out.push(LABELS[k] || k); });
    return out;
  }
  /* 合规词表在 compliance.js，全站一份 */
  var RULES = window.TMB_RULES, BAN_RE = RULES.banRe, cauRe = RULES.cauRe, scanText = RULES.scan;
  function renderTpl(t, p) {
    var v = allVars(), cr = cauRe(p);
    return String(t == null ? '' : t).split(/(\{[^{}\n]+\})/g).map(function (part) {
      var m = part.match(/^\{([^{}\n]+)\}$/);
      if (m && (m[1] in v)) return v[m[1]] ? '<span class="v" title="' + esc(LABELS[m[1]] || m[1]) + '">' + esc(v[m[1]]) + '</span>' : (OPTIONAL[m[1]] ? '<span class="v opt" title="选填，没填时复制会自动省略">' + esc(LABELS[m[1]] || m[1]) + ' 未填</span>' : '<span class="v miss">待填：' + esc(LABELS[m[1]] || m[1]) + '</span>');
      var h = esc(part).replace(BAN_RE, function (x) { return '<mark class="ban" title="禁用词">' + x + '</mark>'; });
      return h.replace(cr, function (x) { return '<span class="cau" title="站外导流词，可能限流">' + x + '</span>'; });
    }).join('');
  }

  /* ---------- 取值 ---------- */
  function val(it, k) {
    var e = state.edits[it.id];
    if (e && e[k] !== undefined) return e[k];
    if (k === 'coverMain') return it.cover.main;
    if (k === 'coverSub') return it.cover.sub;
    return it.f[k];
  }
  function edited(it, k) { var e = state.edits[it.id]; return !!(e && (k ? e[k] !== undefined : Object.keys(e).length)); }
  function setVal(it, k, v) { state.edits[it.id] = state.edits[it.id] || {}; state.edits[it.id][k] = v; save('tmb.edits', state.edits); }
  function resetVal(it, k) { if (state.edits[it.id]) { delete state.edits[it.id][k]; if (!Object.keys(state.edits[it.id]).length) delete state.edits[it.id]; } save('tmb.edits', state.edits); }
  /* 生成用的“经验库”：全部模板 + 团队改过的版本 + 自己保存的创意 */
  function pool(excludeId) {
    return items().filter(function (it) { return it.id !== excludeId; }).map(function (it) {
      var c = JSON.parse(JSON.stringify(it)), e = state.edits[it.id];
      if (e) { Object.keys(e).forEach(function (k) { if (k === 'coverMain') c.cover.main = e[k]; else if (k === 'coverSub') c.cover.sub = e[k]; else c.f[k] = e[k]; }); c.edited = true; }
      return c;
    });
  }
  /* Claude 生成次数：每人每 5 小时 10 次，从第一次使用开始计时 */
  var AI_LIMIT = 10, AI_WINDOW = 5 * 3600 * 1000;
  function quota() {
    if (AUTH && AUTH.active) return AUTH.quota();
    var q = load('tmb.aiq', null), now = Date.now();
    if (!q || now >= q.start + AI_WINDOW) return { left: AI_LIMIT, reset: null };
    return { left: Math.max(0, AI_LIMIT - q.used), reset: q.start + AI_WINDOW };
  }
  function useQuota() {
    if (AUTH && AUTH.active) return AUTH.useQuota();
    var q = load('tmb.aiq', null), now = Date.now();
    if (!q || now >= q.start + AI_WINDOW) q = { start: now, used: 0 };
    q.used++; save('tmb.aiq', q);
  }
  function hhmm(t) {
    var d = new Date(t), n = new Date(), pad = function (x) { return (x < 10 ? '0' : '') + x; };
    var day = d.toDateString() === n.toDateString() ? '' : (new Date(n.getTime() + 864e5).toDateString() === d.toDateString() ? '明天 ' : (d.getMonth() + 1) + '/' + d.getDate() + ' ');
    return day + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fieldsOf(it) { return FIELDS[it.p].filter(function (f) { return it.f[f[0]] !== undefined; }); }
  function itemText(it) {
    var parts = [resolve(val(it, 'coverMain')), resolve(val(it, 'coverSub')), resolve(it.title)];
    fieldsOf(it).forEach(function (f) { var v = val(it, f[0]); parts.push(f[2] === 'table' ? v.map(function (r) { return r.join(' '); }).join('\n') : resolve(v)); });
    return parts.join('\n');
  }
  function scanItem(it) { return scanText(itemText(it), it.p); }
  function plainAll(it) {
    var out = ['【' + PLATS[it.p].name + ' · ' + it.acct + ' · ' + it.type + '】' + resolve(it.title), '封面：' + resolve(val(it, 'coverMain')).replace(/\n/g, ' ') + '｜' + resolve(val(it, 'coverSub')), ''];
    if ((it.frames || []).length) {
      out.push('— 画面 ' + it.frames.length + ' 张 —');
      it.frames.forEach(function (f, i) { out.push((i + 1) + '. ' + f.role + '｜' + resolve(i === 0 ? val(it, 'coverMain') : f.main).replace(/\n/g, ' ') + (f.sub ? '｜' + resolve(i === 0 ? val(it, 'coverSub') : f.sub) : '') + '｜排版：' + f.layout + (f.style ? '｜风格：' + f.style : '')); });
      out.push('');
    }
    fieldsOf(it).forEach(function (f) {
      var v = val(it, f[0]); out.push('— ' + f[1] + ' —');
      if (f[2] === 'table') v.forEach(function (r) { out.push(resolve(r[0]) + '｜' + resolve(r[1]) + '｜' + resolve(r[2])); }); else out.push(resolve(v));
      out.push('');
    });
    return out.join('\n').trim();
  }

  /* ---------- 图片与封面 ---------- */
  function photo(slot) { var p = state.photos[state.cur] || {}; return p[slot] || null; }
  function firstPhoto(it) { for (var i = 0; i < (it.slots || []).length; i++) { var p = photo(it.slots[i]); if (p) return p; } return null; }
  function refSrc(name) { return IMG_DIR + encodeURIComponent(name) + '.jpg'; }
  function coverHTML(it, mode) {
    if (it.p === 'pyq') return momentHTML(it, mode === 'big');
    var img = firstPhoto(it), video = it.p === 'douyin' || it.p === 'sph';
    var ratio = mode === 'big' ? (video ? ' r916' : ' r34') : '';
    var h = '<div class="cv ' + esc(it.cover.style) + ratio + (img ? ' has-img' : '') + '">' + (img ? '<div class="bgimg" style="background-image:url(' + img + ')"></div>' : '<i class="deco d1"></i><i class="deco d2"></i>');
    h += '<span class="brandtag">Ulike 脱毛吧</span><span class="platmark">' + PLATS[it.p].name + ((it.frames || []).length > 1 ? ' · ' + it.frames.length + ' 张' : '') + '</span>';
    h += '<div class="cv-in"><h4>' + esc(resolve(val(it, 'coverMain'))) + '</h4><span class="sub">' + esc(resolve(val(it, 'coverSub'))) + '</span>';
    if (it.p === 'sph' && val(it, 'mount')) h += '<span class="mount">' + esc(resolve(String(val(it, 'mount')).replace(/^[^：]*：/, '').replace(/[「」]/g, ''))) + '</span>';
    h += '</div>';
    if (video) {
      var first = resolve(val(it, 'post') || val(it, 'summary') || it.title).split('\n')[0];
      h += (mode === 'big' ? '<div class="side"><i></i><i></i><i></i></div>' : '') + '<div class="vbar"><b>@' + (it.acct === '门店号' ? esc(resolve('{简称}')) : it.acct === '公众号' ? 'Ulike脱毛吧 公众号' : 'Ulike脱毛吧') + '</b><span>' + esc(first) + '</span></div>';
    }
    return h + '</div>';
  }
  /* 多张图：每张按平台比例渲染，底图优先用本店照片，其次参考图，最后是占位 */
  function frameRatio(it) { return it.p === 'xhs' ? 'r34' : it.p === 'pyq' ? 'r11' : it.acct === '公众号' ? 'r169' : 'r916'; }
  function frameHTML(it, f, idx, small) {
    var n = (it.frames || []).length, img = f.slot ? photo(f.slot) : null, ref = !img && f.ref ? refSrc(f.ref) : null;
    var main = idx === 0 ? val(it, 'coverMain') : f.main, sub = idx === 0 ? val(it, 'coverSub') : f.sub;
    var h = '<div class="cv fr ' + esc(it.cover.style) + ' ' + frameRatio(it) + (img ? ' has-img' : '') + (ref ? ' has-ref' : '') + '">';
    if (img) h += '<div class="bgimg" style="background-image:url(' + img + ')"></div>';
    else if (ref) h += '<img class="frref" src="' + ref + '" alt="" loading="lazy">';
    else if (f.slot) h += '<div class="frph"><span>底图：' + esc(SLOTS[f.slot] ? SLOTS[f.slot].name : f.slot) + '<br>（上传本店照片后显示）</span></div>';
    else h += '<i class="deco d1"></i>';
    h += '<span class="frno">' + (idx + 1) + '/' + n + '</span>';
    h += '<div class="cv-in"><h4>' + esc(resolve(main)) + '</h4>' + (sub ? '<span class="sub">' + esc(resolve(sub)) + '</span>' : '') + (!small && f.note ? '<p class="frnote">' + esc(resolve(f.note)) + '</p>' : '') + '</div>';
    return h + '</div>';
  }
  function momentHTML(it, full) {
    var who = it.acct === '老客' ? '老客' : resolve('{简称}') + ' 店主';
    var pics = (it.slots || []).slice(0, full ? 9 : 3).map(function (s) { var p = photo(s); return p ? '<div style="background-image:url(' + p + ')"></div>' : '<div class="ph" title="' + esc(SLOTS[s].name) + '"></div>'; });
    if (!pics.length && it.refs && it.refs.length) pics = it.refs.slice(0, 1).map(function (r) { return '<div style="background-image:url(' + refSrc(r) + ');background-position:top"></div>'; });
    var pt = String(val(it, 'pics') || '');
    var mini = /卡片|视频号|邀请卡/.test(pt) ? '<div class="mini"><i></i>' + (/视频号/.test(pt) ? '视频号 · Ulike脱毛吧' : '小程序 · Ulike脱毛吧') + '</div>' : '';
    return '<div class="moment' + (full ? ' full' : '') + '"><div class="av">U</div><div><div class="nm">' + esc(who) + '</div><div class="tx">' + esc(resolve(val(it, 'v1'))) + '</div>' + (pics.length ? '<div class="pics">' + pics.join('') + '</div>' : '') + mini + '<div class="tm">' + esc(resolve(it.when)) + '</div></div></div>';
  }

  /* ---------- 列表 ---------- */
  function themeItems(p, theme) {
    var q = state.q.trim();
    return items().filter(function (it) {
      if (it.p !== p || it.type !== theme) return false;
      if (state.acct && it.acct !== state.acct) return false;
      if (state.period && it.period !== state.period) return false;
      if (q && plainAll(it).indexOf(q) < 0 && (it.form || '').indexOf(q) < 0) return false;
      return true;
    });
  }
  function ratioText(t) {
    if (!t.ratio) return '朋友圈';
    return Object.keys(t.ratio).map(function (k) { return k + ' ' + (t.ratio[k] ? t.ratio[k] + '%' : '不做'); }).join(' · ');
  }
  function renderTabs() {
    document.getElementById('tabs').innerHTML = ORDER.map(function (k) {
      var n = items().filter(function (i) { return i.p === k; }).length;
      return '<button class="tab" role="tab" type="button" data-tab="' + k + '" aria-selected="' + (state.tab === k) + '"><i class="dot ' + k + '"></i>' + PLATS[k].name + '<span class="n">' + n + '</span></button>';
    }).join('');
  }
  function renderHead() {
    var P = PLATS[state.tab];
    document.getElementById('platHead').innerHTML = '<div><h1>' + P.name + '：' + P.lead + '</h1><ul class="pdesc">' + [].concat(P.desc).map(function (d) { return '<li>' + d + '</li>'; }).join('') + '</ul><div class="pills">' + P.freq.map(function (g) { return '<span class="pill">' + g + '</span>'; }).join('') + '</div></div>' +
      '<div><button class="btn primary" type="button" id="copyTab">复制本平台全部文案</button></div>';
    document.getElementById('themeNav').innerHTML = P.themes.map(function (t, i) {
      return '<button class="tn" type="button" data-jump="' + i + '"><b>' + t.name + '</b><span>' + ratioText(t) + '</span></button>';
    }).join('');
  }
  function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  function renderFilters() {
    var pool = items().filter(function (it) { return it.p === state.tab; });
    var accts = uniq(pool.map(function (i) { return i.acct; })), periods = uniq(pool.map(function (i) { return i.period; }));
    if (state.acct && accts.indexOf(state.acct) < 0) state.acct = null;
    if (state.period && periods.indexOf(state.period) < 0) state.period = null;
    function grp(name, key, list) {
      return '<div class="grp"><span>' + name + '</span>' + ['全部'].concat(list).map(function (x) {
        var on = x === '全部' ? !state[key] : state[key] === x;
        return '<button class="chip" type="button" data-f="' + key + '" data-v="' + esc(x) + '" aria-pressed="' + on + '">' + esc(x) + '</button>';
      }).join('') + '</div>';
    }
    document.getElementById('filters').innerHTML = grp('账号', 'acct', accts) + grp('档期', 'period', periods) +
      '<label class="search"><span class="note">搜索</span><input id="q" type="search" placeholder="标题、文案、形式" value="' + esc(state.q) + '"></label>';
  }
  function cardHTML(it) {
    var a = ACT[it.act] || ACT.A, bad = scanItem(it).some(function (x) { return x.lv === 'ban'; });
    return '<button class="card" type="button" data-open="' + esc(it.id) + '"><div class="thumb">' + coverHTML(it) + '</div>' +
      '<div class="meta"><div class="ttl">' + esc(resolve(it.title)) + '</div>' +
      '<div class="row">' + (it.custom ? '<span class="pill mine">我的</span>' : '') + '<span class="pill">' + esc(it.acct) + '</span><span class="pill">' + esc(it.form || '') + '</span></div>' +
      '<div class="row"><span class="pill ' + a[0] + '">' + a[1] + '</span>' + (bad ? '<span class="pill a">有禁用词</span>' : '') + '</div>' +
      '<div class="foot"><span>' + esc(resolve(it.when)) + '</span>' + (edited(it) ? '<span class="edited">已改</span>' : '') + '</div></div></button>';
  }
  function pb(p, theme) { var P = window.TMB_PLAYBOOK || {}; return P[p] && P[p][theme] || null; }
  function pbCard(t, i) {
    var b = pb(state.tab, t.name); if (!b) return '';
    return '<button class="card pbcard" type="button" data-pb="' + i + '"><div class="thumb"><div class="pbthumb"><span class="pbk">爆款公式</span><b>' + esc(t.name) + '</b>' +
      '<dl><dt>内容公式</dt><dd>' + esc(b.content.formula) + '</dd><dt>文案公式</dt><dd>' + esc(b.copy.formula) + '</dd></dl></div></div>' +
      '<div class="meta"><div class="ttl">外部爆款案例与公式</div><div class="row"><span class="pill">' + b.cases.length + ' 个案例拆解</span>' + (brkFor(state.tab, t.name).length ? '<span class="pill mine">团队拆过 ' + brkFor(state.tab, t.name).length + ' 条</span>' : '') + '</div><div class="row"><span class="pill">' + b.copy.titles.length + ' 个标题公式</span></div><div class="foot"><span>点开看完整拆解</span></div></div></button>';
  }
  function pbPanel(themeIdx) {
    var t = PLATS[state.tab].themes[themeIdx], b = pb(state.tab, t.name); if (!b) return;
    state.open = null;
    var li = function (a) { return '<ul class="pblist">' + a.map(function (x) { var p = String(x).split('｜'); return '<li>' + (p.length > 1 ? '<b>' + esc(p[0]) + '</b><span>' + esc(p.slice(1).join('｜')) + '</span>' : esc(x)) + '</li>'; }).join('') + '</ul>'; };
    var steps = '<ol class="pbsteps">' + b.content.steps.map(function (r, i) { return '<li><div class="ps-h"><span class="frn">' + (i + 1) + '</span><b>' + esc(r[0]) + '</b>' + (r[2] ? '<span class="ps-t">' + esc(r[2]) + '</span>' : '') + '</div><p>' + esc(r[1]) + '</p></li>'; }).join('') + '</ol>';
    var cases = b.cases.map(function (c, k) {
      return '<div class="case"><div class="case-h"><b>' + (k + 1) + '. ' + esc(c.name) + '</b><span class="pill">' + esc(c.type || '') + '</span></div>' +
        '<dl class="brief"><dt>内容</dt><dd>' + esc(c.what) + '</dd><dt>为什么火</dt><dd>' + esc(c.why) + '</dd><dt>怎么借鉴</dt><dd>' + esc(c.borrow) + '</dd><dt>来源</dt><dd><a href="' + esc(c.url) + '" target="_blank" rel="noopener">' + esc(c.source) + '</a></dd></dl></div>';
    }).join('');
    layer.innerHTML = '<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="pbTitle">' +
      '<div class="d-head"><div><div class="pills" style="margin:0"><span class="pill"><i class="dot ' + state.tab + '"></i>' + PLATS[state.tab].name + '</span><span class="pill">' + esc(t.name) + '</span><span class="pill mine">爆款公式</span></div>' +
      '<h2 id="pbTitle">' + esc(t.name) + '：外部爆款案例与内容、文案公式</h2><p class="angle">' + esc(b.summary) + '</p></div>' +
      '<div class="acts"><button class="btn accent" type="button" data-pbcopy="' + themeIdx + '">复制公式</button><button class="btn" type="button" data-new="' + themeIdx + '">按公式新建创意</button><button class="btn" type="button" data-close>关闭</button></div></div>' +
      '<div class="d-body pb-body"><div class="col">' +
      '<div class="box"><h3>爆款内容的特点</h3>' + li(b.traits) + '</div>' +
      '<div class="box"><h3>内容拆解与公式</h3><div class="formula">' + esc(b.content.formula) + '</div>' + steps + '<h4 class="sub-h">拍摄 / 排版要点</h4>' + li(b.content.tips) + '</div>' +
      '<div class="box"><h3>文案拆解与公式</h3><div class="formula">' + esc(b.copy.formula) + '</div><h4 class="sub-h">标题公式</h4>' + li(b.copy.titles) + '<h4 class="sub-h">开头钩子</h4>' + li(b.copy.hooks) + '<h4 class="sub-h">结尾引导</h4>' + li(b.copy.ctas) + '<h4 class="sub-h">不要这样写</h4>' + li(b.copy.avoid) + '</div>' +
      '</div><div class="col">' + pbMine(t.name) + '<div class="box"><h3>外部优秀案例拆解<span class="note">' + b.cases.length + ' 个</span></h3><div class="cases">' + cases + '</div></div></div></div></aside>';
  }
  /* 团队自己拆过、归到这个主题的对标 */
  function pbMine(theme) {
    var l = brkFor(state.tab, theme);
    return '<div class="box"><h3>团队拆过的对标<span class="note">' + l.length + ' 条</span></h3>' + (l.length ? '<ul class="brklib">' + l.map(function (b) { return '<li><button type="button" data-brk="' + esc(b.id) + '"><b>' + esc(brkName(b)) + '</b><span>' + esc(b.result.formula) + '</span></button></li>'; }).join('') + '</ul>' : '<p class="note">还没有。看到同类爆款，点顶部“拆对标”粘进来，拆完会自动归到对应主题。</p>') + '<div class="m-acts" style="margin-top:8px"><button class="btn sm" type="button" data-openbrk="1">拆一条对标</button></div></div>';
  }
  function pbText(themeIdx) {
    var t = PLATS[state.tab].themes[themeIdx], b = pb(state.tab, t.name);
    return ['【' + PLATS[state.tab].name + ' · ' + t.name + ' · 爆款公式】', b.summary, '', '内容公式：' + b.content.formula].concat(b.content.steps.map(function (r) { return '· ' + r[0] + '：' + r[1] + '（' + r[2] + '）'; }), ['', '文案公式：' + b.copy.formula, '标题：'], b.copy.titles.map(function (x) { return '· ' + x; }), ['开头钩子：'], b.copy.hooks.map(function (x) { return '· ' + x; }), ['结尾引导：'], b.copy.ctas.map(function (x) { return '· ' + x; })).join('\n');
  }
  function renderThemes() {
    var P = PLATS[state.tab];
    document.getElementById('themes').innerHTML = P.themes.map(function (t, i) {
      var list = themeItems(state.tab, t.name);
      var say = t.ratio && t.dian ? '<span><b>官号：</b>' + t.guan + '</span><span><b>门店号：</b>' + t.dian + '</span>' : '<span>' + t.guan + '</span>';
      return '<section class="theme" id="theme-' + i + '" data-theme="' + esc(t.name) + '"><div class="th-head"><div><h2>' + t.name + '<span class="pill">' + ratioText(t) + '</span><span class="cnt">' + list.length + ' 条</span></h2><div class="say">' + say + '</div></div>' +
        '<div class="pager"><button class="btn sm ghost" type="button" data-copytheme="' + i + '">复制本主题</button><button class="arrow" type="button" data-pg="-1" aria-label="上一页">‹</button><span class="pg">1 / 1</span><button class="arrow" type="button" data-pg="1" aria-label="下一页">›</button></div></div>' +
        '<div class="track" tabindex="0" aria-label="' + t.name + ' 创意">' +
        '<button class="card blank" type="button" data-new="' + i + '"><div class="thumb"><span class="plus">+</span><p>空白创意<br>写下想法和形式，生成这个主题的新创意</p></div><div class="meta"><div class="ttl">新建「' + t.name + '」创意</div><div class="row"><span class="pill">' + P.name + '</span></div><div class="row"><span class="pill">输入想法即可</span></div><div class="foot"><span>保存到这一栏最前面</span></div></div></button>' + pbCard(t, i) +
        list.map(cardHTML).join('') + '</div></section>';
    }).join('');
    document.querySelectorAll('.track').forEach(function (tr) { tr.addEventListener('scroll', function () { updatePager(tr); }, { passive: true }); updatePager(tr); });
  }
  function perView(tr) { return parseInt(getComputedStyle(tr).getPropertyValue('--n'), 10) || 4; }
  function updatePager(tr) {
    var sec = tr.closest('.theme'), n = perView(tr), total = tr.children.length;
    var pages = Math.max(1, Math.ceil(total / n));
    var w = tr.clientWidth || 1, page = Math.min(pages, Math.round(tr.scrollLeft / w) + 1);
    if (tr.scrollLeft + w >= tr.scrollWidth - 4) page = pages;
    sec.querySelector('.pg').textContent = page + ' / ' + pages;
    sec.querySelector('[data-pg="-1"]').disabled = tr.scrollLeft <= 4;
    sec.querySelector('[data-pg="1"]').disabled = tr.scrollLeft + w >= tr.scrollWidth - 4;
  }
  function cities() {
    var c = {};
    state.stores.forEach(function (s) { var k = s.vars['城市'] || '未填城市'; c[k] = (c[k] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b, 'zh'); }).map(function (k) { return [k, c[k]]; });
  }
  function renderStoreSel() {
    var city = store().vars['城市'] || '未填城市';
    document.getElementById('citySel').innerHTML = cities().map(function (c) { return '<option value="' + esc(c[0]) + '"' + (c[0] === city ? ' selected' : '') + '>' + esc(c[0]) + '（' + c[1] + '）</option>'; }).join('');
    document.getElementById('storeSel').innerHTML = state.stores.filter(function (s) { return (s.vars['城市'] || '未填城市') === city; }).map(function (s) { return '<option value="' + s.id + '"' + (s.id === state.cur ? ' selected' : '') + '>' + esc(s.vars['简称'] || s.vars['店名'] || '未命名门店') + '</option>'; }).join('');
  }
  function renderMain() { renderTabs(); renderHead(); renderFilters(); renderThemes(); }
  function renderAll() { renderMain(); renderStoreSel(); if (state.open) renderDrawer(); }

  /* ---------- 详情抽屉 ---------- */
  var layer = document.getElementById('layer');
  function openItem(id) {
    state.open = byId(id) || null; state.editing = {}; state.frame = 0;
    if (!state.open) return closeLayer();
    layer.innerHTML = ''; /* 新打开的抽屉从顶部开始看，不沿用上一个弹层的滚动位置 */
    T('view', state.open);
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    renderDrawer();
  }
  function closeLayer() {
    state.open = null; layer.innerHTML = '';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
    renderThemes(); renderTabs();
  }
  function fieldHTML(it, f) {
    var k = f[0], v = val(it, k), isEd = state.editing[k], h = '<div class="field" data-k="' + k + '"><div class="f-top"><b>' + f[1] + '</b>' + (f[3] ? '<span class="risk">' + f[3] + '</span>' : '') + (edited(it, k) ? '<span class="badge">已改</span>' : '');
    if (isEd) {
      h += '<button class="btn sm primary" type="button" data-act="save">保存</button><button class="btn sm" type="button" data-act="cancel">取消</button>' + (edited(it, k) ? '<button class="btn sm ghost" type="button" data-act="reset">恢复默认</button>' : '') + '</div>';
      if (f[2] === 'table') {
        h += '<div class="tbl-wrap"><table class="sb"><thead><tr>' + SCRIPT_COLS.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '<th></th></tr></thead><tbody>' +
          v.map(function (r, i) { return '<tr>' + r.map(function (c, j) { return '<td><textarea data-r="' + i + '" data-c="' + j + '" aria-label="' + SCRIPT_COLS[j] + '">' + esc(c) + '</textarea></td>'; }).join('') + '<td><button class="btn sm ghost" type="button" data-act="delrow" data-r="' + i + '">删</button></td></tr>'; }).join('') +
          '</tbody></table></div><div><button class="btn sm" type="button" data-act="addrow">+ 加一个镜头</button></div>';
      } else {
        h += '<textarea class="ed" id="ed-' + esc(it.id) + '-' + k + '" rows="' + Math.max(3, String(v).split('\n').length + 1) + '">' + esc(v) + '</textarea>';
      }
      h += '<div class="hint">花括号里的是门店变量，比如 {商场}、{新人价}，会按当前门店和统一价格自动替换。</div>';
    } else {
      h += '<button class="btn sm" type="button" data-act="copy">复制</button><button class="btn sm" type="button" data-act="edit">编辑</button></div>';
      h += f[2] === 'table' ? '<div class="tbl-wrap"><table class="sb"><thead><tr>' + SCRIPT_COLS.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' + v.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + renderTpl(c, it.p) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' : '<div class="f-val">' + renderTpl(v, it.p) + '</div>';
    }
    return h + '</div>';
  }
  function slotTile(s) {
    var p = photo(s);
    return '<label class="slot"><div class="img ' + (p ? '' : 'ph') + '"' + (p ? ' style="background-image:url(' + p + ')"' : '') + '>' + (p ? '<span class="tag">本店</span>' : '') + '<span class="up">' + (p ? '替换' : '上传') + '</span></div><div class="lb">' + SLOTS[s].name + '</div><div class="gd">' + SLOTS[s].guide + '</div><input type="file" accept="image/*" hidden data-slot="' + s + '"></label>';
  }
  function refLinks(it) {
    var r = (it.basedOn || []).map(byId).filter(Boolean);
    return r.length ? '<div class="pills"><span class="note">参考：</span>' + r.map(function (x) { return '<button class="chip" type="button" data-open="' + esc(x.id) + '">' + esc(resolve(x.title)) + '</button>'; }).join('') + '</div>' : '';
  }
  function abBox(it) {
    var ab = abOf(it); if (!ab || (!ab.hooks.length && !ab.test)) return '';
    var L = ['A', 'B', 'C'];
    return '<div class="box"><h3>钩子备选 · A/B 测试<span class="note">同一条内容换个开头，看哪个更留人</span></h3>' +
      (ab.hooks.length ? '<ul class="ablist">' + ab.hooks.map(function (h, i) { return '<li><span class="abk">' + L[i] + '</span><span class="abt">' + renderTpl(h, it.p) + (ab.labels && ab.labels[i] ? '<em class="note">　' + esc(ab.labels[i]) + '</em>' : '') + '</span><button class="btn sm" type="button" data-act="abcopy" data-h="' + esc(h) + '">复制</button></li>'; }).join('') + '</ul>' : '') +
      (ab.test ? '<p class="abtest">' + esc(resolve(ab.test)) + '</p>' : '') + '<p class="note">看哪个数定胜负：' + esc(ab.metric) + '</p></div>';
  }
  function renderDrawer() {
    var it = state.open; if (!it) return;
    var keep = layer.querySelector('.d-body'), st = keep ? keep.scrollTop : 0;
    var a = ACT[it.act] || ACT.A, issues = scanItem(it);
    var ban = issues.filter(function (x) { return x.lv === 'ban'; }), cau = issues.filter(function (x) { return x.lv === 'cau'; });
    var chk = ban.length ? '<div class="chk bad"><b>有 ' + ban.length + ' 处禁用词，发布前必须改：' + uniq(ban.map(function (x) { return x.w; })).join('、') + '</b></div>'
      : cau.length ? '<div class="chk warn"><b>合规检查：无禁用词</b>导流词“' + uniq(cau.map(function (x) { return x.w; })).join('、') + '”在抖音/小红书可能限流，只放在置顶评论 A 里测试。</div>'
      : '<div class="chk ok"><b>合规检查：通过</b>没有功效宣称、绝对化用语和站外导流词。</div>';
    var missing = itemText(it).match(/【待填：[^】]+】/g);
    if (missing) chk += '<div class="chk warn"><b>门店信息待填：' + uniq(missing).join(' ').replace(/【待填：|】/g, ' ') + '</b>在“门店与价格”里填好后自动替换。</div>';
    var opt = optMissing(it);
    if (opt.length) chk += '<div class="chk tip"><b>本店还没填：' + opt.join('、') + '</b>复制时会自动省略这几处；填上后文案更具体，路线类内容更好用。</div>';
    var b = it.brief, video = it.p === 'douyin' || it.p === 'sph';
    var fr = it.frames || [], cur = Math.min(state.frame || 0, Math.max(0, fr.length - 1));
    var coverFields = [['coverMain', '封面大字', 'long'], ['coverSub', '封面小字', 'text']];
    var acts = '<button class="btn accent" type="button" data-act="copyall">复制全部文案</button>' +
      (it.custom ? '<button class="btn" type="button" data-act="regen">换一版</button><button class="btn ghost" type="button" data-act="delcustom">删除</button>' : '') +
      (edited(it) ? '<button class="btn" type="button" data-act="resetall">全部恢复默认</button>' : '') + '<button class="btn" type="button" data-close>关闭</button>';
    layer.innerHTML = '<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">' +
      '<div class="d-head"><div><div class="pills" style="margin:0"><span class="pill"><i class="dot ' + it.p + '"></i>' + PLATS[it.p].name + ' · ' + esc(it.acct) + '</span><span class="pill">' + esc(it.type) + '</span><span class="pill">' + esc(it.form || '') + '</span><span class="pill ' + a[0] + '">' + a[1] + '</span><span class="pill">' + esc(resolve(it.when)) + ' · ' + esc(it.freq) + '</span>' + (it.custom ? '<span class="pill mine">' + (it.ai ? 'Claude 生成' : '快速生成') + '</span>' : '') + '</div>' +
      '<h2 id="dTitle">' + esc(resolve(it.title)) + '</h2><p class="angle">' + esc(resolve(it.angle)) + '</p>' + refLinks(it) + (it.fromBreak && brkOf(it.fromBreak) ? '<div class="pills"><span class="note">改写自对标：</span><button class="chip" type="button" data-brk="' + esc(it.fromBreak) + '">' + esc(brkName(brkOf(it.fromBreak))) + '</button></div>' : '') + '</div><div class="acts">' + acts + '</div></div>' +
      '<div class="d-body"><div class="col">' +
      (fr.length ? '<div class="box"><h3>画面 · ' + fr.length + ' 张<span class="note">' + esc(fr[cur].role) + '</span></h3><div class="frview ' + frameRatio(it) + '"><button class="frnav" type="button" data-frame="' + ((cur - 1 + fr.length) % fr.length) + '" aria-label="上一张">‹</button><div class="frmain">' + frameHTML(it, fr[cur], cur) + '</div><button class="frnav" type="button" data-frame="' + ((cur + 1) % fr.length) + '" aria-label="下一张">›</button></div>' +
        '<div class="frthumbs">' + fr.map(function (f, i) { return '<button type="button" class="frthumb' + (i === cur ? ' on' : '') + '" data-frame="' + i + '" aria-label="第 ' + (i + 1) + ' 张">' + frameHTML(it, f, i, true) + '</button>'; }).join('') + '</div></div>'
        : '<div class="box"><h3>画面预览<span class="note">上传门店图后自动换成本店照片</span></h3><div class="cover-wrap' + (video ? ' video' : '') + '">' + coverHTML(it, 'big') + '</div></div>') +
      (it.p === 'pyq' ? '' : '<div class="box"><h3>封面文字</h3>' + coverFields.map(function (f) { return fieldHTML(it, f); }).join('') + '</div>') +
      ((it.slots || []).length ? '<div class="box"><h3>要用的门店图<span class="note">' + it.slots.length + ' 张，点图上传本店照片</span></h3><div class="slots">' + it.slots.map(slotTile).join('') + '</div></div>' : '') +
      ((it.refs || []).length ? '<div class="box"><h3>参考素材图<span class="note">点开看大图</span></h3><div class="refs">' + it.refs.map(function (r) { return '<button class="ref" type="button" data-ref="' + esc(r) + '"><img src="' + refSrc(r) + '" alt="' + esc(REFS[r]) + '" loading="lazy"><span>' + esc(REFS[r]) + '</span></button>'; }).join('') + '</div></div>' : '') +
      '</div><div class="col">' + chk +
      '<div class="box"><h3>总创意</h3><dl class="brief">' + (it.formula ? '<dt>内容公式</dt><dd><b>' + esc(it.formula) + '</b></dd>' : '') + '<dt>给谁看</dt><dd>' + esc(resolve(b.who)) + '</dd><dt>钩子</dt><dd>' + esc(resolve(b.hook)) + '</dd><dt>要说清楚</dt><dd>' + esc(resolve(b.msg)) + '</dd><dt>必须带</dt><dd>' + esc(resolve(b.must)) + '</dd><dt>怎么拍</dt><dd>' + esc(resolve(b.shoot)) + '</dd><dt>看什么数</dt><dd>' + esc(resolve(b.kpi)) + '</dd></dl></div>' +
      (fr.length ? '<div class="box"><h3>逐张说明<span class="note">点一张在左边查看</span></h3><ol class="frlist">' + fr.map(function (f, i) {
        var main = i === 0 ? val(it, 'coverMain') : f.main, sub = i === 0 ? val(it, 'coverSub') : f.sub;
        return '<li class="' + (i === cur ? 'on' : '') + '"><button type="button" class="frli-h" data-frame="' + i + '"><span class="frn">' + (i + 1) + '</span><b>' + esc(f.role) + '</b></button>' +
          '<dl class="brief"><dt>公式</dt><dd><b>' + esc(f.formula) + '</b></dd><dt>排版</dt><dd>' + esc(f.layout) + '</dd><dt>风格</dt><dd>' + esc(f.style || '') + '</dd><dt>图上文字</dt><dd>' + renderTpl(main, it.p) + (sub ? '<br><span class="note">' + renderTpl(sub, it.p) + '</span>' : '') + (f.note ? '<br><span class="note">' + renderTpl(f.note, it.p) + '</span>' : '') + '</dd>' +
          (f.slot ? '<dt>底图</dt><dd>' + esc(SLOTS[f.slot] ? SLOTS[f.slot].name + '：' + SLOTS[f.slot].guide : f.slot) + '</dd>' : '') + (f.ref ? '<dt>参考</dt><dd><button class="chip" type="button" data-ref="' + esc(f.ref) + '">' + esc(REFS[f.ref] || f.ref) + '</button></dd>' : '') + '</dl></li>';
      }).join('') + '</ol></div>' : '') +
      abBox(it) +
      '<div class="box"><h3>文案<span class="note">黄色底 = 门店变量</span></h3>' + fieldsOf(it).map(function (f) { return fieldHTML(it, f); }).join('') + '</div>' +
      '</div></div></aside>';
    var nb = layer.querySelector('.d-body'); if (nb) nb.scrollTop = st;
  }

  /* ---------- 空白创意：生成器 ---------- */
  var gen = null;
  function acctsFor(p, theme) {
    var P = PLATS[p], t = P.themes.filter(function (x) { return x.name === theme; })[0] || {};
    var list = P.accts.filter(function (a) { return !t.ratio || t.ratio[a] === undefined || t.ratio[a] > 0; });
    if (p === 'xhs' && theme !== '真实反馈和打卡') list = list.filter(function (a) { return a === '官号' || a === '门店号'; });
    if (p === 'sph') list = ['官号', '公众号'];
    return list.length ? list : [P.accts[0]];
  }
  var IDEA_HINT = {
    '门店体验': '比如：下班路上顺路去做，想拍第一视角，突出不用预约、没人推销',
    '活动介绍': '比如：讲冬季 20 次卡，用“一次不到 4 块”做钩子',
    '真实反馈和打卡': '比如：打卡第 2 周的用户晒卡片，语气轻松一点',
    '项目背书': '比如：家用仪品牌开线下店，先试再买',
    '门店指引和点位': '比如：地铁口出来怎么走到店，15 秒路线',
    '科普答疑': '比如：第一次去的人最关心的 5 个问题',
    '福利与拉新': '比如：约闺蜜一起来，好友到店双方有礼'
  };
  function genModal(p, themeIdx, prev) {
    var P = PLATS[p], theme = P.themes[themeIdx].name, accts = acctsFor(p, theme);
    gen = prev || { p: p, theme: theme, themeIdx: themeIdx, acct: accts[0], form: P.forms[0], idea: '', points: [], occasion: '常规', who: '' };
    var seg = function (key, list, multi) {
      return '<div class="seg" role="group">' + list.map(function (x) {
        var on = multi ? gen[key].indexOf(x) >= 0 : gen[key] === x;
        return '<button class="chip" type="button" data-g="' + key + '" data-gv="' + esc(x) + '"' + (multi ? ' data-multi="1"' : '') + ' aria-pressed="' + on + '">' + esc(x) + '</button>';
      }).join('') + '</div>';
    };
    layer.innerHTML = '<div class="scrim" data-close></div><div class="modal" role="dialog" aria-modal="true" aria-labelledby="gTitle" id="genForm">' +
      '<h2 id="gTitle">新创意 · ' + P.name + ' · ' + theme + '</h2><p class="sub">写下你想要的创意和形式，生成一条完整的创意：标题、封面、' + (p === 'pyq' ? '朋友圈文案' : p === 'xhs' ? '正文' : '分镜和文案') + '、要拍的门店图和合规检查。生成后可以继续改。</p>' +
      '<div class="gen-grid">' +
      '<div class="gfield">你的创意想法<textarea id="gIdea" placeholder="' + esc(IDEA_HINT[theme] || '写一句你想要的创意') + '">' + esc(gen.idea) + '</textarea>' + genBrkChips(p, theme) + '</div>' +
      '<div class="gfield">账号' + seg('acct', accts) + '</div>' +
      '<div class="gfield">形式' + seg('form', P.forms) + '</div>' +
      '<div class="gfield">主打卖点（可多选，最多 3 个）' + seg('points', window.TMB_SELLING, true) + '</div>' +
      '<div class="two"><label class="gfield">档期 / 活动<select id="gOcc">' + GEN.occasions.map(function (o) { return '<option' + (o === gen.occasion ? ' selected' : '') + '>' + o + '</option>'; }).join('') + '</select></label>' +
      '<label class="gfield">给谁看（选填）<input id="gWho" value="' + esc(gen.who) + '" placeholder="比如：附近大学的学生"></label></div>' +
      '<div class="gen-status" id="gStatus" aria-live="polite"></div>' +
      '</div><div class="m-acts" id="gActs"></div></div>';
    renderGenButtons();
    setTimeout(function () { var t = document.getElementById('gIdea'); if (t) t.focus(); }, 30);
  }
  /* 拆过的同平台对标：点一下把改写好的钩子填进想法 */
  function genBrkChips(p, theme) {
    var l = brkFor(p, theme); if (!l.length) l = brkFor(p);
    if (!l.length) return '';
    return '<div class="pills" style="margin-top:6px"><span class="note">用拆过的对标：</span>' + l.slice(0, 4).map(function (b) { return '<button class="chip" type="button" data-gbrk="' + esc(b.id) + '" title="' + esc(b.result.formula) + '">' + esc(brkName(b)) + '</button>'; }).join('') + '</div>';
  }
  function renderGenButtons() {
    var el = document.getElementById('gActs'); if (!el) return;
    var q = quota(), aiBtn = state.ai ? (q.left > 0 ? '<button class="btn" type="button" data-act="genai">用 Claude 生成（剩 ' + q.left + ' 次）</button>' : '<button class="btn" type="button" disabled>Claude 次数用完，' + hhmm(q.reset) + ' 恢复</button>') : '';
    el.innerHTML = '<span class="note">从团队积累的 ' + items().length + ' 条创意、拆过的 ' + state.breaks.length + ' 条对标和本模块的爆款公式里找最接近的，按你的想法改写</span><button class="btn accent" type="button" data-act="genlocal">快速生成</button>' + aiBtn + '<button class="btn" type="button" data-close>取消</button>';
  }
  function readGen() {
    gen.idea = (document.getElementById('gIdea') || {}).value || '';
    gen.occasion = (document.getElementById('gOcc') || {}).value || '常规';
    gen.who = (document.getElementById('gWho') || {}).value || '';
  }
  function saveCustom(item, input) {
    item.input = input;
    state.custom.unshift(item);
    if (!save('tmb.custom', state.custom)) toast('浏览器空间不够，这条创意只在本次打开时有效');
    renderTabs(); renderThemes();
    openItem(item.id);
    toast('已生成，放在「' + item.type + '」最前面');
  }
  var aiCtl = null;
  function runAI() {
    readGen();
    if (quota().left <= 0) { renderGenButtons(); return; }
    var input = JSON.parse(JSON.stringify(gen));
    var status = document.getElementById('gStatus');
    var btns = document.querySelectorAll('#gActs .btn'); btns.forEach(function (b) { b.disabled = true; });
    status.textContent = 'Claude 正在写…（通常 10–60 秒）';
    GEN.ai(input, pool(), function (u) { status.textContent = 'Claude 正在写… 已写 ' + u.text.length + ' 字'; })
      .then(function (item) { useQuota(); T('aiGen', item); saveCustom(item, input); var q = quota(); toast('已生成。Claude 还剩 ' + q.left + ' 次，' + hhmm(q.reset) + ' 恢复'); })
      .catch(function (e) {
        var code = e && e.code;
        if (code === 'not_granted' || code === 'sampling_disabled' || code === 'unavailable') state.ai = null;
        var msg = code === 'rate_limited' ? 'Claude 额度暂时用满了，先用快速生成。' : code === 'not_granted' ? '没有允许页面使用 Claude，已切换为快速生成。' : 'Claude 这次没生成成功，可以再试或用快速生成。';
        if (document.getElementById('gStatus')) { status.textContent = msg; renderGenButtons(); }
      });
  }

  /* ---------- 拆对标：粘贴对标爆款 → 拆解 → 改写成本店创意 ---------- */
  var BRK = window.TMB_BREAK;
  function brkBlank(p) { return { p: p || state.tab, url: '', title: '', cover: '', body: '', comments: '', data: {}, shots: [] }; }
  function brkOf(id) { return state.breaks.filter(function (b) { return b.id === id; })[0] || null; }
  function brkName(rec) { return clip1(rec.input.title || rec.input.cover || rec.input.body, 22) || '未命名对标'; }
  function clip1(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }
  function brkFor(p, theme) { return state.breaks.filter(function (b) { return b.input.p === p && (!theme || b.result.map.theme === theme); }); }
  function openBreak(id) {
    var rec = id ? brkOf(id) : null;
    state.brk = rec ? { id: rec.id, input: JSON.parse(JSON.stringify(rec.input)), result: rec.result, saved: true } : { id: null, input: brkBlank(), result: null, saved: false };
    renderBreak();
  }
  function readBreak() {
    var b = state.brk, g = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
    if (!document.getElementById('bTitle')) return;
    b.input.url = g('bUrl').trim(); b.input.title = g('bTitle'); b.input.cover = g('bCover'); b.input.body = g('bBody'); b.input.comments = g('bCmt');
    ['play', 'like', 'fav', 'cmt', 'share'].forEach(function (k) { b.input.data[k] = g('bd-' + k).trim(); });
  }
  var BRK_DATA = [['play', '播放'], ['like', '点赞'], ['fav', '收藏'], ['cmt', '评论'], ['share', '转发']];
  function brkForm() {
    var b = state.brk, x = b.input;
    var plat = '<div class="seg" role="group" aria-label="对标来自哪个平台">' + ORDER.map(function (k) { return '<button class="chip" type="button" data-bp="' + k + '" aria-pressed="' + (x.p === k) + '">' + PLATS[k].name + '</button>'; }).join('') + '</div>';
    var shots = (x.shots || []).map(function (s, i) { return '<div class="shot" style="background-image:url(' + s + ')"><button type="button" class="x" data-act="brkshotdel" data-i="' + i + '" aria-label="删除截图">×</button></div>'; }).join('');
    return '<div class="box"><h3>1 · 粘贴对标<span class="note">只分析你粘贴的内容，不联网抓数据</span></h3><div class="gen-grid">' +
      '<div class="gfield">对标来自' + plat + '</div>' +
      '<label class="gfield">标题 / 口播第一句<input id="bTitle" value="' + esc(x.title) + '" placeholder="比如：美容院一次 300，我在楼下花 19.9 搞定了"></label>' +
      '<label class="gfield">封面大字（选填）<input id="bCover" value="' + esc(x.cover) + '" placeholder="封面上最大的那行字"></label>' +
      '<label class="gfield">正文 / 口播全文<textarea id="bBody" placeholder="小红书复制正文；抖音复制文案，口播可以用字幕或自己听写">' + esc(x.body) + '</textarea></label>' +
      '<label class="gfield">热门评论（选填，一行一条，5–10 条就够）<textarea id="bCmt" class="sm" placeholder="复制点赞多的评论，能看出大家在关心什么">' + esc(x.comments) + '</textarea></label>' +
      '<div class="gfield">页面上的数据（选填，不填就不判断爆的类型）<div class="bdata">' + BRK_DATA.map(function (d) { return '<label>' + d[1] + '<input id="bd-' + d[0] + '" inputmode="decimal" value="' + esc(x.data[d[0]] || '') + '" placeholder="选填"></label>'; }).join('') + '</div></div>' +
      '<label class="gfield">链接（选填，方便回看）<input id="bUrl" value="' + esc(x.url) + '" placeholder="https://"></label>' +
      '<div class="gfield">截图（选填，存着回看，不会自动识别文字）<div class="shots">' + shots + ((x.shots || []).length < 3 ? '<label class="shot add">+<input type="file" accept="image/*" hidden id="bShot"></label>' : '') + '</div></div>' +
      '</div><div class="m-acts"><span class="note" id="bStatus" aria-live="polite"></span><button class="btn accent" type="button" data-act="brkrun">开始拆解</button>' + (state.ai ? '<button class="btn" type="button" data-act="brkai">用 Claude 深度拆解</button>' : '') + '</div></div>';
  }
  function brkLib() {
    var cur = state.brk && state.brk.id;
    if (!state.breaks.length) return '<div class="box"><h3>拆解库</h3><p class="note">拆过的对标会存在这里（当前浏览器，会跟着“备份 / 导入”一起带走）。拆得越多，空白创意和爆款公式越贴近你们自己的赛道。</p></div>';
    return '<div class="box"><h3>拆解库<span class="note">' + state.breaks.length + ' 条</span></h3><ul class="brklib">' + state.breaks.map(function (b) {
      return '<li class="' + (b.id === cur ? 'on' : '') + '"><button type="button" data-brk="' + esc(b.id) + '"><i class="dot ' + b.input.p + '"></i><b>' + esc(brkName(b)) + '</b><span>' + esc(b.result.hooks[0].label + ' · ' + b.result.struct.label + ' · ' + b.result.map.theme) + '</span></button></li>';
    }).join('') + '</ul></div>';
  }
  function brkEmpty() {
    return '<div class="box"><h3>怎么用</h3><ol class="pbsteps">' +
      [['找 3–5 条同类爆款', '抖音 / 小红书搜“自助脱毛”“脱毛 + 你的城市”，挑点赞或收藏明显高的'], ['粘进左边', '标题、正文或口播、热评；有数据就填上点赞收藏'], ['看拆解，一键改写', '告诉你它为什么火、我们能借什么、哪些不能照搬，再生成本店创意']].map(function (r, i) { return '<li><div class="ps-h"><span class="frn">' + (i + 1) + '</span><b>' + r[0] + '</b></div><p>' + r[1] + '</p></li>'; }).join('') +
      '</ol></div><div class="box"><h3>拆什么</h3><dl class="brief"><dt>钩子</dt><dd>前 3 秒 / 标题第一句用了哪一招：结果前置、反常识、身份点名、提问、实测、清单</dd><dt>情绪</dt><dd>戳中的是怕疼、怕贵、怕麻烦、怕尴尬，还是想变美、占便宜</dd><dt>结构</dt><dd>对比算账、清单、反转、实测 vlog、剧情、问答</dd><dt>互动</dt><dd>评论区在聊什么，作者怎么把人引到评论区</dd><dt>数据</dt><dd>收藏 / 点赞高 = 干货型；评论 / 点赞高 = 话题型；转发多 = 适合拉新</dd></dl></div>';
  }
  function brkResult() {
    var b = state.brk, r = b.result; if (!r) return brkEmpty();
    var P = PLATS[b.input.p], m = r.map, h0 = r.hooks[0];
    var themes = P.themes.map(function (t) { return t.name; });
    var sel = function (id, list, cur) { return '<select id="' + id + '">' + list.map(function (x) { return '<option' + (x === cur ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select>'; };
    var hooks = m.hooks.concat(m.skeleton ? [m.skeleton] : []);
    var ai = r.ai ? '<div class="box ai"><h3>Claude 补充<span class="note">基于你粘贴的内容</span></h3><dl class="brief">' + (r.ai.why ? '<dt>为什么火</dt><dd>' + esc(r.ai.why) + '</dd>' : '') + (r.ai.audience ? '<dt>谁在看</dt><dd>' + esc(r.ai.audience) + '</dd>' : '') + ((r.ai.borrow || []).length ? '<dt>能借的</dt><dd>' + r.ai.borrow.map(esc).join('<br>') + '</dd>' : '') + ((r.ai.cover || []).length ? '<dt>封面</dt><dd>' + r.ai.cover.map(function (c) { return esc(resolve(c)); }).join('<br>') + '</dd>' : '') + '</dl></div>' : '';
    var topics = r.interact.topics.length ? '<ul class="topics">' + r.interact.topics.map(function (t) {
      var rep = t.bank && typeof RP === 'function' ? RP(t.bank, 1, 'guan') : t.reply;
      return '<li><div class="tp-h"><b>' + esc(t.label) + '</b><span class="pill">' + t.n + ' 条</span></div>' + (t.sample.length ? '<p class="note">“' + t.sample.map(esc).join('”　“') + '”</p>' : '') + (rep ? '<p class="rep">' + esc(resolve(rep)).replace(/\n/g, '<br>') + '</p>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="note">没贴评论。评论区是下一条选题的来源，下次记得复制几条点赞多的。</p>';
    var sig = r.signal.rows.length ? '<table class="sb sig"><tbody>' + r.signal.rows.map(function (x) { return '<tr><td>' + esc(x.k) + '</td><td><b>' + esc(x.v) + '</b></td><td>' + esc(x.note) + '</td></tr>'; }).join('') + '</tbody></table>' : '';
    return '<div class="box"><h3>2 · 它为什么火</h3><div class="formula">' + esc(r.formula) + '</div>' + (r.summary ? '<p class="brk-sum">' + esc(r.summary) + '</p>' : '') +
      '<dl class="brief"><dt>钩子</dt><dd><b>' + esc(r.hookName || h0.label) + '</b>' + (h0.quote ? '：“' + esc(h0.quote) + '”' : '') + '<br><span class="note">' + esc(h0.why) + '</span></dd>' +
      '<dt>情绪</dt><dd>' + (r.emos.length ? r.emos.map(function (e, i) { return (i ? '' : '<b>') + esc(e.label) + (i ? '' : '</b>'); }).join(' · ') : '没有明显的情绪词，可能靠画面或人设') + '</dd>' +
      '<dt>结构</dt><dd><b>' + esc(r.struct.label) + '</b><span class="note">　' + esc(r.struct.tip) + '</span></dd>' +
      (r.cover.notes.length ? '<dt>封面</dt><dd>' + r.cover.notes.map(esc).join('；') + '</dd>' : '') +
      '<dt>互动</dt><dd>' + r.interact.notes.map(esc).join('；') + '</dd></dl></div>' + ai +
      '<div class="box"><h3>评论区在聊什么<span class="note">可以直接改成置顶和回复</span></h3>' + topics + '</div>' +
      '<div class="box"><h3>数据信号</h3>' + sig + r.signal.notes.map(function (n) { return '<p class="note">' + esc(n) + '</p>'; }).join('') + '</div>' +
      '<div class="box"><h3>3 · 改成我们的</h3>' + r.risks.map(function (x) { return '<div class="chk ' + (/没发现/.test(x) ? 'ok' : 'warn') + '">' + esc(x) + '</div>'; }).join('') +
      '<div class="gen-grid" style="margin-top:12px"><div class="gfield">选一个钩子（已按同款钩子改写，可以在生成后再改）<div class="hookpick">' + hooks.map(function (hk, i) { return '<label><input type="radio" name="bHook" value="' + i + '"' + (i === 0 ? ' checked' : '') + '><span>' + renderTpl(hk, b.input.p) + (i === hooks.length - 1 && m.skeleton ? '<em class="note">　原句骨架，把品类词换成我们的</em>' : '') + '</span></label>'; }).join('') + '</div></div>' +
      '<div class="two"><label class="gfield">放到哪个主题' + sel('bTheme', themes, m.theme) + '</label><label class="gfield">哪个账号发' + sel('bAcct', P.accts, P.accts[0]) + '</label></div>' +
      '<div class="two"><label class="gfield">形式' + sel('bForm', P.forms, m.form) + '</label><label class="gfield">挂什么活动' + sel('bOcc', GEN.occasions, m.occasion) + '</label></div></div>' +
      '<div class="m-acts"><span class="note">推荐卖点：' + esc(m.points.join('、')) + '</span><button class="btn accent" type="button" data-act="brkgen">生成本店创意</button></div></div>' +
      '<div class="box"><h3>A/B 测试建议</h3><p>' + esc(resolve(r.ab.test)) + '</p><p class="note">看哪个数定胜负：' + esc(r.ab.metric) + '</p></div>';
  }
  function renderBreak() {
    var b = state.brk, keep = layer.querySelector('.d-body'), st = keep ? keep.scrollTop : 0;
    state.open = null;
    layer.innerHTML = '<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="bkTitle">' +
      '<div class="d-head"><div><div class="pills" style="margin:0"><span class="pill mine">拆对标</span>' + (b.saved ? '<span class="pill">已存入拆解库</span>' : '') + '</div>' +
      '<h2 id="bkTitle">' + (b.result ? esc(brkName(b)) : '拆一条对标爆款') + '</h2><p class="angle">把同行的爆款拆成“钩子 + 情绪 + 结构 + 互动”，看清它为什么火，再一键改写成本店能发的创意。</p></div>' +
      '<div class="acts">' + (b.result ? '<button class="btn" type="button" data-act="brkcopy">复制拆解</button>' : '') + (b.result && !b.saved ? '<button class="btn" type="button" data-act="brksave">存入拆解库</button>' : '') + (b.saved ? '<button class="btn ghost" type="button" data-act="brkdel">删除</button>' : '') + '<button class="btn" type="button" data-act="brknew">再拆一条</button><button class="btn" type="button" data-close>关闭</button></div></div>' +
      '<div class="d-body brk-body"><div class="col">' + brkForm() + brkLib() + '</div><div class="col">' + brkResult() + '</div></div></aside>';
    var nb = layer.querySelector('.d-body'); if (nb) nb.scrollTop = st;
  }
  function saveBreakRec() {
    var b = state.brk; if (!b.result) return null;
    var rec = { id: b.id || 'bk' + Date.now().toString(36), at: Date.now(), input: JSON.parse(JSON.stringify(b.input)), result: b.result };
    state.breaks = [rec].concat(state.breaks.filter(function (x) { return x.id !== rec.id; }));
    b.id = rec.id; b.saved = true;
    if (!save('tmb.breaks', state.breaks)) {
      rec.input.shots = []; save('tmb.breaks', state.breaks);
      toast('浏览器空间不够，截图没存下来，文字拆解已保存');
    }
    return rec;
  }
  function brkText(r, x) {
    return ['【对标拆解 · ' + PLATS[x.p].name + '】' + (x.title || ''), x.url ? '链接：' + x.url : '', '爆点公式：' + r.formula,
      '钩子：' + r.hooks[0].label + (r.hooks[0].quote ? '（“' + r.hooks[0].quote + '”）' : '') + '——' + r.hooks[0].why,
      '情绪：' + (r.emos.map(function (e) { return e.label; }).join('、') || '无明显情绪词'), '结构：' + r.struct.label, '互动：' + r.interact.notes.join('；'),
      r.interact.topics.length ? '评论区在聊：' + r.interact.topics.map(function (t) { return t.label + ' ' + t.n + ' 条'; }).join('、') : '',
      r.signal.rows.length ? '数据：' + r.signal.rows.map(function (s) { return s.k + ' ' + s.v + '（' + s.note + '）'; }).join('；') : '',
      '迁移提醒：' + r.risks.join('；'), '改写钩子：' + r.map.hooks.map(resolve).join(' / '), 'A/B：' + resolve(r.ab.test) + '；看' + r.ab.metric].filter(Boolean).join('\n');
  }
  function runBreakAI() {
    readBreak();
    var b = state.brk, st = document.getElementById('bStatus');
    if (quota().left <= 0) { if (st) st.textContent = 'Claude 次数用完了，' + hhmm(quota().reset) + ' 恢复；本地拆解照常能用。'; return; }
    if (!b.result) b.result = BRK.analyze(b.input, { scan: scanText });
    var x = b.input, P = PLATS[x.p];
    if (st) st.textContent = 'Claude 正在拆…（通常 10–40 秒）';
    GEN.sample().then(function (sample) {
      if (!sample) throw { code: 'unavailable' };
      var prompt = ['你是做本地生活引流的内容策划，服务 Ulike脱毛吧（Ulike 家用脱毛仪品牌开的无人值守自助脱毛店：独立隔间、扫码开机、语音指引、按次付费，开在商场、园区、学校附近）。',
        '下面是一条' + P.name + '上的对标内容，只根据这些文字判断，不要编造播放量或数据：',
        '标题/首句：' + x.title, '封面：' + x.cover, '正文/口播：' + clip1(x.body, 2400), '热评：' + clip1(x.comments, 800),
        '页面数据：' + BRK_DATA.map(function (d) { return d[1] + (x.data[d[0]] || '未填'); }).join('，'),
        '规则拆解的初步结论：' + b.result.formula,
        '请输出一个 JSON：{"why": "它为什么能火，2 句，说到具体手法", "audience": "谁会看、在什么场景刷到", "borrow": ["我们能借的 3 个具体做法"], "hooks": ["改写给脱毛吧的 3 个钩子/标题，≤22 字，像真人说话，不是广告腔"], "cover": ["封面大字 2 版，≤12 字，可用\\n换行"], "risks": ["迁移时不能照搬的地方"]}',
        '要求：价格写 {新人价}、商场写 {商场}；不用 最/第一/永久/无痛/100%/保证效果 等词，体感只说具体感受；抖音小红书里不写美团/微信/私信；不冒充顾客。'].join('\n');
      return sample.json(prompt, { cache: false });
    }).then(function (j) {
      if (!j || typeof j !== 'object') throw { code: 'invalid_json' };
      useQuota();
      var fx = RULES.fix, arr = function (a) { return Array.isArray(a) ? a.map(function (s) { return fx(String(s)); }).filter(Boolean) : []; };
      b.result.ai = { why: fx(j.why || ''), audience: fx(j.audience || ''), borrow: arr(j.borrow), cover: arr(j.cover) };
      var hs = arr(j.hooks);
      if (hs.length) b.result.map.hooks = hs.concat(b.result.map.hooks.filter(function (h) { return hs.indexOf(h) < 0; })).slice(0, 5);
      arr(j.risks).forEach(function (rk) { if (b.result.risks.indexOf(rk) < 0) b.result.risks.push(rk); });
      b.result.risks = b.result.risks.filter(function (rk) { return !/没发现明显风险/.test(rk) || b.result.risks.length === 1; });
      if (b.saved) saveBreakRec();
      renderBreak(); toast('Claude 拆完了，还剩 ' + quota().left + ' 次');
    }).catch(function (e) {
      var code = e && e.code;
      if (code === 'not_granted' || code === 'unavailable') state.ai = null;
      var s2 = document.getElementById('bStatus'); if (s2) s2.textContent = code === 'rate_limited' ? 'Claude 额度暂时用满了，先看本地拆解。' : 'Claude 这次没拆成功，本地拆解结果照常可用。';
      if (b.result) renderBreak();
    });
  }
  /* 模板的钩子备选和 A/B：没有手写的，就从本主题爆款公式里挑两个不同类型的钩子 */
  function bigrams(s) { s = String(s).replace(/\{[^}]*\}|[\s，。、！？：；|｜·“”]/g, ''); var g = {}; for (var i = 0; i < s.length - 1; i++) g[s.substr(i, 2)] = 1; return g; }
  function similar(a, b) { var A = bigrams(a), B = bigrams(b), n = 0, t = 0; for (var k in A) { t++; if (B[k]) n++; } return t ? n / t : 0; }
  function hashId(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function abOf(it) {
    if (it.ab) return it.ab;
    var metric = it.p === 'xhs' ? '封面点击率和收藏率' : it.p === 'pyq' ? '咨询数和本店渠道码核销' : '3 秒留存和完播率';
    if (it.p === 'pyq') return { hooks: [], test: '同一周分别发文案 1 和文案 2（隔 2 天以上），配图不变，看哪条带来的咨询和本店码核销多，下次就用赢的那种说法。', metric: metric };
    var P0 = pb(it.p, it.type), own = BRK.hookOf(String(it.title) + '\n' + String(it.cover.main || '').replace(/\n/g, ''));
    /* 只用和这条内容场景对得上的钩子；带选填门店信息的不用（没填会缺字） */
    var scene = GEN.sceneOf(it.title + JSON.stringify(it.brief || {}), true);
    if (['午休', '下班路上', '逛街', '下课后', '健身前后'].indexOf(scene) < 0) scene = null; /* 钩子里的 {scene} 是时间 / 地点，社交、节日类场景套进去读不通 */
    var cands = ((P0 && P0.gen && P0.gen.hooks) || []).concat((P0 && P0.gen && P0.gen.titles) || [])
      .filter(function (h) { return (scene || h.indexOf('{scene}') < 0) && !/\{(位置|周边|区域|营业时间)\}|【N】/.test(h); })
      .map(function (h) { return RULES.fix(h.replace(/\{scene\}/g, scene || '')); });
    /* 活动要对得上：女神节的模板不推“冬季 20 次卡”的钩子 */
    cands = cands.filter(function (c) { var o = GEN.periodOf(c); return o === '常规' || o === it.period; });
    var start = hashId(it.id) % Math.max(1, cands.length), picked = [], types = [own];
    for (var n = 0; n < cands.length && picked.length < 2; n++) {
      var c = cands[(start + n) % cands.length], t = BRK.hookOf(c);
      if (c === it.title || picked.indexOf(c) >= 0 || [it.title].concat(picked).some(function (x) { return similar(x, c) > 0.5; })) continue;
      if (types.indexOf(t) < 0 || n >= cands.length - (2 - picked.length)) { picked.push(c); types.push(t); }
    }
    /* 本主题公式里不够两条：从拆对标的改写库里补不同类型的钩子 */
    ['ask', 'contra', 'name', 'list', 'test'].forEach(function (k) {
      if (picked.length >= 2 || types.indexOf(k) >= 0) return;
      var c = (BRK.rewrite[k]._ || []).filter(function (x) { return [it.title].concat(picked).every(function (y) { return similar(y, x) <= 0.5; }); })[hashId(it.id) % 3];
      if (c) { picked.push(c); types.push(k); }
    });
    var lab = function (h) { return BRK.hookLabel(BRK.hookOf(h)); };
    var hooks = [it.title].concat(picked);
    return { hooks: hooks, test: hooks.length > 1 ? '先用 A 发；同主题下一条换成 B（' + lab(hooks[1]) + '），封面和正文其余不变，发布时段相同，各看 48 小时。' : '', metric: metric, labels: hooks.map(lab) };
  }

  /* ---------- 弹层：门店与价格 / 图库 / 备份 ---------- */
  function modal(inner) { state.open = null; layer.innerHTML = '<div class="scrim" data-close></div><div class="modal" role="dialog" aria-modal="true">' + inner + '</div>'; }
  function storeModal() {
    var s = store();
    var f1 = VARS.store.map(function (x) { var v = s.vars[x.k] || ''; return '<label>' + x.label + (x.hint ? ' · ' + x.hint : '') + '<input data-sv="' + x.k + '" id="sv-' + x.k + '" value="' + esc(v) + '" class="' + (v ? '' : 'miss') + '"></label>'; }).join('');
    var f2 = VARS.price.map(function (x) { return '<label>' + x.label + '<input data-pv="' + x.k + '" id="pv-' + x.k + '" value="' + esc(state.prices[x.k]) + '"></label>'; }).join('');
    modal('<h2>门店与价格</h2><p class="sub">改一次，所有创意里的店名、位置、价格同步更新。门店信息只影响当前门店；价格全国统一。</p>' +
      '<h3>当前门店：' + esc(s.vars['简称'] || '') + '<span><button class="btn sm" type="button" data-act="addstore">+ 新增门店</button> ' + (state.stores.length > 1 ? '<button class="btn sm ghost" type="button" data-act="delstore">删除此门店</button>' : '') + '</span></h3><div class="form">' + f1 + '</div>' +
      '<h3>统一价格与活动日期<span class="note">以美团当期上架价为准</span></h3><div class="form">' + f2 + '</div>' +
      '<div class="m-acts"><button class="btn" type="button" data-close>关闭</button></div>');
  }
  function photoModal() {
    var s = store(), n = Object.keys(state.photos[state.cur] || {}).length;
    modal('<h2>门店图库 · ' + esc(s.vars['简称'] || '') + '</h2><p class="sub">合作商开店时按这 10 张拍一次。上传后，所有用到这张图的创意都会换成本店照片。已上传 ' + n + ' / 10。</p>' +
      '<div class="slots" style="grid-template-columns:repeat(auto-fill,minmax(128px,1fr))">' + Object.keys(SLOTS).map(slotTile).join('') + '</div>' +
      '<p class="note">照片保存在当前浏览器里（压缩到 900 像素）。换电脑或清理浏览器数据后需要重新上传。</p>' +
      '<div class="m-acts">' + (n ? '<button class="btn ghost" type="button" data-act="clearphotos">清空本店照片</button>' : '') + '<button class="btn" type="button" data-close>关闭</button></div>');
  }
  function backupModal() {
    var data = JSON.stringify({ edits: state.edits, custom: state.custom, stores: state.stores, prices: state.prices, cur: state.cur, breaks: state.breaks.map(function (b) { var c = JSON.parse(JSON.stringify(b)); c.input.shots = []; return c; }) });
    modal('<h2>备份 / 导入</h2><p class="sub">改过的文案、生成的创意、拆过的对标、门店信息和价格都存在当前浏览器里。要给同事，复制下面的内容发过去；同事在这里粘贴后点“导入”。门店照片和对标截图不包含在内。</p>' +
      '<textarea class="ed" id="bk" rows="10" style="font-family:var(--f-mono);font-size:12px">' + esc(data) + '</textarea>' +
      '<div class="m-acts"><button class="btn" type="button" data-act="copybk">复制备份</button><button class="btn primary" type="button" data-act="import">导入粘贴的内容</button><button class="btn" type="button" data-close>关闭</button></div>');
  }
  function logModal() {
    var V = window.TMB_VERSION || { v: '', log: [] };
    modal('<h2>更新日志 · v' + esc(V.v) + '</h2><p class="sub">' + esc(V.date || '') + ' 更新。旧版本存的改动、生成的创意和门店信息都还在。</p>' +
      V.log.map(function (g) { return '<h3>' + esc(g.title) + '</h3><ul class="pblist">' + g.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>'; }).join('') +
      '<div class="m-acts"><button class="btn" type="button" data-close>知道了</button></div>');
  }
  function lightbox(name) {
    var d = document.createElement('div'); d.className = 'lightbox';
    d.innerHTML = '<div><img src="' + refSrc(name) + '" alt="' + esc(REFS[name]) + '"><p>' + esc(REFS[name]) + ' · 点击任意处关闭</p></div>';
    document.body.appendChild(d); d.addEventListener('click', function () { d.remove(); });
  }

  /* ---------- 工具 ---------- */
  var toastT;
  function toast(msg) { var t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 2400); }
  function copy(text, msg) {
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} ta.remove(); toast(ok ? (msg || '已复制') : '复制失败，请手动选中文字复制'); }
    try { navigator.clipboard.writeText(text).then(function () { toast(msg || '已复制'); }, fallback); } catch (e) { fallback(); }
  }
  function compress(file, cb) {
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () { var sc = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', 0.8)); };
      img.onerror = function () { toast('这张图片读不出来，换一张 JPG 或 PNG 试试'); };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }

  /* ---------- 事件 ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-frame],[data-pb],[data-pbcopy],[data-tab],[data-f],[data-open],[data-new],[data-close],[data-act],[data-ref],[data-jump],[data-pg],[data-copytheme],[data-g],[data-bp],[data-brk],[data-gbrk],[data-openbrk],#copyTab,#btnStore,#btnPhotos,#btnBackup,#btnBreak,#btnLog');
    if (!t) return;
    if (t.dataset.tab) { state.tab = t.dataset.tab; state.acct = null; state.period = null; save('tmb.tab', state.tab); renderMain(); window.scrollTo(0, 0); return; }
    if (t.dataset.f) { state[t.dataset.f] = t.dataset.v === '全部' ? null : t.dataset.v; renderFilters(); renderThemes(); return; }
    if (t.dataset.jump) { var sec = document.getElementById('theme-' + t.dataset.jump); if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (t.dataset.pg) { var tr = t.closest('.theme').querySelector('.track'); tr.scrollBy({ left: (+t.dataset.pg) * (tr.clientWidth + 1), behavior: 'smooth' }); return; }
    if (t.dataset.copytheme) { var th = PLATS[state.tab].themes[+t.dataset.copytheme].name, l = themeItems(state.tab, th); T('copy', null, PLATS[state.tab].name + ' · 复制主题「' + th + '」'); copy(l.map(plainAll).join('\n\n==========\n\n'), '已复制「' + th + '」' + l.length + ' 条'); return; }
    if (t.dataset.open) { openItem(t.dataset.open); return; }
    if (t.dataset.new) { genModal(state.tab, +t.dataset.new); return; }
    if (t.dataset.pb) { pbPanel(+t.dataset.pb); return; }
    if (t.dataset.frame !== undefined && state.open) { state.frame = +t.dataset.frame; renderDrawer(); return; }
    if (t.dataset.pbcopy) { copy(pbText(+t.dataset.pbcopy), '已复制公式'); return; }
    if (t.hasAttribute('data-close')) { closeLayer(); return; }
    if (t.dataset.ref) { lightbox(t.dataset.ref); return; }
    if (t.dataset.g) {
      var key = t.dataset.g, v = t.dataset.gv;
      readGen();
      if (t.dataset.multi) { var arr = gen[key], i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else { arr.push(v); if (arr.length > 3) arr.shift(); } }
      else gen[key] = v;
      t.parentNode.querySelectorAll('.chip').forEach(function (c) { c.setAttribute('aria-pressed', t.dataset.multi ? String(gen[key].indexOf(c.dataset.gv) >= 0) : String(c.dataset.gv === gen[key])); });
      return;
    }
    if (t.id === 'copyTab') { var all = items().filter(function (i) { return i.p === state.tab; }); T('copy', null, PLATS[state.tab].name + ' · 复制本平台全部'); copy(all.map(plainAll).join('\n\n==========\n\n'), '已复制 ' + all.length + ' 条'); return; }
    if (t.id === 'btnStore') { storeModal(); return; }
    if (t.id === 'btnPhotos') { photoModal(); return; }
    if (t.id === 'btnBackup') { backupModal(); return; }
    if (t.id === 'btnBreak' || t.dataset.openbrk) { var keepP = t.dataset.openbrk ? state.tab : null; openBreak(); if (keepP) { state.brk.input.p = keepP; renderBreak(); } return; }
    if (t.id === 'btnLog') { logModal(); return; }
    if (t.dataset.bp) { readBreak(); if (state.brk.input.p !== t.dataset.bp) { state.brk.input.p = t.dataset.bp; state.brk.result = null; state.brk.saved = false; state.brk.id = null; } renderBreak(); return; }
    if (t.dataset.brk) { openBreak(t.dataset.brk); return; }
    if (t.dataset.gbrk) {
      readGen(); var gr = brkOf(t.dataset.gbrk); if (!gr) return;
      var gin = BRK.toInput(gr, { theme: gen.theme, acct: gen.acct }), GP = PLATS[gen.p];
      gen.idea = gin.idea; gen.points = gin.points; gen.occasion = gin.occasion;
      if (GP.forms.indexOf(gin.form) >= 0) gen.form = gin.form;
      genModal(gen.p, gen.themeIdx, gen); toast('已用《' + brkName(gr) + '》的钩子和结构填好，可以再改'); return;
    }

    var act = t.dataset.act, it = state.open;
    if (act === 'brkrun') {
      readBreak(); var bx = state.brk.input, st0 = document.getElementById('bStatus');
      if ((bx.title + bx.cover + bx.body).replace(/\s/g, '').length < 8) { if (st0) st0.textContent = '至少粘贴标题或正文（8 个字以上）'; return; }
      var keepAi = state.brk.result && state.brk.result.ai;
      state.brk.result = BRK.analyze(bx, { scan: scanText });
      if (keepAi) state.brk.result.ai = keepAi;
      saveBreakRec(); T('break', null, '拆对标 · ' + brkName(state.brk));
      renderBreak(); var nb2 = layer.querySelector('.brk-body'); if (nb2) { nb2.scrollTop = 0; if (window.innerWidth < 860) { var rc = nb2.querySelectorAll('.col')[1]; if (rc) rc.scrollIntoView({ behavior: 'smooth' }); } }
      toast('拆完了，已存入拆解库'); return;
    }
    if (act === 'brkai') { runBreakAI(); return; }
    if (act === 'brknew') { readBreak(); var lp = state.brk.input.p; state.brk = { id: null, input: brkBlank(lp), result: null, saved: false }; renderBreak(); var bt = document.getElementById('bTitle'); if (bt) bt.focus(); return; }
    if (act === 'brkcopy') { readBreak(); copy(brkText(state.brk.result, state.brk.input), '已复制拆解'); return; }
    if (act === 'brkshotdel') { readBreak(); state.brk.input.shots.splice(+t.dataset.i, 1); if (state.brk.saved) saveBreakRec(); renderBreak(); return; }
    if (act === 'brkdel') {
      if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = '再点一次确认删除'; return; }
      state.breaks = state.breaks.filter(function (x) { return x.id !== state.brk.id; }); save('tmb.breaks', state.breaks);
      openBreak(); toast('已从拆解库删除'); return;
    }
    if (act === 'brkgen') {
      readBreak(); var rec = saveBreakRec(); if (!rec) return;
      var hk = layer.querySelector('input[name="bHook"]:checked'), hooks = rec.result.map.hooks.concat(rec.result.map.skeleton ? [rec.result.map.skeleton] : []);
      var g = function (id) { var el = document.getElementById(id); return el ? el.value : ''; };
      var hook = hooks[hk ? +hk.value : 0] || hooks[0];
      var bin = BRK.toInput(rec, { theme: g('bTheme'), acct: g('bAcct'), form: g('bForm'), hook: hook }); bin.occasion = g('bOcc') || bin.occasion;
      var bi = GEN.smart(bin, 0, pool());
      bi.fromBreak = rec.id;
      bi.angle = '改写自对标《' + brkName(rec) + '》：借它的' + (rec.result.hookName || rec.result.hooks[0].label) + '开头和' + rec.result.struct.label + '结构，戳「' + ((rec.result.emos[0] || {}).label || '好奇') + '」。' + (bi.basedOn && bi.basedOn[0] && byId(bi.basedOn[0]) ? '拍法参考《' + resolve(byId(bi.basedOn[0]).title) + '》。' : '');
      var alts = [bi.title].concat(rec.result.map.hooks.filter(function (h) { return h !== hook && h !== bi.title; })).slice(0, 3);
      bi.ab = { hooks: alts, test: rec.result.ab.test, metric: rec.result.ab.metric };
      T('breakGen', bi);
      if (state.tab !== bin.p) { state.tab = bin.p; save('tmb.tab', state.tab); renderMain(); }
      saveCustom(bi, bin); return;
    }
    if (act === 'abcopy') { copy(resolve(t.dataset.h), '已复制钩子'); return; }
    if (act === 'genlocal') { readGen(); var inp = JSON.parse(JSON.stringify(gen)); var ns = Math.floor(Math.random() * 3); var gi = GEN.smart(inp, ns, pool()); gi.seed = ns; T('quickGen', gi); saveCustom(gi, inp); return; }
    if (act === 'genai') { runAI(); return; }
    var fe = t.closest('.field'), k = fe && fe.dataset.k;
    var fdef = it && k ? fieldsOf(it).concat([['coverMain', '', 'long'], ['coverSub', '', 'text']]).filter(function (f) { return f[0] === k; })[0] : null;
    if (act === 'copyall') { T('copy', it); copy(plainAll(it), '已复制全部文案'); return; }
    if (act === 'resetall') { delete state.edits[it.id]; save('tmb.edits', state.edits); state.editing = {}; renderDrawer(); toast('已恢复默认'); return; }
    if (act === 'regen') {
      var input = it.input || { p: it.p, theme: it.type, acct: it.acct, form: it.form, idea: '', points: [], occasion: '常规' };
      var seed = (it.seed || 0) + 1, nx = GEN.smart(input, seed, pool(it.id));
      nx.id = it.id; nx.seed = seed; nx.input = input;
      state.custom = state.custom.map(function (c) { return c.id === it.id ? nx : c; });
      delete state.edits[it.id]; save('tmb.edits', state.edits); save('tmb.custom', state.custom);
      state.open = nx; state.editing = {}; renderDrawer(); T('quickGen', nx); toast('已换一版'); return;
    }
    if (act === 'delcustom') {
      if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = '再点一次确认删除'; return; }
      state.custom = state.custom.filter(function (c) { return c.id !== it.id; }); save('tmb.custom', state.custom);
      delete state.edits[it.id]; save('tmb.edits', state.edits); closeLayer(); toast('已删除'); return;
    }
    if (act === 'copy') { T('copy', it); var v2 = val(it, k); copy(fdef[2] === 'table' ? v2.map(function (r) { return r.map(resolve).join('｜'); }).join('\n') : resolve(v2)); return; }
    if (act === 'edit') { state.editing[k] = true; renderDrawer(); var ta = layer.querySelector('[data-k="' + k + '"] textarea'); if (ta) ta.focus(); return; }
    if (act === 'cancel') { delete state.editing[k]; renderDrawer(); return; }
    if (act === 'reset') { resetVal(it, k); delete state.editing[k]; renderDrawer(); toast('已恢复默认'); return; }
    if (act === 'save' || act === 'addrow' || act === 'delrow') {
      if (fdef[2] === 'table') {
        var rows = []; fe.querySelectorAll('textarea[data-r]').forEach(function (x) { var r = +x.dataset.r, c = +x.dataset.c; rows[r] = rows[r] || ['', '', '']; rows[r][c] = x.value; });
        rows = rows.filter(Boolean);
        if (act === 'addrow') { rows.push(['', '', '']); setVal(it, k, rows); renderDrawer(); return; }
        if (act === 'delrow') { rows.splice(+t.dataset.r, 1); setVal(it, k, rows); renderDrawer(); return; }
        setVal(it, k, rows);
      } else setVal(it, k, fe.querySelector('textarea').value);
      delete state.editing[k]; renderDrawer(); T('edit', it); toast('已保存'); return;
    }
    if (act === 'addstore') {
      var id = 's' + Date.now().toString(36), nv = defaults(VARS.store); Object.keys(nv).forEach(function (x) { nv[x] = ''; });
      nv['简称'] = '新门店 ' + (state.stores.length + 1); nv['城市'] = store().vars['城市'] || '';
      state.stores.push({ id: id, vars: nv }); state.cur = id; state.photos[id] = {};
      save('tmb.stores', state.stores); save('tmb.cur', state.cur); renderStoreSel(); storeModal(); renderThemes(); return;
    }
    if (act === 'delstore') {
      if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = '再点一次确认删除'; return; }
      var nm = store().vars['简称']; try { localStorage.removeItem('tmb.photos.' + state.cur); } catch (err) {}
      state.stores = state.stores.filter(function (s) { return s.id !== state.cur; }); state.cur = state.stores[0].id;
      save('tmb.stores', state.stores); save('tmb.cur', state.cur); renderAll(); renderStoreSel(); storeModal(); toast('已删除 ' + nm); return;
    }
    if (act === 'clearphotos') {
      if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = '再点一次确认清空'; return; }
      state.photos[state.cur] = {}; try { localStorage.removeItem('tmb.photos.' + state.cur); } catch (err) {} photoModal(); renderThemes(); return;
    }
    if (act === 'copybk') { copy(document.getElementById('bk').value, '已复制备份'); return; }
    if (act === 'import') {
      try {
        var d = JSON.parse(document.getElementById('bk').value);
        if (d.edits) state.edits = d.edits; if (Array.isArray(d.custom)) state.custom = d.custom;
        if (Array.isArray(d.breaks)) { var have = {}; state.breaks.forEach(function (b) { have[b.id] = 1; }); state.breaks = state.breaks.concat(d.breaks.filter(function (b) { return b && b.id && b.result && !have[b.id]; })); save('tmb.breaks', state.breaks); }
        if (d.stores && d.stores.length) state.stores = d.stores; if (d.prices) state.prices = Object.assign(defaults(VARS.price), d.prices);
        state.cur = d.cur && state.stores.some(function (s) { return s.id === d.cur; }) ? d.cur : state.stores[0].id;
        state.stores.forEach(function (s) { state.photos[s.id] = state.photos[s.id] || load('tmb.photos.' + s.id, {}); });
        save('tmb.edits', state.edits); save('tmb.custom', state.custom); save('tmb.stores', state.stores); save('tmb.prices', state.prices); save('tmb.cur', state.cur);
        closeLayer(); renderStoreSel(); renderMain(); toast('导入成功');
      } catch (err) { toast('导入失败：内容不是完整的备份，请重新复制'); }
    }
  });
  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'q') { state.q = t.value; renderThemes(); return; }
    if (t.dataset.sv) { store().vars[t.dataset.sv] = t.value.trim(); t.classList.toggle('miss', !t.value.trim()); save('tmb.stores', state.stores); if (t.dataset.sv === '城市' || t.dataset.sv === '简称') renderStoreSel(); renderThemes(); return; }
    if (t.dataset.pv) { state.prices[t.dataset.pv] = t.value.trim(); save('tmb.prices', state.prices); renderThemes(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'citySel') {
      var first = state.stores.filter(function (s) { return (s.vars['城市'] || '未填城市') === t.value; })[0];
      if (first) { state.cur = first.id; save('tmb.cur', state.cur); renderAll(); renderStoreSel(); toast('已切换到 ' + t.value + ' · ' + (first.vars['简称'] || '')); }
      return;
    }
    if (t.id === 'storeSel') { state.cur = t.value; save('tmb.cur', state.cur); renderAll(); toast('已切换到 ' + (store().vars['简称'] || '')); return; }
    if (t.id === 'bShot' && t.files && t.files[0]) {
      readBreak();
      compress(t.files[0], function (url) { state.brk.input.shots = (state.brk.input.shots || []).concat([url]).slice(0, 3); if (state.brk.saved) saveBreakRec(); renderBreak(); });
      return;
    }
    if (t.dataset.slot && t.files && t.files[0]) {
      var slot = t.dataset.slot;
      compress(t.files[0], function (url) {
        state.photos[state.cur] = state.photos[state.cur] || {}; state.photos[state.cur][slot] = url;
        var ok = save('tmb.photos.' + state.cur, state.photos[state.cur]);
        toast(ok ? '已换成本店照片：' + SLOTS[slot].name : '浏览器空间不够，这张图只在本次打开时有效');
        if (state.open) renderDrawer(); else if (layer.querySelector('.modal')) photoModal();
        renderThemes();
      });
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var lb = document.querySelector('.lightbox'); if (lb) { lb.remove(); return; }
    if (layer.innerHTML) closeLayer();
  });
  window.addEventListener('resize', function () { document.querySelectorAll('.track').forEach(updatePager); });
  window.addEventListener('hashchange', function () { var id = location.hash.slice(1); if (id && byId(id) && id !== (state.open && state.open.id)) { var it = byId(id); if (it.p !== state.tab) { state.tab = it.p; renderMain(); } openItem(id); } });

  renderStoreSel(); renderMain();
  (function () {
    var V = window.TMB_VERSION; if (!V) return;
    var el = document.getElementById('ver'); if (el) el.textContent = 'v' + V.v;
    var seen = load('tmb.ver', ''), used = load('tmb.tab', null);
    if (seen !== V.v && (seen || used)) setTimeout(function () { toast('素材台已更新到 v' + V.v + '，点左上角版本号看更新了什么'); }, 600);
    save('tmb.ver', V.v);
  })();
  var h = location.hash.slice(1), hi = h && byId(h);
  if (hi) { if (hi.p !== state.tab) { state.tab = hi.p; renderMain(); } openItem(h); }
})();
