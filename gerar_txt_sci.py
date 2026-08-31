from __future__ import annotations

import argparse
import csv
import re
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


DATE_RE = re.compile(r"^\s*(\d{2}/\d{2}/\d{4})\s*$")
ACCOUNT_RE = re.compile(r"^\s*(\d+)\s*-")


@dataclass
class DailyTotal:
    date_br: str
    debit: float = 0.0
    credit: float = 0.0

    @property
    def balance(self) -> float:
        return round(self.credit - self.debit, 2)


def parse_brl_amount(value: str | None) -> float:
    text = str(value or "").strip()
    if not text:
        return 0.0

    negative = text.startswith("(") and text.endswith(")")
    text = text.replace("R$", "").replace(" ", "").replace(".", "").replace(",", ".")
    text = text.strip("()")
    try:
        amount = float(text)
    except ValueError:
        return 0.0
    return -amount if negative else amount


def format_brl_sci(value: float) -> str:
    return f"{abs(float(value)):.2f}".replace(".", ",")


def format_valor_sci(value: float) -> str:
    return f"{abs(float(value)):.2f}"


def normalize_date_yyyymmdd(date_br: str) -> str:
    return datetime.strptime(date_br, "%d/%m/%Y").strftime("%Y%m%d")


def detect_account_from_header(first_history: str | None, fallback: str) -> str:
    match = ACCOUNT_RE.match(str(first_history or ""))
    return match.group(1) if match else fallback


def read_daily_totals(csv_path: Path) -> tuple[OrderedDict[str, DailyTotal], str]:
    for encoding in ("utf-8-sig", "cp1252", "latin1"):
        try:
            return _read_daily_totals_with_encoding(csv_path, encoding)
        except UnicodeDecodeError:
            continue
    return _read_daily_totals_with_encoding(csv_path, "latin1")


def _read_daily_totals_with_encoding(csv_path: Path, encoding: str) -> tuple[OrderedDict[str, DailyTotal], str]:
    totals: OrderedDict[str, DailyTotal] = OrderedDict()
    current_date: str | None = None
    detected_account = ""

    with csv_path.open("r", encoding=encoding, newline="") as file:
        reader = csv.DictReader(file, delimiter=";")
        for row_number, row in enumerate(reader, start=2):
            history = str(row.get("Histórico", "") or "").strip()
            if row_number == 2:
                detected_account = detect_account_from_header(history, "")

            date_match = DATE_RE.match(history)
            if date_match:
                current_date = date_match.group(1)
                totals.setdefault(current_date, DailyTotal(date_br=current_date))
                continue

            if current_date is None:
                continue

            debit = parse_brl_amount(row.get("Débito"))
            credit = parse_brl_amount(row.get("Crédito"))
            if debit == 0 and credit == 0:
                continue

            totals[current_date].debit += debit
            totals[current_date].credit += credit

    return totals, detected_account


def generate_sci_line(
    line_number: int,
    date_yyyymmdd: str,
    debit_account: str,
    credit_account: str,
    amount: float,
    history_code: str,
    complement: str,
) -> str:
    fields = [
        str(line_number),
        date_yyyymmdd,
        str(debit_account),
        str(credit_account),
        format_valor_sci(amount),
        str(history_code or ""),
        complement[:200],
    ]
    while len(fields) < 14:
        fields.append("")
    return ",".join(fields)


def export_daily_balance_sci(
    totals: OrderedDict[str, DailyTotal],
    provision_account: str,
    contra_account: str,
    history_code: str,
) -> str:
    lines: list[str] = []

    for total in totals.values():
        balance = total.balance
        if balance == 0:
            continue

        if balance > 0:
            debit_account = contra_account
            credit_account = provision_account
            complement = f"Provisao Sicredi {total.date_br} - creditos menos debitos"
        else:
            debit_account = provision_account
            credit_account = contra_account
            complement = f"Estorno provisao Sicredi {total.date_br} - debitos maiores que creditos"

        lines.append(
            generate_sci_line(
                line_number=len(lines) + 1,
                date_yyyymmdd=normalize_date_yyyymmdd(total.date_br),
                debit_account=debit_account,
                credit_account=credit_account,
                amount=balance,
                history_code=history_code,
                complement=complement,
            )
        )

    return "\n".join(lines) + ("\n" if lines else "")


def write_summary(totals: OrderedDict[str, DailyTotal], output_path: Path) -> None:
    with output_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.writer(file, delimiter=";")
        writer.writerow(["Data", "Débito", "Crédito", "Crédito - Débito"])
        for total in totals.values():
            writer.writerow(
                [
                    total.date_br,
                    format_brl_sci(total.debit),
                    format_brl_sci(total.credit),
                    format_brl_sci(total.balance) if total.balance >= 0 else f"-{format_brl_sci(total.balance)}",
                ]
            )


def main() -> int:
    parser = argparse.ArgumentParser(description="Gera TXT SCI com saldo diario de Credito menos Debito do CSV Sicredi.")
    parser.add_argument("csv", nargs="?", default=str(Path.home() / "Downloads" / "Sicredi.csv"), help="Caminho do CSV do Sicredi")
    parser.add_argument("--saida", default="sci_provisoes_sicredi.txt", help="Arquivo TXT SCI de saida")
    parser.add_argument("--resumo", default="resumo_diario_sicredi.csv", help="CSV de conferencia por dia")
    parser.add_argument("--conta-provisao", default="", help="Conta credito/provisao. Se vazio, usa a conta detectada no cabecalho")
    parser.add_argument("--conta-contra", default="2206", help="Conta debito/contra partida")
    parser.add_argument("--historico", default="", help="Codigo historico SCI")
    args = parser.parse_args()

    csv_path = Path(args.csv).expanduser().resolve()
    output_path = Path(args.saida).expanduser().resolve()
    summary_path = Path(args.resumo).expanduser().resolve()

    totals, detected_account = read_daily_totals(csv_path)
    provision_account = str(args.conta_provisao or detected_account or "2311").strip()

    sci_text = export_daily_balance_sci(
        totals=totals,
        provision_account=provision_account,
        contra_account=str(args.conta_contra).strip(),
        history_code=str(args.historico).strip(),
    )

    output_path.write_text(sci_text, encoding="utf-8")
    write_summary(totals, summary_path)

    generated = sci_text.count("\n")
    print(f"Dias lidos: {len(totals)}")
    print(f"Lancamentos SCI gerados: {generated}")
    print(f"Conta provisao: {provision_account}")
    print(f"Conta contra partida: {args.conta_contra}")
    print(f"TXT SCI: {output_path}")
    print(f"Resumo: {summary_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())




