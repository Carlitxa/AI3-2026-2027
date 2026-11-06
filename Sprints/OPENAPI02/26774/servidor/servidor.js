import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { criarToken, exigirToken, enviarErro } from './autenticacao.js';

const sugestoes = JSON.parse(
  readFileSync(new URL('./dados/sugestoes.json', import.meta.url), 'utf-8')
);
const caminhoContrato = new URL('../sugestoes.openapi.yaml', import.meta.url);
const pastaPublica = fileURLToPath(new URL('./public/', import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(pastaPublica)); // passo 20: cliente na mesma origem

const v2 = express.Router();

// Passo 16: emissão de tokens
v2.post('/tokens', criarToken);

// Passo 18: operação protegida de demonstração
v2.get('/sugestoes', exigirToken, (req, res) => {
  const itens =
    req.utilizador.papel === 'servicos'
      ? sugestoes
      : sugestoes.filter((s) => s.numeroAluno === req.utilizador.sub);

  res.set('Cache-Control', 'private, no-cache');
  res.status(200).json({ pagina: 1, tamanhoPagina: 20, total: itens.length, itens });
});

// Passo 19: publicação do contrato
v2.get('/openapi.yaml', (req, res) => {
  res.type('application/yaml').send(readFileSync(caminhoContrato, 'utf-8'));
});

app.use('/v2', v2);

// Passo 19: tratamento final de erros
app.use((erro, req, res, next) => {
  if (erro.type === 'entity.parse.failed') {
    return enviarErro(res, 400, 'O corpo do pedido não é JSON válido.');
  }
  console.error(erro);
  enviarErro(res, 500, 'Erro interno do servidor.');
});

app.listen(3000, () => {
  console.log('Servidor em http://localhost:3000');
});
