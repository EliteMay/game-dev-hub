const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("gameDevHub", {
  getState: () => ipcRenderer.invoke("hub:get-state"),
  chooseGodot: () => ipcRenderer.invoke("hub:choose-godot"),
  addGitHubProject: (payload) => ipcRenderer.invoke("hub:add-github-project", payload),
  importExistingProject: () => ipcRenderer.invoke("hub:import-existing-project"),
  startDevelopment: (projectId) => ipcRenderer.invoke("hub:start-development", projectId),
  syncProject: (projectId) => ipcRenderer.invoke("hub:sync-project", projectId),
  openEditor: (projectId) => ipcRenderer.invoke("hub:open-editor", projectId),
  runGame: (projectId) => ipcRenderer.invoke("hub:run-game", projectId),
  openFolder: (projectId) => ipcRenderer.invoke("hub:open-folder", projectId),
  openGitHub: (projectId) => ipcRenderer.invoke("hub:open-github", projectId),
  removeProject: (projectId) => ipcRenderer.invoke("hub:remove-project", projectId),
  getUpdateStatus: () => ipcRenderer.invoke("hub:get-update-status"),
  checkForUpdates: () => ipcRenderer.invoke("hub:check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("hub:download-update"),
  installUpdate: () => ipcRenderer.invoke("hub:install-update"),
  openLatestRelease: () => ipcRenderer.invoke("hub:open-latest-release"),
  onUpdateStatus: (callback) => {
    if (typeof callback !== "function") return;
    ipcRenderer.on("hub:update-status", (_event, status) => callback(status));
  }
});
