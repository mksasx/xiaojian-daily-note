const { initializeCloud, requestCloudSync } = require('./utils/cloud-sync');

App({
  globalData: {
    selectedDate: ''
  },

  onLaunch() {
    this.globalData.selectedDate = '';
    if (initializeCloud()) requestCloudSync();
  },

  onShow() {
    if (initializeCloud()) requestCloudSync();
  }
});
