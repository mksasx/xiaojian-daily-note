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
  assert.equal(projectConfig.appid, 'wxa3b2d716724f4f64');
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
  const backup = { version: 2, tasks, deletedTasks: [], settings: { cloudSyncEnabled: true } };

  assert.deepEqual(miniprogramUtils.tasksForDate(tasks, '2026-08-09'), desktopUtils.tasksForDate(tasks, '2026-08-09'));
  assert.deepEqual(miniprogramUtils.progressForDate(tasks, '2026-08-09'), desktopUtils.progressForDate(tasks, '2026-08-09'));
  assert.deepEqual(miniprogramUtils.groupedHistory(tasks, '完成'), desktopUtils.groupedHistory(tasks, '完成'));
  assert.equal(miniprogramUtils.shiftDateKey('2026-08-31', 1), desktopUtils.shiftDateKey('2026-08-31', 1));
  assert.deepEqual(miniprogramUtils.normalizeBackup(backup, {}), desktopUtils.normalizeBackup(backup, {}));
  assert.deepEqual(miniprogramUtils.mergeStores(backup, backup, {}), desktopUtils.mergeStores(backup, backup, {}));
});

test('Mini Program stays local-first while offering OpenID cloud sync and manual backup', () => {
  const sourceFiles = [
    path.join(miniRoot, 'app.js'),
    path.join(miniRoot, 'utils', 'store.js'),
    path.join(miniRoot, 'utils', 'cloud-sync.js'),
    path.join(miniRoot, 'pages', 'settings', 'settings.js')
  ];
  const source = sourceFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

  assert.match(source, /wx\.cloud\.init/);
  assert.match(source, /xiaojian-note-d6g8woyu3eddba850/);
  assert.match(source, /daily_note_users/);
  assert.match(source, /_openid:\s*OPENID_PLACEHOLDER/);
  assert.match(source, /cloudSyncEnabled/);
  assert.doesNotMatch(source, /wx\.request/);
  assert.match(source, /wx\.getStorageSync/);
  assert.match(source, /wx\.setStorageSync/);
  assert.match(source, /wx\.chooseMessageFile/);
  assert.match(source, /wx\.shareFileMessage/);
});

test('Cloud sync merges remote and local tasks before updating the current OpenID document', async (context) => {
  const originalWx = global.wx;
  const localTask = {
    id: 'local', text: '本机待办', date: '2026-08-09', completed: false,
    createdAt: '2026-08-09T01:00:00.000Z', completedAt: null, updatedAt: '2026-08-09T01:00:00.000Z'
  };
  const remoteTask = {
    id: 'remote', text: '云端待办', date: '2026-08-10', completed: false,
    createdAt: '2026-08-09T02:00:00.000Z', completedAt: null, updatedAt: '2026-08-09T02:00:00.000Z'
  };
  let stored = { version: 2, tasks: [localTask], deletedTasks: [], settings: {} };
  let initOptions;
  let query;
  let updatedDocument;
  const collection = {
    where(value) {
      query = value;
      return this;
    },
    limit(value) {
      assert.equal(value, 20);
      return this;
    },
    async get() {
      return {
        data: [{
          _id: 'openid-document',
          store: { version: 2, tasks: [remoteTask], deletedTasks: [], settings: {} }
        }]
      };
    },
    doc(id) {
      assert.equal(id, 'openid-document');
      return {
        async update({ data }) {
          updatedDocument = data;
        }
      };
    },
    async add() {
      assert.fail('an existing user document should be updated');
    }
  };

  global.wx = {
    getStorageSync: () => stored,
    setStorageSync: (_key, value) => {
      stored = value;
    },
    cloud: {
      init: (options) => {
        initOptions = options;
      },
      database: () => ({
        collection: (name) => {
          assert.equal(name, 'daily_note_users');
          return collection;
        },
        serverDate: () => ({ type: 'server-date' })
      })
    }
  };

  const cloudModulePath = path.join(miniRoot, 'utils', 'cloud-sync.js');
  const storeModulePath = path.join(miniRoot, 'utils', 'store.js');
  delete require.cache[require.resolve(cloudModulePath)];
  delete require.cache[require.resolve(storeModulePath)];
  context.after(() => {
    if (originalWx === undefined) delete global.wx;
    else global.wx = originalWx;
    delete require.cache[require.resolve(cloudModulePath)];
    delete require.cache[require.resolve(storeModulePath)];
  });

  const cloudSync = require(cloudModulePath);
  cloudSync.setCloudSyncEnabled(true);
  const result = await cloudSync.requestCloudSync();

  assert.equal(result.ok, true);
  assert.equal(initOptions.env, 'xiaojian-note-d6g8woyu3eddba850');
  assert.deepEqual(query, { _openid: '{openid}' });
  assert.deepEqual(stored.tasks.map((task) => task.id).sort(), ['local', 'remote']);
  assert.deepEqual(updatedDocument.store.tasks.map((task) => task.id).sort(), ['local', 'remote']);
  assert.deepEqual(updatedDocument.store.settings, {});
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
