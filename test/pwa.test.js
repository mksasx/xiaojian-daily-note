const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourceRoot = path.resolve(__dirname, '..', 'src');

test('PWA manifest references valid install icons', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  for (const icon of manifest.icons) {
    assert.equal(fs.existsSync(path.resolve(sourceRoot, icon.src)), true, `missing ${icon.src}`);
  }
});

test('web platform loads before the renderer', () => {
  const html = fs.readFileSync(path.join(sourceRoot, 'index.html'), 'utf8');
  const utilities = html.indexOf('task-utils.js');
  const platform = html.indexOf('platform.js');
  const renderer = html.indexOf('renderer.js');
  assert.ok(utilities > 0 && utilities < platform && platform < renderer);
  assert.match(html, /manifest\.webmanifest/);
});

test('offline shell contains every core PWA asset', () => {
  const worker = fs.readFileSync(path.join(sourceRoot, 'service-worker.js'), 'utf8');
  for (const asset of ['index.html', 'styles.css', 'task-utils.js', 'platform.js', 'renderer.js', 'manifest.webmanifest']) {
    assert.ok(worker.includes(asset), `${asset} is missing from the offline shell`);
  }
});

test('today view does not steal focus unless the new-task shortcut is used', () => {
  const renderer = fs.readFileSync(path.join(sourceRoot, 'renderer.js'), 'utf8');
  assert.doesNotMatch(renderer, /if \(view === 'today'\) elements\.taskInput\.focus\(\)/);
  assert.doesNotMatch(renderer, /renderToday\(\);\s*elements\.taskInput\.focus\(\)/);
  assert.match(renderer, /event\.preventDefault\(\); openView\('today'\); elements\.taskInput\.focus\(\)/);
});

test('date heading exposes a native calendar picker', () => {
  const html = fs.readFileSync(path.join(sourceRoot, 'index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(sourceRoot, 'renderer.js'), 'utf8');
  assert.match(html, /<input type="date" id="datePicker" aria-label="选择日期" \/>/);
  assert.match(renderer, /elements\.datePicker\.value = selectedDate/);
  assert.match(renderer, /elements\.datePicker\.addEventListener\('change'/);
});
