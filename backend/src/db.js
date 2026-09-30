const mysql = require('mysql2/promise');

// Em Docker Compose o host e o NOME DO SERVICO do banco (db-conciliacard).
// Fora do Docker, use DB_HOST=localhost.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db-conciliacard',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'conciliacard',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
});

async function aguardarBanco(tentativas = 20, intervaloMs = 3000) {
  for (let i = 1; i <= tentativas; i++) {
    try {
      const conexao = await pool.getConnection();
      await conexao.ping();
      conexao.release();
      console.log('Conectado ao MySQL.');
      return;
    } catch (erro) {
      console.log(
        `MySQL indisponivel (tentativa ${i}/${tentativas}): ${erro.code || erro.message}`
      );
      await new Promise((r) => setTimeout(r, intervaloMs));
    }
  }
  throw new Error('Nao foi possivel conectar ao MySQL.');
}

module.exports = { pool, aguardarBanco };
