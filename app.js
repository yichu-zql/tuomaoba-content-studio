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

  /* ---------- 存储（每个浏览器各存一份） ---------- */
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function defaults(list) { var o = {}; list.forEach(function (x) { o[x.k] = x.def; }); return o; }

  var state = {
    tab: load('tmb.tab', 'douyin'), acct: null, period: null, q: '',
    edits: load('tmb.edits', {}),
    custom: load('tmb.custom', []),
    stores: load('tmb.stores', null) || [{ id: 's1', vars: defaults(VARS.store) }],
    cur: load('tmb.cur', 's1'),
    prices: Object.assign(defaults(VARS.price), load('tmb.prices', {})),
    photos: {}, open: null, editing: {}, ai: null
  };
  if (ORDER.indexOf(state.tab) < 0) state.tab = 'douyin';
  if (!state.stores.some(function (s) { return s.id === state.cur; })) state.cur = state.stores[0].id;
  state.stores.forEach(function (s) { state.photos[s.id] = load('tmb.photos.' + s.id, {}); });
  GEN.sample().then(function (s) { state.ai = s; if (layer.querySelector('#genForm')) renderGenButtons(); });

  function items() { return state.custom.concat(BASE); }
  function byId(id) { return items().filter(function (i) { return i.id === id; })[0]; }
  function store() { return state.stores.filter(function (s) { return s.id === state.cur; })[0]; }
  function allVars() { return Object.assign({}, state.prices, store().vars); }
  var LABELS = {}; VARS.store.concat(VARS.price).forEach(function (x) { LABELS[x.k] = x.label; });

  /* ---------- 文本与合规 ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function resolve(t) {
    var v = allVars();
    return String(t == null ? '' : t).replace(/\{([^{}\n]+)\}/g, function (m, k) { if (!(k in v)) return m; return v[k] ? v[k] : '【待填：' + (LABELS[k] || k) + '】'; });
  }
  var BAN = ['永久', '根治', '治疗', '治愈', '疗效', '医用', '医院级', '医疗级', '无副作用', '零风险', '包好', '一次见效', '立刻见效', '彻底告别', '顶级', '极致', '唯一', '首选', '全网最低', '100%', '绝对', '保证效果', '无痛', '不痛', '零痛感', '国家级'];
  var CAU_ALL = ['比基尼', '私处'];
  var CAU_SOCIAL = ['美团', '大众点评', '某团', '微信', 'vx', 'VX', '加V', '私信', '二维码', '链接'];
  function reEsc(x) { return x.replace(/[.*+?^${}()|[\]\\%]/g, '\\$&'); }
  var BAN_RE = new RegExp(BAN.map(reEsc).concat(['第一(?![次个周张单天步篇轮视])', '最(?![近多后少低至])']).join('|'), 'g');
  function cauRe(p) { var l = CAU_ALL.concat(p === 'douyin' || p === 'xhs' ? CAU_SOCIAL : []); return new RegExp(l.map(reEsc).join('|'), 'g'); }
  function scanText(text, p) {
    var out = [], m; BAN_RE.lastIndex = 0;
    while ((m = BAN_RE.exec(text))) out.push({ w: m[0], lv: 'ban' });
    var cr = cauRe(p); while ((m = cr.exec(text))) out.push({ w: m[0], lv: 'cau' });
    return out;
  }
  function renderTpl(t, p) {
    var v = allVars(), cr = cauRe(p);
    return String(t == null ? '' : t).split(/(\{[^{}\n]+\})/g).map(function (part) {
      var m = part.match(/^\{([^{}\n]+)\}$/);
      if (m && (m[1] in v)) return v[m[1]] ? '<span class="v" title="' + esc(LABELS[m[1]] || m[1]) + '">' + esc(v[m[1]]) + '</span>' : '<span class="v miss">待填：' + esc(LABELS[m[1]] || m[1]) + '</span>';
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
  function fieldsOf(it) { return FIELDS[it.p].filter(function (f) { return it.f[f[0]] !== undefined; }); }
  function itemText(it) {
    var parts = [resolve(val(it, 'coverMain')), resolve(val(it, 'coverSub')), resolve(it.title)];
    fieldsOf(it).forEach(function (f) { var v = val(it, f[0]); parts.push(f[2] === 'table' ? v.map(function (r) { return r.join(' '); }).join('\n') : resolve(v)); });
    return parts.join('\n');
  }
  function scanItem(it) { return scanText(itemText(it), it.p); }
  function plainAll(it) {
    var out = ['【' + PLATS[it.p].name + ' · ' + it.acct + ' · ' + it.type + '】' + resolve(it.title), '封面：' + resolve(val(it, 'coverMain')).replace(/\n/g, ' ') + '｜' + resolve(val(it, 'coverSub')), ''];
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
    h += '<span class="brandtag">Ulike 脱毛吧</span><span class="platmark">' + PLATS[it.p].name + '</span>';
    h += '<div class="cv-in"><h4>' + esc(resolve(val(it, 'coverMain'))) + '</h4><span class="sub">' + esc(resolve(val(it, 'coverSub'))) + '</span>';
    if (it.p === 'sph' && val(it, 'mount')) h += '<span class="mount">' + esc(resolve(String(val(it, 'mount')).replace(/^[^：]*：/, '').replace(/[「」]/g, ''))) + '</span>';
    h += '</div>';
    if (video) {
      var first = resolve(val(it, 'post') || val(it, 'summary') || it.title).split('\n')[0];
      h += (mode === 'big' ? '<div class="side"><i></i><i></i><i></i></div>' : '') + '<div class="vbar"><b>@' + (it.acct === '门店号' ? esc(resolve('{简称}')) : it.acct === '公众号' ? 'Ulike脱毛吧 公众号' : 'Ulike脱毛吧') + '</b><span>' + esc(first) + '</span></div>';
    }
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
    document.getElementById('platHead').innerHTML = '<div><h1>' + P.name + '：' + P.lead + '</h1><p>' + P.desc + '</p><div class="pills">' + P.freq.map(function (g) { return '<span class="pill">' + g + '</span>'; }).join('') + '</div></div>' +
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
  function renderThemes() {
    var P = PLATS[state.tab];
    document.getElementById('themes').innerHTML = P.themes.map(function (t, i) {
      var list = themeItems(state.tab, t.name);
      var say = t.ratio && t.dian ? '<span><b>官号：</b>' + t.guan + '</span><span><b>门店号：</b>' + t.dian + '</span>' : '<span>' + t.guan + '</span>';
      return '<section class="theme" id="theme-' + i + '" data-theme="' + esc(t.name) + '"><div class="th-head"><div><h2>' + t.name + '<span class="pill">' + ratioText(t) + '</span><span class="cnt">' + list.length + ' 条</span></h2><div class="say">' + say + '</div></div>' +
        '<div class="pager"><button class="btn sm ghost" type="button" data-copytheme="' + i + '">复制本主题</button><button class="arrow" type="button" data-pg="-1" aria-label="上一页">‹</button><span class="pg">1 / 1</span><button class="arrow" type="button" data-pg="1" aria-label="下一页">›</button></div></div>' +
        '<div class="track" tabindex="0" aria-label="' + t.name + ' 创意">' +
        '<button class="card blank" type="button" data-new="' + i + '"><div class="thumb"><span class="plus">+</span><p>空白创意<br>写下想法和形式，生成这个主题的新创意</p></div><div class="meta"><div class="ttl">新建「' + t.name + '」创意</div><div class="row"><span class="pill">' + P.name + '</span></div><div class="row"><span class="pill">输入想法即可</span></div><div class="foot"><span>保存到这一栏最前面</span></div></div></button>' +
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
  function renderStoreSel() {
    document.getElementById('storeSel').innerHTML = state.stores.map(function (s) { return '<option value="' + s.id + '"' + (s.id === state.cur ? ' selected' : '') + '>' + esc(s.vars['简称'] || s.vars['店名'] || '未命名门店') + '</option>'; }).join('');
  }
  function renderMain() { renderTabs(); renderHead(); renderFilters(); renderThemes(); }
  function renderAll() { renderMain(); renderStoreSel(); if (state.open) renderDrawer(); }

  /* ---------- 详情抽屉 ---------- */
  var layer = document.getElementById('layer');
  function openItem(id) {
    state.open = byId(id) || null; state.editing = {};
    if (!state.open) return closeLayer();
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
    var b = it.brief, video = it.p === 'douyin' || it.p === 'sph';
    var coverFields = [['coverMain', '封面大字', 'long'], ['coverSub', '封面小字', 'text']];
    var acts = '<button class="btn accent" type="button" data-act="copyall">复制全部文案</button>' +
      (it.custom ? '<button class="btn" type="button" data-act="regen">换一版</button><button class="btn ghost" type="button" data-act="delcustom">删除</button>' : '') +
      (edited(it) ? '<button class="btn" type="button" data-act="resetall">全部恢复默认</button>' : '') + '<button class="btn" type="button" data-close>关闭</button>';
    layer.innerHTML = '<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dTitle">' +
      '<div class="d-head"><div><div class="pills" style="margin:0"><span class="pill"><i class="dot ' + it.p + '"></i>' + PLATS[it.p].name + ' · ' + esc(it.acct) + '</span><span class="pill">' + esc(it.type) + '</span><span class="pill">' + esc(it.form || '') + '</span><span class="pill ' + a[0] + '">' + a[1] + '</span><span class="pill">' + esc(resolve(it.when)) + ' · ' + esc(it.freq) + '</span>' + (it.custom ? '<span class="pill mine">' + (it.ai ? 'Claude 生成' : '规则生成') + '</span>' : '') + '</div>' +
      '<h2 id="dTitle">' + esc(resolve(it.title)) + '</h2><p class="angle">' + esc(resolve(it.angle)) + '</p></div><div class="acts">' + acts + '</div></div>' +
      '<div class="d-body"><div class="col">' +
      '<div class="box"><h3>画面预览<span class="note">上传门店图后自动换成本店照片</span></h3><div class="cover-wrap' + (video ? ' video' : '') + '">' + coverHTML(it, 'big') + '</div></div>' +
      (it.p === 'pyq' ? '' : '<div class="box"><h3>封面文字</h3>' + coverFields.map(function (f) { return fieldHTML(it, f); }).join('') + '</div>') +
      ((it.slots || []).length ? '<div class="box"><h3>要用的门店图<span class="note">' + it.slots.length + ' 张，点图上传本店照片</span></h3><div class="slots">' + it.slots.map(slotTile).join('') + '</div></div>' : '') +
      ((it.refs || []).length ? '<div class="box"><h3>参考素材图<span class="note">点开看大图</span></h3><div class="refs">' + it.refs.map(function (r) { return '<button class="ref" type="button" data-ref="' + esc(r) + '"><img src="' + refSrc(r) + '" alt="' + esc(REFS[r]) + '" loading="lazy"><span>' + esc(REFS[r]) + '</span></button>'; }).join('') + '</div></div>' : '') +
      '</div><div class="col">' + chk +
      '<div class="box"><h3>创意说明</h3><dl class="brief"><dt>给谁看</dt><dd>' + esc(resolve(b.who)) + '</dd><dt>钩子</dt><dd>' + esc(resolve(b.hook)) + '</dd><dt>要说清楚</dt><dd>' + esc(resolve(b.msg)) + '</dd><dt>必须带</dt><dd>' + esc(resolve(b.must)) + '</dd><dt>怎么拍</dt><dd>' + esc(resolve(b.shoot)) + '</dd><dt>看什么数</dt><dd>' + esc(resolve(b.kpi)) + '</dd></dl></div>' +
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
      '<div class="gfield">你的创意想法<textarea id="gIdea" placeholder="' + esc(IDEA_HINT[theme] || '写一句你想要的创意') + '">' + esc(gen.idea) + '</textarea></div>' +
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
  function renderGenButtons() {
    var el = document.getElementById('gActs'); if (!el) return;
    el.innerHTML = (state.ai ? '<span class="note">Claude 生成会用你自己的 Claude 额度</span><button class="btn" type="button" data-act="genlocal">快速生成</button><button class="btn accent" type="button" data-act="genai">用 Claude 生成</button>' : '<span class="note">按内容矩阵和卖点库生成，可继续修改</span><button class="btn accent" type="button" data-act="genlocal">生成创意</button>') + '<button class="btn" type="button" data-close>取消</button>';
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
    var input = JSON.parse(JSON.stringify(gen));
    var status = document.getElementById('gStatus');
    var btns = document.querySelectorAll('#gActs .btn'); btns.forEach(function (b) { b.disabled = true; });
    status.textContent = 'Claude 正在写…（通常 10–60 秒）';
    var examples = BASE.filter(function (i) { return i.p === input.p && i.type === input.theme; });
    GEN.ai(input, examples, function (u) { status.textContent = 'Claude 正在写… 已写 ' + u.text.length + ' 字'; })
      .then(function (item) { saveCustom(item, input); })
      .catch(function (e) {
        var code = e && e.code;
        if (code === 'not_granted' || code === 'sampling_disabled' || code === 'unavailable') state.ai = null;
        var msg = code === 'rate_limited' ? 'Claude 额度暂时用满了，先用快速生成。' : code === 'not_granted' ? '没有允许页面使用 Claude，已切换为快速生成。' : 'Claude 这次没生成成功，可以再试或用快速生成。';
        if (document.getElementById('gStatus')) { status.textContent = msg; renderGenButtons(); }
      });
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
    var data = JSON.stringify({ edits: state.edits, custom: state.custom, stores: state.stores, prices: state.prices, cur: state.cur });
    modal('<h2>备份 / 导入</h2><p class="sub">改过的文案、生成的创意、门店信息和价格都存在当前浏览器里。要给同事，复制下面的内容发过去；同事在这里粘贴后点“导入”。门店照片不包含在内。</p>' +
      '<textarea class="ed" id="bk" rows="10" style="font-family:var(--f-mono);font-size:12px">' + esc(data) + '</textarea>' +
      '<div class="m-acts"><button class="btn" type="button" data-act="copybk">复制备份</button><button class="btn primary" type="button" data-act="import">导入粘贴的内容</button><button class="btn" type="button" data-close>关闭</button></div>');
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
    var t = e.target.closest('[data-tab],[data-f],[data-open],[data-new],[data-close],[data-act],[data-ref],[data-jump],[data-pg],[data-copytheme],[data-g],#copyTab,#btnStore,#btnPhotos,#btnBackup');
    if (!t) return;
    if (t.dataset.tab) { state.tab = t.dataset.tab; state.acct = null; state.period = null; save('tmb.tab', state.tab); renderMain(); window.scrollTo(0, 0); return; }
    if (t.dataset.f) { state[t.dataset.f] = t.dataset.v === '全部' ? null : t.dataset.v; renderFilters(); renderThemes(); return; }
    if (t.dataset.jump) { var sec = document.getElementById('theme-' + t.dataset.jump); if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (t.dataset.pg) { var tr = t.closest('.theme').querySelector('.track'); tr.scrollBy({ left: (+t.dataset.pg) * (tr.clientWidth + 1), behavior: 'smooth' }); return; }
    if (t.dataset.copytheme) { var th = PLATS[state.tab].themes[+t.dataset.copytheme].name, l = themeItems(state.tab, th); copy(l.map(plainAll).join('\n\n==========\n\n'), '已复制「' + th + '」' + l.length + ' 条'); return; }
    if (t.dataset.open) { openItem(t.dataset.open); return; }
    if (t.dataset.new) { genModal(state.tab, +t.dataset.new); return; }
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
    if (t.id === 'copyTab') { var all = items().filter(function (i) { return i.p === state.tab; }); copy(all.map(plainAll).join('\n\n==========\n\n'), '已复制 ' + all.length + ' 条'); return; }
    if (t.id === 'btnStore') { storeModal(); return; }
    if (t.id === 'btnPhotos') { photoModal(); return; }
    if (t.id === 'btnBackup') { backupModal(); return; }

    var act = t.dataset.act, it = state.open;
    if (act === 'genlocal') { readGen(); var inp = JSON.parse(JSON.stringify(gen)); saveCustom(GEN.local(inp, Math.floor(Math.random() * 5)), inp); return; }
    if (act === 'genai') { runAI(); return; }
    var fe = t.closest('.field'), k = fe && fe.dataset.k;
    var fdef = it && k ? fieldsOf(it).concat([['coverMain', '', 'long'], ['coverSub', '', 'text']]).filter(function (f) { return f[0] === k; })[0] : null;
    if (act === 'copyall') { copy(plainAll(it), '已复制全部文案'); return; }
    if (act === 'resetall') { delete state.edits[it.id]; save('tmb.edits', state.edits); state.editing = {}; renderDrawer(); toast('已恢复默认'); return; }
    if (act === 'regen') {
      var input = it.input || { p: it.p, theme: it.type, acct: it.acct, form: it.form, idea: '', points: [], occasion: '常规' };
      var seed = (it.seed || 0) + 1, nx = GEN.local(input, seed);
      nx.id = it.id; nx.seed = seed; nx.input = input;
      state.custom = state.custom.map(function (c) { return c.id === it.id ? nx : c; });
      delete state.edits[it.id]; save('tmb.edits', state.edits); save('tmb.custom', state.custom);
      state.open = nx; state.editing = {}; renderDrawer(); toast('已换一版'); return;
    }
    if (act === 'delcustom') {
      if (t.dataset.confirm !== '1') { t.dataset.confirm = '1'; t.textContent = '再点一次确认删除'; return; }
      state.custom = state.custom.filter(function (c) { return c.id !== it.id; }); save('tmb.custom', state.custom);
      delete state.edits[it.id]; save('tmb.edits', state.edits); closeLayer(); toast('已删除'); return;
    }
    if (act === 'copy') { var v2 = val(it, k); copy(fdef[2] === 'table' ? v2.map(function (r) { return r.map(resolve).join('｜'); }).join('\n') : resolve(v2)); return; }
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
      delete state.editing[k]; renderDrawer(); toast('已保存'); return;
    }
    if (act === 'addstore') {
      var id = 's' + Date.now().toString(36), nv = defaults(VARS.store); Object.keys(nv).forEach(function (x) { nv[x] = ''; });
      nv['简称'] = '新门店 ' + (state.stores.length + 1);
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
    if (t.dataset.sv) { store().vars[t.dataset.sv] = t.value.trim(); t.classList.toggle('miss', !t.value.trim()); save('tmb.stores', state.stores); renderStoreSel(); renderThemes(); return; }
    if (t.dataset.pv) { state.prices[t.dataset.pv] = t.value.trim(); save('tmb.prices', state.prices); renderThemes(); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'storeSel') { state.cur = t.value; save('tmb.cur', state.cur); renderAll(); toast('已切换到 ' + (store().vars['简称'] || '')); return; }
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
  var h = location.hash.slice(1), hi = h && byId(h);
  if (hi) { if (hi.p !== state.tab) { state.tab = hi.p; renderMain(); } openItem(h); }
})();
