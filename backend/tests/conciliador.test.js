const { conciliar, similaridade, diferencaEmDias } = require('../src/conciliador');

const gastos = [
  { id: 1, descricao: 'Uber para a faculdade', valor: 27.9, data_gasto: '2026-09-05' },
  { id: 2, descricao: 'Mercado Sao Jorge', valor: 184.35, data_gasto: '2026-09-07' },
  { id: 3, descricao: 'Assinatura de streaming', valor: 39.9, data_gasto: '2026-09-10' },
  { id: 4, descricao: 'Livraria Tecnica', valor: 119.0, data_gasto: '2026-09-15' },
];

const itensExtrato = [
  { id: 10, descricao: 'UBER TRIP SAO PAULO', valor: 27.9, data_lancamento: '2026-09-06' },
  { id: 11, descricao: 'MERCADO SAO JORGE', valor: 184.35, data_lancamento: '2026-09-07' },
  { id: 12, descricao: 'ASSINATURA STREAMING', valor: 49.9, data_lancamento: '2026-09-10' },
  { id: 13, descricao: 'PADARIA CENTRAL', valor: 15.0, data_lancamento: '2026-09-18' },
];

describe('CT-UC04 - Regras de conciliacao', () => {
  const r = conciliar(gastos, itensExtrato);

  test('CT-UC04-01 concilia por valor igual e data dentro de 3 dias (RN-01)', () => {
    expect(r.resumo.qtd_conciliados).toBe(2);
    expect(r.conciliados.map((c) => c.gasto.id).sort()).toEqual([1, 2]);
  });

  test('CT-UC04-02 aponta divergencia de valor com descricao semelhante (RN-03)', () => {
    expect(r.resumo.qtd_divergentes).toBe(1);
    expect(r.divergentes[0].gasto.id).toBe(3);
    expect(r.divergentes[0].diferenca_valor).toBe(10);
  });

  test('CT-UC04-03 aponta lancamento existente somente no extrato (RN-04)', () => {
    expect(r.resumo.qtd_so_no_extrato).toBe(1);
    expect(r.so_no_extrato[0].extrato.descricao).toBe('PADARIA CENTRAL');
  });

  test('CT-UC04-04 aponta gasto existente somente no sistema (RN-05)', () => {
    expect(r.resumo.qtd_so_no_sistema).toBe(1);
    expect(r.so_no_sistema[0].gasto.id).toBe(4);
  });

  test('CT-UC04-05 calcula a diferenca entre os totais', () => {
    expect(r.resumo.total_extrato).toBe(277.15);
    expect(r.resumo.total_sistema).toBe(371.15);
    expect(r.resumo.diferenca_total).toBe(-94);
  });

  test('CT-UC04-06 nao concilia o mesmo gasto duas vezes (RN-02)', () => {
    const duplicado = conciliar(
      [{ id: 1, descricao: 'Cafe', valor: 10, data_gasto: '2026-09-01' }],
      [
        { id: 20, descricao: 'CAFETERIA', valor: 10, data_lancamento: '2026-09-01' },
        { id: 21, descricao: 'CAFETERIA', valor: 10, data_lancamento: '2026-09-02' },
      ]
    );
    expect(duplicado.resumo.qtd_conciliados).toBe(1);
    expect(duplicado.resumo.qtd_so_no_extrato).toBe(1);
  });

  test('CT-UC04-07 nao concilia quando a data excede a tolerancia de 3 dias', () => {
    const fora = conciliar(
      [{ id: 1, descricao: 'Cinema', valor: 50, data_gasto: '2026-09-01' }],
      [{ id: 30, descricao: 'CINEMA XPTO', valor: 50, data_lancamento: '2026-09-20' }]
    );
    expect(fora.resumo.qtd_conciliados).toBe(0);
  });

  test('CT-UC04-08 extrato vazio resulta em 0% de conciliacao', () => {
    const vazio = conciliar(gastos, []);
    expect(vazio.resumo.percentual_conciliado).toBe(0);
    expect(vazio.resumo.qtd_so_no_sistema).toBe(4);
  });

  test('funcoes auxiliares', () => {
    expect(diferencaEmDias('2026-09-01', '2026-09-04')).toBe(3);
    expect(similaridade('Mercado Sao Jorge', 'MERCADO SAO JORGE')).toBe(1);
    expect(similaridade('Uber', 'Padaria')).toBe(0);
  });
});
