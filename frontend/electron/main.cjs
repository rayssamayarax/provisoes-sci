const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const isDev = process.env.VITE_DEV_SERVER_URL;
const DATE_RE = /^\s*\d{2}\/\d{2}\/\d{4}\s*$/;

autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function setupAutoUpdater() {
  if (isDev || !app.isPackaged) return;

  autoUpdater.on("update-downloaded", () => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Atualizacao disponivel",
        message: "Uma nova versao do ContaFlow foi baixada.",
        detail: "Reinicie o programa agora para instalar a atualizacao?",
        buttons: ["Reiniciar agora", "Depois"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on("error", (error) => {
    console.error("Falha ao verificar atualizacao:", error);
  });

  autoUpdater.checkForUpdatesAndNotify();
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 700,
    title: "ContaFlow",
    icon: path.join(__dirname, "..", isDev ? "public" : "dist", "icon.ico"),
    backgroundColor: "#f4f7fb",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL(isDev);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function parseAmount(value) {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase().includes("saldo anterior")) return 0;
  const negative = text.startsWith("(") && text.endsWith(")");
  const normalized = text.replace(/R\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace(/[()]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

function readMatrix(filePath, ext) {
  if (ext === "csv") {
    const buffer = fs.readFileSync(filePath);
    const utf8 = buffer.toString("utf8");
    const latin1 = buffer.toString("latin1");
    const text = utf8.includes("�") ? latin1 : utf8;
    return text.split(/\r?\n/).map((line) => line.split(";"));
  }

  const workbook = XLSX.readFile(filePath, { raw: false, cellDates: false });
  const firstSheet = workbook.SheetNames[0];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: "", blankrows: false });
}

function normalizeHeader(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function matrixToPreview(matrix) {
  const nonEmpty = matrix.filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
  if (!nonEmpty.length) return { columns: [], rows: [], error: "Nenhuma linha preenchida encontrada." };
  const headers = nonEmpty[0].map((cell, index) => String(cell || `Coluna ${index + 1}`).trim() || `Coluna ${index + 1}`);
  const rows = nonEmpty.slice(1, 11).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = String(row[index] ?? "");
    });
    return item;
  });
  return { columns: headers, rows, error: "" };
}

function dailyTotalsFromMatrix(matrix) {
  const nonEmpty = matrix.filter((row) => row.some((cell) => String(cell || "").trim() !== ""));
  if (nonEmpty.length < 2) return [];

  const headers = nonEmpty[0].map(normalizeHeader);
  const historyIndex = headers.findIndex((h) => h.includes("historico") || h.includes("descricao"));
  const dateIndex = headers.findIndex((h) => h === "data" || h.includes("data"));
  const debitIndex = headers.findIndex((h) => h.includes("debito"));
  const creditIndex = headers.findIndex((h) => h.includes("credito"));
  const amountIndex = headers.findIndex((h) => h === "valor" || h.includes("valor"));

  const totals = new Map();
  let currentDate = "";

  for (const row of nonEmpty.slice(1)) {
    const possibleDate = String(row[dateIndex >= 0 ? dateIndex : historyIndex] || "").trim();
    if (DATE_RE.test(possibleDate)) {
      currentDate = possibleDate;
      if (!totals.has(currentDate)) totals.set(currentDate, { date: currentDate, debit: 0, credit: 0 });
      if (row.filter((cell) => String(cell || "").trim() !== "").length === 1) continue;
    }

    const rowDate = DATE_RE.test(possibleDate) ? possibleDate : currentDate;
    if (!rowDate) continue;

    const debit = debitIndex >= 0 ? parseAmount(row[debitIndex]) : 0;
    const credit = creditIndex >= 0 ? parseAmount(row[creditIndex]) : 0;
    const amount = amountIndex >= 0 ? parseAmount(row[amountIndex]) : 0;
    const finalCredit = credit || (amount > 0 && creditIndex < 0 ? amount : 0);
    const finalDebit = debit || (amount < 0 && debitIndex < 0 ? Math.abs(amount) : 0);

    if (!finalCredit && !finalDebit) continue;
    if (!totals.has(rowDate)) totals.set(rowDate, { date: rowDate, debit: 0, credit: 0 });
    const total = totals.get(rowDate);
    total.debit += finalDebit;
    total.credit += finalCredit;
  }

  return Array.from(totals.values()).map((total) => ({
    date: total.date,
    debit: Number(total.debit.toFixed(2)),
    credit: Number(total.credit.toFixed(2)),
    amount: Number((total.credit - total.debit).toFixed(2)),
  })).filter((total) => total.amount !== 0);
}

function readSpreadsheet(filePath, ext) {
  try {
    const matrix = readMatrix(filePath, ext);
    return {
      preview: matrixToPreview(matrix),
      dailyTotals: dailyTotalsFromMatrix(matrix),
    };
  } catch (error) {
    return {
      preview: { columns: [], rows: [], error: `Falha ao ler ${ext.toUpperCase()}: ${error.message}` },
      dailyTotals: [],
    };
  }
}

ipcMain.handle("select-spreadsheets", async () => {
  const result = await dialog.showOpenDialog({
    title: "Selecionar planilha",
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Planilhas", extensions: ["xlsx", "xls", "csv"] },
      { name: "Todos os arquivos", extensions: ["*"] },
    ],
  });

  if (result.canceled) return [];

  return result.filePaths.map((filePath) => {
    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).replace(".", "").toLowerCase();
    const type = ["xlsx", "xls", "csv"].includes(ext) ? ext : "csv";
    const data = readSpreadsheet(filePath, type);
    return {
      path: filePath,
      name: path.basename(filePath),
      size: stat.size,
      type,
      ...data,
    };
  });
});


ipcMain.handle("save-txt", async (_event, content) => {
  const result = await dialog.showSaveDialog({
    title: "Salvar TXT SCI",
    defaultPath: "lancamentos_sci.txt",
    filters: [
      { name: "Arquivo TXT", extensions: ["txt"] },
      { name: "Todos os arquivos", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) {
    return { canceled: true, filePath: "" };
  }

  fs.writeFileSync(result.filePath, String(content || ""), "utf8");
  return { canceled: false, filePath: result.filePath };
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

