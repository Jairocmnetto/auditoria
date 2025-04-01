require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Endpoint POST para salvar respostas
app.post('/auditoria', async (req, res) => {
  try {
    const { respostas } = req.body;

    if (!respostas || typeof respostas !== 'object') {
      return res.status(400).json({ error: 'Formato inválido de respostas.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const [pergunta_id, { status, evidencia }] of Object.entries(respostas)) {
        if (!pergunta_id || !status || !evidencia) {
          return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
        }

        await client.query(
          `INSERT INTO respostas (pergunta_id, resposta, evidencia) VALUES ($1, $2, $3)`,
          [pergunta_id, status === "Conforme", evidencia]
        );
      }

      await client.query('COMMIT');
      client.release();
      return res.status(201).json({ message: 'Respostas salvas com sucesso!' });
    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      console.error('Erro ao inserir respostas:', error);
      return res.status(500).json({ error: 'Erro ao salvar as respostas.' });
    }
  } catch (error) {
    console.error('Erro geral:', error);
    return res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// Endpoint GET para buscar respostas
app.get('/auditoria', async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT * FROM respostas ORDER BY id DESC');
    client.release();
    return res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar respostas:', error);
    return res.status(500).json({ error: 'Erro ao buscar respostas.' });
  }
});

app.listen(process.env.PORT || 4000, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT || 4000}`);
});
