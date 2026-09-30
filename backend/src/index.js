/**
 * index.js - API do ConciliaCard (Sprint #1)
 *
 * UC01 Autenticacao ......... POST /api/auth/cadastro | POST /api/auth/login
 * UC02 Manter gastos ........ CRUD /api/gastos
 * UC03 Importar extrato ..... POST /api/extratos  (upload de PDF)
 * UC04 Conciliar ............ GET  /api/conciliacao/:extratoId
 */
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { extrairTexto } = require('./pdfTexto');

const { pool, aguardarBanco } = require('./db');
const { cadastrar, login, autenticar } = require('./auth');
const { parseExtrato } = require('./parserExtrato');
const { conciliar } = require('./conciliador');

const app = express();
const PORTA = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

// RNF-03 Upload limitado a 5 MB e somente arquivos PDF
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, arquivo, cb) => {
    if (arquivo.mimetype !== 'application/pdf') {
      return cb(new Error('FORMATO_INVALIDO'));
    }
    cb(null, true);
  },
});

// ------------------------------------------------------------------
// Monitoramento
// ------------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', banco: 'ok' });
  } catch (e) {
    res.status(503).json({ status: 'degradado', banco: 'indisponivel' });
  }
});

// ------------------------------------------------------------------
// UC01 - Autenticacao
// ------------------------------------------------------------------
app.post('/api/auth/cadastro', cadastrar);
app.post('/api/auth/login', login);

// ------------------------------------------------------------------
// UC02 - Manter lancamentos de gastos
// ------------------------------------------------------------------
function validarGasto(corpo) {
  const erros = [];
  const { descricao, valor, data_gasto } = corpo || {};

  if (!descricao || String(descricao).trim().length < 3) {
    erros.push('A descricao deve ter no minimo 3 caracteres.');
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0) {
    erros.push('O valor deve ser um numero maior que zero.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data_gasto || ''))) {
    erros.push('A data deve estar no formato AAAA-MM-DD.');
  } else if (new Date(data_gasto) > new Date()) {
    erros.push('A data do gasto nao pode ser futura.');
  }
  return erros;
}

app.get('/api/gastos', autenticar, async (req, res) => {
  try {
    const [linhas] = await pool.query(
      `SELECT id, descricao, valor, data_gasto, categoria
         FROM gasto WHERE usuario_id = ?
        ORDER BY data_gasto DESC, id DESC`,
      [req.usuario.id]
    );
    res.json(linhas.map((g) => ({ ...g, valor: Number(g.valor) })));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar gastos.' });
  }
});

app.post('/api/gastos', autenticar, async (req, res) => {
  const erros = validarGasto(req.body);
  if (erros.length > 0) return res.status(400).json({ erro: erros.join(' ') });

  const { descricao, valor, data_gasto, categoria } = req.body;
  try {
    const [r] = await pool.query(
      `INSERT INTO gasto (usuario_id, descricao, valor, data_gasto, categoria)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.usuario.id,
        String(descricao).trim(),
        Number(valor),
        data_gasto,
        categoria || 'Outros',
      ]
    );
    res.status(201).json({ id: r.insertId, mensagem: 'Gasto incluido com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao incluir gasto.' });
  }
});

app.put('/api/gastos/:id', autenticar, async (req, res) => {
  const erros = validarGasto(req.body);
  if (erros.length > 0) return res.status(400).json({ erro: erros.join(' ') });

  const { descricao, valor, data_gasto, categoria } = req.body;
  try {
    const [r] = await pool.query(
      `UPDATE gasto SET descricao = ?, valor = ?, data_gasto = ?, categoria = ?
        WHERE id = ? AND usuario_id = ?`,
      [
        String(descricao).trim(),
        Number(valor),
        data_gasto,
        categoria || 'Outros',
        req.params.id,
        req.usuario.id,
      ]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ erro: 'Gasto nao encontrado.' });
    }
    res.json({ mensagem: 'Gasto alterado com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao alterar gasto.' });
  }
});

app.delete('/api/gastos/:id', autenticar, async (req, res) => {
  try {
    const [r] = await pool.query(
      'DELETE FROM gasto WHERE id = ? AND usuario_id = ?',
      [req.params.id, req.usuario.id]
    );
    if (r.affectedRows === 0) {
      return res.status(404).json({ erro: 'Gasto nao encontrado.' });
    }
    res.json({ mensagem: 'Gasto excluido com sucesso.' });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao excluir gasto.' });
  }
});

// ------------------------------------------------------------------
// UC03 - Importar extrato em PDF
// ------------------------------------------------------------------
app.post(
  '/api/extratos',
  autenticar,
  (req, res, next) => {
    upload.single('arquivo')(req, res, (erro) => {
      if (!erro) return next();
      if (erro.message === 'FORMATO_INVALIDO') {
        return res
          .status(400)
          .json({ erro: 'Formato de arquivo invalido. Envie um extrato em PDF.' });
      }
      if (erro.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ erro: 'Arquivo maior que o limite de 5 MB.' });
      }
      return res.status(400).json({ erro: 'Falha no envio do arquivo.' });
    });
  },
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo foi enviado.' });
    }

    let conexao;
    try {
      const texto = await extrairTexto(req.file.buffer);
      const { referencia, itens, linhasIgnoradas } = parseExtrato(texto);
      const valorTotal = Number(
        itens.reduce((a, i) => a + i.valor, 0).toFixed(2)
      );

      conexao = await pool.getConnection();
      await conexao.beginTransaction();

      const [r] = await conexao.query(
        `INSERT INTO extrato (usuario_id, nome_arquivo, referencia, total_itens, valor_total)
         VALUES (?, ?, ?, ?, ?)`,
        [
          req.usuario.id,
          req.file.originalname,
          referencia,
          itens.length,
          valorTotal,
        ]
      );
      const extratoId = r.insertId;

      await conexao.query(
        `INSERT INTO extrato_item (extrato_id, data_lancamento, descricao, valor)
         VALUES ?`,
        [itens.map((i) => [extratoId, i.data_lancamento, i.descricao, i.valor])]
      );

      await conexao.commit();

      res.status(201).json({
        id: extratoId,
        nome_arquivo: req.file.originalname,
        referencia,
        total_itens: itens.length,
        valor_total: valorTotal,
        linhas_ignoradas: linhasIgnoradas,
        mensagem: `Extrato importado com ${itens.length} lancamento(s).`,
      });
    } catch (erro) {
      if (conexao) await conexao.rollback();
      if (erro.codigo === 'EXTRATO_VAZIO' || erro.codigo === 'EXTRATO_SEM_LANCAMENTOS') {
        return res.status(422).json({ erro: erro.message });
      }
      console.error(erro);
      res.status(500).json({ erro: 'Erro ao processar o extrato.' });
    } finally {
      if (conexao) conexao.release();
    }
  }
);

app.get('/api/extratos', autenticar, async (req, res) => {
  try {
    const [linhas] = await pool.query(
      `SELECT id, nome_arquivo, referencia, total_itens, valor_total, criado_em
         FROM extrato WHERE usuario_id = ? ORDER BY id DESC`,
      [req.usuario.id]
    );
    res.json(linhas.map((e) => ({ ...e, valor_total: Number(e.valor_total) })));
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar extratos.' });
  }
});

// ------------------------------------------------------------------
// UC04 - Conciliacao
// ------------------------------------------------------------------
app.get('/api/conciliacao/:extratoId', autenticar, async (req, res) => {
  try {
    const [extratos] = await pool.query(
      'SELECT id, nome_arquivo, referencia FROM extrato WHERE id = ? AND usuario_id = ?',
      [req.params.extratoId, req.usuario.id]
    );
    if (extratos.length === 0) {
      return res.status(404).json({ erro: 'Extrato nao encontrado.' });
    }

    const [itens] = await pool.query(
      `SELECT id, data_lancamento, descricao, valor
         FROM extrato_item WHERE extrato_id = ? ORDER BY data_lancamento`,
      [req.params.extratoId]
    );
    const [gastos] = await pool.query(
      `SELECT id, descricao, valor, data_gasto, categoria
         FROM gasto WHERE usuario_id = ? ORDER BY data_gasto`,
      [req.usuario.id]
    );

    const resultado = conciliar(
      gastos.map((g) => ({ ...g, valor: Number(g.valor) })),
      itens.map((i) => ({ ...i, valor: Number(i.valor) }))
    );

    res.json({ extrato: extratos[0], ...resultado });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao conciliar extrato.' });
  }
});

// ------------------------------------------------------------------
app.use((req, res) => res.status(404).json({ erro: 'Rota nao encontrada.' }));

aguardarBanco()
  .then(() => {
    app.listen(PORTA, () =>
      console.log(`API ConciliaCard rodando na porta ${PORTA}`)
    );
  })
  .catch((erro) => {
    console.error(erro.message);
    process.exit(1);
  });

module.exports = app;
