import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  criarToken,
  criarSessao,
  criarSugestao,
  obterSessao,
  apagarSessao,
  exigirToken,
  enviarErro
} from './autenticacao.js';

const sugestoes = JSON.parse(
  readFileSync(new URL('./dados/sugestoes.json', import.meta.url), 'utf-8')
);
const caminhoContrato = new URL('../sugestoes.openapi.yaml', import.meta.url);
const pastaPublica = fileURLToPath(new URL('./public/', import.meta.url));

const app = express();
app.use(express.json());
app.use(express.static(pastaPublica)); // passo 20: cliente na mesma origem

const v2 = express.Router();

function autenticarCookieSessao(req, _res, next) {
  if (!req.get('Authorization')) {
    const cookie = (req.get('Cookie') ?? '')
      .split(';')
      .map((parte) => parte.trim())
      .find((parte) => parte.startsWith('sessao='));
    if (cookie) {
      try {
        req.headers.authorization = `Bearer ${decodeURIComponent(cookie.slice('sessao='.length))}`;
      } catch {
        // Deixa o middleware de autenticação responder a cookies inválidos.
      }
    }
  }
  next();
}

// Passo 16: emissão de tokens. O cliente usa esta rota para iniciar sessão;
// guardar também o token num cookie permite autenticar pedidos por cookie.
v2.post('/tokens', (req, res, next) => {
  const enviarJson = res.json.bind(res);
  res.json = (corpo) => {
    if (res.statusCode === 200 && typeof corpo?.token === 'string') {
      res.cookie('sessao', corpo.token, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/v2',
        maxAge: Number(corpo.expiraEm) * 1000
      });
    }
    return enviarJson(corpo);
  };
  criarToken(req, res, next);
});

// Gestão da sessão por cookie.
v2.post('/sessao', criarSessao);
v2.get('/sessao', autenticarCookieSessao, exigirToken, obterSessao);
v2.delete('/sessao', apagarSessao);

// Passo 18: operação protegida de demonstração
v2.get('/sugestoes', exigirToken, (req, res) => {
  const itens =
    req.utilizador.papel === 'servicos'
      ? sugestoes
      : sugestoes.filter((s) => s.numeroAluno === req.utilizador.sub);

  res.set('Cache-Control', 'private, no-cache');
  res.status(200).json({ pagina: 1, tamanhoPagina: 20, total: itens.length, itens });
});
v2.post('/sugestoes', exigirToken, criarSugestao);

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
