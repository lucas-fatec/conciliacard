/**
 * auth.js - UC01 Autenticacao de Usuario
 */
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const SEGREDO = process.env.JWT_SECRET || 'conciliacard-sprint1-fatec';
const EXPIRACAO = '8h';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// RN-06 Senha com no minimo 8 caracteres, contendo maiuscula, minuscula, numero e simbolo
const SENHA_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function validarCredenciais(email, senha) {
  const erros = [];
  if (!EMAIL_REGEX.test(String(email || ''))) erros.push('E-mail invalido.');
  if (!SENHA_REGEX.test(String(senha || '')))
    erros.push(
      'A senha deve ter no minimo 8 caracteres, incluindo letra maiuscula, minuscula, numero e caractere especial.'
    );
  return erros;
}

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, email: usuario.email, nome: usuario.nome },
    SEGREDO,
    { expiresIn: EXPIRACAO }
  );
}

/** Middleware: exige token valido no header Authorization: Bearer <token> */
function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  if (!token) {
    return res.status(401).json({ erro: 'Token nao informado.' });
  }
  try {
    req.usuario = jwt.verify(token, SEGREDO);
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Sessao expirada ou token invalido.' });
  }
}

async function cadastrar(req, res) {
  const { nome, email, senha } = req.body || {};

  if (!nome || String(nome).trim().length < 3) {
    return res.status(400).json({ erro: 'Informe o nome completo.' });
  }
  const erros = validarCredenciais(email, senha);
  if (erros.length > 0) return res.status(400).json({ erro: erros.join(' ') });

  try {
    const [existe] = await pool.query(
      'SELECT id FROM usuario WHERE email = ?',
      [email]
    );
    if (existe.length > 0) {
      return res.status(409).json({ erro: 'E-mail ja cadastrado.' });
    }

    const hash = await bcrypt.hash(String(senha), 10);
    const [resultado] = await pool.query(
      'INSERT INTO usuario (nome, email, senha_hash) VALUES (?, ?, ?)',
      [String(nome).trim(), String(email).toLowerCase(), hash]
    );

    const usuario = { id: resultado.insertId, nome, email };
    return res.status(201).json({ usuario, token: gerarToken(usuario) });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: 'Erro ao cadastrar usuario.' });
  }
}

async function login(req, res) {
  const { email, senha } = req.body || {};
  if (!email || !senha) {
    return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  }

  try {
    const [linhas] = await pool.query(
      'SELECT id, nome, email, senha_hash, ativo FROM usuario WHERE email = ?',
      [String(email).toLowerCase()]
    );

    if (linhas.length === 0) {
      return res.status(401).json({ erro: 'E-mail invalido.' });
    }

    const usuario = linhas[0];
    if (usuario.ativo !== 1) {
      return res
        .status(403)
        .json({ erro: 'Usuario inativo. Procure o administrador.' });
    }

    const senhaOk = await bcrypt.compare(String(senha), usuario.senha_hash);
    if (!senhaOk) {
      return res.status(401).json({ erro: 'Senha invalida.' });
    }

    const dados = { id: usuario.id, nome: usuario.nome, email: usuario.email };
    return res.json({ usuario: dados, token: gerarToken(dados) });
  } catch (erro) {
    console.error(erro);
    return res.status(500).json({ erro: 'Erro ao autenticar usuario.' });
  }
}

module.exports = { cadastrar, login, autenticar, validarCredenciais, gerarToken };
