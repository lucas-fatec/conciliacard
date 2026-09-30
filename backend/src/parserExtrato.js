/**
 * parserExtrato.js
 * Converte o TEXTO extraido de um extrato de cartao em PDF
 * numa lista de lancamentos estruturados.
 *
 * Formato de linha esperado no extrato:
 *   05/09/2026   UBER TRIP SAO PAULO            R$ 27,90
 *
 * Funcao pura (sem banco e sem I/O) para permitir teste unitario.
 */

// dd/mm/aaaa  <descricao>  <valor em formato brasileiro>
const LINHA_REGEX =
  /^\s*(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(?:R\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2})\s*$/;

const REFERENCIA_REGEX = /fatura\s+(?:de\s+)?(\d{2}\/\d{4})/i;

/** Converte "1.234,56" -> 1234.56 */
function paraNumero(valorBr) {
  return Number(valorBr.replace(/\./g, '').replace(',', '.'));
}

/** Converte "05/09/2026" -> "2026-09-05" */
function paraDataIso(dataBr) {
  const [dia, mes, ano] = dataBr.split('/');
  return `${ano}-${mes}-${dia}`;
}

/** Normaliza descricao: maiusculas, sem acento e sem espaco duplicado */
function normalizarDescricao(texto) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} texto Texto bruto extraido do PDF
 * @returns {{referencia: string|null, itens: Array, linhasIgnoradas: number}}
 */
function parseExtrato(texto) {
  if (typeof texto !== 'string' || texto.trim() === '') {
    const erro = new Error('Extrato vazio ou ilegivel.');
    erro.codigo = 'EXTRATO_VAZIO';
    throw erro;
  }

  const linhas = texto.split(/\r?\n/);
  const itens = [];
  let linhasIgnoradas = 0;
  let referencia = null;

  for (const linha of linhas) {
    if (!referencia) {
      const ref = linha.match(REFERENCIA_REGEX);
      if (ref) referencia = ref[1];
    }

    const m = linha.match(LINHA_REGEX);
    if (!m) {
      if (linha.trim() !== '') linhasIgnoradas++;
      continue;
    }

    const valor = paraNumero(m[3]);
    // Pagamentos e creditos (valores negativos) nao entram na conciliacao de gastos
    if (valor <= 0) {
      linhasIgnoradas++;
      continue;
    }

    itens.push({
      data_lancamento: paraDataIso(m[1]),
      descricao: normalizarDescricao(m[2]),
      valor: Number(valor.toFixed(2)),
    });
  }

  if (itens.length === 0) {
    const erro = new Error(
      'Nenhum lancamento reconhecido. Verifique se o arquivo e um extrato valido.'
    );
    erro.codigo = 'EXTRATO_SEM_LANCAMENTOS';
    throw erro;
  }

  return { referencia, itens, linhasIgnoradas };
}

module.exports = { parseExtrato, paraNumero, paraDataIso, normalizarDescricao };
