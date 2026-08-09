const { mergeStores, normalizeBackup } = require('./task-utils');
const { emptyStore, loadStore, saveStore } = require('./store');

const CLOUD_ENV_ID = 'xiaojian-note-d6g8woyu3eddba850';
const CLOUD_COLLECTION = 'daily_note_users';
const OPENID_PLACEHOLDER = '{openid}';

let cloudInitialized = false;
let syncQueue = Promise.resolve();
let syncState = { status: 'idle', lastSyncedAt: '', errorCode: '' };
const listeners = [];

function publishState(status, extra = {}) {
  syncState = { ...syncState, ...extra, status };
  listeners.slice().forEach((listener) => {
    try {
      listener({ ...syncState });
    } catch (error) {
      console.error('Unable to publish cloud sync state', error);
    }
  });
}

function getSyncState() {
  return { ...syncState };
}

function subscribeSyncState(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.push(listener);
  listener(getSyncState());
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) listeners.splice(index, 1);
  };
}

function getCloudSyncPreference() {
  const enabled = loadStore().settings.cloudSyncEnabled;
  return typeof enabled === 'boolean' ? enabled : null;
}

function setCloudSyncEnabled(enabled) {
  const store = loadStore();
  store.settings = { ...store.settings, cloudSyncEnabled: Boolean(enabled) };
  saveStore(store);
  publishState(enabled ? 'idle' : 'disabled', { errorCode: '' });
  return store;
}

function initializeCloud() {
  if (cloudInitialized) return true;
  if (typeof wx === 'undefined' || !wx.cloud) {
    publishState('unsupported', { errorCode: 'CLOUD_UNAVAILABLE' });
    return false;
  }
  try {
    wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true });
    cloudInitialized = true;
    const preference = getCloudSyncPreference();
    publishState(preference === null ? 'choice_required' : (preference ? 'idle' : 'disabled'), {
      errorCode: ''
    });
    return true;
  } catch (error) {
    console.error('Unable to initialize CloudBase', error);
    publishState('error', { errorCode: 'CLOUD_INIT_FAILED' });
    return false;
  }
}

function cloudSafeStore(store) {
  const safe = normalizeBackup(store, {});
  return {
    version: 2,
    tasks: safe.tasks,
    deletedTasks: safe.deletedTasks,
    settings: {}
  };
}

function mergeRemoteDocuments(documents) {
  return documents.reduce((remoteStore, document) => {
    try {
      return mergeStores(remoteStore, document.store || document, {});
    } catch (error) {
      console.warn('Ignoring an invalid cloud store document', document && document._id);
      return remoteStore;
    }
  }, emptyStore());
}

function classifyError(error) {
  const message = String((error && (error.errMsg || error.message)) || error || '');
  if (/-502005|collection.+not exist|collection.+does not exist|DATABASE_COLLECTION_NOT_EXIST/i.test(message)) {
    return { status: 'setup_required', errorCode: 'COLLECTION_MISSING' };
  }
  if (/network|offline|timeout|request:fail/i.test(message)) {
    return { status: 'offline', errorCode: 'NETWORK_UNAVAILABLE' };
  }
  if (/permission|auth|unauthorized|-502003/i.test(message)) {
    return { status: 'error', errorCode: 'PERMISSION_DENIED' };
  }
  return { status: 'error', errorCode: 'SYNC_FAILED' };
}

async function performCloudSync() {
  const preference = getCloudSyncPreference();
  if (preference !== true) {
    publishState(preference === null ? 'choice_required' : 'disabled', { errorCode: '' });
    return { ok: false, status: syncState.status, store: loadStore() };
  }
  if (!initializeCloud()) {
    return { ok: false, status: syncState.status, store: loadStore() };
  }

  publishState('syncing', { errorCode: '' });
  try {
    const database = wx.cloud.database();
    const collection = database.collection(CLOUD_COLLECTION);
    const response = await collection
      .where({ _openid: OPENID_PLACEHOLDER })
      .limit(20)
      .get();
    const documents = Array.isArray(response.data) ? response.data : [];
    const remoteStore = mergeRemoteDocuments(documents);
    const latestLocal = loadStore();
    const merged = mergeStores(latestLocal, remoteStore, latestLocal.settings);
    merged.settings = latestLocal.settings;
    saveStore(merged);

    const timestamp = typeof database.serverDate === 'function'
      ? database.serverDate()
      : new Date().toISOString();
    const data = {
      schemaVersion: 2,
      store: cloudSafeStore(merged),
      updatedAt: timestamp
    };

    if (documents.length) {
      await Promise.all(documents.map((document) => (
        collection.doc(document._id).update({ data })
      )));
    } else {
      await collection.add({ data: { ...data, createdAt: timestamp } });
    }

    const lastSyncedAt = new Date().toISOString();
    publishState('synced', { lastSyncedAt, errorCode: '' });
    return { ok: true, status: 'synced', store: loadStore(), lastSyncedAt };
  } catch (error) {
    console.error('Unable to sync with CloudBase', error);
    const classified = classifyError(error);
    publishState(classified.status, { errorCode: classified.errorCode });
    return { ok: false, status: classified.status, store: loadStore(), errorCode: classified.errorCode };
  }
}

function requestCloudSync() {
  syncQueue = syncQueue.catch(() => null).then(performCloudSync);
  return syncQueue;
}

module.exports = {
  CLOUD_ENV_ID,
  CLOUD_COLLECTION,
  OPENID_PLACEHOLDER,
  initializeCloud,
  getCloudSyncPreference,
  setCloudSyncEnabled,
  getSyncState,
  subscribeSyncState,
  requestCloudSync
};
