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
  setSelectedProject: (projectId) => ipcRenderer.invoke("hub:set-selected-project", projectId),
  setActiveTask: (payload) => ipcRenderer.invoke("hub:set-active-task", payload),
  listReferenceImages: (projectId) => ipcRenderer.invoke("hub:reference-images-list", projectId),
  addReferenceImages: (projectId) => ipcRenderer.invoke("hub:reference-images-add", projectId),
  removeReferenceImage: (payload) => ipcRenderer.invoke("hub:reference-image-remove", payload),
  openReferenceImage: (payload) => ipcRenderer.invoke("hub:reference-image-open", payload),
  exportChatGptPack: (payload) => ipcRenderer.invoke("hub:chatgpt-pack-export", payload),
  getDiagnostics: () => ipcRenderer.invoke("hub:get-diagnostics"),
  exportDiagnostics: () => ipcRenderer.invoke("hub:diagnostics-export"),
  openLogsFolder: () => ipcRenderer.invoke("hub:diagnostics-open-logs"),
  clearDiagnosticLogs: () => ipcRenderer.invoke("hub:diagnostics-clear-logs"),
  checkForUpdates: () => ipcRenderer.invoke("hub:update-check"),
  downloadUpdate: () => ipcRenderer.invoke("hub:update-download"),
  installUpdate: () => ipcRenderer.invoke("hub:update-install"),
  openUpdatePage: () => ipcRenderer.invoke("hub:update-open-release"),
  onUpdateState: (callback) => {
    const listener = (_event, updateState) => callback(updateState);
    ipcRenderer.on("hub:update-state", listener);
    return () => ipcRenderer.removeListener("hub:update-state", listener);
  }
});
