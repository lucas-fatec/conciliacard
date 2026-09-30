"""
Gera extratos de cartao de credito ficticios em PDF para os testes da Sprint #1.
Uso: python3 gerar_extrato.py
Requer: pip install reportlab
"""
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

LARGURA, ALTURA = A4


def gerar(nome_arquivo, titular, referencia, lancamentos, rodape_total=True):
    c = canvas.Canvas(nome_arquivo, pagesize=A4)
    y = ALTURA - 60

    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, "BANCO FICTICIO S.A.")
    y -= 18
    c.setFont("Helvetica", 10)
    c.drawString(50, y, "Cartao de credito final 4821 - DOCUMENTO DE TESTE, SEM VALOR FISCAL")
    y -= 14
    c.drawString(50, y, f"Extrato do cartao de credito - Fatura de {referencia}")
    y -= 14
    c.drawString(50, y, f"Titular: {titular}")
    y -= 28

    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, y, "Data")
    c.drawString(130, y, "Estabelecimento")
    c.drawString(430, y, "Valor")
    y -= 6
    c.line(50, y, 545, y)
    y -= 16

    c.setFont("Helvetica", 10)
    total = 0.0
    for data, descricao, valor in lancamentos:
        c.drawString(50, y, data)
        c.drawString(130, y, descricao)
        texto_valor = f"R$ {valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        c.drawString(430, y, texto_valor)
        if valor > 0:
            total += valor
        y -= 16
        if y < 80:
            c.showPage()
            y = ALTURA - 60
            c.setFont("Helvetica", 10)

    if rodape_total:
        y -= 10
        c.line(50, y, 545, y)
        y -= 18
        c.setFont("Helvetica-Bold", 10)
        texto_total = f"R$ {total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        c.drawString(50, y, f"Total desta fatura: {texto_total}")

    c.save()
    print(f"Gerado: {nome_arquivo}  ({len(lancamentos)} linhas)")


# ---------------------------------------------------------------------------
# Extrato 1 - cenario principal da demonstracao (CT-UC03-01 / CT-UC04-01)
# ---------------------------------------------------------------------------
gerar(
    "extrato_setembro_2026.pdf",
    "Usuario de Teste",
    "09/2026",
    [
        ("05/09/2026", "UBER TRIP SAO PAULO", 27.90),          # concilia com gasto 1
        ("07/09/2026", "MERCADO SAO JORGE", 184.35),           # concilia com gasto 2
        ("10/09/2026", "STREAMING ASSINATURA MENSAL", 49.90),  # divergencia de valor
        ("12/09/2026", "FARMACIA BEM ESTAR", 62.80),           # concilia com gasto 4
        ("18/09/2026", "PADARIA CENTRAL", 15.00),              # so no extrato
        ("19/09/2026", "POSTO IPIRANGA COMBUSTIVEL", 210.45),  # so no extrato
        ("20/09/2026", "PAGAMENTO FATURA ANTERIOR", -500.00),  # ignorado (credito)
    ],
)

# ---------------------------------------------------------------------------
# Extrato 2 - arquivo PDF valido porem SEM lancamentos (CT-UC03-04)
# ---------------------------------------------------------------------------
gerar(
    "extrato_invalido_sem_lancamentos.pdf",
    "Usuario de Teste",
    "09/2026",
    [],
    rodape_total=False,
)
