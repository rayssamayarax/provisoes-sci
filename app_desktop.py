from __future__ import annotations

import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

from gerar_txt_sci import (
    DailyTotal,
    format_brl_sci,
    read_daily_totals,
    write_summary,
)


APP_DIR = Path(__file__).resolve().parent
DEFAULT_CSV = Path.home() / "Downloads" / "Sicredi.csv"

COLORS = {
    "bg": "#0f172a",
    "panel": "#111c32",
    "panel_soft": "#17233a",
    "field": "#f8fafc",
    "text": "#e5edf8",
    "muted": "#94a3b8",
    "line": "#2b3a55",
    "accent": "#14b8a6",
    "accent_dark": "#0f766e",
    "accent_soft": "#ccfbf1",
    "warning": "#f59e0b",
}


class ProvisoesApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Provisoes Sicredi - TXT SCI")
        self.geometry("980x640")
        self.minsize(900, 580)
        self.configure(bg=COLORS["bg"])

        self.totals: dict[str, DailyTotal] = {}
        self.detected_account = ""

        self.csv_path = tk.StringVar(value=str(DEFAULT_CSV if DEFAULT_CSV.exists() else ""))
        self.output_path = tk.StringVar(value=str(APP_DIR / "sci_provisoes_sicredi.txt"))
        self.summary_path = tk.StringVar(value=str(APP_DIR / "resumo_diario_sicredi.csv"))
        self.debit_account = tk.StringVar(value="2206")
        self.credit_account = tk.StringVar(value="2311")
        self.history_code = tk.StringVar(value="")
        self.complement = tk.StringVar(value="")
        self.status = tk.StringVar(value="Selecione a planilha CSV para iniciar.")
        self.days_count = tk.StringVar(value="0")
        self.credit_total = tk.StringVar(value="0,00")
        self.debit_total = tk.StringVar(value="0,00")
        self.balance_total = tk.StringVar(value="0,00")

        self._configure_style()
        self._build_ui()
        if self.csv_path.get():
            self.load_csv()

    def _configure_style(self) -> None:
        style = ttk.Style(self)
        style.theme_use("clam")

        style.configure("App.TFrame", background=COLORS["bg"])
        style.configure("Card.TFrame", background=COLORS["panel"], relief="flat")
        style.configure("Soft.TFrame", background=COLORS["panel_soft"], relief="flat")
        style.configure("Title.TLabel", background=COLORS["bg"], foreground=COLORS["text"], font=("Segoe UI", 18, "bold"))
        style.configure("Subtitle.TLabel", background=COLORS["bg"], foreground=COLORS["muted"], font=("Segoe UI", 10))
        style.configure("CardTitle.TLabel", background=COLORS["panel"], foreground=COLORS["text"], font=("Segoe UI", 11, "bold"))
        style.configure("Label.TLabel", background=COLORS["panel"], foreground=COLORS["muted"], font=("Segoe UI", 9, "bold"))
        style.configure("Hint.TLabel", background=COLORS["panel"], foreground=COLORS["muted"], font=("Segoe UI", 9))
        style.configure("Status.TLabel", background=COLORS["bg"], foreground=COLORS["muted"], font=("Segoe UI", 9))
        style.configure("Metric.TLabel", background=COLORS["panel_soft"], foreground=COLORS["muted"], font=("Segoe UI", 8, "bold"))
        style.configure("MetricValue.TLabel", background=COLORS["panel_soft"], foreground=COLORS["text"], font=("Segoe UI", 13, "bold"))

        style.configure(
            "Modern.TEntry",
            fieldbackground=COLORS["field"],
            foreground="#0f172a",
            bordercolor=COLORS["line"],
            lightcolor=COLORS["line"],
            darkcolor=COLORS["line"],
            padding=6,
            relief="flat",
        )
        style.map("Modern.TEntry", bordercolor=[("focus", COLORS["accent"])])

        style.configure(
            "Modern.TButton",
            background=COLORS["panel_soft"],
            foreground=COLORS["text"],
            bordercolor=COLORS["line"],
            focusthickness=0,
            padding=(12, 7),
            font=("Segoe UI", 9, "bold"),
        )
        style.map("Modern.TButton", background=[("active", "#22304a")])

        style.configure(
            "Accent.TButton",
            background=COLORS["accent"],
            foreground="#052f2b",
            bordercolor=COLORS["accent"],
            focusthickness=0,
            padding=(16, 9),
            font=("Segoe UI", 10, "bold"),
        )
        style.map("Accent.TButton", background=[("active", "#2dd4bf")])

        style.configure(
            "Treeview",
            background="#f8fafc",
            fieldbackground="#f8fafc",
            foreground="#111827",
            rowheight=30,
            bordercolor=COLORS["line"],
            font=("Segoe UI", 9),
        )
        style.configure(
            "Treeview.Heading",
            background="#e2e8f0",
            foreground="#0f172a",
            padding=8,
            font=("Segoe UI", 9, "bold"),
        )
        style.map("Treeview", background=[("selected", COLORS["accent_soft"])], foreground=[("selected", "#0f172a")])

        style.configure("Vertical.TScrollbar", background=COLORS["panel_soft"], troughcolor=COLORS["panel"])

    def _card(self, parent: tk.Widget, title: str) -> ttk.Frame:
        card = ttk.Frame(parent, style="Card.TFrame", padding=12)
        ttk.Label(card, text=title, style="CardTitle.TLabel").grid(row=0, column=0, columnspan=4, sticky="w", pady=(0, 8))
        return card

    def _field(self, parent: ttk.Frame, label: str, variable: tk.StringVar, row: int, browse_command=None) -> None:
        ttk.Label(parent, text=label, style="Label.TLabel").grid(row=row, column=0, sticky="w", pady=(0, 6))
        entry = ttk.Entry(parent, textvariable=variable, style="Modern.TEntry")
        entry.grid(row=row + 1, column=0, sticky="ew", pady=(0, 8))
        if browse_command:
            ttk.Button(parent, text="Escolher", style="Modern.TButton", command=browse_command).grid(
                row=row + 1, column=1, sticky="ew", padx=(8, 0), pady=(0, 8)
            )

    def _metric(self, parent: tk.Widget, label: str, value: tk.StringVar, column: int) -> None:
        box = ttk.Frame(parent, style="Soft.TFrame", padding=(12, 9))
        box.grid(row=0, column=column, sticky="ew", padx=(0 if column == 0 else 8, 0))
        ttk.Label(box, text=label.upper(), style="Metric.TLabel").pack(anchor="w")
        ttk.Label(box, textvariable=value, style="MetricValue.TLabel").pack(anchor="w", pady=(3, 0))

    def _build_ui(self) -> None:
        root = ttk.Frame(self, style="App.TFrame", padding=16)
        root.pack(fill="both", expand=True)
        root.columnconfigure(0, weight=0, minsize=340)
        root.columnconfigure(1, weight=1)
        root.rowconfigure(2, weight=1)

        header = ttk.Frame(root, style="App.TFrame")
        header.grid(row=0, column=0, columnspan=2, sticky="ew", pady=(0, 12))
        header.columnconfigure(0, weight=1)
        ttk.Label(header, text="Provisoes Sicredi", style="Title.TLabel").grid(row=0, column=0, sticky="w")
        ttk.Label(
            header,
            text="Gere o TXT SCI por dia a partir do saldo Credito - Debito da planilha.",
            style="Subtitle.TLabel",
        ).grid(row=1, column=0, sticky="w", pady=(2, 0))
        ttk.Button(header, text="Gerar TXT SCI", style="Accent.TButton", command=self.generate_files).grid(
            row=0, column=1, rowspan=2, sticky="e"
        )

        metrics = ttk.Frame(root, style="App.TFrame")
        metrics.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 10))
        for col in range(4):
            metrics.columnconfigure(col, weight=1)
        self._metric(metrics, "Dias", self.days_count, 0)
        self._metric(metrics, "Credito", self.credit_total, 1)
        self._metric(metrics, "Debito", self.debit_total, 2)
        self._metric(metrics, "Saldo", self.balance_total, 3)

        left = ttk.Frame(root, style="App.TFrame")
        left.grid(row=2, column=0, sticky="nsew", padx=(0, 14))
        left.columnconfigure(0, weight=1)

        files = self._card(left, "Arquivos")
        files.pack(fill="x", pady=(0, 10))
        files.columnconfigure(0, weight=1)
        self._field(files, "Planilha CSV", self.csv_path, 1, self.choose_csv)
        ttk.Button(files, text="Ler planilha", style="Modern.TButton", command=self.load_csv).grid(
            row=3, column=0, columnspan=2, sticky="ew", pady=(0, 8)
        )
        self._field(files, "Salvar TXT SCI em", self.output_path, 4, self.choose_output)
        self._field(files, "Salvar resumo em", self.summary_path, 6, self.choose_summary)

        params = self._card(left, "Lancamento SCI")
        params.pack(fill="x")
        for col in range(4):
            params.columnconfigure(col, weight=1)

        ttk.Label(params, text="Conta debito", style="Label.TLabel").grid(row=1, column=0, sticky="w", pady=(0, 5))
        ttk.Entry(params, textvariable=self.debit_account, style="Modern.TEntry").grid(row=2, column=0, sticky="ew", padx=(0, 8), pady=(0, 8))
        ttk.Label(params, text="Conta credito", style="Label.TLabel").grid(row=1, column=1, sticky="w", pady=(0, 5))
        ttk.Entry(params, textvariable=self.credit_account, style="Modern.TEntry").grid(row=2, column=1, sticky="ew", padx=(0, 8), pady=(0, 8))
        ttk.Label(params, text="Historico SCI", style="Label.TLabel").grid(row=1, column=2, sticky="w", pady=(0, 5))
        ttk.Entry(params, textvariable=self.history_code, style="Modern.TEntry").grid(row=2, column=2, sticky="ew", padx=(0, 8), pady=(0, 8))
        ttk.Label(params, text="Complemento que vai no TXT", style="Label.TLabel").grid(row=3, column=0, columnspan=4, sticky="w", pady=(2, 5))
        ttk.Entry(params, textvariable=self.complement, style="Modern.TEntry").grid(row=4, column=0, columnspan=4, sticky="ew", pady=(0, 6))
        ttk.Label(
            params,
            text="Variaveis aceitas: {data}, {debito}, {credito}, {saldo}",
            style="Hint.TLabel",
        ).grid(row=5, column=0, columnspan=4, sticky="w")

        preview_card = self._card(root, "Previa por dia")
        preview_card.grid(row=2, column=1, sticky="nsew")
        preview_card.columnconfigure(0, weight=1)
        preview_card.rowconfigure(1, weight=1)

        columns = ("data", "debito", "credito", "saldo")
        self.preview = ttk.Treeview(preview_card, columns=columns, show="headings", height=16)
        self.preview.heading("data", text="Data")
        self.preview.heading("debito", text="Debito")
        self.preview.heading("credito", text="Credito")
        self.preview.heading("saldo", text="Credito - Debito")
        self.preview.column("data", width=120, anchor="center")
        self.preview.column("debito", width=140, anchor="e")
        self.preview.column("credito", width=140, anchor="e")
        self.preview.column("saldo", width=160, anchor="e")
        self.preview.grid(row=1, column=0, sticky="nsew")

        scrollbar = ttk.Scrollbar(preview_card, orient="vertical", command=self.preview.yview, style="Vertical.TScrollbar")
        self.preview.configure(yscrollcommand=scrollbar.set)
        scrollbar.grid(row=1, column=1, sticky="ns")

        footer = ttk.Frame(root, style="App.TFrame")
        footer.grid(row=3, column=0, columnspan=2, sticky="ew", pady=(10, 0))
        footer.columnconfigure(0, weight=1)
        ttk.Label(footer, textvariable=self.status, style="Status.TLabel").grid(row=0, column=0, sticky="w")

    def choose_csv(self) -> None:
        path = filedialog.askopenfilename(
            title="Selecionar planilha Sicredi",
            filetypes=[("CSV", "*.csv"), ("Todos os arquivos", "*.*")],
            initialdir=str(Path.home() / "Downloads"),
        )
        if path:
            self.csv_path.set(path)
            self.load_csv()

    def choose_output(self) -> None:
        path = filedialog.asksaveasfilename(
            title="Salvar TXT SCI",
            defaultextension=".txt",
            filetypes=[("TXT", "*.txt"), ("Todos os arquivos", "*.*")],
            initialfile="sci_provisoes_sicredi.txt",
            initialdir=str(APP_DIR),
        )
        if path:
            self.output_path.set(path)
            self.summary_path.set(str(Path(path).with_name("resumo_diario_sicredi.csv")))

    def choose_summary(self) -> None:
        path = filedialog.asksaveasfilename(
            title="Salvar resumo de conferencia",
            defaultextension=".csv",
            filetypes=[("CSV", "*.csv"), ("Todos os arquivos", "*.*")],
            initialfile="resumo_diario_sicredi.csv",
            initialdir=str(APP_DIR),
        )
        if path:
            self.summary_path.set(path)

    def load_csv(self) -> None:
        csv_file = Path(self.csv_path.get().strip())
        if not csv_file.exists():
            messagebox.showerror("Arquivo nao encontrado", "Selecione uma planilha CSV valida.")
            return

        try:
            totals, detected_account = read_daily_totals(csv_file)
        except Exception as exc:
            messagebox.showerror("Erro ao ler planilha", str(exc))
            return

        self.totals = totals
        self.detected_account = detected_account
        if detected_account and self.credit_account.get().strip() in {"", "2311"}:
            self.credit_account.set(detected_account)
        self.refresh_preview()
        total_credit = sum(item.credit for item in totals.values())
        total_debit = sum(item.debit for item in totals.values())
        total_balance = total_credit - total_debit
        self.days_count.set(str(len(totals)))
        self.credit_total.set(format_brl_sci(total_credit))
        self.debit_total.set(format_brl_sci(total_debit))
        self.balance_total.set(self._format_signed(total_balance))
        self.status.set(f"Planilha lida com sucesso: {csv_file.name}")

    def refresh_preview(self) -> None:
        self.preview.delete(*self.preview.get_children())
        for index, item in enumerate(self.totals.values()):
            tag = "even" if index % 2 == 0 else "odd"
            self.preview.insert(
                "",
                "end",
                values=(item.date_br, format_brl_sci(item.debit), format_brl_sci(item.credit), self._format_signed(item.balance)),
                tags=(tag,),
            )
        self.preview.tag_configure("even", background="#f8fafc")
        self.preview.tag_configure("odd", background="#eef4fb")

    def _format_signed(self, value: float) -> str:
        return format_brl_sci(value) if value >= 0 else f"-{format_brl_sci(value)}"

    def _build_custom_sci_text(self) -> str:
        from gerar_txt_sci import generate_sci_line, normalize_date_yyyymmdd

        lines: list[str] = []
        debit_account = self.debit_account.get().strip()
        credit_account = self.credit_account.get().strip()
        history_code = self.history_code.get().strip()
        complement_template = self.complement.get().strip()

        for total in self.totals.values():
            balance = total.balance
            if balance == 0:
                continue

            line_debit = debit_account
            line_credit = credit_account
            if balance < 0:
                line_debit, line_credit = line_credit, line_debit

            complement = complement_template.format(
                data=total.date_br,
                debito=format_brl_sci(total.debit),
                credito=format_brl_sci(total.credit),
                saldo=self._format_signed(balance),
            )
            lines.append(
                generate_sci_line(
                    line_number=len(lines) + 1,
                    date_yyyymmdd=normalize_date_yyyymmdd(total.date_br),
                    debit_account=line_debit,
                    credit_account=line_credit,
                    amount=balance,
                    history_code=history_code,
                    complement=complement,
                )
            )
        return "\n".join(lines) + ("\n" if lines else "")

    def generate_files(self) -> None:
        if not self.totals:
            self.load_csv()
            if not self.totals:
                return

        if not self.debit_account.get().strip() or not self.credit_account.get().strip():
            messagebox.showerror("Contas obrigatorias", "Preencha conta debito e conta credito.")
            return
        output_text = self.output_path.get().strip()
        summary_text = self.summary_path.get().strip()
        if not output_text:
            messagebox.showerror("Destino obrigatorio", "Escolha onde salvar o TXT SCI.")
            return
        if not summary_text:
            messagebox.showerror("Resumo obrigatorio", "Escolha onde salvar o resumo de conferencia.")
            return

        output = Path(output_text)
        summary = Path(summary_text)

        try:
            output.parent.mkdir(parents=True, exist_ok=True)
            summary.parent.mkdir(parents=True, exist_ok=True)
            sci_text = self._build_custom_sci_text()
            output.write_text(sci_text, encoding="utf-8")
            write_summary(self.totals, summary)
        except KeyError as exc:
            messagebox.showerror(
                "Complemento invalido",
                f"O campo complemento tem uma variavel invalida: {exc}. Use apenas {{data}}, {{debito}}, {{credito}} e {{saldo}}.",
            )
            return
        except Exception as exc:
            messagebox.showerror("Erro ao salvar", str(exc))
            return

        lines = sci_text.count("\n")
        self.status.set(f"TXT gerado com {lines} lancamentos: {output}")
        messagebox.showinfo("Concluido", f"TXT SCI gerado com {lines} lancamentos.\n\n{output}")


if __name__ == "__main__":
    app = ProvisoesApp()
    app.mainloop()



