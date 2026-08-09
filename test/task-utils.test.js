const test = require('node:test');
const assert = require('node:assert/strict');
const { localDateKey, shiftDateKey, tasksForDate, progressForDate, groupedHistory, normalizeBackup, mergeStores } = require('../src/task-utils');

const tasks = [
  { id: '1', text: '写周报', date: '2026-08-09', completed: false, createdAt: '2026-08-09T01:00:00.000Z' },
  { id: '2', text: '整理桌面', date: '2026-08-09', completed: true, createdAt: '2026-08-09T02:00:00.000Z' },
  { id: '3', text: '散步', date: '2026-08-08', completed: true, createdAt: '2026-08-08T02:00:00.000Z' }
];

test('localDateKey uses calendar-local date parts', () => {
  assert.equal(localDateKey(new Date(2026, 7, 9, 23, 30)), '2026-08-09');
});

test('shiftDateKey crosses month boundaries', () => {
  assert.equal(shiftDateKey('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftDateKey('2024-03-01', -1), '2024-02-29');
});

test('tasksForDate puts active tasks before completed tasks', () => {
  assert.deepEqual(tasksForDate(tasks, '2026-08-09').map((task) => task.id), ['1', '2']);
});

test('progressForDate reports completion ratio', () => {
  assert.deepEqual(progressForDate(tasks, '2026-08-09'), { total: 2, completed: 1, percent: 50 });
  assert.deepEqual(progressForDate(tasks, '2026-08-07'), { total: 0, completed: 0, percent: 0 });
});

test('groupedHistory sorts newest date first and filters text', () => {
  assert.deepEqual(groupedHistory(tasks).map(([date]) => date), ['2026-08-09', '2026-08-08']);
  assert.deepEqual(groupedHistory(tasks, '散步').map(([date]) => date), ['2026-08-08']);
});

test('normalizeBackup keeps safe task fields and settings', () => {
  const backup = normalizeBackup({
    tasks: [{ ...tasks[0], text: '  写周报  ', unexpected: 'ignored' }],
    settings: { alwaysOnTop: true, compactMode: false, unknown: true }
  }, { alwaysOnTop: false, launchAtLogin: false, compactMode: false });
  assert.equal(backup.tasks[0].text, '写周报');
  assert.equal(backup.tasks[0].unexpected, undefined);
  assert.deepEqual(backup.settings, { alwaysOnTop: true, launchAtLogin: false, compactMode: false });
});

test('normalizeBackup rejects malformed backup data', () => {
  assert.throws(() => normalizeBackup({ tasks: 'not-an-array' }), /INVALID_BACKUP/);
  assert.throws(() => normalizeBackup({ tasks: [{ id: '1', text: '', date: '2026-08-09' }] }), /INVALID_TASK/);
});

test('mergeStores keeps the newest version of the same task', () => {
  const local = { tasks: [{ ...tasks[0], text: '旧内容', updatedAt: '2026-08-09T01:00:00.000Z' }] };
  const incoming = { tasks: [{ ...tasks[0], text: '新内容', updatedAt: '2026-08-09T03:00:00.000Z' }] };
  assert.equal(mergeStores(local, incoming).tasks[0].text, '新内容');
});

test('mergeStores applies deletions across devices', () => {
  const local = { tasks: [{ ...tasks[0], updatedAt: '2026-08-09T01:00:00.000Z' }] };
  const incoming = { tasks: [], deletedTasks: [{ id: '1', deletedAt: '2026-08-09T03:00:00.000Z' }] };
  assert.equal(mergeStores(local, incoming).tasks.length, 0);
});

test('a task restored after deletion survives merging', () => {
  const local = { tasks: [{ ...tasks[0], updatedAt: '2026-08-09T04:00:00.000Z' }] };
  const incoming = { tasks: [], deletedTasks: [{ id: '1', deletedAt: '2026-08-09T03:00:00.000Z' }] };
  assert.equal(mergeStores(local, incoming).tasks.length, 1);
});
