/* 爆款拆解：把用户粘贴的抖音 / 小红书 / 视频号对标素材拆成钩子、情绪、结构、互动和数据信号，
   再给出迁移到 Ulike脱毛吧 的主题、形式、卖点和改写后的钩子。
   - 只分析用户粘贴的内容，不联网、不编造数据；没填数据就不判断爆的类型
   - 本地规则在任何地方都能用；在 claude.ai 打开时可以再用 Claude 深度拆解（见 app.js） */
(function () {
  'use strict';

  function cnt(re, t) { var m = String(t || '').match(re); return m ? m.length : 0; }
  function clip(s, n) { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[,，\s]/g, '').replace(/[wW万]$/, function () { return 'e4'; })); if (/[wW万]\s*$/.test(String(v))) n = parseFloat(String(v).replace(/[^\d.]/g, '')) * 1e4; return isFinite(n) && n >= 0 ? n : null; }
  function sentences(t) { return String(t || '').split(/[\n。！!？?…]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length >= 2; }); }
  function pct(x) { return (Math.round(x * 1000) / 10) + '%'; }

  /* ---------- 钩子 ---------- */
  var HOOKS = [
    { k: 'result', label: '结果前置', re: /\d+(\.\d+)?\s*(元|块|r\b|分钟|min|秒|次|天|周)|(一次|才|只要|花了?|就)\s*\d+|搞定了|做完了|终于|结果/i, why: '先给结论或价格，用户一眼知道“值不值、多快”，停留成本最低' },
    { k: 'contra', label: '反常识', re: /不是|其实|别再|千万别|才知道|原来|没想到|居然|竟然|后悔|晚了|误区|错了|根本不用|白花/, why: '推翻一个常见认知，制造“我是不是也做错了”的停留' },
    { k: 'name', label: '身份点名', re: /姐妹|打工人|学生党|宝子|女生|女孩|男生|社恐|懒人|新手|上班族|宝妈|毛孩子|手残|i人|e人|[一-龥]{1,4}(党|族)(?![一-龥]{0,1}的)/i, why: '直接叫出目标人群，被点名的人会觉得“在说我”' },
    { k: 'ask', label: '提问挑衅', re: /[?？]|吗[，,。！!]?$|难道|为什么|为啥|怎么|你还在|有没有人|谁懂/, why: '用问题制造悬念，让人想看答案或忍不住评论' },
    { k: 'test', label: '悬念 / 实测', re: /实测|测评|亲测|全程|不剪|记录|vlog|第\s*\d+\s*(天|次|周)|试了|体验了|跟我|带你|沉浸式|开箱/i, why: '承诺一个真实过程，用户想看“到底怎么样”' },
    { k: 'list', label: '数字清单', re: /\d+\s*(个|件|条|种|步|招|点|大|句)|清单|合集|攻略|必看|必须知道|整理了|汇总/, why: '数字和清单降低阅读压力，收藏意愿高' }
  ];
  /* 开头 = 标题（抖音就是口播第一句）；没有标题才用正文第一句。开头权重最高，封面其次 */
  function detectHooks(first, title, cover) {
    var open = title || first, src = [open, cover].filter(Boolean).join('\n');
    return HOOKS.map(function (h) {
      var g = function (t) { return t ? cnt(new RegExp(h.re.source, 'gi'), t) : 0; };
      var s = g(open) * 3 + g(cover) * 1.5 + (first !== open ? g(first) : 0);
      var quote = '';
      [open, cover, first].some(function (t) { if (t && h.re.test(t)) { quote = clip(t, 40); return true; } return false; });
      return { k: h.k, label: h.label, s: s, quote: quote || clip(src, 40), why: h.why };
    }).filter(function (h) { return h.s > 0; }).sort(function (a, b) { return b.s - a.s; });
  }

  /* ---------- 情绪 ---------- */
  var EMO = [
    { k: 'pain', label: '怕疼', re: /疼|痛|刺|烫|灼|忍不住|受不了|敏感|红肿/g, point: '' },
    { k: 'price', label: '怕贵', re: /贵|便宜|价格|多少钱|\d+(\.\d+)?\s*(元|块|r\b)|一次\s*\d{2,}|花了?\s*\d+|\d+\.\d+|\d+\s*(vs|VS)\s*\d+|十几块|几十块|省钱|划算|性价比|白菜价|几百|几千|办卡|一次不到|奶茶钱|智商税/g, point: '价格反差' },
    { k: 'hassle', label: '怕麻烦', re: /预约|排队|麻烦|懒|省事|顺路|午休|下班|几分钟|方便|随时|不用等|通勤|楼下/g, point: '顺路就做' },
    { k: 'shy', label: '怕尴尬', re: /尴尬|尴不尬|社恐|推销|尬聊|没人|没有店员|一个人|隐私|害羞|被看|看不到|不好意思|拉着|被拉|i人/gi, point: '没人推销' },
    { k: 'clean', label: '怕不干净', re: /卫生|干净|消毒|清洁|脏|一次性/g, point: '看得见的干净' },
    { k: 'beauty', label: '想变美', re: /光滑|嫩|好看|自信|露|夏天|短袖|吊带|穿搭|约会|精致|变美|颜值|腿毛|腋毛/g, point: '' },
    { k: 'deal', label: '占便宜', re: /福利|免费|白嫖|送|抽奖|领|优惠|券|活动|限时|赠|0\s*元|有礼|羊毛/g, point: '价格反差' },
    { k: 'social', label: '结伴社交', re: /闺蜜|朋友|一起|同事|室友|姐妹们|对象|男朋友|女朋友|拉上/g, point: '' },
    { k: 'gadget', label: '想先试', re: /脱毛仪|吃灰|买前|先试|试用|值不值得买|种草/g, point: '先试再买' }
  ];
  /* 情绪看内容本身：开头（标题 / 封面）算 2 倍，评论只做参考（评论里问“疼不疼”不代表这条内容在打怕疼） */
  function detectEmo(text, comments, open, st) {
    return EMO.map(function (e) {
      var s = cnt(e.re, text) + cnt(e.re, open) + cnt(e.re, comments) * 0.3 + (st && st.k === 'compare' && e.k === 'price' ? 1 : 0);
      return { k: e.k, label: e.label, s: s, point: e.point };
    }).filter(function (e) { return e.s > 0; }).sort(function (a, b) { return b.s - a.s; });
  }

  /* ---------- 结构 ---------- */
  var STRUCT = [
    { k: 'compare', label: '对比算账', re: /对比|vs|VS|比起|算了?一笔账|算账|折合|平均下来|一次才|美容院|家用|贵了?\s*\d+|省了/g, tip: '列出两三种选择，把账算给用户看' },
    { k: 'list', label: '清单 / 攻略', re: /①|②|1️⃣|2️⃣|(^|\n)\s*\d+\s*[\.、．]|清单|合集|攻略|步骤|第[一二三]步|首先|其次/g, tip: '一条一条列，适合收藏' },
    { k: 'twist', label: '反转', re: /本来|以为|结果|没想到|居然|竟然|但是|谁知|后来|直到/g, tip: '先立预期再打破，情绪起伏留人' },
    { k: 'vlog', label: '实测 vlog', re: /实测|vlog|全程|第一视角|跟我|带你|记录|测评|沉浸式|进门|出门|推开/gi, tip: '跟着镜头走一遍过程，真实感强' },
    { k: 'drama', label: '剧情对话', re: /(^|\n)\s*[A-Za-z甲乙我她他闺蜜同事妈][:：]|闺蜜说|我妈说|男朋友说|同事问|她问我|问我/g, tip: '两个人一问一答，把顾虑演出来' },
    { k: 'qa', label: '问答', re: /Q[:：]|问[:：]|答[:：]|A[:：]|评论区问|被问|常见问题|\?\s*\n|？\s*\n/g, tip: '把用户最常问的问题一次答完' }
  ];
  function detectStruct(text) {
    var r = STRUCT.map(function (s) { return { k: s.k, label: s.label, s: cnt(s.re, text), tip: s.tip }; }).sort(function (a, b) { return b.s - a.s; });
    return r[0].s ? r[0] : { k: 'talk', label: '口播 / 自述', s: 0, tip: '一个人对镜头讲，靠钩子和信息密度' };
  }

  /* ---------- 评论区 ---------- */
  var TOPICS = [
    { k: 'pain', bank: 'pain', label: '疼不疼', re: /疼|痛/, reply: 'Q：疼不疼？\nA：多数人反馈就是温温的、轻轻一下的感觉，档位能自己调，第一次从低档开始就好～' },
    { k: 'price', bank: 'price', label: '多少钱', re: /多少钱|价格|贵|便宜|几块|多少米/, reply: 'Q：多少钱？\nA：新人腋下+手臂 {新人价} 元一次，8 次卡 {八次卡} 元，折合每次 {八次单次}。' },
    { k: 'where', bank: 'where', label: '在哪 / 求店名', re: /在哪|地址|哪里|位置|求店名|坐标|求链接|哪家|定位/, reply: 'Q：店在哪？\nA：{城市}{商场}{位置}，搜「Ulike脱毛吧」就能看到离你最近的店～' },
    { k: 'effect', bank: 'times', label: '效果 / 几次', re: /效果|几次|多久|有用吗|有效吗|会长|反弹|还长吗/, reply: 'Q：要做几次？\nA：跟着 28 天打卡计划来，4 周 8 次，小程序会提醒你；效果因人而异，坚持按计划做就好～' },
    { k: 'safe', bank: 'clean', label: '卫生 / 安全', re: /卫生|干净|安全|过敏|副作用|变黑|敏感肌|伤皮肤/, reply: 'Q：卫生吗？\nA：独立隔间，备有消毒用品，用前还能自己再擦一遍；皮肤有特殊情况的先咨询专业意见～' },
    { k: 'want', bank: 'want', label: '想去 / 种草', re: /想去|想试|蹲|求|已下单|冲|马住|码住|收藏了|心动|狂喜/, reply: '' },
    { k: 'doubt', bank: 'ad', label: '质疑 / 是不是广告', re: /广告|托|真的吗|假的|智商税|恰饭|骗/, reply: 'Q：是广告吗？\nA：是我们自己的店哈～第一次可以先买新人体验，{新人价} 元试一次再决定。' }
  ];
  function detectTopics(comments) {
    var lines = String(comments || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var used = {};
    return TOPICS.map(function (t) {
      /* “想去 / 种草”只算没被其他话题认领的评论，避免“求店名”被算两次 */
      var hit = lines.filter(function (l, i) { if (!t.re.test(l) || (t.k === 'want' && used[i])) return false; used[i] = 1; return true; });
      return { k: t.k, bank: t.bank || '', label: t.label, n: hit.length, sample: hit.slice(0, 2).map(function (x) { return clip(x, 30); }), reply: t.reply };
    }).filter(function (t) { return t.n > 0; }).sort(function (a, b) { return b.n - a.n; }).concat([]).slice(0, 5).map(function (t) { t.total = lines.length; return t; });
  }

  /* ---------- 数据信号（只用用户填的数，阈值是经验值） ---------- */
  function signals(p, d) {
    var like = num(d.like), fav = num(d.fav), cmt = num(d.cmt), share = num(d.share), play = num(d.play), out = [];
    if (like == null && fav == null && cmt == null && share == null && play == null) return { none: true, rows: [], notes: ['没填数据，不判断它是靠什么爆的。有后台截图或页面上的点赞、收藏、评论数，填进来能看出它是“收藏型”还是“共鸣/争议型”。'] };
    if (like && fav != null) {
      var r = fav / like;
      out.push({ k: '收藏 / 点赞', v: pct(r), note: r >= 0.6 ? '收藏远高于常见水平 → 干货型：用户想“以后照着做”，适合迁移成攻略、清单、问答' : r >= 0.3 ? '收藏和点赞都不错 → 既有共鸣也有信息量' : '以点赞为主 → 情绪 / 共鸣型：靠戳中情绪，迁移时保留情绪钩子，信息别堆太多' });
    }
    if (like && cmt != null) {
      var c = cmt / like;
      out.push({ k: '评论 / 点赞', v: pct(c), note: c >= 0.15 ? '评论很活跃 → 话题或争议强，评论区的问题值得直接抄成下一条选题' : c >= 0.05 ? '评论正常' : '评论偏少 → 结尾可以加一个让人想回答的问题' });
    }
    if (like && share != null) {
      var s = share / like;
      out.push({ k: '分享 / 点赞', v: pct(s), note: s >= 0.3 ? '转发多 → 社交货币型（“发给闺蜜看”），适合挂邀好友、双人卡' : '转发一般' });
    }
    if (play && like != null) {
      var l = like / play;
      out.push({ k: '点赞 / 播放', v: pct(l), note: l >= 0.05 ? '互动率高，内容本身有吸引力' : l >= 0.02 ? '互动率正常' : '互动率偏低，可能是靠推荐量起来的，借鉴钩子比借鉴内容更有用' });
    }
    return { none: false, rows: out, notes: ['以上阈值是经验判断，不是平台公布的标准；拆 5 条以上同类对标对比着看更准。'] };
  }

  /* ---------- 迁移到脱毛吧 ---------- */
  var MED = /激光|冰点|光子|医美|皮肤科|医院|医生|诊所|院线|热玛吉|术后|疗程/;
  var BRAND = /[A-Za-z]{3,}\s*(脱毛仪|美容|医美|脱毛)|[一-龥]{2,6}(医美|医疗美容|皮肤管理)(中心|诊所|机构)/;
  /* 改写库：同款钩子 × 对标戳中的情绪。写法像真人在说话，不是广告腔；没有对应情绪时用该钩子的通用版 */
  var REWRITE = {
    result: {
      price: ['美容院一次几百，我在{商场}花 {新人价} 做完了', '{新人价}，一杯奶茶钱，腋下手臂都做了', '算了下，8 次卡一次才 {八次单次}'],
      shy: ['从进门到出门，一句话都没跟人说', '一个人做完脱毛，全程没人推销我', '门一锁，30 分钟，谁也不打扰'],
      hassle: ['午休 30 分钟，脱毛做完还能喝杯咖啡', '下班顺路，进去出来不到半小时', '不用预约，路过{商场}就做了'],
      pain: ['做完了，比我想的轻多了', '腋下做完，就刺了那么几下', '怕疼的我，第一次居然做完了'],
      clean: ['进门先擦一遍，隔间比我想的干净', '一人一间，用前自己擦，安心多了'],
      beauty: ['夏天穿短袖不用再遮遮掩掩了', '约会前做完，自信多了'],
      deal: ['新人 {新人价}，还送了 28 天打卡礼包', '打卡第 4 周，抽中了'],
      social: ['和闺蜜一人一间，做完一起逛街', '拉同事一起去，两个人都有礼'],
      gadget: ['脱毛仪没买，先在店里试了一次', '买脱毛仪前，我先花 {新人价} 试了'],
      _: ['{新人价} 元，在{商场}脱了个毛', '30 分钟，从进门到做完', '一次 {八次单次}，脱毛这事我算明白了']
    },
    contra: {
      price: ['脱毛不一定要办几千的卡', '别再一次几百了，自助店 {新人价}', '我后悔之前在美容院办卡了'],
      shy: ['脱毛店不一定有人推销你', '谁说脱毛一定要跟店员尬聊', '其实一个人去脱毛一点都不尴尬'],
      hassle: ['脱毛不用专门请假跑一趟', '原来脱毛可以顺路就做'],
      pain: ['脱毛没你想的那么吓人', '我以为会很疼，结果……'],
      beauty: ['脱毛不是夏天才做的事', '夏天才脱毛的人，已经晚了'],
      gadget: ['脱毛仪买回家吃灰？其实不用买', '别急着买脱毛仪，先去店里试'],
      _: ['脱毛不是夏天才做的事', '夏天才脱毛的人，已经晚了', '脱毛不一定要办几千的卡']
    },
    name: {
      price: ['{商场}上班的姐妹，脱毛别再办几千的卡了', '学生党也负担得起的脱毛', '预算不多的姐妹看这条'],
      shy: ['社恐女生的脱毛店，全程不用跟人说话', 'i 人狂喜，脱毛店里没人', '怕被推销的姐妹，这家店没人'],
      hassle: ['{商场}附近上班的姐妹，午休就能去', '懒人脱毛，路过就做', '下班路过{商场}的姐妹看过来'],
      pain: ['怕疼的姐妹先看这条', '跟我一样怕疼的，先试低档'],
      beauty: ['想穿吊带的姐妹，现在开始刚好', '要约会的姐妹先收藏'],
      social: ['有闺蜜的看过来，两个人一起去更划算', '拉上室友，一人一间'],
      _: ['{商场}附近上班的姐妹看过来', '社恐女生的脱毛店', '学生党也能负担的脱毛']
    },
    ask: {
      price: ['你还在美容院一次几百地脱毛吗？', '脱毛一定要办卡吗？', '{新人价} 能脱一次毛，你信吗？'],
      shy: ['一个人去脱毛会尴尬吗？', '没人的脱毛店，你敢去吗？', '你被推销办卡过几次？'],
      hassle: ['脱毛还要提前预约？', '午休 30 分钟能干嘛？'],
      pain: ['自助脱毛到底疼不疼？', '怕疼的人能自己脱毛吗？'],
      clean: ['无人店到底干不干净？', '没人打扫的店你敢去吗？'],
      gadget: ['脱毛仪到底值不值得买？', '买了脱毛仪你真的会用吗？'],
      _: ['你还在美容院排队脱毛吗？', '脱毛一定要办卡吗？', '一个人去脱毛会尴尬吗？']
    },
    test: {
      price: ['{新人价} 的自助脱毛，我去试了', '花 {新人价} 体验自助脱毛，全程实拍'],
      shy: ['一个人去无人脱毛店，全程实拍', '社恐去自助脱毛店，拍下全过程'],
      pain: ['怕疼的我去试了自助脱毛', '第一次自助脱毛，疼不疼我替你试了'],
      clean: ['无人店干不干净？我进去拍给你看', '把隔间拍给你看，自己判断'],
      _: ['第一次自助脱毛，全程实拍不剪', '把隔间里的过程都拍下来了', '自助脱毛到底怎么用？我去试了']
    },
    list: {
      price: ['脱毛怎么做划算？我算了 3 种', '自助脱毛 3 个省钱的办法'],
      pain: ['怕疼的人去脱毛，先知道这 3 件事', '第一次脱毛前，我会先看这 5 条'],
      hassle: ['顺路脱毛的 3 个时间点', '去{商场}脱毛前，先看这 3 条'],
      _: ['自助脱毛前必须知道的 3 件事', '第一次去脱毛店的 5 个问题', '{商场}这家脱毛店的 3 个细节']
    }
  };
  function rewriteFor(hk, emos) {
    var R = REWRITE[hk] || REWRITE.test, out = [];
    emos.slice(0, 2).forEach(function (e) { (R[e.k] || []).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); });
    R._.forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
    return out;
  }
  var FORMS = {
    douyin: { compare: '价格字卡', list: '口播讲解', twist: '剧情', vlog: '第一视角 vlog', drama: '剧情', qa: '口播讲解', talk: '口播讲解' },
    xhs: { compare: '对比图', list: '清单合集', twist: '探店笔记', vlog: '探店笔记', drama: '探店笔记', qa: '问答合集', talk: '图文攻略' },
    sph: { compare: '口播讲解', list: '口播讲解', twist: '剧情', vlog: '逛店 vlog', drama: '剧情', qa: '口播讲解', talk: '口播讲解' },
    pyq: { compare: '单条文案', list: '单条文案', twist: '单条文案', vlog: '九宫格', drama: '私聊话术', qa: '群聊天', talk: '单条文案' }
  };
  function pickTheme(p, st, emos, text) {
    var P = window.TMB_PLATFORMS[p], names = P.themes.map(function (t) { return t.name; });
    var e0 = emos[0] ? emos[0].k : '';
    var want = [];
    if (/打卡|第\s*\d+\s*(天|次)|晒(单|图|一下|出来)|毕业/.test(text)) want.push('真实反馈和打卡');
    if (st.k === 'list' || st.k === 'qa') want.push('科普答疑'); /* 清单 / 问答类收藏型内容，最适合迁移成科普 */
    if (/在哪|路线|怎么走|地铁|出口|几楼/.test(text)) want.push('门店指引和点位');
    if (e0 === 'deal' || e0 === 'social') want.push('福利与拉新', '活动介绍');
    if (st.k === 'qa' || (st.k === 'list' && e0 === 'pain') || e0 === 'pain') want.push('科普答疑');
    if (st.k === 'compare' || e0 === 'price') want.push('活动介绍');
    if (e0 === 'gadget' || /品牌|设备|科技|原理/.test(text)) want.push('项目背书');
    want.push('门店体验');
    for (var i = 0; i < want.length; i++) if (names.indexOf(want[i]) >= 0) return want[i];
    return names[0];
  }

  /* 主函数：input = { p, url, title, cover, body, comments, data: {play, like, fav, cmt, share} }；opts.scan(text, p) 复用页面的合规扫描 */
  function analyze(input, opts) {
    opts = opts || {};
    var p = input.p || 'douyin';
    var title = String(input.title || '').trim(), cover = String(input.cover || '').trim(), body = String(input.body || '').trim(), comments = String(input.comments || '').trim();
    var text = [title, cover, body].join('\n');
    var first = sentences(body)[0] || title;
    var hooks = detectHooks(first, title, cover);
    if (!hooks.length) hooks = [{ k: 'test', label: '平铺开头', s: 0, quote: clip(first, 40), why: '开头没有明显钩子，可能靠画面、人设或话题本身；迁移时建议补一个钩子' }];
    var st = detectStruct(text), emos = detectEmo(text, comments, [title, cover].join('\n'), st), topics = detectTopics(comments), sig = signals(p, input.data || {});
    var GEN = window.TMB_GEN || {};

    /* 封面 */
    var cv = cover || title, cvNotes = [];
    if (cv) {
      if (/\d/.test(cv)) cvNotes.push('有数字（价格 / 时间 / 数量），一眼抓住');
      if (cv.replace(/\s/g, '').length <= 12) cvNotes.push('字少（≤12 字），手机上一眼读完'); else cvNotes.push('字偏多，迁移时压到 12 字以内');
      if (/[?？]/.test(cv)) cvNotes.push('用问句制造好奇');
      if (/姐妹|女生|打工人|学生|社恐|新手/.test(cv)) cvNotes.push('点名人群');
      if (/vs|VS|对比|前后|→/.test(cv)) cvNotes.push('对比构图');
    }

    /* 互动 */
    var tail = sentences(body).slice(-1)[0] || '';
    var iNotes = [];
    if (/[?？]\s*$/.test(body) || /评论区|告诉我|你们|你会|你呢|扣\s*1|留言/.test(tail)) iNotes.push('结尾抛问题或喊评论（“' + clip(tail, 24) + '”），把讨论引到评论区');
    if (/收藏|码住|马住|存好/.test(text)) iNotes.push('直接提醒收藏');
    if (/关注|下期|下一条|明天更/.test(text)) iNotes.push('预告下一条，拉关注');
    if (!iNotes.length) iNotes.push('没有明显的互动引导；迁移时结尾加一个好回答的问题，比如“你被推销过几次？”');

    /* 合规与迁移风险 */
    var scan = opts.scan ? opts.scan(text, p) : [];
    var ban = scan.filter(function (x) { return x.lv === 'ban'; }).map(function (x) { return x.w; }), cau = scan.filter(function (x) { return x.lv === 'cau'; }).map(function (x) { return x.w; });
    var uniq = function (a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); };
    var risks = [];
    if (ban.length) risks.push('对标里有禁用词：' + uniq(ban).join('、') + '，迁移时不能照搬');
    if (cau.length) risks.push('对标里有站外导流词：' + uniq(cau).join('、') + '，我们在抖音 / 小红书正文里不能写，改成“搜 Ulike脱毛吧＋商圈名”');
    if (MED.test(text)) risks.push('对标讲的是医美 / 院线项目，脱毛吧是自助店，不能借它的功效、疗程说法，只借钩子和结构');
    if (BRAND.test(text)) risks.push('对标点名了别的品牌或机构，迁移时只比品类（美容院 / 家用仪），不点名');
    if (/前后对比|对比图|before|after/i.test(text)) risks.push('“前后对比”在脱毛品类容易被判功效宣传，迁移时改成体验过程或价格对比');
    if (!risks.length) risks.push('没发现明显风险，迁移后仍会再做一次合规扫描');

    /* 推荐的迁移方向 */
    var theme = pickTheme(p, st, emos, text);
    var points = uniq(emos.map(function (e) { return e.point; }).filter(Boolean)).slice(0, 2);
    if (!points.length) points = ['没人推销'];
    var form = (FORMS[p] || FORMS.douyin)[st.k] || window.TMB_PLATFORMS[p].forms[0];
    var occ = GEN.occOf ? GEN.occOf(text) : '常规';
    if (occ === '冬季 20 次卡' && !/20 ?次|冬季|冬天/.test(text)) occ = '常规'; /* 对标自己的“8 次卡”不等于我们的冬季卡 */
    var h0 = hooks[0], h1 = hooks[1] || hooks[0];
    var mine = rewriteFor(h0.k, emos).slice(0, 3);
    var hB = h1.k !== h0.k ? h1 : { k: h0.k === 'ask' ? 'result' : 'ask', label: h0.k === 'ask' ? '结果前置' : '提问挑衅' };
    var alt = rewriteFor(hB.k, emos)[0];
    if (alt && mine.indexOf(alt) < 0) mine.push(alt);
    /* 原句骨架：价格换成变量，其余保留，提示人工替换品类词 */
    /* 原句骨架：用对标的开头原句，把百元以下的价格（通常是它自己的低价）换成我们的新人价，大价格留着做对比 */
    var opening = title || first;
    var skeleton = opening ? clip(opening, 30).replace(/…$/, '').replace(/(\d+(?:\.\d+)?)\s*(元|块)?/g, function (m0, n0, u) { return parseFloat(n0) < 100 && /\./.test(n0) ? '{新人价}' + (u ? ' ' + u : '') : m0; }) : '';
    var FX = (window.TMB_RULES || {}).fix || function (x) { return x; };
    mine = mine.map(FX); skeleton = FX(skeleton);
    var e0 = emos[0] ? emos[0].label : '好奇';
    /* 第二种钩子分数接近时一起算（很多爆款是“点名 + 提问”这种组合） */
    var hookName = h0.label + (h1 !== h0 && h1.s >= h0.s * 0.6 ? ' + ' + h1.label : '');
    var ask = iNotes[0].indexOf('结尾抛问题') === 0;
    var formula = hookName + '钩子 + ' + st.label + '结构 + 戳「' + e0 + '」' + (ask ? ' + 结尾抛问题' : '');
    /* 一句话说人话：它火在哪、我们该借什么 */
    var sig0 = sig.rows[0];
    var summary = '它开头用' + hookName + '把人留住，' + (st.k === 'talk' ? '' : '用' + st.label + '的结构展开，') + '戳中的是「' + e0 + '」' + (ask ? '，结尾再把人引到评论区' : '') + '。' +
      (sig0 ? (sig0.k === '收藏 / 点赞' ? (parseFloat(sig0.v) >= 60 ? '收藏很高，说明大家想“存起来照着做”。' : '') : '') : '') +
      '我们最该借的：' + hookName + '的开头' + (st.k === 'talk' ? '' : ' + ' + st.label + '的结构') + '，情绪继续打「' + e0 + '」。';
    var metric = p === 'xhs' ? '封面点击率和收藏率' : p === 'pyq' ? '咨询数和本店渠道码核销' : '3 秒留存和完播率';
    var ab = {
      hooks: mine.slice(0, 3),
      test: 'A 用同款「' + h0.label + '」：“' + mine[0] + '”；B 换成「' + hB.label + '」：“' + alt + '”。画面、正文、发布时段都不变，各发一条看 48 小时',
      metric: metric
    };
    ab.test = FX(ab.test);

    return {
      p: p, summary: summary, hookName: hookName, hooks: hooks.slice(0, 3), emos: emos.slice(0, 4), struct: st, cover: { text: cv, notes: cvNotes },
      interact: { notes: iNotes, topics: topics }, signal: sig, risks: risks, formula: formula,
      map: { theme: theme, form: form, points: points, occasion: occ, hooks: mine, skeleton: skeleton !== mine[0] ? skeleton : '' },
      ab: ab
    };
  }

  /* 拆解结果 → 生成器的输入：钩子用引号包住，生成器会直接拿来当标题和封面 */
  function toInput(rec, over) {
    var r = rec.result, m = r.map, P = window.TMB_PLATFORMS[rec.input.p];
    over = over || {};
    var hook = over.hook || m.hooks[0];
    return {
      p: rec.input.p, theme: over.theme || m.theme, acct: over.acct || P.accts[0], form: over.form || m.form,
      idea: '“' + hook + '”，学对标的' + r.struct.label + '结构，戳' + ((r.emos[0] || {}).label || '好奇') + '的情绪',
      points: m.points.slice(0, 3), occasion: m.occasion || '常规', who: ''
    };
  }

  /* 一句话属于哪种钩子（模板的 A/B 备选用来错开钩子类型） */
  function hookOf(t) { var h = detectHooks(sentences(t)[0] || t, t, ''); return h.length ? h[0].k : ''; }

  window.TMB_BREAK = { analyze: analyze, toInput: toInput, hookOf: hookOf, rewrite: REWRITE, hookLabel: function (k) { return (HOOKS.filter(function (h) { return h.k === k; })[0] || {}).label || ''; } };
})();
