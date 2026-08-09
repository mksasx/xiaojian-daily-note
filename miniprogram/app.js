const { initializeCloud } = require('./utils/cloud-sync');

App({
  globalData: {
    selectedDate: ''
  },

  onLaunch() {
    this.globalData.selectedDate = '';
    initializeCloud();
  }
});
