/**
 * pdfTexto.js
 * Extrai o texto de um arquivo PDF preservando a quebra de linhas,
 * para que o parserExtrato consiga identificar cada lancamento.
 */
const path = require('path');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

const CAMINHO_FONTES = path.join(
  path.dirname(require.resolve('pdfjs-dist/package.json')),
  'standard_fonts/'
);

const TOLERANCIA_LINHA = 2; // variacao vertical aceita dentro da mesma linha

async function extrairTexto(buffer) {
  const documento = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    standardFontDataUrl: CAMINHO_FONTES,
    verbosity: 0,
  }).promise;

  const linhas = [];

  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero);
    const conteudo = await pagina.getTextContent();

    let ultimoY = null;
    let linhaAtual = '';

    for (const item of conteudo.items) {
      const y = item.transform[5];
      if (ultimoY !== null && Math.abs(y - ultimoY) > TOLERANCIA_LINHA) {
        linhas.push(linhaAtual.trim());
        linhaAtual = '';
      }
      linhaAtual += item.str + ' ';
      ultimoY = y;
    }
    linhas.push(linhaAtual.trim());
  }

  await documento.destroy();
  return linhas.join('\n');
}

module.exports = { extrairTexto };
