# Provisões Sicredi para SCI

Programa desktop para ler o CSV do Sicredi, agrupar os lançamentos por dia, calcular `Crédito - Débito` e gerar um TXT no layout SCI.

## Abrir o programa

Dê dois cliques em:

```text
Abrir Provisoes.bat
```

Ou rode pelo PowerShell:

```powershell
cd "C:\Users\rayss\OneDrive\Documentos\Provisões"
py .\app_desktop.py
```

## O que a tela permite escolher

- Planilha CSV que será lida.
- Conta débito.
- Conta crédito.
- Código histórico SCI.
- Complemento do lançamento.
- Local onde o TXT SCI será salvo.
- Local onde o resumo de conferência será salvo.

No campo complemento você pode usar:

```text
{data} {debito} {credito} {saldo}
```

Exemplo:

```text
Provisao Sicredi {data} - saldo {saldo}
```

## Arquivos gerados

- `sci_provisoes_sicredi.txt`: TXT para importar no SCI.
- `resumo_diario_sicredi.csv`: conferência com débito, crédito e saldo por dia.

## Também dá para usar por comando

```powershell
py .\gerar_txt_sci.py "C:\Users\rayss\Downloads\Sicredi.csv" --conta-provisao 2311 --conta-contra 2206
```

Layout gerado por linha:

```text
numero,data_aaaammdd,conta_debito,conta_credito,valor,codigo_historico,complemento,,,,,,,
```

