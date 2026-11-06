import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';

// --- Configuração (passo 14) ---
const segredo = process.env.JWT_SEGREDO;
if (!segredo || segredo.length < 32) {
  console.error('Erro: defina JWT_SEGREDO (mínimo de 32 caracteres) no ficheiro .env.');
  process.exit(1);
}
const validade = Number(process.env.JWT_VALIDADE) || 900;

// --- Dados ---
const utilizadores = JSON.parse(
  readFileSync(new URL('./dados/utilizadores.json', import.meta.url), 'utf-8')
);
// Hash fixo, usado para que o tempo de resposta seja o mesmo quando o utilizador não existe
const HASH_FICTICIO = bcrypt.hashSync('palavra-passe-ficticia', 10);

// --- Respostas de erro (corpo Erro do contrato, sempre com no-store) ---
export function enviarErro(res, codigo, mensagem, { detalhes, cabecalhos } = {}) {
  res.set('Cache-Control', 'no-store');
  if (cabecalhos) res.set(cabecalhos);
  const corpo = { codigo, mensagem };
  if (detalhes) corpo.detalhes = detalhes;
  res.status(codigo).json(corpo);
}

// --- POST /v2/tokens (passo 16) ---
const PADRAO_UTILIZADOR = /^([0-9]{5,8}|[a-z]+\.[a-z]+)$/;

function validarCredenciais(corpo) {
  if (corpo === null || typeof corpo !== 'object' || Array.isArray(corpo)) {
    return [{ campo: 'corpo', problema: 'O corpo do pedido tem de ser um objeto JSON.' }];
  }
  const detalhes = [];
  const { utilizador, palavraPasse } = corpo;
  if (typeof utilizador !== 'string' || !PADRAO_UTILIZADOR.test(utilizador)) {
    detalhes.push({
      campo: 'utilizador',
      problema: 'Tem de ser um número de aluno (5 a 8 algarismos) ou um identificador nome.apelido.'
    });
  }
  if (typeof palavraPasse !== 'string' || palavraPasse.length < 8 || palavraPasse.length > 128) {
    detalhes.push({
      campo: 'palavraPasse',
      problema: 'Tem de ser uma string entre 8 e 128 caracteres.'
    });
  }
  return detalhes;
}

export async function criarToken(req, res, next) {
  try {
    const detalhes = validarCredenciais(req.body ?? null);
    if (detalhes.length > 0) {
      return enviarErro(res, 400, 'Pedido inválido.', { detalhes });
    }

    const { utilizador, palavraPasse } = req.body;
    const registo = utilizadores.find((u) => u.utilizador === utilizador);

    // A comparação faz-se sempre, mesmo que o utilizador não exista
    const palavraCorreta = await bcrypt.compare(
      palavraPasse,
      registo ? registo.hashPalavraPasse : HASH_FICTICIO
    );

    if (!registo || !palavraCorreta) {
      return enviarErro(res, 401, 'Utilizador ou palavra-passe incorretos.');
    }

    const token = jwt.sign(
      { sub: registo.utilizador, nome: registo.nome, papel: registo.papel },
      segredo,
      { algorithm: 'HS256', expiresIn: validade }
    );

    res.set('Cache-Control', 'no-store');
    res.status(200).json({ token, tipo: 'Bearer', expiraEm: validade });
  } catch (erro) {
    next(erro);
  }
}

// --- Middleware de proteção (passo 17) ---
export function exigirToken(req, res, next) {
  const partes = /^Bearer (\S+)$/i.exec(req.get('Authorization') ?? '');
  if (!partes) {
    return enviarErro(res, 401, 'Token ausente.', {
      cabecalhos: { 'WWW-Authenticate': 'Bearer' }
    });
  }

  let payload;
  try {
    payload = jwt.verify(partes[1], segredo, {
      algorithms: ['HS256'],     // só aceita HS256 (recusa "none" e outros algoritmos)
      ignoreExpiration: false    // verifica o exp
    });
  } catch {
    payload = null;
  }

  const valido =
    payload !== null &&
    typeof payload === 'object' &&
    typeof payload.sub === 'string' &&
    typeof payload.nome === 'string' &&
    ['aluno', 'servicos'].includes(payload.papel);

  if (!valido) {
    return enviarErro(res, 401, 'Token inválido ou expirado.', {
      cabecalhos: { 'WWW-Authenticate': 'Bearer error="invalid_token"' }
    });
  }

  req.utilizador = { sub: payload.sub, nome: payload.nome, papel: payload.papel };
  next();
}

export function exigirPapel(papel) {
  return (req, res, next) => {
    if (req.utilizador.papel !== papel) {
      return enviarErro(res, 403, 'Sem permissão para esta operação.');
    }
    next();
  };
}
