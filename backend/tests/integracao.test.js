/**
 * Teste de integracao: le o PDF ficticio real de /samples, extrai o texto,
 * faz o parse e executa a conciliacao contra a massa de dados do init.sql.
 */
const fs = require('fs');
const path = require('path');
const { extrairTexto } = require('../src/pdfTexto');
const { parseExtrato } = require('../src/parserExtrato');
const { conciliar } = require('../src/conciliador');

const PDF_VALIDO = path.join(__dirname, '../../samples/extrato_setembro_2026.pdf');
const PDF_SEM_LANCAMENTOS = path.join(
  __dirname,
  '../../samples/extrato_invalido_sem_lancamentos.pdf'
);

// Mesma massa inserida pelo script bd/init.sql
const GASTOS_CADASTRADOS = [
  { id: 1, descricao: 'Uber para a faculdade', valor: 27.9, data_gasto: '2026-09-05' },
  { id: 2, descricao: 'Mercado Sao Jorge', valor: 184.35, data_gasto: '2026-09-07' },
  { id: 3, descricao: 'Assinatura de streaming', valor: 39.9, data_gasto: '2026-09-10' },
  { id: 4, descricao: 'Farmacia Bem Estar', valor: 62.8, data_gasto: '2026-09-12' },
  { id: 5, descricao: 'Livraria Tecnica', valor: 119.0, data_gasto: '2026-09-15' },
];

jest.setTimeout(20000);

describe('CT-UC03/UC04 - Integracao importacao + conciliacao', () => {
  test('CT-UC03-08 le o PDF ficticio e extrai 6 lancamentos de debito', async () => {
    const texto = await extrairTexto(fs.readFileSync(PDF_VALIDO));
    const { referencia, itens } = parseExtrato(texto);
    expect(referencia).toBe('09/2026');
    expect(itens).toHaveLength(6);
    expect(itens.map((i) => i.valor)).toEqual([
      27.9, 184.35, 49.9, 62.8, 15.0, 210.45,
    ]);
  });

  test('CT-UC03-09 recusa PDF valido porem sem lancamentos', async () => {
    const texto = await extrairTexto(fs.readFileSync(PDF_SEM_LANCAMENTOS));
    expect(() => parseExtrato(texto)).toThrow(/Nenhum lancamento reconhecido/);
  });

  test('CT-UC04-09 conciliacao ponta a ponta do cenario da demonstracao', async () => {
    const texto = await extrairTexto(fs.readFileSync(PDF_VALIDO));
    const { itens } = parseExtrato(texto);
    const itensComId = itens.map((i, idx) => ({ ...i, id: idx + 1 }));

    const r = conciliar(GASTOS_CADASTRADOS, itensComId);

    expect(r.resumo.qtd_conciliados).toBe(3); // Uber, Mercado, Farmacia
    expect(r.resumo.qtd_divergentes).toBe(1); // streaming 39,90 x 49,90
    expect(r.resumo.qtd_so_no_extrato).toBe(2); // Padaria e Posto
    expect(r.resumo.qtd_so_no_sistema).toBe(1); // Livraria Tecnica
    expect(r.resumo.total_extrato).toBe(550.4);
    expect(r.resumo.percentual_conciliado).toBe(50);
  });
});
