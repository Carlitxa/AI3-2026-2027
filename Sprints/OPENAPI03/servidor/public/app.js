let expiraEmMs = null;
let temporizador = null;
let tokenAcesso = sessionStorage.getItem('tokenAcesso');
let configuracoes = lerConfiguracoes();
let formularioSugestao;
let campoTituloSugestao;
let campoCategoriaSugestao;
let campoDescricaoSugestao;

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

const CONFIGURACOES_POR_OMISSAO = { tema: 'claro', ordenacao: 'recentes' };

function lerConfiguracoes() {
  const porOmissao = { tema: 'claro', ordenacao: 'recentes' };
  try {
    const guardadas = localStorage.getItem('configuracoes');
    if (guardadas === null) return porOmissao;
    const dados = JSON.parse(guardadas);
    if (!dados || !['claro', 'escuro'].includes(dados.tema) ||
        !['recentes', 'estado'].includes(dados.ordenacao)) return porOmissao;
    return { tema: dados.tema, ordenacao: dados.ordenacao };
  } catch {
    return porOmissao;
  }
}

function guardarConfiguracoes(novasConfiguracoes) {
  localStorage.setItem('configuracoes', JSON.stringify(novasConfiguracoes));
}

function aplicarConfiguracoes() {
  document.documentElement.dataset.tema = configuracoes.tema;
}

function criarZonaConfiguracoes() {
  const zona = document.createElement('section');
  zona.id = 'configuracoes';
  zona.setAttribute('aria-label', 'Configurações');
  const titulo = document.createElement('h2');
  titulo.textContent = 'Configurações';
  zona.append(titulo);

  for (const [chave, rotulo, opcoes] of [
    ['tema', 'Tema', ['claro', 'escuro']],
    ['ordenacao', 'Ordenação', ['recentes', 'estado']]
  ]) {
    const label = document.createElement('label');
    label.textContent = `${rotulo}: `;
    const select = document.createElement('select');
    select.name = chave;
    for (const valor of opcoes) {
      const option = document.createElement('option');
      option.value = valor;
      option.textContent = valor;
      select.append(option);
    }
    select.value = configuracoes[chave];
    select.addEventListener('change', () => {
      configuracoes = { ...configuracoes, [chave]: select.value };
      aplicarConfiguracoes();
      guardarConfiguracoes(configuracoes);
      if (chave === 'ordenacao' && listaSugestoes.childElementCount) {
        // A lista é atualizada na próxima resposta do servidor.
      }
    });
    label.append(select);
    zona.append(label);
  }
  document.body.prepend(zona);
}

criarZonaConfiguracoes();
aplicarConfiguracoes();

// --- Mensagens ---
function mostrarMensagem(texto) {
  zonaMensagem.textContent = texto;
}

function limparMensagem() {
  zonaMensagem.textContent = '';
}

// --- Sessão ---
function formatarTempo(milissegundos) {
  const total = Math.max(0, Math.floor(milissegundos / 1000));
  const minutos = String(Math.floor(total / 60)).padStart(2, '0');
  const segundos = String(total % 60).padStart(2, '0');
  return `${minutos}:${segundos}`;
}

function atualizarTempoRestante() {
  if (!expiraEmMs) return;
  const restante = expiraEmMs - Date.now();
  if (restante <= 0) {
    terminarSessao(MENSAGEM_EXPIRADA);
    return;
  }
  elemento('tempo-restante').textContent = formatarTempo(restante);
}

function dadosDaSessao(dados) {
  const sessao = dados?.sessao ??
    (typeof dados?.utilizador === 'object' ? dados.utilizador : null) ??
    (typeof dados?.usuario === 'object' ? dados.usuario : null) ??
    dados ?? {};
  return {
    nome: sessao.nome ?? sessao.name ?? sessao.utilizador ?? sessao.sub ?? 'Utilizador',
    papel: sessao.papel ?? sessao.role ?? '',
    exp: sessao.exp ?? sessao.expiresAt,
    expiraEm: sessao.expiraEm
  };
}

function dadosDoToken(token) {
  try {
    const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const preenchida = parte.padEnd(Math.ceil(parte.length / 4) * 4, '=');
    const texto = decodeURIComponent(Array.from(atob(preenchida), (caracter) =>
      `%${caracter.charCodeAt(0).toString(16).padStart(2, '0')}`
    ).join(''));
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

function criarFormularioSugestao() {
  if (formularioSugestao) return;
  formularioSugestao = document.createElement('form');
  formularioSugestao.id = 'formulario-sugestao';
  const titulo = document.createElement('h3');
  titulo.textContent = 'Nova sugestão';
  formularioSugestao.append(titulo);

  const criarCampo = (rotulo, nome, tag = 'input') => {
    const label = document.createElement('label');
    label.textContent = `${rotulo}: `;
    const campo = document.createElement(tag);
    campo.name = nome;
    campo.required = true;
    label.append(campo);
    formularioSugestao.append(label);
    return campo;
  };
  campoTituloSugestao = criarCampo('Título', 'titulo');
  campoCategoriaSugestao = criarCampo('Categoria', 'categoria');
  campoDescricaoSugestao = criarCampo('Descrição', 'descricao', 'textarea');
  const enviar = document.createElement('button');
  enviar.type = 'submit';
  enviar.textContent = 'Criar sugestão';
  formularioSugestao.append(enviar);

  formularioSugestao.addEventListener('input', guardarRascunho);
  formularioSugestao.addEventListener('submit', submeterSugestao);
  areaSessao.append(formularioSugestao);
}

function guardarRascunho() {
  sessionStorage.setItem('rascunhoSugestao', JSON.stringify({
    titulo: campoTituloSugestao.value,
    categoria: campoCategoriaSugestao.value,
    descricao: campoDescricaoSugestao.value
  }));
}

function reporRascunho() {
  try {
    const rascunho = JSON.parse(sessionStorage.getItem('rascunhoSugestao') || '{}');
    campoTituloSugestao.value = rascunho.titulo ?? '';
    campoCategoriaSugestao.value = rascunho.categoria ?? '';
    campoDescricaoSugestao.value = rascunho.descricao ?? '';
  } catch {
    sessionStorage.removeItem('rascunhoSugestao');
  }
}

function iniciarSessao(dados) {
  const sessao = dadosDaSessao(dados);
  const expiracao = typeof sessao.exp === 'number'
    ? sessao.exp * 1000
    : (typeof sessao.exp === 'string'
      ? Date.parse(sessao.exp)
      : (typeof sessao.expiraEm === 'number'
        ? Date.now() + sessao.expiraEm * 1000
        : (typeof sessao.expiraEm === 'string' ? Date.parse(sessao.expiraEm) : NaN)));
  expiraEmMs = Number.isFinite(expiracao) ? expiracao : null;

  elemento('nome').textContent = sessao.nome;
  elemento('papel').textContent = sessao.papel;
  elemento('hora-expiracao').textContent = expiraEmMs
    ? new Date(expiraEmMs).toLocaleTimeString('pt-PT') : '';
  botaoSugestoes.textContent =
    sessao.papel === 'servicos' ? 'Todas as sugestões' : 'As minhas sugestões';

  campoPalavraPasse.value = '';
  areaEntrada.hidden = true;
  areaSessao.hidden = false;

  if (['aluno', 'alunos', 'student'].includes(String(sessao.papel).toLowerCase())) {
    criarFormularioSugestao();
    formularioSugestao.hidden = false;
    reporRascunho();
  } else if (formularioSugestao) {
    formularioSugestao.hidden = true;
  }

  atualizarTempoRestante();
  clearInterval(temporizador);
  temporizador = setInterval(atualizarTempoRestante, 1000);
}

function terminarSessao(mensagem) {
  clearInterval(temporizador);
  temporizador = null;
  expiraEmMs = null;
  tokenAcesso = null;
  sessionStorage.removeItem('tokenAcesso');
  sessionStorage.removeItem('rascunhoSugestao');

  listaSugestoes.replaceChildren();
  areaSessao.hidden = true;
  areaEntrada.hidden = false;
  mostrarMensagem(mensagem ?? '');
  campoUtilizador.focus();
}

// --- Autenticação por sessão ---
formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  limparMensagem();

  const corpo = {
    utilizador: campoUtilizador.value.trim(),
    palavraPasse: campoPalavraPasse.value
  };

  let resposta;
  let usouToken = true;
  try {
    resposta = await fetch('/v2/tokens', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo)
    });
  } catch {
    mostrarMensagem(MENSAGEM_REDE);
    return;
  }

  if (resposta.status === 404) {
    usouToken = false;
    try {
      resposta = await fetch('/v2/sessao', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo)
      });
    } catch {
      mostrarMensagem(MENSAGEM_REDE);
      return;
    }
  }

  if (resposta.ok) {
    let dados = {};
    try { dados = await resposta.json(); } catch { /* a sessão pode não devolver corpo */ }
    if (usouToken) {
      const claims = dadosDoToken(dados.token);
      if (!claims) {
        mostrarMensagem('Resposta de autenticação inválida.');
        return;
      }
      tokenAcesso = dados.token;
      sessionStorage.setItem('tokenAcesso', tokenAcesso);
      iniciarSessao(claims);
      return;
    }
    if (!dados.nome && !dados.utilizador && !dados.sessao && !dados.papel) {
      iniciarSessao({ nome: corpo.utilizador });
    } else {
      iniciarSessao(dados);
    }
  } else if (resposta.status === 400 || resposta.status === 401) {
    const erro = await resposta.json();
    mostrarMensagem(erro.mensagem);
  } else {
    mostrarMensagem(`Erro inesperado do servidor (código ${resposta.status}).`);
  }
});

// --- Pedidos protegidos por cookie de sessão ---
async function pedidoAutenticado(url) {
  const cabecalhos = tokenAcesso
    ? { Authorization: `Bearer ${tokenAcesso}` }
    : {};
  const resposta = await fetch(url, { credentials: 'include', headers: cabecalhos });
  if (resposta.status === 401) {
    terminarSessao(MENSAGEM_EXPIRADA);
    return null;
  }
  return resposta;
}

function mostrarSugestoes(itens) {
  listaSugestoes.replaceChildren();

  const ordenados = [...itens];
  if (configuracoes.ordenacao === 'estado') {
    ordenados.sort((a, b) => String(a.estado).localeCompare(String(b.estado), 'pt'));
  } else {
    ordenados.sort((a, b) => new Date(b.criadaEm ?? b.dataCriacao ?? b.createdAt ?? 0) -
      new Date(a.criadaEm ?? a.dataCriacao ?? a.createdAt ?? 0));
  }

  if (ordenados.length === 0) {
    const vazio = document.createElement('li');
    vazio.textContent = 'Não há sugestões para mostrar.';
    listaSugestoes.append(vazio);
    return;
  }

  for (const sugestao of ordenados) {
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

async function submeterSugestao(evento) {
  evento.preventDefault();
  limparMensagem();
  try {
    const resposta = await fetch('/v2/sugestoes', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(tokenAcesso ? { Authorization: `Bearer ${tokenAcesso}` } : {})
      },
      body: JSON.stringify({
        titulo: campoTituloSugestao.value.trim(),
        categoria: campoCategoriaSugestao.value.trim(),
        descricao: campoDescricaoSugestao.value.trim()
      })
    });
    if (resposta.status === 401) {
      terminarSessao(MENSAGEM_EXPIRADA);
    } else if (resposta.ok) {
      formularioSugestao.reset();
      sessionStorage.removeItem('rascunhoSugestao');
      mostrarMensagem('Sugestão criada com sucesso.');
    } else {
      mostrarMensagem(`Erro inesperado do servidor (código ${resposta.status}).`);
    }
  } catch {
    mostrarMensagem(MENSAGEM_REDE);
  }
}

async function carregarSessao() {
  try {
    const resposta = await fetch('/v2/sessao', { credentials: 'include' });
    if (resposta.status === 200) {
      let dados = {};
      try { dados = await resposta.json(); } catch { /* resposta sem corpo */ }
      iniciarSessao(dados);
    } else if (resposta.status === 401 || resposta.status === 404) {
      const claims = tokenAcesso ? dadosDoToken(tokenAcesso) : null;
      if (claims) iniciarSessao(claims);
      else terminarSessao('');
    } else {
      mostrarMensagem(`Erro inesperado do servidor (código ${resposta.status}).`);
      console.log(resposta);
    }
  } catch {
    mostrarMensagem(MENSAGEM_REDE);
  }
}

// --- Termo de sessão ---
botaoTerminar.addEventListener('click', async () => {
  let mensagem = '';
  try {
    const resposta = await fetch('/v2/sessao', {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!resposta.ok && resposta.status !== 401) {
      mensagem = `Erro inesperado do servidor (código ${resposta.status}).`;
    }
  } catch {
    mensagem = MENSAGEM_REDE;
  }
  terminarSessao('');
  if (mensagem) mostrarMensagem(mensagem);
});

carregarSessao();
