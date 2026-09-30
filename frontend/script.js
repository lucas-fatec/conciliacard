/* =========================================================
   ConciliaCard - frontend
   Sprint #1 - FATEC Ipiranga / Lab. de Engenharia de Software
   ========================================================= */

const API = '/api';

/* ---------- sessao ---------- */
function salvarSessao(dados) {
  sessionStorage.setItem('token', dados.token);
  sessionStorage.setItem('usuario', JSON.stringify(dados.usuario));
}
function token() { return sessionStorage.getItem('token'); }
function usuarioLogado() {
  try { return JSON.parse(sessionStorage.getItem('usuario')); } catch (e) { return null; }
}
function sair() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

/* ---------- utilitarios ---------- */
function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function dataBr(iso) {
  if (!iso) return '-';
  const [a, m, d] = String(iso).substring(0, 10).split('-');
  return `${d}/${m}/${a}`;
}
function alertar(texto, tipo) {
  const el = document.getElementById('alerta');
  if (!el) { alert(texto); return; }
  el.textContent = texto;
  el.className = 'alerta ' + (tipo || 'info');
  setTimeout(() => { el.className = 'alerta oculto'; }, 4500);
}

async function chamarApi(caminho, opcoes) {
  const config = opcoes || {};
  config.headers = config.headers || {};
  if (token()) config.headers.Authorization = 'Bearer ' + token();
  if (config.body && !(config.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
  }

  const resposta = await fetch(API + caminho, config);
  if (resposta.status === 401) {
    alertar('Sessao expirada. Faca login novamente.', 'erro');
    setTimeout(sair, 1500);
    throw new Error('nao autorizado');
  }
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(dados.erro || 'Erro na requisicao.');
  return dados;
}

/* =========================================================
   UC01 - Autenticacao (tela de acesso)
   ========================================================= */
function trocarAba(aba) {
  const ehLogin = aba === 'login';
  document.getElementById('form-login').classList.toggle('oculto', !ehLogin);
  document.getElementById('form-cadastro').classList.toggle('oculto', ehLogin);
  document.getElementById('aba-login').classList.toggle('ativa', ehLogin);
  document.getElementById('aba-cadastro').classList.toggle('ativa', !ehLogin);
  mensagemAcesso('');
}

function mensagemAcesso(texto, tipo) {
  const el = document.getElementById('mensagem-acesso');
  if (!el) return;
  el.textContent = texto || '';
  el.className = texto ? 'mensagem ' + (tipo || 'erro') : 'mensagem oculto';
}

async function entrar() {
  const email = document.getElementById('login-email').value.trim();
  const senha = document.getElementById('login-senha').value;
  if (!email || !senha) { mensagemAcesso('Informe e-mail e senha.'); return; }
  try {
    const dados = await chamarApi('/auth/login', {
      method: 'POST', body: JSON.stringify({ email, senha }),
    });
    salvarSessao(dados);
    window.location.href = 'app.html';
  } catch (e) {
    mensagemAcesso(e.message);
  }
}

async function cadastrar() {
  const nome = document.getElementById('cad-nome').value.trim();
  const email = document.getElementById('cad-email').value.trim();
  const senha = document.getElementById('cad-senha').value;
  try {
    const dados = await chamarApi('/auth/cadastro', {
      method: 'POST', body: JSON.stringify({ nome, email, senha }),
    });
    salvarSessao(dados);
    window.location.href = 'app.html';
  } catch (e) {
    mensagemAcesso(e.message);
  }
}

/* =========================================================
   Painel (app.html)
   ========================================================= */
let gastoEmEdicao = null;
let extratoSelecionado = null;

function iniciarPainel() {
  if (!token()) { window.location.href = 'index.html'; return; }
  const u = usuarioLogado();
  document.getElementById('nome-usuario').textContent = u ? u.nome : '';
  document.getElementById('data').valueAsDate = new Date();
  listarGastos();
  listarExtratos();
}

/* ---------- UC02 - Manter gastos ---------- */
async function listarGastos() {
  const corpo = document.getElementById('tabela-gastos');
  try {
    const gastos = await chamarApi('/gastos');
    if (gastos.length === 0) {
      corpo.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum gasto cadastrado.</td></tr>';
      document.getElementById('total-gastos').textContent = moeda(0);
      return;
    }
    corpo.innerHTML = gastos.map((g) => `
      <tr>
        <td>${g.id}</td>
        <td>${dataBr(g.data_gasto)}</td>
        <td>${g.descricao}</td>
        <td>${g.categoria}</td>
        <td class="direita">${moeda(g.valor)}</td>
        <td class="centro">
          <button class="botao-texto" onclick="editarGasto(${g.id})">Editar</button>
          <button class="botao-texto perigo" onclick="excluirGasto(${g.id})">Excluir</button>
        </td>
      </tr>`).join('');
    const total = gastos.reduce((a, g) => a + Number(g.valor), 0);
    document.getElementById('total-gastos').textContent = moeda(total);
    window.__gastos = gastos;
  } catch (e) {
    alertar(e.message, 'erro');
  }
}

function limparFormulario() {
  gastoEmEdicao = null;
  document.getElementById('descricao').value = '';
  document.getElementById('valor').value = '';
  document.getElementById('data').valueAsDate = new Date();
  document.getElementById('categoria').value = 'Alimentacao';
  document.getElementById('btn-salvar').textContent = 'Incluir';
}

function editarGasto(id) {
  const g = (window.__gastos || []).find((x) => x.id === id);
  if (!g) return;
  gastoEmEdicao = id;
  document.getElementById('descricao').value = g.descricao;
  document.getElementById('valor').value = g.valor;
  document.getElementById('data').value = String(g.data_gasto).substring(0, 10);
  document.getElementById('categoria').value = g.categoria;
  document.getElementById('btn-salvar').textContent = 'Salvar alteracao';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function salvarGasto() {
  const corpo = {
    descricao: document.getElementById('descricao').value.trim(),
    valor: document.getElementById('valor').value,
    data_gasto: document.getElementById('data').value,
    categoria: document.getElementById('categoria').value,
  };
  try {
    const resposta = gastoEmEdicao
      ? await chamarApi('/gastos/' + gastoEmEdicao, { method: 'PUT', body: JSON.stringify(corpo) })
      : await chamarApi('/gastos', { method: 'POST', body: JSON.stringify(corpo) });
    alertar(resposta.mensagem || 'Operacao realizada.', 'sucesso');
    limparFormulario();
    listarGastos();
    if (extratoSelecionado) conciliar(extratoSelecionado);
  } catch (e) {
    alertar(e.message, 'erro');
  }
}

async function excluirGasto(id) {
  if (!confirm('Confirma a exclusao do gasto ' + id + '?')) return;
  try {
    const r = await chamarApi('/gastos/' + id, { method: 'DELETE' });
    alertar(r.mensagem, 'sucesso');
    listarGastos();
    if (extratoSelecionado) conciliar(extratoSelecionado);
  } catch (e) {
    alertar(e.message, 'erro');
  }
}

/* ---------- UC03 - Importar extrato ---------- */
async function listarExtratos() {
  const corpo = document.getElementById('tabela-extratos');
  try {
    const extratos = await chamarApi('/extratos');
    if (extratos.length === 0) {
      corpo.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum extrato importado.</td></tr>';
      return;
    }
    corpo.innerHTML = extratos.map((e) => `
      <tr>
        <td>${e.id}</td>
        <td>${e.nome_arquivo}</td>
        <td>${e.referencia || '-'}</td>
        <td class="centro">${e.total_itens}</td>
        <td class="direita">${moeda(e.valor_total)}</td>
        <td class="centro"><button class="botao-secundario" onclick="conciliar(${e.id})">Conciliar</button></td>
      </tr>`).join('');
  } catch (e) {
    alertar(e.message, 'erro');
  }
}

async function importarExtrato() {
  const campo = document.getElementById('arquivo');
  if (!campo.files || campo.files.length === 0) {
    alertar('Selecione o arquivo PDF do extrato.', 'erro');
    return;
  }
  const dados = new FormData();
  dados.append('arquivo', campo.files[0]);
  try {
    const r = await chamarApi('/extratos', { method: 'POST', body: dados });
    alertar(r.mensagem, 'sucesso');
    campo.value = '';
    await listarExtratos();
    conciliar(r.id);
  } catch (e) {
    alertar(e.message, 'erro');
  }
}

/* ---------- UC04 - Conciliacao ---------- */
const ROTULOS = {
  CONCILIADO: { texto: 'Conciliado', classe: 'ok' },
  DIVERGENTE: { texto: 'Valor divergente', classe: 'atencao' },
  SO_NO_EXTRATO: { texto: 'Nao cadastrado', classe: 'erro' },
  SO_NO_SISTEMA: { texto: 'Nao faturado', classe: 'neutro' },
};

async function conciliar(extratoId) {
  extratoSelecionado = extratoId;
  try {
    const r = await chamarApi('/conciliacao/' + extratoId);
    const s = r.resumo;

    document.getElementById('legenda-conciliacao').textContent =
      `Extrato #${r.extrato.id} - ${r.extrato.nome_arquivo} (referencia ${r.extrato.referencia || '-'})`;

    document.getElementById('indicadores').innerHTML = `
      <div class="indicador ok"><span>${s.qtd_conciliados}</span>Conciliados</div>
      <div class="indicador atencao"><span>${s.qtd_divergentes}</span>Divergentes</div>
      <div class="indicador erro"><span>${s.qtd_so_no_extrato}</span>Nao cadastrados</div>
      <div class="indicador neutro"><span>${s.qtd_so_no_sistema}</span>Nao faturados</div>
      <div class="indicador total"><span>${s.percentual_conciliado}%</span>Conciliacao</div>
      <div class="indicador total"><span>${moeda(s.diferenca_total)}</span>Diferenca de totais</div>`;

    const linhas = [...r.conciliados, ...r.divergentes, ...r.so_no_extrato, ...r.so_no_sistema];
    document.getElementById('tabela-conciliacao').innerHTML = linhas.map((l) => {
      const rot = ROTULOS[l.status];
      return `<tr>
        <td><span class="etiqueta ${rot.classe}">${rot.texto}</span></td>
        <td>${l.extrato ? dataBr(l.extrato.data_lancamento) + ' - ' + l.extrato.descricao : '-'}</td>
        <td>${l.gasto ? dataBr(l.gasto.data_gasto) + ' - ' + l.gasto.descricao : '-'}</td>
        <td class="direita">${l.extrato ? moeda(l.extrato.valor) : '-'}</td>
        <td class="direita">${l.gasto ? moeda(l.gasto.valor) : '-'}</td>
        <td class="direita">${l.status === 'DIVERGENTE' ? moeda(l.diferenca_valor) : '-'}</td>
      </tr>`;
    }).join('');
  } catch (e) {
    alertar(e.message, 'erro');
  }
}
