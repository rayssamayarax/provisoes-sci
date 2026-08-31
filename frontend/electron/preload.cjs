const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("provisoesDesktop", {
  selectSpreadsheets: () => ipcRenderer.invoke("select-spreadsheets"),
  saveTxt: (content) => ipcRenderer.invoke("save-txt", content),
});
