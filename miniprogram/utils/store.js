const { normalizeBackup } = require('./task-utils');

const STORAGE_KEY = 'daily-note-store-v2';
const emptyStore = () => ({ version: 2, tasks: [], deletedTasks: [], settings: {} });

function loadStore() {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY);
    return stored ? normalizeBackup(stored, {}) : emptyStore();
  } catch (error) {
    console.error('Unable to load local store', error);
    return emptyStore();
  }
}

function saveStore(store) {
  const safeStore = normalizeBackup(store, {});
  wx.setStorageSync(STORAGE_KEY, safeStore);
  return safeStore;
}

function createTaskId() {
  return `wx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

module.exports = { STORAGE_KEY, emptyStore, loadStore, saveStore, createTaskId };
