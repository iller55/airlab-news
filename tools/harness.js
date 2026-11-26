// Code.gs を Mac の上で動かすための代役（UrlFetchApp などを curl とファイルで置き換える）
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SRC = process.argv[2], OUT = process.argv[3];
const CACHE = path.join(OUT, 'cache.json');
function curl(url, ua) {
  const r = cp.spawnSync('curl', ['-sS', '-L', '-m', '25', '-A', ua || 'Mozilla/5.0 (AIR LAB NEWS; personal RSS reader)', '-o', '-', '-w', '\n%{http_code}', url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = r.stdout || ''; const i = out.lastIndexOf('\n');
  const code = parseInt(out.slice(i + 1), 10) || 0; const body = out.slice(0, i);
  return { getResponseCode: () => code, getContentText: () => body };
}
const g = {
  UrlFetchApp: { fetchAll: reqs => reqs.map(q => curl(q.url, q.headers && q.headers['User-Agent'])), fetch: (u) => curl(u) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  Logger: { log: s => console.log('[log]', String(s).slice(0, 400)) },
  XmlService: { parse: () => { throw new Error('no XmlService here'); } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'x', setProperty: () => {} }) },
  DriveApp: { getFileById: () => ({ getBlob: () => ({ getDataAsString: () => fs.existsSync(CACHE) ? fs.readFileSync(CACHE, 'utf8') : '' }), setContent: s => fs.writeFileSync(CACHE, s) }) },
  MimeType: {}, ContentService: {}, ScriptApp: {}, HtmlService: {},
};
const quiet = { log: () => {} };
const fn = new Function(...Object.keys(g), 'console', fs.readFileSync(SRC, 'utf8') + '\nreturn { refresh, getTabs, readCache_ };');
const api = fn(...Object.values(g), quiet);
const t0 = Date.now(); api.refresh();
const data = JSON.parse(api.readCache_());
fs.writeFileSync(path.join(OUT, 'data.json'), JSON.stringify(data));
fs.writeFileSync(path.join(OUT, 'tabs.json'), JSON.stringify(api.getTabs()));
console.log('took', Date.now() - t0, 'ms  errors:', JSON.stringify(data.errors));
