require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
// Aumenta o limite de payload para 100mb, necessário para imagens em base64
app.use(express.json({ limit: '100mb' }));

// Configuração do armazenamento com multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Pasta onde as imagens serão salvas
  },
  filename: function (req, file, cb) {
    // Gera um nome único para o arquivo
    const ext = path.extname(file.originalname);
    const filename = file.fieldname + '-' + Date.now() + ext;
    cb(null, filename);
  }
});
const upload = multer({ storage });

// Servir arquivos estáticos da pasta uploads
app.use('/uploads', express.static('uploads'));

// Criação do pool de conexões com MySQL
const pool = mysql.createPool({
  host: '10.109.0.12',
  port: 3306,
  user: 'jairo.melo',
  password: 'Data9174',
  database: 'PCP', // Substitua pelo nome do seu banco de dados
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Endpoint POST para upload de imagens
app.post('/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  // Constrói a URL da imagem com base no local onde o servidor está rodando
  const imageUrl = `http://localhost:${process.env.PORT || 4000}/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Endpoint POST para salvar respostas (agora com imagem)
app.post('/auditoria', async (req, res) => {
  try {
    const { respostas } = req.body;

    if (!respostas || typeof respostas !== 'object') {
      return res.status(400).json({ error: 'Formato inválido de respostas.' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const [pergunta_id, { status, evidencia, imagem }] of Object.entries(respostas)) {
        if (!pergunta_id || !status || evidencia === undefined) {
          return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
        }

        await connection.execute(
          `INSERT INTO respostas (pergunta_id, resposta, evidencia, imagem) VALUES (?, ?, ?, ?)`,
          [pergunta_id, status === "Conforme", evidencia, imagem || null]
        );
      }

      await connection.commit();
      connection.release();
      return res.status(201).json({ message: 'Respostas salvas com sucesso!' });
    } catch (error) {
      await connection.rollback();
      connection.release();
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
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT * FROM respostas ORDER BY id DESC');
    connection.release();
    return res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar respostas:', error);
    return res.status(500).json({ error: 'Erro ao buscar respostas.' });
  }
});

// Endpoint GET para buscar perguntas
app.get('/perguntas', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute('SELECT ID, CATEGORIA, DESCRICAO FROM perguntas ORDER BY CATEGORIA, ID');
    connection.release();
    return res.json(rows);
  } catch (error) {
    console.error('Erro ao buscar perguntas:', error);
    return res.status(500).json({ error: 'Erro ao buscar perguntas.' });
  }
});

app.listen(process.env.PORT || 4000, () => {
  console.log(`Servidor rodando na porta ${process.env.PORT || 4000}`);
});
