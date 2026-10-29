/* 合规词表（全站唯一一份）：页面高亮、生成器自动替换、拆对标风险提示都从这里取。
   和 tuomaoba-content 的 compliance_check.py 保持同一口径：禁用 = 发布前必须改；慎用 = 抖音/小红书正文里可能限流或需要换说法。 */
(function () {
  'use strict';
  var BAN = ['永久', '根治', '治疗', '治愈', '疗效', '医用', '医院级', '医疗级', '无副作用', '零风险', '包好', '包满意', '一次见效', '立刻见效', '彻底告别', '顶级', '极致', '唯一', '首选', '全网最低', '100%', '绝对', '保证效果', '无痛', '不痛', '零痛感', '国家级'];
  /* “最”“第一”“药”按搭配放行：最近 / 最后 / 第一次 / 药妆 这类不算 */
  var BAN_EXTRA = ['第一(?![次个周张单天步篇轮视遍回])', '最(?![近多后少初终开])', '(?<![妆])药(?!妆)'];
  var CAU_ALL = ['比基尼', '私处'];
  var CAU_SOCIAL = ['美团', '大众点评', '某团', '淘宝', '微信', 'vx', 'VX', '加V', '私信', '二维码', '链接'];
  function reEsc(x) { return x.replace(/[.*+?^${}()|[\]\\%]/g, '\\$&'); }
  var extra = BAN_EXTRA;
  try { new RegExp(extra[2]); } catch (e) { extra = extra.slice(0, 2).concat(['药(?!妆)']); } /* 老浏览器不支持后行断言 */
  var BAN_RE = new RegExp(BAN.map(reEsc).concat(extra).join('|'), 'g');
  function cauRe(p) { var l = CAU_ALL.concat(p === 'douyin' || p === 'xhs' ? CAU_SOCIAL : []); return new RegExp(l.map(reEsc).join('|'), 'g'); }
  function scan(text, p) {
    var out = [], m; text = String(text || ''); BAN_RE.lastIndex = 0;
    while ((m = BAN_RE.exec(text))) out.push({ w: m[0], lv: 'ban' });
    var cr = cauRe(p); while ((m = cr.exec(text))) out.push({ w: m[0], lv: 'cau' });
    return out;
  }
  /* 自动改写：生成的内容先过一遍，再扫描 */
  var FIX = [[/最好的?/g, '很适合的'], [/最便宜/g, '更划算'], [/最怕/g, '怕'], [/最常见/g, '常见'], [/最关心的?/g, '都会问的'], [/最低档/g, '低档'], [/最(?![近多后少初终开])/g, '很'], [/第一(?![次个周张单天步篇轮视遍回])/g, '头一'],
    [/无痛|不痛|零痛感/g, '没我想的那么疼'], [/100%/g, '人人'], [/绝对/g, '真的'], [/首选/g, '我会选'], [/顶级|极致/g, '好用的'], [/全网最低/g, '划算'], [/永久/g, '长期'], [/保证效果|包满意/g, '看个人情况'], [/彻底告别/g, '省心多了'],
    [/一次见效|立刻见效/g, '坚持几次后'], [/医院级|医疗级|医用/g, 'Ulike 的'], [/无副作用|零风险/g, '']];
  function fix(s) { s = String(s == null ? '' : s); FIX.forEach(function (f) { s = s.replace(f[0], f[1]); }); return s; }
  window.TMB_RULES = { ban: BAN, banRe: BAN_RE, cauRe: cauRe, scan: scan, fix: fix };
})();
