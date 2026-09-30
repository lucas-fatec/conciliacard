const { parseExtrato, paraNumero, paraDataIso } = require('../src/parserExtrato');

const EXTRATO_VALIDO = `
BANCO FICTICIO S.A.
Extrato do cartao de credito - Fatura de 09/2026
Titular: Usuario de Teste

Data         Estabelecimento              Valor
05/09/2026   UBER TRIP SAO PAULO          R$ 27,90
07/09/2026   MERCADO SAO JORGE            R$ 184,35
10/09/2026   STREAMING ASSINATURA         R$ 39,90
12/09/2026   FARMACIA BEM ESTAR           R$ 62,80
18/09/2026   PADARIA CENTRAL              R$ 15,00
20/09/2026   PAGAMENTO FATURA ANTERIOR    R$ -500,00

Total desta fatura: R$ 329,95
`;

describe('CT-UC03 - Parser do extrato em PDF', () => {
  test('CT-UC03-01 converte valores em formato brasileiro', () => {
    expect(paraNumero('27,90')).toBe(27.9);
    expect(paraNumero('1.234,56')).toBe(1234.56);
  });

  test('CT-UC03-02 converte datas dd/mm/aaaa para ISO', () => {
    expect(paraDataIso('05/09/2026')).toBe('2026-09-05');
  });

  test('CT-UC03-03 extrai todos os lancamentos de debito do extrato', () => {
    const { itens } = parseExtrato(EXTRATO_VALIDO);
    expect(itens).toHaveLength(5);
    expect(itens[0]).toEqual({
      data_lancamento: '2026-09-05',
      descricao: 'UBER TRIP SAO PAULO',
      valor: 27.9,
    });
  });

  test('CT-UC03-04 identifica a referencia da fatura', () => {
    expect(parseExtrato(EXTRATO_VALIDO).referencia).toBe('09/2026');
  });

  test('CT-UC03-05 ignora pagamentos e creditos (valores negativos)', () => {
    const { itens } = parseExtrato(EXTRATO_VALIDO);
    expect(itens.some((i) => i.valor < 0)).toBe(false);
    expect(itens.some((i) => i.descricao.includes('PAGAMENTO'))).toBe(false);
  });

  test('CT-UC03-06 rejeita arquivo sem lancamentos reconheciveis', () => {
    expect(() => parseExtrato('Documento qualquer sem lancamentos.')).toThrow(
      /Nenhum lancamento reconhecido/
    );
  });

  test('CT-UC03-07 rejeita conteudo vazio', () => {
    expect(() => parseExtrato('   ')).toThrow(/vazio ou ilegivel/);
  });
});
