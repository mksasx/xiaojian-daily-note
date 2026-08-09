const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const miniRoot = path.join(projectRoot, 'miniprogram');
const desktopUtils = require(path.join(projectRoot, 'src', 'task-utils'));
const miniprogramUtils = require(path.join(miniRoot, 'utils', 'task-utils'));

test('WeChat Mini Program project exposes the three core tabs', () => {
  const projectConfig = JSON.parse(fs.readFileSync(path.join(projectRoot, 'project.config.json'), 'utf8'));
  const appConfig = JSON.parse(fs.readFileSync(path.join(miniRoot, 'app.json'), 'utf8'));

  assert.equal(projectConfig.miniprogramRoot, 'miniprogram/');
  assert.equal(projectConfig.appid, 'touristappid');
  assert.deepEqual(appConfig.pages, [
    'pages/today/today',
    'pages/history/history',
    'pages/settings/settings'
  ]);
  assert.equal(appConfig.tabBar.list.length, 3);

  for (const page of ['today', 'history', 'settings']) {
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      assert.equal(fs.existsSync(path.join(miniRoot, 'pages', page, `${page}.${extension}`)), true);
    }
  }
});

test('Mini Program task utilities stay backup-compatible with desktop', () => {
  const tasks = [
    {
      id: 'a', text: '先完成这一项', date: '2026-08-09', completed: false,
      createdAt: '2026-08-09T01:00:00.000Z', completedAt: null, updatedAt: '2026-08-09T01:00:00.000Z'
    },
    {
      id: 'b', text: '已经完成', date: '2026-08-09', completed: true,
      createdAt: '2026-08-09T02:00:00.000Z', completedAt: '2026-08-09T03:00:00.000Z', updatedAt: '2026-08-09T03:00:00.000Z'
    }
  ];
  const backup = { version: 2, tasks, deletedTasks: [], settings: {} };

  assert.deepEqual(miniprogramUtils.tasksForDate(tasks, '2026-08-09'), desktopUtils.tasksForDate(tasks, '2026-08-09'));
  assert.deepEqual(miniprogramUtils.progressForDate(tasks, '2026-08-09'), desktopUtils.progressForDate(tasks, '2026-08-09'));
  assert.deepEqual(miniprogramUtils.groupedHistory(tasks, '完成'), desktopUtils.groupedHistory(tasks, '完成'));
  assert.equal(miniprogramUtils.shiftDateKey('2026-08-31', 1), desktopUtils.shiftDateKey('2026-08-31', 1));
  assert.deepEqual(miniprogramUtils.normalizeBackup(backup, {}), desktopUtils.normalizeBackup(backup, {}));
  assert.deepEqual(miniprogramUtils.mergeStores(backup, backup, {}), desktopUtils.mergeStores(backup, backup, {}));
});

test('Mini Program remains local-only and offers manual backup transfer', () => {
  const sourceFiles = [
    path.join(miniRoot, 'utils', 'store.js'),
    path.join(miniRoot, 'pages', 'settings', 'settings.js')
  ];
  const source = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

  assert.doesNotMatch(source, /wx\.cloud|wx\.request/);
  assert.match(source, /wx\.getStorageSync/);
  assert.match(source, /wx\.setStorageSync/);
  assert.match(source, /wx\.chooseMessageFile/);
  assert.match(source, /wx\.shareFileMessage/);
});

test('every WXML event handler is implemented by its page', () => {
  for (const page of ['today', 'history', 'settings']) {
    const directory = path.join(miniRoot, 'pages', page);
    const markup = fs.readFileSync(path.join(directory, `${page}.wxml`), 'utf8');
    const script = fs.readFileSync(path.join(directory, `${page}.js`), 'utf8');
    const handlers = [...markup.matchAll(/(?:bind|catch)[a-z]+="([A-Za-z][A-Za-z0-9_]*)"/g)].map((match) => match[1]);
    for (const handler of new Set(handlers)) {
      assert.match(script, new RegExp(`\\b${handler}\\s*\\(`), `${page}.${handler} is missing`);
    }
  }
});
