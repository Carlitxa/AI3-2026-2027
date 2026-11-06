// O token vive apenas nesta variável do módulo: perde-se ao recarregar a página.
let token = null;
let expiraEmMs = null;
let temporizador = null;

const MENSAGEM_EXPIRADA = 'Sessão expirada. É necessária nova autenticação.';
const MENSAGEM_REDE = 'Não foi possível contactar o servidor. Verifique a ligação e tente novamente.';

const elemento = (id) => document.getElementById(id);
const zonaMensagem = elemento('mensagem');
const areaEntrada = elemento('area-entrada');
const areaSessao = elemento('area-sessao');
const formulario = elemento('formulario-entrada');
const campoUtilizador = elemento('utilizador');
const campoPalavraPasse = elemento('palavra-passe');
const botaoSugestoes = elemento('botao-sugestoes');
const botaoTerminar = elemento('botao-terminar');
const listaSugestoes = elemento('lista-sugestoes');

// --- Mensagens ---
function mostrarMensagem(texto) {
  zonaMensagem.textContent = texto;
}

function limparMensagem() {
  zonaMensagem.textContent = '';
}

// --- Payload (passo 23): só para apresentar na interface, nunca para decidir segurança ---
function descodificarPayload(jwt) {
  const parte = jwt.split('.')[1];
  const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
  const completo = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binario = atob(completo);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

// --- Sessão ---
function formatarTempo(milissegundos) {
  const total = Math.max(0, Math.floor(milissegundos / 1000));
  const minutos = String(Math.floor(total / 60)).padStart(2, '0');
  const segundos = String(total % 60).padStart(2, '0');
  return `${minutos}:${segundos}`;
}

function atualizarTempoRestante() {
  const restante = expiraEmMs - Date.now();
  if (restante <= 0) {
    terminarSessao(MENSAGEM_EXPIRADA);
    return;
  }
  elemento('tempo-restante').textContent = formatarTempo(restante);
}

function iniciarSessao(jwt) {
  const payload = descodificarPayload(jwt);
  token = jwt;
  expiraEmMs = payload.exp * 1000;

  elemento('nome').textContent = payload.nome;
  elemento('papel').textContent = payload.papel;
  elemento('hora-expiracao').textContent = new Date(expiraEmMs).toLocaleTimeString('pt-PT');
  botaoSugestoes.textContent =
    payload.papel === 'servicos' ? 'Todas as sugestões' : 'As minhas sugestões';

  campoPalavraPasse.value = '';
  areaEntrada.hidden = true;
  areaSessao.hidden = false;

  atualizarTempoRestante();
  clearInterval(temporizador);
  temporizador = setInterval(atualizarTempoRestante, 1000);
}

function terminarSessao(mensagem) {
  clearInterval(temporizador);
  temporizador = null;
  token = null;
  expiraEmMs = null;

  listaSugestoes.replaceChildren();
  areaSessao.hidden = true;
  areaEntrada.hidden = false;
  mostrarMensagem(mensagem ?? '');
  campoUtilizador.focus();
}

// --- Autenticação (passo 22) ---
formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparMensagem();

  const corpo = {
    utilizador: campoUtilizador.value.trim(),
    palavraPasse: campoPalavraPasse.value
  };

  let resposta;
  try {
    resposta = await fetch('/v2/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
  } catch {
    mostrarMensagem(MENSAGEM_REDE);
    return;
  }

  if (resposta.status === 200) {
    const dados = await resposta.json();
    iniciarSessao(dados.token);
  } else if (resposta.status === 400 || resposta.status === 401) {
    const erro = await resposta.json();
    mostrarMensagem(erro.mensagem);
  } else {
    mostrarMensagem(`Erro inesperado do servidor (código ${resposta.status}).`);
  }
});

// --- Pedidos protegidos (passo 24) ---
// Devolve a resposta, ou null se o servidor respondeu 401 (a sessão já foi terminada).
async function pedidoAutenticado(url) {
  const resposta = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (resposta.status === 401) {
    terminarSessao(MENSAGEM_EXPIRADA);
    return null;
  }
  return resposta;
}

function mostrarSugestoes(itens) {
  listaSugestoes.replaceChildren();

  if (itens.length === 0) {
    const vazio = document.createElement('li');
    vazio.textContent = 'Não há sugestões para mostrar.';
    listaSugestoes.append(vazio);
    return;
  }

  for (const sugestao of itens) {
    const li = document.createElement('li');

    const titulo = document.createElement('span');
    titulo.className = 'titulo';
    titulo.textContent = sugestao.titulo;

    const detalhe = document.createElement('span');
    detalhe.className = 'detalhe';
    detalhe.textContent = `Categoria: ${sugestao.categoria} · Estado: ${sugestao.estado}`;

    li.append(titulo, detalhe);
    listaSugestoes.append(li);
  }
}

botaoSugestoes.addEventListener('click', async () => {
  limparMensagem();

  let resposta;
  try {
    resposta = await pedidoAutenticado('/v2/sugestoes');
  } catch {
    mostrarMensagem(MENSAGEM_REDE);
    return;
  }
  if (resposta === null) return;

  if (!resposta.ok) {
    mostrarMensagem(`Erro inesperado do servidor (código ${resposta.status}).`);
    return;
  }

  const lista = await resposta.json();
  mostrarSugestoes(lista.itens);
});

// --- Termo de sessão (passo 25) ---
botaoTerminar.addEventListener('click', () => {
  terminarSessao('');
});
