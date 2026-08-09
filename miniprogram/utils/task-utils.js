const pad = (value) => String(value).padStart(2, '0');

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function shiftDateKey(key, amount) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function tasksForDate(tasks, key) {
  return tasks
    .filter((task) => task.date === key)
    .sort((a, b) => Number(a.completed) - Number(b.completed) || a.createdAt.localeCompare(b.createdAt));
}

function progressForDate(tasks, key) {
  const dayTasks = tasksForDate(tasks, key);
  const completed = dayTasks.filter((task) => task.completed).length;
  return {
    total: dayTasks.length,
    completed,
    percent: dayTasks.length ? Math.round(completed / dayTasks.length * 100) : 0
  };
}

function groupedHistory(tasks, query = '') {
  const normalized = query.trim().toLocaleLowerCase();
  const filtered = normalized
    ? tasks.filter((task) => task.text.toLocaleLowerCase().includes(normalized))
    : tasks;
  return Object.entries(filtered.reduce((groups, task) => {
    if (!groups[task.date]) groups[task.date] = [];
    groups[task.date].push(task);
    return groups;
  }, {})).sort(([dateA], [dateB]) => dateB.localeCompare(dateA));
}

function normalizeBackup(input, fallbackSettings = {}) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.tasks)) throw new Error('INVALID_BACKUP');

  const tasks = input.tasks.slice(0, 10000).map((task) => {
    if (!task || typeof task !== 'object' || typeof task.id !== 'string' || !task.id.trim()
      || typeof task.text !== 'string' || !task.text.trim()
      || typeof task.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(task.date)) {
      throw new Error('INVALID_TASK');
    }
    const normalized = {
      id: task.id.slice(0, 100),
      text: task.text.trim().slice(0, 120),
      date: task.date,
      completed: Boolean(task.completed),
      createdAt: typeof task.createdAt === 'string' ? task.createdAt : `${task.date}T00:00:00.000Z`,
      completedAt: typeof task.completedAt === 'string' ? task.completedAt : null,
      updatedAt: typeof task.updatedAt === 'string'
        ? task.updatedAt
        : (typeof task.createdAt === 'string' ? task.createdAt : `${task.date}T00:00:00.000Z`)
    };
    if (typeof task.carriedFrom === 'string') normalized.carriedFrom = task.carriedFrom;
    if (typeof task.sourceId === 'string') normalized.sourceId = task.sourceId;
    return normalized;
  });

  const deletedTasks = (Array.isArray(input.deletedTasks) ? input.deletedTasks : []).slice(0, 10000).map((entry) => {
    if (!entry || typeof entry.id !== 'string' || !entry.id.trim() || typeof entry.deletedAt !== 'string') {
      throw new Error('INVALID_TOMBSTONE');
    }
    return { id: entry.id.slice(0, 100), deletedAt: entry.deletedAt };
  });

  const sourceSettings = input.settings && typeof input.settings === 'object' ? input.settings : {};
  const settings = { ...fallbackSettings };
  for (const key of ['alwaysOnTop', 'launchAtLogin', 'compactMode']) {
    if (typeof sourceSettings[key] === 'boolean') settings[key] = sourceSettings[key];
  }
  return { version: 2, tasks, deletedTasks, settings };
}

function mergeStores(localInput, incomingInput, fallbackSettings = {}) {
  const local = normalizeBackup(localInput, fallbackSettings);
  const incoming = normalizeBackup(incomingInput, fallbackSettings);
  const taskMap = new Map();
  for (const task of [...local.tasks, ...incoming.tasks]) {
    const current = taskMap.get(task.id);
    if (!current || task.updatedAt.localeCompare(current.updatedAt) > 0) taskMap.set(task.id, task);
  }
  const deletionMap = new Map();
  for (const entry of [...local.deletedTasks, ...incoming.deletedTasks]) {
    const current = deletionMap.get(entry.id);
    if (!current || entry.deletedAt.localeCompare(current.deletedAt) > 0) deletionMap.set(entry.id, entry);
  }
  const tasks = [...taskMap.values()].filter((task) => {
    const deletion = deletionMap.get(task.id);
    return !deletion || task.updatedAt.localeCompare(deletion.deletedAt) > 0;
  });
  return { version: 2, tasks, deletedTasks: [...deletionMap.values()], settings: local.settings };
}

module.exports = {
  localDateKey,
  dateFromKey,
  shiftDateKey,
  tasksForDate,
  progressForDate,
  groupedHistory,
  normalizeBackup,
  mergeStores
};
