import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownUp,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input, Label, Select } from "./components/ui/form";
import { cn, currency, fileSize } from "./lib/utils";

type StepId = "dashboard" | "import" | "mapping" | "review" | "export";
type ProcessState = "empty" | "uploaded" | "processing" | "success" | "warning" | "txt" | "error";
type EntryStatus = "ok" | "warning" | "error";

type SheetFile = {
  id: string;
  name: string;
  size: number;
  type: "csv" | "xlsx" | "xls";
  debitAccount: string;
  creditAccount: string;
  historyCode: string;
  complement: string;
  preview: {
    columns: string[];
    rows: Record<string, string>[];
    error: string;
  };
  dailyTotals: {
    date: string;
    debit: number;
    credit: number;
    amount: number;
  }[];
};

type DesktopFile = {
  path: string;
  name: string;
  size: number;
  type: "csv" | "xlsx" | "xls";
  preview: {
    columns: string[];
    rows: Record<string, string>[];
    error: string;
  };
  dailyTotals: {
    date: string;
    debit: number;
    credit: number;
    amount: number;
  }[];
};

declare global {
  interface Window {
    provisoesDesktop?: {
      selectSpreadsheets: () => Promise<DesktopFile[]>;
      saveTxt: (content: string) => Promise<{ canceled: boolean; filePath: string }>;
    };
  }
}

type AccountingEntry = {
  id: string;
  sheetId: string;
  sheetName: string;
  date: string;
  debitAccount: string;
  creditAccount: string;
  amount: number;
  historyCode: string;
  history: string;
  status: EntryStatus;
  observation: string;
};

const steps: { id: StepId; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "import", label: "Importacao", icon: Upload },
  { id: "mapping", label: "Mapeamento", icon: Settings2 },
  { id: "review", label: "Conferencia", icon: ClipboardCheck },
  { id: "export", label: "Gerar TXT", icon: FileText },
];

function buildEntries(files: SheetFile[]): AccountingEntry[] {
  return files.flatMap((file) =>
    file.dailyTotals.map((total, index) => {
      const amount = Math.abs(total.amount);
      const isNegative = total.amount < 0;
      const hasError = !file.debitAccount || !file.creditAccount || !amount || !total.date;
      return {
        id: `${file.id}-${index}`,
        sheetId: file.id,
        sheetName: file.name,
        date: total.date,
        debitAccount: isNegative ? file.creditAccount : file.debitAccount,
        creditAccount: isNegative ? file.debitAccount : file.creditAccount,
        amount,
        historyCode: file.historyCode,
        history: file.complement,
        status: hasError ? "error" : "ok",
        observation: hasError ? "Preencha conta debito, conta credito e confira o valor." : "",
      };
    }),
  );
}

function StatusBadge({ status }: { status: EntryStatus | ProcessState }) {
  const map: Record<string, string> = {
    ok: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    txt: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    uploaded: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
    processing: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    error: "bg-red-50 text-red-700 ring-1 ring-red-200",
    empty: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  };
  const label: Record<string, string> = {
    ok: "Ok",
    success: "Processado",
    txt: "TXT gerado",
    warning: "Com alerta",
    uploaded: "Arquivo enviado",
    processing: "Processando",
    error: "Erro",
    empty: "Nao enviado",
  };
  return <Badge className={map[status]}>{label[status]}</Badge>;
}

function Sidebar({ current, setCurrent }: { current: StepId; setCurrent: (step: StepId) => void }) {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-500 text-slate-950">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold">ContaFlow</div>
            <div className="text-xs text-slate-400">Importador contabil</div>
          </div>
        </div>
      </div>
      <nav className="space-y-1 p-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => setCurrent(step.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition",
                current === step.id ? "bg-teal-500 text-slate-950" : "text-slate-300 hover:bg-slate-900 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {step.label}
            </button>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-slate-800 p-4 text-xs text-slate-400">
        Desenvolvido por Rayssa ·{" "}
        <a
          href="https://github.com/rayssamayarax/provisoes-sci"
          target="_blank"
          rel="noreferrer"
          className="text-teal-400 underline hover:text-teal-300"
        >
          GitHub
        </a>
      </div>
    </aside>
  );
}

function Header({ state, onReprocess, disabled }: { state: ProcessState; onReprocess: () => void; disabled: boolean }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-lg font-bold text-slate-950">Geracao de lancamentos para SCI</h1>
        <p className="text-sm text-slate-500">Fluxo simples para importar, conferir e exportar TXT contabil.</p>
      </div>
      <div className="flex items-center gap-3">
        <StatusBadge status={state} />
        <Button variant="outline" size="sm" disabled={disabled} onClick={onReprocess}><RefreshCw className="h-4 w-4" />Reprocessar planilhas</Button>
      </div>
    </header>
  );
}

function Stepper({ current }: { current: StepId }) {
  const index = steps.findIndex((s) => s.id === current);
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
      {steps.map((step, i) => (
        <div key={step.id} className="flex flex-1 items-center gap-2">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold", i <= index ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500")}>{i + 1}</div>
          <div className="min-w-0">
            <div className={cn("truncate text-xs font-semibold", i <= index ? "text-slate-900" : "text-slate-400")}>{step.label}</div>
          </div>
          {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
        </div>
      ))}
    </div>
  );
}

function SummaryCards({ entries, files }: { entries: AccountingEntry[]; files: SheetFile[] }) {
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const errors = entries.filter((entry) => entry.status === "error").length;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Arquivos</p><p className="mt-2 text-2xl font-bold">{files.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Lancamentos</p><p className="mt-2 text-2xl font-bold">{entries.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Valor total</p><p className="mt-2 text-2xl font-bold">{currency(total)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs font-semibold uppercase text-slate-500">Erros</p><p className={cn("mt-2 text-2xl font-bold", errors ? "text-red-700" : "text-emerald-700")}>{errors}</p></CardContent></Card>
    </div>
  );
}

function UploadBox({ onSelectFiles }: { onSelectFiles: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-48 flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-700"><Upload className="h-7 w-7" /></div>
        <h3 className="font-semibold text-slate-950">Arraste a planilha ou clique para importar</h3>
        <p className="mt-2 max-w-md text-sm text-slate-500">Aceita arquivos .xlsx, .xls e .csv. Clique no botão abaixo para escolher o arquivo no Windows.</p>
        <Button className="mt-5" onClick={onSelectFiles}><Plus className="h-4 w-4" />Selecionar planilha</Button>
      </CardContent>
    </Card>
  );
}

function ErrorAlert({ errors }: { errors: number }) {
  if (!errors) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-5 w-5" />
      <div><strong>Existem {errors} erro(s) obrigatorios.</strong><br />Corrija os lancamentos marcados antes de gerar o TXT.</div>
    </div>
  );
}

function FileSettings({ files, setFiles, onRemove }: { files: SheetFile[]; setFiles: (files: SheetFile[]) => void; onRemove?: (id: string) => void }) {
  const update = (id: string, field: keyof SheetFile, value: string) => setFiles(files.map((file) => file.id === id ? { ...file, [field]: value } : file));
  return (
    <div className="space-y-4">
      {files.map((file) => (
        <Card key={file.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{file.name}</span>
              <span className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-500">{file.type.toUpperCase()} - {fileSize(file.size)}</span>
                {onRemove && (
                  <Button variant="ghost" size="sm" onClick={() => onRemove(file.id)} title="Excluir planilha">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                )}
              </span>
            </CardTitle>
            <CardDescription>Configuracao individual desta planilha para separar os lancamentos no TXT.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div><Label>Conta debito</Label><Input value={file.debitAccount} onChange={(e) => update(file.id, "debitAccount", e.target.value)} /></div>
            <div><Label>Conta credito</Label><Input value={file.creditAccount} onChange={(e) => update(file.id, "creditAccount", e.target.value)} /></div>
            <div><Label>Historico SCI</Label><Input value={file.historyCode} onChange={(e) => update(file.id, "historyCode", e.target.value)} placeholder="Opcional" /></div>
            <div><Label>Complemento</Label><Input value={file.complement} onChange={(e) => update(file.id, "complement", e.target.value)} placeholder="Texto do lancamento" /></div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MappingColumns({ files, setFiles, onRemove }: { files: SheetFile[]; setFiles: (files: SheetFile[]) => void; onRemove: (id: string) => void }) {
  return (
    <div className="space-y-4">
      {files.map((file) => (
        <Card key={file.id}>
          <CardHeader><CardTitle>{file.name}</CardTitle><CardDescription>Configure como os lançamentos desta planilha devem sair no TXT e confira as primeiras linhas lidas.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <FileSettings files={[file]} setFiles={(updated) => setFiles(files.map((item) => item.id === file.id ? updated[0] : item))} onRemove={onRemove} />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase text-slate-500">Dias com saldo</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{file.dailyTotals.length}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase text-slate-500">Credito total</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{currency(file.dailyTotals.reduce((sum, item) => sum + item.credit, 0))}</div>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold uppercase text-slate-500">Debito total</div>
                <div className="mt-1 text-lg font-bold text-slate-900">{currency(file.dailyTotals.reduce((sum, item) => sum + item.debit, 0))}</div>
              </div>
            </div>
            <PreviewTable preview={file.preview} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PreviewTable({ preview }: { preview: SheetFile["preview"] }) {
  if (preview.error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {preview.error}
      </div>
    );
  }

  if (!preview.rows.length || !preview.columns.length) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
        Nenhuma linha preenchida encontrada para prévia.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-md border border-slate-200">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-xs uppercase text-slate-500">
          <tr>
            {preview.columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-3 py-2 font-semibold">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, index) => (
            <tr key={index} className="border-t border-slate-100">
              {preview.columns.map((column) => (
                <td key={column} className="whitespace-nowrap px-3 py-2 text-slate-700">{row[column]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccountingEntryTable({ entries, setEntries }: { entries: AccountingEntry[]; setEntries: (entries: AccountingEntry[]) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("todos");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const filtered = useMemo(() => entries.filter((entry) => (status === "todos" || entry.status === status) && JSON.stringify(entry).toLowerCase().includes(query.toLowerCase())).sort((a, b) => sort === "date" ? a.date.localeCompare(b.date) : b.amount - a.amount), [entries, query, status, sort]);
  const update = (id: string, field: keyof AccountingEntry, value: string) => setEntries(entries.map((entry) => entry.id === id ? { ...entry, [field]: field === "amount" ? Number(value) : value, status: value ? entry.status === "error" ? "ok" : entry.status : "error" } : entry));
  return (
    <Card>
      <CardHeader><CardTitle>Conferencia dos lancamentos</CardTitle><CardDescription>Edite os campos antes de gerar o TXT SCI.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Pesquisar por conta, historico ou planilha" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="todos">Todos os status</option><option value="ok">Ok</option><option value="warning">Com alerta</option><option value="error">Com erro</option></Select>
          <Button variant="outline" onClick={() => setSort(sort === "date" ? "amount" : "date")}><ArrowDownUp className="h-4 w-4" />Ordenar por {sort === "date" ? "valor" : "data"}</Button>
        </div>
        <div className="overflow-auto rounded-md border border-slate-200">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase text-slate-500"><tr>{["Data", "Debito", "Credito", "Valor", "Historico", "Origem", "Status", "Observacao"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{filtered.map((entry) => <tr key={entry.id} className={cn("border-t border-slate-100", entry.status === "error" && "bg-red-50", entry.status === "warning" && "bg-amber-50")}>
              <td className="px-3 py-2"><Input value={entry.date} onChange={(e) => update(entry.id, "date", e.target.value)} /></td>
              <td className="px-3 py-2"><Input value={entry.debitAccount} onChange={(e) => update(entry.id, "debitAccount", e.target.value)} /></td>
              <td className="px-3 py-2"><Input value={entry.creditAccount} onChange={(e) => update(entry.id, "creditAccount", e.target.value)} /></td>
              <td className="px-3 py-2"><Input value={entry.amount} onChange={(e) => update(entry.id, "amount", e.target.value)} /></td>
              <td className="px-3 py-2 min-w-64"><Input value={entry.history} onChange={(e) => update(entry.id, "history", e.target.value)} /></td>
              <td className="px-3 py-2 text-xs text-slate-500">{entry.sheetName}</td>
              <td className="px-3 py-2"><StatusBadge status={entry.status} /></td>
              <td className="px-3 py-2 text-xs text-slate-600">{entry.observation || "-"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ExportTxtButton({ disabled, onClick, generated }: { disabled: boolean; onClick: () => void; generated: boolean }) {
  return <Button size="lg" disabled={disabled} onClick={onClick}>{generated ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}{generated ? "TXT gerado" : "Gerar arquivo TXT"}</Button>;
}

function sciLine(entry: AccountingEntry, index: number) {
  const date = entry.date.split("/").reverse().join("");
  return `${index + 1},${date},${entry.debitAccount},${entry.creditAccount},${entry.amount.toFixed(2)},${entry.historyCode},${entry.history},,,,,,,`;
}

export default function App() {
  const [current, setCurrent] = useState<StepId>("dashboard");
  const [files, setFiles] = useState<SheetFile[]>([]);
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [state, setState] = useState<ProcessState>("empty");
  const [txtGenerated, setTxtGenerated] = useState(false);
  const [txtContent, setTxtContent] = useState("");
  const [savedPath, setSavedPath] = useState("");
  const errors = entries.filter((entry) => entry.status === "error").length;
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);

  const selectFiles = async () => {
    if (!window.provisoesDesktop) {
      alert("Seletor de arquivos disponivel apenas no app desktop.");
      return;
    }

    const selected = await window.provisoesDesktop.selectSpreadsheets();
    if (!selected.length) return;

    const mappedFiles = selected.map((selectedFile, index) => {
      return {
        id: `file-${Date.now()}-${index}`,
        name: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        debitAccount: "",
        creditAccount: "5",
        historyCode: "3665",
        complement: "Provisão",
        preview: selectedFile.preview,
        dailyTotals: selectedFile.dailyTotals,
      };
    });

    const nextFiles = [...files, ...mappedFiles];
    setFiles(nextFiles);
    setEntries(buildEntries(nextFiles));
    setState("uploaded");
  };

  const removeFile = (id: string) => {
    const nextFiles = files.filter((file) => file.id !== id);
    setFiles(nextFiles);
    setEntries(buildEntries(nextFiles));
    if (!nextFiles.length) setState("empty");
  };

  const clearFiles = () => {
    setFiles([]);
    setEntries([]);
    setState("empty");
    setTxtGenerated(false);
    setTxtContent("");
    setSavedPath("");
  };

  const confirmMapping = () => {
    setState("processing");
    setTimeout(() => { setEntries(buildEntries(files)); setState("success"); setCurrent("review"); }, 500);
  };

  const reprocessFiles = () => {
    if (!files.length) return;
    setState("processing");
    setTxtGenerated(false);
    setTxtContent("");
    setSavedPath("");
    setTimeout(() => {
      setEntries(buildEntries(files));
      setState("success");
    }, 300);
  };

  const buildSciContent = () => {
    const content = entries.map(sciLine).join("\n");
    return content ? content + "\n" : content;
  };

  const generateTxt = () => {
    if (errors) return;
    const content = buildSciContent();
    setTxtContent(content);
    setTxtGenerated(true);
    setState("txt");
  };

  const downloadTxt = async () => {
    const content = txtContent || buildSciContent();
    if (!content.trim()) {
      alert("Nao ha lancamentos para salvar.");
      return;
    }
    if (!window.provisoesDesktop) {
      alert("Salvar TXT esta disponivel apenas no app desktop.");
      return;
    }

    try {
      const result = await window.provisoesDesktop.saveTxt(content);
      if (!result.canceled) {
        setSavedPath(result.filePath);
        setTxtGenerated(true);
        setTxtContent(content);
        setState("txt");
      }
    } catch (error) {
      setState("error");
      alert(`Erro ao salvar TXT: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar current={current} setCurrent={setCurrent} />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header state={state} onReprocess={reprocessFiles} disabled={files.length === 0 || state === "processing"} />
        <div className="min-h-0 flex-1 space-y-5 overflow-auto p-6">
          <Stepper current={current} />
          {current === "dashboard" && <div className="space-y-5"><SummaryCards entries={entries} files={files} /><Card><CardHeader><CardTitle>Importar planilha</CardTitle><CardDescription>Comece adicionando uma ou mais planilhas. Cada arquivo pode ter contas e complemento proprios.</CardDescription></CardHeader><CardContent className="flex items-center justify-between"><div><p className="text-sm text-slate-600">Ultimo processamento: {files.length ? (state === "txt" ? "TXT gerado com sucesso" : "Arquivo pronto para conferencia") : "Nenhum arquivo importado"}</p><p className="mt-1 text-sm font-semibold text-slate-900">{entries.length} lancamentos - {currency(total)}</p></div><Button onClick={() => setCurrent("import")}><Upload className="h-4 w-4" />Importar planilha</Button></CardContent></Card></div>}
          {current === "import" && <div className="space-y-5"><UploadBox onSelectFiles={selectFiles} />{files.length > 0 ? <><div className="flex justify-end"><Button variant="outline" size="sm" onClick={clearFiles}><X className="h-4 w-4" />Limpar planilhas</Button></div><FileSettings files={files} setFiles={setFiles} onRemove={removeFile} /></> : <Card><CardContent className="p-6 text-sm text-slate-500">Nenhuma planilha selecionada ainda.</CardContent></Card>}<div className="flex justify-end"><Button disabled={files.length === 0} onClick={() => setCurrent("mapping")}>Continuar para mapeamento</Button></div></div>}
          {current === "mapping" && <div className="space-y-5">{files.length > 0 ? <><div className="flex justify-end"><Button variant="outline" size="sm" onClick={clearFiles}><X className="h-4 w-4" />Limpar planilhas</Button></div><MappingColumns files={files} setFiles={setFiles} onRemove={removeFile} /></> : <Card><CardContent className="p-6 text-sm text-slate-500">Importe uma planilha antes de mapear as colunas.</CardContent></Card>}<div className="flex justify-end"><Button disabled={files.length === 0} onClick={confirmMapping}><CheckCircle2 className="h-4 w-4" />Confirmar mapeamento</Button></div></div>}
          {current === "review" && <div className="space-y-5"><ErrorAlert errors={errors} /><AccountingEntryTable entries={entries} setEntries={setEntries} /><div className="flex justify-end"><Button onClick={() => setCurrent("export")}>Ir para geracao do TXT</Button></div></div>}
          {current === "export" && <div className="space-y-5"><ErrorAlert errors={errors} /><SummaryCards entries={entries} files={files} /><Card><CardHeader><CardTitle>Resumo final</CardTitle><CardDescription>Confira os totais antes de salvar o TXT SCI.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><ExportTxtButton disabled={errors > 0} generated={txtGenerated} onClick={generateTxt} /><Button variant="outline" disabled={errors > 0 || entries.length === 0} onClick={downloadTxt}><Download className="h-4 w-4" />Baixar TXT</Button><Button variant="secondary" onClick={() => setCurrent("review")}><Pencil className="h-4 w-4" />Voltar para corrigir</Button>{txtGenerated && <span className="text-sm font-semibold text-emerald-700">TXT gerado com sucesso.</span>}{savedPath && <span className="text-xs text-slate-500">Salvo em: {savedPath}</span>}</CardContent></Card></div>}
        </div>
      </main>
    </div>
  );
}
