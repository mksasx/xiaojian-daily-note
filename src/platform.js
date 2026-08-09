(function configurePlatform() {
  const isDesktop = Boolean(window.desktop);
  document.body.classList.toggle('web-mode', !isDesktop);
  document.body.classList.toggle('desktop-mode', isDesktop);

  if (isDesktop) {
    return;
  }

  const storageKey = 'daily-note-store-v2';
  let deferredInstallPrompt = null;

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportBackup(data) {
    const date = new Date().toISOString().slice(0, 10);
    const fileName = `小笺备份-${date}.json`;
    const safeStore = window.TaskUtils.normalizeBackup(data, {});
    const file = new File([
      JSON.stringify({ ...safeStore, exportedAt: new Date().toISOString(), appVersion: '1.4.0' }, null, 2)
    ], fileName, { type: 'application/json' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '小笺备份', text: '保存或发送这份小笺本地备份' });
        return { canceled: false, fileName };
      } catch (error) {
        if (error.name === 'AbortError') return { canceled: true };
      }
    }
    downloadFile(file);
    return { canceled: false, fileName };
  }

  function importBackup() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return resolve({ canceled: true });
        try {
          const parsed = JSON.parse(await file.text());
          const store = window.TaskUtils.normalizeBackup(parsed, {});
          resolve({ canceled: false, store, fileName: file.name });
        } catch (error) {
          console.error(error);
          resolve({ canceled: false, error: 'INVALID_BACKUP' });
        }
      }, { once: true });
      input.click();
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    window.dispatchEvent(new CustomEvent('pwa-install-ready'));
  });

  window.desktop = {
    isDesktop: false,
    loadStore: async () => {
      try {
        const raw = localStorage.getItem(storageKey);
        return raw
          ? window.TaskUtils.normalizeBackup(JSON.parse(raw), {})
          : { version: 2, tasks: [], deletedTasks: [], settings: {} };
      } catch (error) {
        console.error(error);
        return { version: 2, tasks: [], deletedTasks: [], settings: {} };
      }
    },
    saveStore: async (data) => {
      const safeStore = window.TaskUtils.normalizeBackup(data, {});
      localStorage.setItem(storageKey, JSON.stringify(safeStore));
      return safeStore;
    },
    exportBackup,
    importBackup,
    showDataInFolder: async () => ({ unsupported: true }),
    minimize: async () => {},
    close: async () => {},
    setAlwaysOnTop: async () => false,
    setCompact: async () => false,
    setLoginItem: async () => false,
    installApp: async () => {
      if (!deferredInstallPrompt) return { available: false };
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      return { available: true, accepted: choice.outcome === 'accepted' };
    }
  };

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(console.error));
  }
})();
