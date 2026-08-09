const { localDateKey, dateFromKey, shiftDateKey, tasksForDate, progressForDate, groupedHistory, mergeStores } = window.TaskUtils;

const elements = Object.fromEntries([
  'taskForm', 'taskInput', 'addTaskButton', 'taskContent', 'activeTaskList', 'completedTaskList',
  'completedSection', 'completedCount', 'toggleCompleted', 'emptyState', 'dateEyebrow', 'dateTitle',
  'progressRing', 'progressText', 'ringValue', 'previousDay', 'nextDay', 'jumpToday', 'carryButton',
  'carryCount', 'historyPanel', 'settingsPanel', 'historySearch', 'historySummary', 'historyList',
  'pinButton', 'minimizeButton', 'closeButton', 'alwaysOnTopSetting', 'launchAtLoginSetting',
  'compactModeSetting', 'exportDataButton', 'importDataButton', 'showDataFolderButton', 'installAppButton', 'toast'
].map((id) => [id, document.getElementById(id)]));

let store = { version: 2, tasks: [], deletedTasks: [], settings: {} };
let selectedDate = localDateKey();
let saveChain = Promise.resolve();
let toastTimer;

const fullDateFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' });
const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', { weekday: 'long' });
const historyDateFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });

function escapeHtml(text) {
  const node = document.createElement('span');
  node.textContent = text;
  return node.innerHTML;
}

function showToast(message, action = null) {
  clearTimeout(toastTimer);
  const messageNode = elements.toast.querySelector('span');
  const actionButton = elements.toast.querySelector('button');
  messageNode.textContent = message;
  actionButton.replaceWith(actionButton.cloneNode());
  const freshButton = elements.toast.querySelector('button');
  if (action) {
    freshButton.textContent = action.label;
    freshButton.hidden = false;
    freshButton.addEventListener('click', () => {
      clearTimeout(toastTimer);
      elements.toast.classList.remove('show');
      action.run();
    }, { once: true });
  } else {
    freshButton.hidden = true;
  }
  elements.toast.classList.add('show');
  toastTimer = setTimeout(() => elements.toast.classList.remove('show'), action ? 5000 : 1800);
}

function persist() {
  const snapshot = structuredClone(store);
  saveChain = saveChain
    .then(() => window.desktop.saveStore(snapshot))
    .catch((error) => {
      console.error(error);
      showToast('保存失败，请稍后重试');
    });
  return saveChain;
}

function createTaskElement(task) {
  const item = document.createElement('li');
  item.className = `task-item${task.completed ? ' completed' : ''}`;
  item.dataset.id = task.id;
  item.innerHTML = `
    <button class="task-check" aria-label="${task.completed ? '标记为未完成' : '标记为完成'}">
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>
    </button>
    <span class="task-text" title="双击编辑">${escapeHtml(task.text)}</span>
    <button class="task-delete" aria-label="删除待办" title="删除">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 6h10M8 6V4h4v2m2 0-.7 10H6.7L6 6m3 3v4m2-4v4"/></svg>
    </button>`;

  item.querySelector('.task-check').addEventListener('click', () => toggleTask(task.id));
  item.querySelector('.task-delete').addEventListener('click', () => deleteTask(task.id));
  const textNode = item.querySelector('.task-text');
  textNode.addEventListener('dblclick', () => beginEditing(textNode, task));
  if (!window.desktop.isDesktop) textNode.addEventListener('click', () => beginEditing(textNode, task));
  return item;
}

function renderTasks() {
  const dayTasks = tasksForDate(store.tasks, selectedDate);
  const active = dayTasks.filter((task) => !task.completed);
  const completed = dayTasks.filter((task) => task.completed);

  elements.activeTaskList.replaceChildren(...active.map(createTaskElement));
  elements.completedTaskList.replaceChildren(...completed.map(createTaskElement));
  elements.completedCount.textContent = completed.length;
  elements.completedSection.classList.toggle('hidden', completed.length === 0);
  elements.emptyState.classList.toggle('hidden', dayTasks.length > 0);

  const progress = progressForDate(store.tasks, selectedDate);
  elements.progressText.textContent = `${progress.percent}%`;
  elements.progressRing.setAttribute('aria-label', `完成 ${progress.completed} 项，共 ${progress.total} 项`);
  elements.ringValue.style.strokeDashoffset = String(106.82 * (1 - progress.percent / 100));
  renderCarryBanner();
}

function renderDate() {
  const date = dateFromKey(selectedDate);
  const today = localDateKey();
  elements.dateEyebrow.textContent = weekdayFormatter.format(date);
  elements.dateTitle.textContent = fullDateFormatter.format(date);
  elements.jumpToday.classList.toggle('is-today', selectedDate === today);
  elements.jumpToday.textContent = selectedDate === today ? '今天' : '回到今天';
  elements.taskInput.placeholder = selectedDate === today ? '写下今天想完成的事…' : '为这一天补记一件事…';
}

function priorIncompleteTasks() {
  const previous = shiftDateKey(selectedDate, -1);
  const alreadyCarried = new Set(
    store.tasks.filter((task) => task.date === selectedDate && task.carriedFrom === previous).map((task) => task.sourceId)
  );
  return store.tasks.filter((task) => task.date === previous && !task.completed && !alreadyCarried.has(task.id));
}

function renderCarryBanner() {
  const candidates = priorIncompleteTasks();
  elements.carryCount.textContent = candidates.length;
  elements.carryButton.classList.toggle('hidden', candidates.length === 0);
}

function renderToday() {
  renderDate();
  renderTasks();
}

function addTask(text) {
  const cleanText = text.trim();
  if (!cleanText) return;
  const now = new Date().toISOString();
  store.tasks.push({
    id: crypto.randomUUID(),
    text: cleanText,
    date: selectedDate,
    completed: false,
    createdAt: now,
    completedAt: null,
    updatedAt: now
  });
  elements.taskInput.value = '';
  elements.taskForm.classList.remove('has-value');
  renderTasks();
  persist();
}

function toggleTask(id) {
  const task = store.tasks.find((candidate) => candidate.id === id);
  if (!task) return;
  task.completed = !task.completed;
  task.completedAt = task.completed ? new Date().toISOString() : null;
  task.updatedAt = new Date().toISOString();
  renderTasks();
  persist();
  if (task.completed) {
    const progress = progressForDate(store.tasks, selectedDate);
    showToast(progress.total === progress.completed ? '今天的事都完成啦 ✓' : '完成一件，真不错');
  }
}

function deleteTask(id) {
  const index = store.tasks.findIndex((task) => task.id === id);
  if (index < 0) return;
  const [removed] = store.tasks.splice(index, 1);
  const deletedAt = new Date().toISOString();
  store.deletedTasks ||= [];
  store.deletedTasks = store.deletedTasks.filter((entry) => entry.id !== removed.id);
  store.deletedTasks.push({ id: removed.id, deletedAt });
  renderTasks();
  persist();
  showToast(`已删除「${removed.text.slice(0, 10)}${removed.text.length > 10 ? '…' : ''}」`, {
    label: '撤销',
    run: () => {
      store.deletedTasks = (store.deletedTasks || []).filter((entry) => entry.id !== removed.id);
      removed.updatedAt = new Date().toISOString();
      store.tasks.push(removed);
      selectedDate = removed.date;
      renderToday();
      persist();
      showToast('已恢复');
    }
  });
}

function beginEditing(node, task) {
  if (node.contentEditable === 'true') return;
  node.contentEditable = 'true';
  node.focus();
  const selection = window.getSelection();
  selection.selectAllChildren(node);
  selection.collapseToEnd();

  const finish = (save) => {
    if (node.contentEditable !== 'true') return;
    node.contentEditable = 'false';
    const nextText = node.textContent.trim();
    if (save && nextText) {
      task.text = nextText.slice(0, 120);
      task.updatedAt = new Date().toISOString();
      persist();
    }
    renderTasks();
  };
  node.addEventListener('blur', () => finish(true), { once: true });
  node.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); node.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); finish(false); }
  });
}

function carryTasks() {
  const candidates = priorIncompleteTasks();
  const now = new Date().toISOString();
  for (const task of candidates) {
    store.tasks.push({
      id: crypto.randomUUID(), text: task.text, date: selectedDate, completed: false,
      createdAt: now, completedAt: null, updatedAt: now, carriedFrom: task.date, sourceId: task.id
    });
  }
  renderTasks();
  persist();
  showToast(`已移入 ${candidates.length} 项待办`);
}

function renderHistory() {
  const query = elements.historySearch.value;
  const groups = groupedHistory(store.tasks, query);
  const completed = store.tasks.filter((task) => task.completed).length;
  const activeDays = new Set(store.tasks.map((task) => task.date)).size;
  elements.historySummary.innerHTML = `
    <div class="summary-card"><b>${completed}</b><span>累计完成</span></div>
    <div class="summary-card"><b>${activeDays}</b><span>记录天数</span></div>`;
  if (!groups.length) {
    elements.historyList.innerHTML = `<div class="history-empty">${query ? '没有找到相关记录' : '完成第一件小事后，这里会留下足迹。'}</div>`;
    return;
  }
  elements.historyList.innerHTML = groups.map(([dateKey, tasks]) => {
    const progress = progressForDate(tasks, dateKey);
    return `<section class="history-day">
      <button class="history-date" data-history-date="${dateKey}"><b>${historyDateFormatter.format(dateFromKey(dateKey))}</b><span>${progress.completed}/${progress.total} 完成 · 查看</span></button>
      ${tasks.map((task) => `<div class="history-task${task.completed ? ' done' : ''}"><i></i><span>${escapeHtml(task.text)}</span></div>`).join('')}
    </section>`;
  }).join('');
  elements.historyList.querySelectorAll('[data-history-date]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedDate = button.dataset.historyDate;
      renderToday();
      openView('today');
    });
  });
}

async function exportData() {
  try {
    const result = await window.desktop.exportBackup(store);
    if (!result.canceled) showToast(`已导出 ${result.fileName}`);
  } catch (error) {
    console.error(error);
    showToast('导出失败，请重试');
  }
}

async function importData() {
  try {
    const result = await window.desktop.importBackup();
    if (result.canceled) return;
    if (result.error) {
      showToast('这不是有效的小笺备份');
      return;
    }
    const previousCount = store.tasks.length;
    store = mergeStores(store, result.store, store.settings);
    selectedDate = localDateKey();
    syncSettingsUi();
    renderToday();
    renderHistory();
    await persist();
    const added = Math.max(0, store.tasks.length - previousCount);
    showToast(added ? `已合并，新增 ${added} 项记录` : '已合并到最新状态');
  } catch (error) {
    console.error(error);
    showToast('导入失败，请重试');
  }
}

async function installMobileApp() {
  const result = await window.desktop.installApp();
  if (!result.available) {
    showToast('请在浏览器菜单中选择“添加到主屏幕”', { label: '知道了', run: () => {} });
  } else if (result.accepted) {
    showToast('小笺已添加到桌面');
  }
}

function openView(view) {
  const panels = { history: elements.historyPanel, settings: elements.settingsPanel };
  Object.entries(panels).forEach(([name, panel]) => {
    const open = view === name;
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
  });
  document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  if (view === 'history') renderHistory();
}

function syncSettingsUi() {
  elements.alwaysOnTopSetting.checked = Boolean(store.settings.alwaysOnTop);
  elements.launchAtLoginSetting.checked = Boolean(store.settings.launchAtLogin);
  elements.compactModeSetting.checked = Boolean(store.settings.compactMode);
  elements.pinButton.classList.toggle('active', Boolean(store.settings.alwaysOnTop));
}

async function updateSetting(key, enabled) {
  store.settings[key] = enabled;
  if (key === 'alwaysOnTop') store.settings[key] = await window.desktop.setAlwaysOnTop(enabled);
  if (key === 'launchAtLogin') store.settings[key] = await window.desktop.setLoginItem(enabled);
  if (key === 'compactMode') await window.desktop.setCompact(enabled);
  syncSettingsUi();
  persist();
}

elements.taskForm.addEventListener('submit', (event) => { event.preventDefault(); addTask(elements.taskInput.value); });
elements.taskInput.addEventListener('input', () => elements.taskForm.classList.toggle('has-value', Boolean(elements.taskInput.value.trim())));
elements.previousDay.addEventListener('click', () => { selectedDate = shiftDateKey(selectedDate, -1); renderToday(); });
elements.nextDay.addEventListener('click', () => { selectedDate = shiftDateKey(selectedDate, 1); renderToday(); });
elements.jumpToday.addEventListener('click', () => { selectedDate = localDateKey(); renderToday(); });
elements.carryButton.addEventListener('click', carryTasks);
elements.toggleCompleted.addEventListener('click', () => {
  elements.completedSection.classList.toggle('collapsed');
  elements.toggleCompleted.setAttribute('aria-expanded', String(!elements.completedSection.classList.contains('collapsed')));
});
elements.historySearch.addEventListener('input', renderHistory);

document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => openView(button.dataset.view)));
document.querySelectorAll('[data-close-panel]').forEach((button) => button.addEventListener('click', () => openView('today')));

elements.pinButton.addEventListener('click', () => updateSetting('alwaysOnTop', !store.settings.alwaysOnTop));
elements.minimizeButton.addEventListener('click', () => window.desktop.minimize());
elements.closeButton.addEventListener('click', () => window.desktop.close());
elements.alwaysOnTopSetting.addEventListener('change', (event) => updateSetting('alwaysOnTop', event.target.checked));
elements.launchAtLoginSetting.addEventListener('change', (event) => updateSetting('launchAtLogin', event.target.checked));
elements.compactModeSetting.addEventListener('change', (event) => updateSetting('compactMode', event.target.checked));
elements.exportDataButton.addEventListener('click', exportData);
elements.importDataButton.addEventListener('click', importData);
elements.showDataFolderButton.addEventListener('click', () => window.desktop.showDataInFolder());
elements.installAppButton.addEventListener('click', installMobileApp);

window.addEventListener('appinstalled', () => {
  elements.installAppButton.classList.add('hidden');
  showToast('安装完成，可以离线使用了');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') openView('today');
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'n') {
    event.preventDefault(); openView('today'); elements.taskInput.focus();
  }
});

async function initialize() {
  try {
    store = await window.desktop.loadStore();
    syncSettingsUi();
    if (store.settings.alwaysOnTop) await window.desktop.setAlwaysOnTop(true);
    if (store.settings.compactMode) await window.desktop.setCompact(true);
    if (!window.desktop.isDesktop && window.matchMedia('(display-mode: standalone)').matches) {
      elements.installAppButton.classList.add('hidden');
    }
    renderToday();
  } catch (error) {
    console.error(error);
    showToast('应用初始化失败');
  }
}

initialize();
