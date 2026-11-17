#!/usr/bin/env node
// Drive the local k3Dmap static app and leave proof in K3DMAP_EVIDENCE_DIR.
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.K3DMAP_PORT || '8765';
const DEBUG_PORT = process.env.K3DMAP_DEBUG_PORT || '9333';
const STATE = process.env.K3DMAP_STATE_DIR || '/tmp/k3dmap-verify/state';
const EVIDENCE = process.env.K3DMAP_EVIDENCE_DIR || '/tmp/k3dmap-verify-evidence';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const AUTHORED_JS = [
  'dist/app.js',
  'dist/cartography.js',
  'dist/auction.js',
  'dist/auction-data.js',
  'dist/landcover.js',
  'dist/trees.js',
  'dist/miniature.js',
  'dist/miniature-style.js',
];

function die(message) {
  const error = new Error(message);
  error.k3dmap = true;
  throw error;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function alive(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function stateFile(name) {
  return path.join(STATE, name);
}

function trace(message) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.appendFileSync(path.join(EVIDENCE, 'actions.log'), `${new Date().toISOString()} ${message}\n`);
  console.log(message);
}

function listeners(port) {
  try {
    const out = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
    return [...new Set(out.split('\n').map((line) => line.trim()).filter(Boolean))];
  } catch {
    return [];
  }
}

function descendantOf(pid, ancestor) {
  let current = String(pid);
  for (let hop = 0; hop < 12; hop += 1) {
    if (current === String(ancestor)) return true;
    let status;
    try {
      status = fs.readFileSync(`/proc/${current}/status`, 'utf8');
    } catch {
      return false;
    }
    const parent = status.match(/PPid:\s+(\d+)/)?.[1];
    if (!parent || parent === '0') return false;
    current = parent;
  }
  return false;
}

function childrenOf(pid) {
  const kids = [];
  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    let status;
    try {
      status = fs.readFileSync(`/proc/${entry}/status`, 'utf8');
    } catch {
      continue;
    }
    if (status.match(/PPid:\s+(\d+)/)?.[1] === String(pid)) kids.push(Number(entry));
  }
  return kids;
}

function killTree(pid) {
  if (!pid || Number(pid) <= 1) return;
  for (const child of childrenOf(pid)) killTree(child);
  try { process.kill(Number(pid), 'SIGTERM'); } catch { /* already gone */ }
  try { process.kill(-Number(pid), 'SIGTERM'); } catch { /* not a group leader */ }
}

function validateCartography(input) {
  const config = structuredClone(input);
  config.appearance ??= {
    mode: 'standard',
    roofs: true,
    windows: true,
    wallColor: '#eee4cc',
    roofColor: '#cc8658',
    windowColor: '#537c77',
  };
  if (!['standard', 'miniature'].includes(config.appearance.mode)
    || typeof config.appearance.roofs !== 'boolean'
    || typeof config.appearance.windows !== 'boolean') {
    throw new Error('잘못된 미니어처 설정');
  }
  if (config.version !== 1) throw new Error('설정 버전이 맞지 않습니다.');
  const ranges = {
    'terrain.exaggeration': [0, 3],
    'terrain.shade': [0, 1],
    'buildings.opacity': [0, 1],
    'farmland.opacity': [0, 1],
    'farmland.patternSpacing': [4, 16],
    'forest.heightScale': [0.5, 2],
    'forest.widthScale': [0.5, 2],
    'forest.density': [0.25, 2],
    'forest.maxTrees': [0, 1800],
    'forest.minZoom': [13, 18],
  };
  for (const [setting, [lo, hi]] of Object.entries(ranges)) {
    const [group, key] = setting.split('.');
    const value = config[group]?.[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < lo || value > hi) {
      throw new Error(`잘못된 설정: ${setting}`);
    }
  }
  const colors = [
    'appearance.wallColor', 'appearance.roofColor', 'appearance.windowColor',
    'buildings.lowColor', 'buildings.highColor', 'farmland.color', 'farmland.patternColor',
    'farmland.boundaryColor', 'forest.color', 'forest.crownColor', 'forest.trunkColor',
  ];
  for (const setting of colors) {
    const [group, key] = setting.split('.');
    if (!/^#[0-9a-f]{6}$/i.test(config[group]?.[key] || '')) throw new Error(`잘못된 색상: ${setting}`);
  }
  for (const [group, key] of [['terrain', 'enabled'], ['buildings', 'enabled'], ['forest', 'trees']]) {
    if (typeof config[group]?.[key] !== 'boolean') throw new Error('잘못된 표시 설정');
  }
  if (!['rows', 'grid', 'none'].includes(config.farmland.pattern) || !['cone', 'round'].includes(config.forest.shape)) {
    throw new Error('지원하지 않는 표현 방식');
  }
  return config;
}

function checkData() {
  for (const file of AUTHORED_JS) {
    execFileSync(process.execPath, ['--check', file], { cwd: ROOT, stdio: 'inherit' });
    console.log(`ok syntax ${file}`);
  }
  execFileSync('python3', ['-c', 'import py_compile; py_compile.compile("scripts/update_onbid_auctions.py", cfile="/tmp/k3dmap-onbid.pyc", doraise=True)'], { cwd: ROOT, stdio: 'inherit' });
  console.log('ok syntax scripts/update_onbid_auctions.py');
  const html = fs.readFileSync(path.join(ROOT, 'dist/index.html'), 'utf8');
  for (const needle of ['id="map"', 'id="reset"', '전국 보기', 'cartography.js', 'app.js']) {
    if (!html.includes(needle)) die(`index.html is missing ${needle}`);
  }
  console.log('ok index.html markers');
  const cartography = validateCartography(readJson(path.join(ROOT, 'dist/cartography.json')));
  console.log(`ok cartography version=${cartography.version} mode=${cartography.appearance.mode}`);
  const auctions = readJson(path.join(ROOT, 'dist/onbid-auctions.geojson'));
  if (auctions.type !== 'FeatureCollection' || !Array.isArray(auctions.features) || auctions.features.length === 0) {
    die('onbid-auctions.geojson is not a non-empty FeatureCollection');
  }
  if (auctions.metadata?.itemCount !== undefined && auctions.metadata.itemCount !== auctions.features.length) {
    die(`onbid itemCount ${auctions.metadata.itemCount} != features ${auctions.features.length}`);
  }
  for (const feature of auctions.features) {
    if (feature.geometry?.type !== 'Point' || feature.geometry.coordinates?.length !== 2 || !feature.properties?.id) {
      die('onbid feature is missing a Point geometry or properties.id');
    }
  }
  console.log(`ok onbid features=${auctions.features.length}`);
}

async function waitForHttp() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/`);
      const body = await response.text();
      if (response.ok && body.includes('대한민국 3D — Spatial Atlas')) return;
    } catch { /* server still binding */ }
    await sleep(200);
  }
  die(`server at ${ORIGIN} did not serve the map page`);
}

function launch() {
  fs.mkdirSync(STATE, { recursive: true });
  const recordPath = stateFile('http.json');
  if (fs.existsSync(recordPath)) {
    const existing = readJson(recordPath);
    if (alive(existing.pid)) die(`refusing to launch: verification server already running as pid ${existing.pid} on port ${existing.port}. Run cleanup, or set a new K3DMAP_STATE_DIR and K3DMAP_PORT.`);
  }
  const owners = listeners(PORT);
  if (owners.length) die(`refusing to launch: port ${PORT} is already held by pid ${owners.join(',')}. Do not attach to a server this run did not start.`);
  const log = stateFile('http.log');
  const fd = fs.openSync(log, 'a');
  const child = spawn('python3', ['-m', 'http.server', PORT, '--directory', path.join(ROOT, 'dist'), '--bind', '127.0.0.1'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', fd, fd],
  });
  fs.closeSync(fd);
  child.unref();
  fs.writeFileSync(recordPath, JSON.stringify({ pid: child.pid, port: Number(PORT), origin: ORIGIN }));
  trace(`launched python3 -m http.server ${PORT} --directory dist --bind 127.0.0.1 pid=${child.pid}`);
}

async function doctor() {
  const recordPath = stateFile('http.json');
  if (!fs.existsSync(recordPath)) die('doctor: no verification server record. Run launch first.');
  const record = readJson(recordPath);
  if (String(record.port) !== String(PORT)) die(`doctor: recorded port ${record.port} does not match K3DMAP_PORT=${PORT}`);
  if (!alive(record.pid)) die(`doctor: recorded server pid ${record.pid} is not running`);
  const owners = listeners(record.port);
  if (!owners.some((pid) => descendantOf(pid, record.pid))) {
    die(`doctor: port ${record.port} is not owned by pid ${record.pid} (listeners: ${owners.join(',') || 'none'})`);
  }
  const page = await fetch(`${record.origin}/`);
  const html = await page.text();
  if (!page.ok || !html.includes('<title>대한민국 3D — Spatial Atlas</title>')) die('doctor: map page title was not served');
  const configResponse = await fetch(`${record.origin}/cartography.json`);
  const config = validateCartography(await configResponse.json());
  const appResponse = await fetch(`${record.origin}/app.js`);
  const app = await appResponse.text();
  if (!appResponse.ok || !app.includes('function start')) die('doctor: app.js was not served');
  console.log(`pid: ${record.pid}`);
  console.log(`port: ${record.port}`);
  console.log(`origin: ${record.origin}`);
  console.log('title: 대한민국 3D — Spatial Atlas');
  console.log(`cartography: version ${config.version} mode ${config.appearance.mode}`);
  console.log('result: worth driving');
}

function flags(args) {
  const values = {};
  for (let i = 0; i < args.length; i += 1) {
    if (!args[i].startsWith('--')) die(`unexpected argument ${args[i]}`);
    const key = args[i].slice(2);
    const value = args[i + 1];
    if (value === undefined || value.startsWith('--')) die(`missing value for --${key}`);
    values[key] = value;
    i += 1;
  }
  return values;
}

async function connectCdp() {
  const version = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((response) => response.json());
  const socket = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('Chrome DevTools socket failed')), { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(`${message.error.message || 'cdp error'}`));
    else resolve(message.result || {});
  });
  function send(method, params = {}, sessionId) {
    const id = ++nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    socket.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timeout waiting for ${method}`));
      }, 20000);
      pending.set(id, { resolve, reject, timer });
    });
  }
  return {
    send,
    async close() {
      socket.close();
      await Promise.race([
        new Promise((resolve) => socket.addEventListener('close', resolve, { once: true })),
        sleep(500),
      ]);
    },
  };
}

async function withPage(fn) {
  const chrome = readJson(stateFile('chrome.json'));
  if (!alive(chrome.pid)) die('browser: recorded Chrome is not running. Run browser start.');
  const list = await fetch(`http://127.0.0.1:${chrome.debugPort}/json/list`).then((response) => response.json());
  const page = list.find((target) => target.type === 'page' && target.url.startsWith(chrome.origin));
  if (!page) die(`browser: no page open at ${chrome.origin}`);
  const cdp = await connectCdp();
  try {
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: page.id, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    const downloadDir = path.join(EVIDENCE, 'downloads');
    fs.mkdirSync(downloadDir, { recursive: true });
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir }, sessionId);
    return await fn(cdp, sessionId);
  } finally {
    await cdp.close();
  }
}

async function evaluate(cdp, sessionId, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails.exception));
  }
  return result.result?.value;
}

function quote(value) {
  return JSON.stringify(value);
}

async function pageReady(cdp, sessionId) {
  const fatal = [
    '3D 지도를 시작하지 못했습니다',
    '지형 고도 데이터를 불러오지 못했습니다',
    '지도 일부를 불러오지 못했습니다',
    '미니어처 세부 모델을 불러오지 못했습니다',
  ];
  const deadline = Date.now() + 30000;
  let state;
  while (Date.now() < deadline) {
    state = await evaluate(cdp, sessionId, `(() => {
      const canvas = document.querySelector('#map canvas');
      const status = document.getElementById('status')?.textContent || '';
      return {
        title: document.title,
        location: document.getElementById('location')?.textContent || '',
        status,
        canvas: canvas ? canvas.width + 'x' + canvas.height : 'none',
        fields: document.querySelectorAll('#cartography-fields fieldset').length,
        places: document.querySelectorAll('#places button').length,
        webgl: (() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); })()
      };
    })()`);
    if (fatal.some((text) => state.status.includes(text))) die(`browser: map failed to start: ${state.status}`);
    const usable = state.canvas !== 'none'
      && !state.canvas.startsWith('0x')
      && state.fields >= 5
      && state.places === 7
      && state.location === '광화문 · 종로'
      && state.webgl === true
      && (state.status === '' || state.status === '건물을 보려면 지도를 더 확대해 주세요.');
    if (usable) return state;
    await sleep(400);
  }
  die(`browser: map was not usable: ${JSON.stringify(state)}`);
}

async function browserStart() {
  const http = readJson(stateFile('http.json'));
  if (!alive(http.pid)) die('browser start: verification server is not running');
  fs.mkdirSync(STATE, { recursive: true });
  const recordPath = stateFile('chrome.json');
  if (!fs.existsSync(recordPath) || !alive(readJson(recordPath).pid)) {
    const owners = listeners(DEBUG_PORT);
    if (owners.length) die(`refusing to start Chrome: debug port ${DEBUG_PORT} is held by pid ${owners.join(',')}`);
    const log = stateFile('chrome.log');
    const fd = fs.openSync(log, 'a');
    const child = spawn('google-chrome', [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--force-device-scale-factor=1',
      '--window-size=1440,900',
      `--remote-debugging-address=127.0.0.1`,
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${path.join(STATE, 'chrome-profile')}`,
      '--no-first-run',
      '--no-default-browser-check',
      `${http.origin}/`,
    ], { detached: true, stdio: ['ignore', fd, fd] });
    fs.closeSync(fd);
    child.unref();
    fs.writeFileSync(recordPath, JSON.stringify({ pid: child.pid, debugPort: Number(DEBUG_PORT), origin: http.origin }));
    trace(`launched google-chrome headless pid=${child.pid} debug=${DEBUG_PORT}`);
  }
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const version = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).then((response) => response.json());
      if (version.Browser) break;
    } catch { /* chrome still starting */ }
    await sleep(200);
  }
  const chrome = readJson(recordPath);
  const owners = listeners(DEBUG_PORT);
  if (!owners.some((pid) => descendantOf(pid, chrome.pid))) {
    die(`browser: debug port ${DEBUG_PORT} is not owned by Chrome pid ${chrome.pid}`);
  }
  const state = await withPage((cdp, sessionId) => pageReady(cdp, sessionId));
  trace(`browser ready title=${state.title} location=${state.location} canvas=${state.canvas} webgl=${state.webgl} status=${JSON.stringify(state.status)}`);
}

async function browserClick(selector, hasText) {
  const label = hasText ?? null;
  const clicked = await withPage((cdp, sessionId) => evaluate(cdp, sessionId, `(() => {
    const nodes = [...document.querySelectorAll(${quote(selector)})];
    const el = nodes.find((node) => {
      if (${quote(label)} === null) return node === nodes[0];
      const strong = node.querySelector('strong');
      const name = (strong ? strong.textContent : node.innerText).trim();
      return name === ${quote(label)};
    });
    if (!el) return { ok: false, reason: 'not found' };
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return { ok: false, reason: 'not visible' };
    return { ok: true, x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, text: (el.innerText || el.id || '').trim().slice(0, 80) };
  })()`).then(async (target) => {
    if (!target?.ok) die(`click failed for ${selector}${hasText ? ` text ${hasText}` : ''}: ${target?.reason || 'unknown'}`);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: target.x, y: target.y, button: 'left', clickCount: 1 }, sessionId);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: target.x, y: target.y, button: 'left', clickCount: 1 }, sessionId);
    return target;
  }));
  trace(`click ${selector}${hasText ? ` text=${hasText}` : ''} -> ${clicked.text}`);
}

async function browserFill(selector, value) {
  const filled = await withPage((cdp, sessionId) => evaluate(cdp, sessionId, `(() => {
    const el = document.querySelector(${quote(selector)});
    if (!el) return { ok: false };
    el.value = ${quote(value)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: String(el.value) };
  })()`));
  if (!filled?.ok) die(`fill failed for ${selector}`);
  trace(`fill ${selector} value=${filled.value}`);
}

async function browserText(selector) {
  const text = await withPage((cdp, sessionId) => evaluate(cdp, sessionId, `document.querySelector(${quote(selector)})?.textContent ?? null`));
  if (text === null) die(`text not found for ${selector}`);
  trace(`text ${selector} ${JSON.stringify(text)}`);
  return text;
}

async function browserWait(selector, text, startsWith) {
  const deadline = Date.now() + 20000;
  let last;
  while (Date.now() < deadline) {
    last = await withPage((cdp, sessionId) => evaluate(cdp, sessionId, `(() => {
      const el = document.querySelector(${quote(selector)});
      return el ? (el.textContent || '').trim() : null;
    })()`));
    const matched = text !== undefined
      ? last === text
      : startsWith !== undefined
        ? typeof last === 'string' && last.startsWith(startsWith)
        : last !== null;
    if (matched) {
      const detail = text !== undefined ? ` text=${text}` : startsWith !== undefined ? ` starts=${startsWith}` : '';
      trace(`wait ${selector}${detail} ok`);
      return;
    }
    await sleep(200);
  }
  die(`timed out waiting for ${selector} (last: ${JSON.stringify(last)})`);
}

async function browserSnapshot(file, feature, entry) {
  const state = await withPage((cdp, sessionId) => evaluate(cdp, sessionId, `(() => {
    const canvas = document.querySelector('#map canvas');
    const mode = document.querySelector('[data-mode].active');
    const active = document.querySelector('#places button.active strong');
    const read = (id) => document.getElementById(id);
    return {
      title: document.title,
      mapLabel: read('map')?.getAttribute('aria-label') || '',
      location: read('location')?.textContent || '',
      status: read('status')?.textContent || '',
      pitch: read('pitch-value')?.textContent || '',
      coords: read('coords')?.textContent || '',
      view3d: read('view3d')?.getAttribute('aria-pressed') || '',
      view2d: read('view2d')?.getAttribute('aria-pressed') || '',
      activePlace: active?.textContent || '',
      mode: mode?.dataset.mode || '',
      miniatureNoteHidden: String(read('miniature-note')?.hidden),
      auctionCount: read('auction-count')?.textContent || '',
      auctionState: read('auction-data-state')?.textContent || '',
      terrain: String(read('terrain')?.checked),
      buildings: String(read('buildings')?.checked),
      landcover: String(read('landcover')?.checked),
      labels: String(read('labels')?.checked),
      auctions: String(read('auctions')?.checked),
      canvas: canvas ? canvas.width + 'x' + canvas.height : 'none'
    };
  })()`));
  const lines = [];
  if (feature) lines.push(`feature: ${feature}`);
  if (entry) lines.push(`entry: ${entry}`);
  for (const [key, value] of Object.entries(state)) lines.push(`${key}: ${value}`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.join('\n')}\n`);
  trace(`snapshot ${file}`);
}

async function browserScreenshot(file) {
  const image = await withPage(async (cdp, sessionId) => {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' }, sessionId);
    return Buffer.from(shot.data, 'base64');
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, image);
  trace(`screenshot ${file} bytes=${image.length}`);
}

async function browserWaitFile(name) {
  const file = path.join(EVIDENCE, 'downloads', name);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (fs.existsSync(file) && fs.statSync(file).size > 0) {
      trace(`download ${file} bytes=${fs.statSync(file).size}`);
      return;
    }
    await sleep(200);
  }
  die(`timed out waiting for download ${file}`);
}

async function cleanup() {
  for (const name of ['chrome.json', 'http.json']) {
    const file = stateFile(name);
    if (!fs.existsSync(file)) continue;
    const record = readJson(file);
    if (alive(record.pid)) {
      killTree(record.pid);
      const deadline = Date.now() + 4000;
      while (alive(record.pid) && Date.now() < deadline) await sleep(100);
      if (alive(record.pid)) {
        try { process.kill(Number(record.pid), 'SIGKILL'); } catch { /* already gone */ }
      }
    }
    trace(`stopped ${name} pid=${record.pid}`);
  }
  fs.rmSync(STATE, { recursive: true, force: true });
  console.log(`state removed: ${STATE}`);
  console.log(`evidence kept: ${EVIDENCE}`);
}

function evidenceOk() {
  const shot = path.join(EVIDENCE, 'nationwide/after.png');
  const snap = path.join(EVIDENCE, 'nationwide/after.txt');
  if (!fs.existsSync(shot) || fs.statSync(shot).size < 10000) die(`missing map screenshot ${shot}`);
  const body = fs.readFileSync(snap, 'utf8');
  for (const line of ['feature: nationwide-view', 'entry: 전국 보기', 'location: 대한민국 전체', 'pitch: 0°', 'view2d: true', 'activePlace: \n']) {
    if (!body.includes(line)) die(`snapshot missing ${JSON.stringify(line)}`);
  }
  console.log(`evidence ok ${shot} and ${snap}`);
}

async function smoke() {
  let started = false;
  try {
    checkData();
    launch();
    started = true;
    await waitForHttp();
    await doctor();
    await driveNationwide();
  } finally {
    if (started) await cleanup();
  }
  evidenceOk();
}

async function driveNationwide() {
  await browserStart();
  const before = await browserText('#location');
  if (before !== '광화문 · 종로') die(`expected opening location 광화문 · 종로, got ${before}`);
  await browserSnapshot(path.join(EVIDENCE, 'nationwide/before.txt'), 'nationwide-view', '초기 화면');
  await browserClick('#reset');
  await browserWait('#location', '대한민국 전체');
  await browserWait('#pitch-value', '0°');
  await browserWait('#view2d[aria-pressed="true"]');
  await browserSnapshot(path.join(EVIDENCE, 'nationwide/after.txt'), 'nationwide-view', '전국 보기');
  await browserScreenshot(path.join(EVIDENCE, 'nationwide/after.png'));
}

function usage() {
  console.log(`Usage:
  node scripts/verify_k3dmap.mjs check
  node scripts/verify_k3dmap.mjs launch
  node scripts/verify_k3dmap.mjs doctor
  node scripts/verify_k3dmap.mjs browser start
  node scripts/verify_k3dmap.mjs browser text --selector <css>
  node scripts/verify_k3dmap.mjs browser click --selector <css> [--has-text <exact label>]
  node scripts/verify_k3dmap.mjs browser fill --selector <css> --value <value>
  node scripts/verify_k3dmap.mjs browser wait --selector <css> [--text <exact text>] [--starts-with <prefix>]
  node scripts/verify_k3dmap.mjs browser snapshot --path <file> [--feature <id>] [--entry <label>]
  node scripts/verify_k3dmap.mjs browser screenshot --path <file>
  node scripts/verify_k3dmap.mjs browser wait-file --name <download name>
  node scripts/verify_k3dmap.mjs cleanup
  node scripts/verify_k3dmap.mjs smoke`);
}

const [command, sub, ...rest] = process.argv.slice(2);
try {
  if (!globalThis.WebSocket) die('Node 22 or newer is required (global WebSocket)');
  if (!command) {
    usage();
    process.exit(2);
  }
  if (command === 'check') checkData();
  else if (command === 'launch') {
    launch();
    await waitForHttp();
    console.log(`ready ${ORIGIN}`);
  } else if (command === 'doctor') await doctor();
  else if (command === 'cleanup') await cleanup();
  else if (command === 'smoke') await smoke();
  else if (command === 'browser') {
    const args = flags(rest);
    if (sub === 'start') await browserStart();
    else if (sub === 'text') await browserText(args.selector || die('need --selector'));
    else if (sub === 'click') await browserClick(args.selector || die('need --selector'), args['has-text']);
    else if (sub === 'fill') await browserFill(args.selector || die('need --selector'), args.value ?? die('need --value'));
    else if (sub === 'wait') await browserWait(args.selector || die('need --selector'), args.text, args['starts-with']);
    else if (sub === 'snapshot') await browserSnapshot(args.path || die('need --path'), args.feature, args.entry);
    else if (sub === 'screenshot') await browserScreenshot(args.path || die('need --path'));
    else if (sub === 'wait-file') await browserWaitFile(args.name || die('need --name'));
    else {
      usage();
      process.exit(2);
    }
  } else {
    usage();
    process.exit(2);
  }
} catch (error) {
  console.error(error.k3dmap ? error.message : (error.stack || error.message));
  process.exit(1);
}
