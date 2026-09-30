/**
 * conciliador.js
 * Regras de negocio da conciliacao (UC04).
 *
 * RN-01 Um lancamento do extrato e considerado CONCILIADO com um gasto
 *       cadastrado quando o valor e identico (tolerancia de R$ 0,01) e a
 *       diferenca entre as datas e de no maximo 3 dias.
 * RN-02 Cada gasto so pode ser conciliado com um unico lancamento do extrato.
 * RN-03 Quando as descricoes sao semelhantes (>= 50% de palavras em comum) mas
 *       o valor difere, o par e marcado como DIVERGENTE (possivel erro de digitacao).
 * RN-04 Lancamento presente somente no extrato = SO_NO_EXTRATO (gasto nao registrado).
 * RN-05 Gasto presente somente no sistema = SO_NO_SISTEMA (lancamento nao faturado).
 *
 * Funcoes puras (sem banco e sem I/O) para permitir teste unitario.
 */

const TOLERANCIA_VALOR = 0.01;
const TOLERANCIA_DIAS = 3;
const SIMILARIDADE_MINIMA = 0.5;

function diferencaEmDias(dataA, dataB) {
  const ms = Math.abs(new Date(dataA).getTime() - new Date(dataB).getTime());
  return Math.round(ms / 86400000);
}

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Similaridade por sobreposicao de palavras (indice de Jaccard simplificado) */
function similaridade(textoA, textoB) {
  const a = new Set(normalizar(textoA).split(' ').filter((p) => p.length > 2));
  const b = new Set(normalizar(textoB).split(' ').filter((p) => p.length > 2));
  if (a.size === 0 || b.size === 0) return 0;
  let comuns = 0;
  for (const palavra of a) if (b.has(palavra)) comuns++;
  return comuns / Math.min(a.size, b.size);
}

function mesmoValor(a, b) {
  return Math.abs(Number(a) - Number(b)) <= TOLERANCIA_VALOR;
}

/**
 * @param {Array} gastos       [{id, descricao, valor, data_gasto}]
 * @param {Array} itensExtrato [{id, descricao, valor, data_lancamento}]
 */
function conciliar(gastos, itensExtrato) {
  const listaGastos = (gastos || []).map((g) => ({ ...g, usado: false }));
  const conciliados = [];
  const divergentes = [];
  const soNoExtrato = [];

  for (const item of itensExtrato || []) {
    // 1a passada: valor e data compativeis (RN-01)
    let par = listaGastos.find(
      (g) =>
        !g.usado &&
        mesmoValor(g.valor, item.valor) &&
        diferencaEmDias(g.data_gasto, item.data_lancamento) <= TOLERANCIA_DIAS
    );

    if (par) {
      par.usado = true; // RN-02
      conciliados.push({
        status: 'CONCILIADO',
        extrato: item,
        gasto: par,
        diferenca_valor: 0,
        diferenca_dias: diferencaEmDias(par.data_gasto, item.data_lancamento),
      });
      continue;
    }

    // 2a passada: descricao semelhante mas valor diferente (RN-03)
    par = listaGastos.find(
      (g) =>
        !g.usado &&
        similaridade(g.descricao, item.descricao) >= SIMILARIDADE_MINIMA &&
        !mesmoValor(g.valor, item.valor)
    );

    if (par) {
      par.usado = true;
      divergentes.push({
        status: 'DIVERGENTE',
        extrato: item,
        gasto: par,
        diferenca_valor: Number((item.valor - par.valor).toFixed(2)),
        diferenca_dias: diferencaEmDias(par.data_gasto, item.data_lancamento),
      });
      continue;
    }

    // RN-04
    soNoExtrato.push({ status: 'SO_NO_EXTRATO', extrato: item, gasto: null });
  }

  // RN-05
  const soNoSistema = listaGastos
    .filter((g) => !g.usado)
    .map((g) => ({ status: 'SO_NO_SISTEMA', extrato: null, gasto: g }));

  const soma = (lista, campo, sub) =>
    Number(
      lista
        .reduce((acc, r) => acc + Number((sub ? r[sub] : r)[campo] || 0), 0)
        .toFixed(2)
    );

  const totalExtrato = Number(
    (itensExtrato || []).reduce((a, i) => a + Number(i.valor), 0).toFixed(2)
  );
  const totalSistema = Number(
    listaGastos.reduce((a, g) => a + Number(g.valor), 0).toFixed(2)
  );

  return {
    resumo: {
      qtd_extrato: (itensExtrato || []).length,
      qtd_sistema: listaGastos.length,
      qtd_conciliados: conciliados.length,
      qtd_divergentes: divergentes.length,
      qtd_so_no_extrato: soNoExtrato.length,
      qtd_so_no_sistema: soNoSistema.length,
      total_extrato: totalExtrato,
      total_sistema: totalSistema,
      diferenca_total: Number((totalExtrato - totalSistema).toFixed(2)),
      valor_conciliado: soma(conciliados, 'valor', 'extrato'),
      percentual_conciliado:
        (itensExtrato || []).length === 0
          ? 0
          : Math.round((conciliados.length / itensExtrato.length) * 100),
    },
    conciliados,
    divergentes,
    so_no_extrato: soNoExtrato,
    so_no_sistema: soNoSistema,
  };
}

module.exports = { conciliar, similaridade, diferencaEmDias, normalizar };
