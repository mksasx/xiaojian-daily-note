const {
  localDateKey,
  shiftDateKey,
  tasksForDate,
  progressForDate
} = require('../../utils/task-utils');
const { formatDateHeading } = require('../../utils/format');
const { loadStore, saveStore, createTaskId } = require('../../utils/store');

Page({
  data: {
    dateKey: '',
    weekday: '',
    dateTitle: '',
    inputValue: '',
    activeTasks: [],
    completedTasks: [],
    total: 0,
    completed: 0,
    percent: 0,
    carryCount: 0,
    showCompleted: false,
    isEmpty: true,
    showEditDialog: false,
    editValue: ''
  },

  onLoad() {
    this.selectedDate = localDateKey();
    this.store = loadStore();
    this.render();
  },

  onShow() {
    const app = getApp();
    if (app.globalData.selectedDate) {
      this.selectedDate = app.globalData.selectedDate;
      app.globalData.selectedDate = '';
    }
    this.store = loadStore();
    this.render();
  },

  render() {
    if (!this.store) this.store = loadStore();
    if (!this.selectedDate) this.selectedDate = localDateKey();
    const heading = formatDateHeading(this.selectedDate);
    const tasks = tasksForDate(this.store.tasks, this.selectedDate);
    const progress = progressForDate(this.store.tasks, this.selectedDate);
    const activeTasks = tasks.filter((task) => !task.completed);
    const completedTasks = tasks.filter((task) => task.completed);

    this.setData({
      dateKey: this.selectedDate,
      weekday: heading.weekday,
      dateTitle: heading.title,
      activeTasks,
      completedTasks,
      total: progress.total,
      completed: progress.completed,
      percent: progress.percent,
      carryCount: this.priorIncompleteTasks().length,
      isEmpty: progress.total === 0
    });
  },

  persist() {
    this.store = saveStore(this.store);
    this.render();
  },

  priorIncompleteTasks() {
    const previous = shiftDateKey(this.selectedDate, -1);
    const alreadyCarried = new Set(
      this.store.tasks
        .filter((task) => task.date === this.selectedDate && task.carriedFrom === previous)
        .map((task) => task.sourceId)
    );
    return this.store.tasks.filter((task) => (
      task.date === previous && !task.completed && !alreadyCarried.has(task.id)
    ));
  },

  onInput(event) {
    this.setData({ inputValue: event.detail.value.slice(0, 120) });
  },

  onAddTask(event) {
    const text = String(event.detail.value.text || this.data.inputValue).trim().slice(0, 120);
    if (!text) return;
    const now = new Date().toISOString();
    this.store.tasks.push({
      id: createTaskId(),
      text,
      date: this.selectedDate,
      completed: false,
      createdAt: now,
      completedAt: null,
      updatedAt: now
    });
    this.setData({ inputValue: '' });
    this.persist();
  },

  onPreviousDay() {
    this.selectedDate = shiftDateKey(this.selectedDate, -1);
    this.render();
  },

  onNextDay() {
    this.selectedDate = shiftDateKey(this.selectedDate, 1);
    this.render();
  },

  onJumpToday() {
    this.selectedDate = localDateKey();
    this.render();
  },

  onDateChange(event) {
    if (!event.detail.value) return;
    this.selectedDate = event.detail.value;
    this.render();
  },

  onToggleTask(event) {
    const task = this.store.tasks.find((candidate) => candidate.id === event.currentTarget.dataset.id);
    if (!task) return;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    task.updatedAt = new Date().toISOString();
    this.persist();
  },

  onDeleteTask(event) {
    const id = event.currentTarget.dataset.id;
    const task = this.store.tasks.find((candidate) => candidate.id === id);
    if (!task) return;
    wx.showModal({
      title: '删除这项待办？',
      content: task.text,
      confirmText: '删除',
      confirmColor: '#b45d4c',
      success: (result) => {
        if (!result.confirm) return;
        const deletedAt = new Date().toISOString();
        this.store.tasks = this.store.tasks.filter((candidate) => candidate.id !== id);
        this.store.deletedTasks = this.store.deletedTasks.filter((entry) => entry.id !== id);
        this.store.deletedTasks.push({ id, deletedAt });
        this.persist();
      }
    });
  },

  onOpenEdit(event) {
    const task = this.store.tasks.find((candidate) => candidate.id === event.currentTarget.dataset.id);
    if (!task) return;
    this.editingTaskId = task.id;
    this.setData({ showEditDialog: true, editValue: task.text });
  },

  onEditInput(event) {
    this.setData({ editValue: event.detail.value.slice(0, 120) });
  },

  onCancelEdit() {
    this.editingTaskId = '';
    this.setData({ showEditDialog: false, editValue: '' });
  },

  onSaveEdit() {
    const task = this.store.tasks.find((candidate) => candidate.id === this.editingTaskId);
    const text = this.data.editValue.trim().slice(0, 120);
    if (!task || !text) return;
    task.text = text;
    task.updatedAt = new Date().toISOString();
    this.onCancelEdit();
    this.persist();
  },

  onToggleCompleted() {
    this.setData({ showCompleted: !this.data.showCompleted });
  },

  onCarryTasks() {
    const candidates = this.priorIncompleteTasks();
    if (!candidates.length) return;
    const now = new Date().toISOString();
    candidates.forEach((task) => {
      this.store.tasks.push({
        id: createTaskId(),
        text: task.text,
        date: this.selectedDate,
        completed: false,
        createdAt: now,
        completedAt: null,
        updatedAt: now,
        carriedFrom: task.date,
        sourceId: task.id
      });
    });
    this.persist();
    wx.showToast({ title: `已移入 ${candidates.length} 项`, icon: 'success' });
  },

  noop() {
  }
});
