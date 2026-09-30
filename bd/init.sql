-- ============================================================
-- Projeto: ConciliaCard - Conciliacao de Extrato de Cartao de Credito
-- Disciplina: Laboratorio de Engenharia de Software - FATEC Ipiranga
-- Script de inicializacao do banco de dados (Sprint #1)
-- ============================================================

CREATE DATABASE IF NOT EXISTS conciliacard;
USE conciliacard;

-- ------------------------------------------------------------
-- UC01 - Autenticacao de Usuario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nome         VARCHAR(120)  NOT NULL,
  email        VARCHAR(160)  NOT NULL UNIQUE,
  senha_hash   VARCHAR(255)  NOT NULL,
  ativo        TINYINT(1)    NOT NULL DEFAULT 1,
  criado_em    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- UC02 - Manter Lancamentos de Gastos (CRUD)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gasto (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id   INT           NOT NULL,
  descricao    VARCHAR(160)  NOT NULL,
  valor        DECIMAL(10,2) NOT NULL,
  data_gasto   DATE          NOT NULL,
  categoria    VARCHAR(60)   NOT NULL DEFAULT 'Outros',
  criado_em    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gasto_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuario(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- UC03 - Importar Extrato (PDF)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS extrato (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id    INT           NOT NULL,
  nome_arquivo  VARCHAR(255)  NOT NULL,
  referencia    VARCHAR(20)   NULL,
  total_itens   INT           NOT NULL DEFAULT 0,
  valor_total   DECIMAL(10,2) NOT NULL DEFAULT 0,
  criado_em     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_extrato_usuario FOREIGN KEY (usuario_id)
    REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS extrato_item (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  extrato_id       INT           NOT NULL,
  data_lancamento  DATE          NOT NULL,
  descricao        VARCHAR(160)  NOT NULL,
  valor            DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_item_extrato FOREIGN KEY (extrato_id)
    REFERENCES extrato(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Massa de dados para teste (usada no Plano de Teste da Sprint #1)
-- Senha do usuario de teste: Senha@2026
-- Hash gerado com bcrypt (10 rounds)
-- ------------------------------------------------------------
INSERT INTO usuario (nome, email, senha_hash, ativo) VALUES
('Usuario de Teste', 'usuario@fatec.sp.gov.br',
 '$2a$10$L0W7.0uQ3rJJMT8Iym3a/.6z00YEg0H7/AwPIPl3/o5PAsDP5fsL.', 1),
('Usuario Inativo', 'inativo@fatec.sp.gov.br',
 '$2a$10$L0W7.0uQ3rJJMT8Iym3a/.6z00YEg0H7/AwPIPl3/o5PAsDP5fsL.', 0);

INSERT INTO gasto (usuario_id, descricao, valor, data_gasto, categoria) VALUES
(1, 'Uber para a faculdade',        27.90,  '2026-09-05', 'Transporte'),
(1, 'Mercado Sao Jorge',           184.35,  '2026-09-07', 'Alimentacao'),
(1, 'Assinatura de streaming',      39.90,  '2026-09-10', 'Lazer'),
(1, 'Farmacia Bem Estar',           62.80,  '2026-09-12', 'Saude'),
(1, 'Livraria Tecnica',            119.00,  '2026-09-15', 'Educacao');
