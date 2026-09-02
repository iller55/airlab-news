// ============================================================
// AIR LAB NEWS — 広告ゼロの自分用ニュース（GASバックエンド）
// ------------------------------------------------------------
// 使い方（初回だけ）:
//   1. このファイルを Apps Script の Code.gs に貼る
//   2. index.html を Apps Script の HTMLファイル「index」に貼る
//   3. エディタ上で関数 setup を選んで実行（権限の承認が出る）
//   4. デプロイ → 新しいデプロイ → ウェブアプリ（画面は GitHub Pages、GASは ?api= でJSONを返す）
//        実行ユーザー: 自分 / アクセスできるユーザー: 全員
//   5. 出てきたURLをiPhoneのSafariで開いて「ホーム画面に追加」
//
// 以後は30分ごとに自動でニュースを集め直す（トリガー refresh）。
// 媒体を足したい／減らしたいときは下の TABS を直して保存するだけ。
// ============================================================

const APP_NAME = 'AIR LAB NEWS';
const DATA_FILE = 'airlab_news_data.json';   // Driveに置くキャッシュ
const MAX_PER_FEED = 40;                     // 1媒体あたり最大件数
const MAX_PER_TAB = 150;                     // 1タブあたり最大件数
const MAX_AGE_DAYS = 4;                      // これより古い記事は捨てる
const SUMMARY_LEN = 110;                     // 要約の文字数

// Googleニュース検索をRSSとして使う（公式RSSが無い媒体用）
function gn(q) {
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=ja&gl=JP&ceid=JP:ja';
}

// ---------- タブと媒体 ----------
const TABS = [
  { id: 'local', name: '鳥取県', color: '#e8862a', feeds: [
    { name: '日本海新聞', url: gn('site:nnn.co.jp 鳥取') },
    { name: '鳥取県ニュース', url: gn('鳥取県') },
    { name: 'BSS山陰放送', url: gn('山陰放送') },
    { name: 'TSK', url: gn('site:fnn.jp 鳥取') },
  ]},
  { id: 'japan', name: '国内', color: '#3fae6a', feeds: [
    { name: 'NHK', url: 'https://www.nhk.or.jp/rss/news/cat0.xml' },
    { name: 'NHK', url: 'https://www.nhk.or.jp/rss/news/cat1.xml' },
    { name: 'NHK', url: 'https://www.nhk.or.jp/rss/news/cat4.xml' },
    { name: 'NHK', url: 'https://www.nhk.or.jp/rss/news/cat5.xml' },
    { name: '朝日新聞', url: 'https://www.asahi.com/rss/asahi/newsheadlines.rdf' },
    { name: '共同通信', url: gn('site:47news.jp') },
    { name: 'TBS NEWS DIG', url: gn('site:newsdig.tbs.co.jp') },
    { name: 'テレ朝news', url: gn('site:news.tv-asahi.co.jp') },
    { name: '日テレNEWS', url: gn('site:news.ntv.co.jp') },
  ]},
  { id: 'pogo', name: 'ポケモンGO', color: '#3b8fd9', feeds: [
    { name: 'Pokémon GO 公式', url: 'https://pokemongo.com/feed?hl=ja' },
    { name: 'GameWith', url: 'https://gamewith.jp/pokemongo/feed' },   // GoogleのサーバーからはHTTP 403で取れないことがある
    { name: 'ポケモンGO', url: gn('ポケモンGO') },
  ]},
  { id: 'tech', name: 'テクノロジー', color: '#8e5bd6', feeds: [
    { name: 'ITmedia', url: 'https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml' },
    { name: 'Impress Watch', url: 'https://www.watch.impress.co.jp/data/rss/1.0/ipw/feed.rdf' },
    { name: 'CNET Japan', url: 'https://feeds.japan.cnet.com/rss/cnet/all.rdf' },
    { name: 'GIGAZINE', url: 'https://gigazine.net/news/rss_2.0/' },
    { name: 'テクノエッジ', url: 'https://www.techno-edge.net/rss20/index.rdf' },
    { name: 'BRIDGE', url: 'https://thebridge.jp/feed' },
  ]},
  { id: 'gizmodo', name: 'ギズモード', color: '#d94b4b', feeds: [
    { name: 'ギズモード', url: 'https://www.gizmodo.jp/feed/index.xml' },
  ]},
  { id: 'rocket', name: 'ロケニュー', color: '#e8862a', feeds: [
    { name: 'ロケットニュース24', url: 'https://rocketnews24.com/feed/' },
  ]},
  { id: 'delish', name: 'デリッシュキッチン', color: '#3fae6a', feeds: [
    { name: 'DELISH KITCHEN', url: 'https://delishkitchen.tv/articles', type: 'delish' },
    { name: 'DELISH KITCHEN', url: gn('デリッシュキッチン') },
  ]},
  { id: 'mens', name: 'メンズスタイル', color: '#3b8fd9', feeds: [
    { name: "MEN'S NON-NO", url: 'https://www.mensnonno.jp/feed/' },
    { name: 'GQ JAPAN', url: 'https://www.gqjapan.jp/feed/rss' },
    { name: 'Esquire', url: 'https://www.esquire.com/jp/rss/all.xml/' },
  ]},
  { id: 'car', name: '自動車', color: '#8e5bd6', feeds: [
    { name: 'Car Watch', url: 'https://car.watch.impress.co.jp/data/rss/1.0/car/feed.rdf' },
    { name: 'レスポンス', url: 'https://response.jp/rss20/index.rdf' },
    { name: 'webCG', url: 'https://www.webcg.net/list/feed/rss' },
    { name: 'くるまのニュース', url: 'https://kuruma-news.jp/feed' },
  ]},
  { id: 'hobby', name: 'ホビー', color: '#d94b4b', feeds: [
    { name: '電撃ホビー', url: 'https://hobby.dengeki.com/feed/' },
    { name: 'ホビージャパン', url: 'https://hjweb.jp/feed' },
    { name: 'Hobby Watch', url: 'https://hobby.watch.impress.co.jp/data/rss/1.0/hbw/feed.rdf' },
    { name: 'ファミ通', url: gn('site:famitsu.com') },
    { name: '4Gamer', url: 'https://www.4gamer.net/rss/index.xml' },
  ]},
  { id: 'fashion', name: 'ファッション', color: '#e8862a', feeds: [
    { name: 'WWD JAPAN', url: 'https://www.wwdjapan.com/feed' },
    { name: 'FASHIONSNAP', url: 'https://www.fashionsnap.com/rss.xml' },
    { name: 'Fashion Press', url: gn('site:fashion-press.net') },
  ]},
  { id: 'kpop', name: 'K-POP', color: '#3fae6a', feeds: [
    { name: 'Kstyle', url: gn('site:news.kstyle.com') },
    { name: 'Kpop monster', url: 'https://www.kpopmonster.jp/?feed=rss2' },
    { name: 'wowkorea', url: gn('site:wowkorea.jp') },
    { name: 'danmee', url: 'https://danmee.jp/feed/' },
  ]},
];

// 天気（鳥取市）
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=35.50&longitude=134.24'
  + '&current=temperature_2m,weather_code,precipitation'
  + '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  + '&timezone=Asia%2FTokyo&forecast_days=3';
const JMA_OVERVIEW_URL = 'https://www.jma.go.jp/bosai/forecast/data/overview_forecast/310000.json';

// ============================================================
// Web（ここから下は普段触らない）
// ============================================================
function doGet(e) {
  // ?api=data / tabs / refresh → JSONを返す（GitHub Pages 側の画面が使う）
  const api = e && e.parameter && e.parameter.api;
  if (api) {
    let body;
    if (api === 'tabs') body = JSON.stringify(getTabs());
    else if (api === 'refresh') body = refreshNow();
    else body = getData();
    return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
  }
  // それ以外 → 画面そのもの（予備。普段は GitHub Pages のURLを使う）
  const t = HtmlService.createTemplateFromFile('index');
  t.appName = APP_NAME;
  return t.evaluate()
    .setTitle(APP_NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// 画面から呼ばれる：キャッシュを返す
function getData() {
  const raw = readCache_();
  if (raw) return raw;
  refresh();
  return readCache_();
}

// 画面から呼ばれる：いま集め直して返す
function refreshNow() {
  refresh();
  return readCache_();
}

// 画面から呼ばれる：タブ定義（名前と色）
function getTabs() {
  return TABS.map(t => ({ id: t.id, name: t.name, color: t.color }));
}

// ============================================================
// 初回セットアップ（手動で1回だけ実行）
// ============================================================
function setup() {
  ScriptApp.getProjectTriggers().forEach(tr => {
    if (tr.getHandlerFunction() === 'refresh') ScriptApp.deleteTrigger(tr);
  });
  ScriptApp.newTrigger('refresh').timeBased().everyMinutes(30).create();
  refresh();
  Logger.log('setup 完了。30分ごとに refresh が動きます。');
}

// ============================================================
// 収集（トリガーで30分ごと）
//   ・6媒体ずつまとめて取りに行く（1つが遅くても全体が止まらない）
//   ・全体で4分を超えたら残りは諦めて、前回の記事を使う
//   ・前回のキャッシュと合流させるので、1回取れなくても記事が消えない
// ============================================================
const FETCH_CHUNK = 6;
const FETCH_BUDGET_MS = 240000;

function refresh() {
  const start = Date.now();
  const reqs = [];
  const meta = [];
  TABS.forEach(tab => tab.feeds.forEach(f => {
    reqs.push({ url: f.url, muteHttpExceptions: true, followRedirects: true,
      headers: { 'User-Agent': 'Mozilla/5.0 (AIR LAB NEWS; personal RSS reader)' } });
    meta.push({ tab: tab.id, feed: f });
  }));

  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;
  const byTab = {};
  const errors = [];
  const timing = [];
  TABS.forEach(t => byTab[t.id] = []);

  const handle = (m, r) => {
    try {
      const code = r.getResponseCode();
      if (code !== 200) { errors.push(m.feed.name + ' HTTP ' + code); return; }
      const body = r.getContentText('UTF-8');
      const items = m.feed.type === 'delish' ? parseDelish_(body) : parseFeed_(body);
      items.slice(0, MAX_PER_FEED).forEach(it => {
        if (!it.t || !it.u) return;
        if (it.d && it.d < cutoff) return;
        it.s = it.s || m.feed.name;
        byTab[m.tab].push(it);
      });
    } catch (err) { errors.push(m.feed.name + ' ' + err); }
  };

  for (let i = 0; i < reqs.length; i += FETCH_CHUNK) {
    if (Date.now() - start > FETCH_BUDGET_MS) {
      errors.push('時間切れ: ' + meta.slice(i).map(m => m.feed.name).join(','));
      break;
    }
    const names = meta.slice(i, i + FETCH_CHUNK).map(m => m.feed.name).join(',');
    const t0 = Date.now();
    let rs = [];
    try { rs = UrlFetchApp.fetchAll(reqs.slice(i, i + FETCH_CHUNK)); }
    catch (err) { errors.push('fetchAll ' + names + ' ' + err); continue; }
    timing.push(names + ' ' + (Date.now() - t0) + 'ms');
    rs.forEach((r, j) => handle(meta[i + j], r));
  }

  // 前回のキャッシュと合流（取れなかった媒体の記事を残す）
  let old = null;
  try { old = JSON.parse(readCache_() || 'null'); } catch (e) {}
  if (old && old.tabs) {
    Object.keys(byTab).forEach(id => {
      (old.tabs[id] || []).forEach(it => { if (it.d && it.d >= cutoff) byTab[id].push(it); });
    });
  }

  // タブ内の重複を消して新しい順に
  Object.keys(byTab).forEach(id => {
    const seen = {};
    byTab[id] = byTab[id]
      .filter(it => { const k = normTitle_(it.t); if (seen[it.u] || seen[k]) return false; seen[it.u] = seen[k] = 1; return true; })
      .sort((a, b) => (b.d || 0) - (a.d || 0))
      .slice(0, MAX_PER_TAB);
  });

  const data = {
    updated: Date.now(),
    tabs: byTab,
    weather: fetchWeather_(),
    errors: errors,
    timing: timing,
    took: Date.now() - start,
  };
  writeCache_(JSON.stringify(data));
  Logger.log('refresh 完了 ' + data.took + 'ms, errors: ' + errors.join(' / ') + ' | ' + timing.join(' | '));
}

// ============================================================
// フィード解析（RSS2 / Atom / RSS1.0 RDF）
// ============================================================
function parseFeed_(xml) {
  xml = xml.replace(/^﻿/, '').trim();
  try { return parseXml_(xml); }
  catch (e) { return parseRegex_(xml); }
}

function parseXml_(xml) {
  const doc = XmlService.parse(xml);
  const root = doc.getRootElement();
  const name = root.getName();
  const ns = root.getNamespace();
  let entries = [];
  let isAtom = false;
  if (name === 'rss') {
    const ch = root.getChild('channel');
    entries = ch ? ch.getChildren('item') : [];
  } else if (name === 'feed') {
    isAtom = true;
    entries = root.getChildren('entry', ns);
  } else if (name === 'RDF') {
    const rss1 = XmlService.getNamespace('http://purl.org/rss/1.0/');
    entries = root.getChildren('item', rss1);
  } else {
    throw new Error('unknown feed type ' + name);
  }
  const out = [];
  entries.forEach(el => {
    const it = { t: '', u: '', d: 0, i: '', x: '', s: '' };
    const kids = el.getChildren();
    let content = '';
    kids.forEach(k => {
      const n = k.getName();
      const v = (k.getText() || '').trim();
      if (n === 'title') it.t = v;
      else if (n === 'link') {
        if (isAtom) {
          const rel = k.getAttribute('rel') ? k.getAttribute('rel').getValue() : 'alternate';
          const href = k.getAttribute('href') ? k.getAttribute('href').getValue() : '';
          if (rel === 'alternate' && href && !it.u) it.u = href;
        } else if (v && !it.u) it.u = v;
      }
      else if (n === 'pubDate' || n === 'date' || n === 'published' || n === 'updated' || n === 'issued') {
        if (!it.d) it.d = parseDate_(v);
      }
      else if (n === 'description' || n === 'summary') { if (!it.x) it.x = v; }
      else if (n === 'encoded' || n === 'content') { content = content || v; }
      else if (n === 'source') { if (v) it.s = v; }
      else if (n === 'enclosure' || n === 'content' || n === 'thumbnail') {
        const a = k.getAttribute('url');
        const type = k.getAttribute('type') ? k.getAttribute('type').getValue() : '';
        if (a && (!type || /image/.test(type)) && !it.i) it.i = a.getValue();
      }
    });
    if (!it.i) { const mc = el.getChildren().find(k => (k.getName() === 'content' || k.getName() === 'thumbnail') && k.getAttribute('url')); if (mc) it.i = mc.getAttribute('url').getValue(); }
    if (!it.u && !isAtom) { const g = el.getChild('guid'); if (g && /^https?:/.test(g.getText())) it.u = g.getText().trim(); }
    finishItem_(it, content);
    out.push(it);
  });
  return out;
}

function parseRegex_(xml) {
  const out = [];
  const blocks = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) || [];
  blocks.forEach(b => {
    const it = { t: tag_(b, 'title'), u: '', d: 0, i: '', x: '', s: '' };
    const l = b.match(/<link[^>]*href="([^"]+)"/) || b.match(/<link[^>]*>([^<]+)<\/link>/);
    it.u = l ? l[1].trim() : '';
    it.d = parseDate_(tag_(b, 'pubDate') || tag_(b, 'dc:date') || tag_(b, 'published') || tag_(b, 'updated'));
    it.x = tag_(b, 'description') || tag_(b, 'summary');
    it.s = tag_(b, 'source');
    const img = b.match(/<(?:enclosure|media:content|media:thumbnail)[^>]*url="([^"]+)"/);
    if (img) it.i = img[1];
    finishItem_(it, tag_(b, 'content:encoded') || tag_(b, 'content'));
    out.push(it);
  });
  return out;
}

function tag_(b, name) {
  const m = b.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>'));
  if (!m) return '';
  return decode_(m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')).trim();
}

// DELISH KITCHEN の記事一覧（RSSが無いのでページから拾う）
function parseDelish_(html) {
  const out = [];
  const seen = {};
  const re = /href="(\/articles\/(\d+))"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = re.exec(html)) && out.length < 30) {
    const url = 'https://delishkitchen.tv' + m[1];
    if (seen[url]) continue;
    const title = decode_(m[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if (!title || title.length < 6) continue;
    seen[url] = 1;
    const img = (m[3].match(/<img[^>]*src="([^"]+)"/) || [])[1] || '';
    out.push({ t: title, u: url, d: Date.now() - out.length * 3600000, i: img, x: '', s: '' });
  }
  return out;
}

function finishItem_(it, content) {
  // Googleニュースの「タイトル - 媒体名」を分解
  const gm = it.t.match(/^(.*)\s[-–]\s([^-–]{1,30})$/);
  if (gm && /news\.google\.com/.test(it.u)) { it.t = gm[1].trim(); it.s = it.s || gm[2].trim(); }
  it.t = decode_(it.t).replace(/\s+/g, ' ').trim();
  if (/^[\w.-]+\.[a-z]{2,}$/i.test(it.s)) it.s = '';        // 媒体名がドメインだけなら捨てて feed 名を使う
  if (!it.i) { const im = (it.x + content).match(/<img[^>]*src="(https?:[^"]+)"/i); if (im) it.i = im[1]; }
  let x = stripHtml_(it.x || content || '');
  if (/news\.google\.com/.test(it.u)) x = '';       // Googleニュースの要約はリンク羅列なので捨てる
  if (x && it.t && x.indexOf(it.t.slice(0, 20)) === 0) x = x.slice(it.t.length).trim();
  it.x = x.length > SUMMARY_LEN ? x.slice(0, SUMMARY_LEN) + '…' : x;
  if (!it.d) it.d = Date.now();
}

function stripHtml_(s) {
  return decode_(String(s).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decode_(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(n))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
}

function parseDate_(s) {
  if (!s) return 0;
  const d = new Date(s);
  if (!isNaN(d)) return d.getTime();
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return new Date(m[1], m[2] - 1, m[3], m[4], m[5]).getTime();
  return 0;
}

function normTitle_(t) {
  return String(t).toLowerCase().replace(/[\s　、。・「」『』（）()【】\[\]!?！？:：\-–—~〜…]/g, '').slice(0, 40);
}

// ============================================================
// 天気
// ============================================================
function fetchWeather_() {
  const w = {};
  try {
    const j = JSON.parse(UrlFetchApp.fetch(WEATHER_URL, { muteHttpExceptions: true }).getContentText());
    w.now = { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code };
    w.days = j.daily.time.map((d, i) => ({
      date: d, code: j.daily.weather_code[i],
      max: Math.round(j.daily.temperature_2m_max[i]), min: Math.round(j.daily.temperature_2m_min[i]),
      pop: j.daily.precipitation_probability_max[i],
    }));
  } catch (e) { w.error = String(e); }
  try {
    const o = JSON.parse(UrlFetchApp.fetch(JMA_OVERVIEW_URL, { muteHttpExceptions: true }).getContentText());
    w.text = String(o.text || '').replace(/\s+/g, ' ').slice(0, 160);
  } catch (e) {}
  return w;
}

// ============================================================
// キャッシュ（Driveの1ファイル）
// ============================================================
function getDataFile_() {
  const files = DriveApp.getFilesByName(DATA_FILE);
  if (files.hasNext()) return files.next();
  return DriveApp.createFile(DATA_FILE, '', MimeType.PLAIN_TEXT);
}
function readCache_() {
  const f = getDataFile_();
  const s = f.getBlob().getDataAsString('UTF-8');
  return s && s.length > 2 ? s : null;
}
function writeCache_(s) {
  getDataFile_().setContent(s);
}
