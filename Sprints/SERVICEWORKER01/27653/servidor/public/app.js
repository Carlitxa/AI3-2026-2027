import {
  abrirBD,
  acrescentarPendente,
  descartarPendente,
  guardarProprietario,
  guardarSugestao,
  lerAtualizadoEm,
  lerPendentes,
  lerProprietario,
  lerSugestoes,
  limparBD,
  substituirSugestoes
} from './bd.js';
import { aplicarConfiguracoes, guardarConfiguracoes, lerConfiguracoes } from './configuracoes.js';
import { enviarPendentes } from './pendentes.js';

const porId = (id) => document.getElementById(id);
const elementosEstado = {
  'a-verificar': porId('estado-a-verificar'),
  'sem-sessao': porId('area-entrada'),
  'com-sessao': porId('area-sessao'),
  'sem-ligacao': porId('area-sem-ligacao')
};

const configuracoes = lerConfiguracoes();
let sessaoAtual = null;
let proprietarioLocal = null;
let copiaOfflineValida = false;
let categoriasDisponiveis = false;
let pendentesVisiveis = [];
let temporizadorSessao = null;
let atualizacaoSW = null;
let recarregarQuandoControlado = false;

aplicarConfiguracoes(configuracoes);
criarZonaConfiguracoes();

function mostrarMensagem(mensagem = '') {
  porId('mensagem').textContent = mensagem;
}

function mudarEstado(estado) {
  if (!Object.hasOwn(elementosEstado, estado)) {
    throw new Error(`Estado de interface inválido: ${estado}`);
  }

  document.body.dataset.estado = estado;
  for (const [nome, painel] of Object.entries(elementosEstado)) {
    painel.hidden = nome !== estado;
  }
  porId('configuracoes').hidden = estado !== 'com-sessao' && estado !== 'sem-ligacao';

  const podeCriar = estado === 'com-sessao'
    ? sessaoAtual?.papel === 'aluno'
    : estado === 'sem-ligacao' && copiaOfflineValida && proprietarioLocal?.papel === 'aluno';
  porId('secao-sugestao').hidden = !podeCriar;
  porId('area-pendentes').hidden = pendentesVisiveis.length === 0 ||
    (estado !== 'com-sessao' && !(estado === 'sem-ligacao' && copiaOfflineValida));

  const botaoTerminar = porId('botao-terminar');
  botaoTerminar.disabled = estado !== 'com-sessao';
  botaoTerminar.title = estado === 'sem-ligacao'
    ? 'Não é possível terminar a sessão sem ligação ao servidor.'
    : '';
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
    select.setAttribute('aria-label', rotulo);
    for (const valor of opcoes) {
      const opcao = document.createElement('option');
      opcao.value = valor;
      opcao.textContent = valor;
      select.append(opcao);
    }
    select.value = configuracoes[chave];
    select.addEventListener('change', async () => {
      configuracoes[chave] = select.value;
      aplicarConfiguracoes(configuracoes);
      guardarConfiguracoes(configuracoes);
      if (chave === 'ordenacao') await atualizarListasLocais();
    });
    label.append(select);
    zona.append(label);
  }
  document.body.prepend(zona);
}

function formatarHora(valor) {
  if (!valor) return '—';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '—' : data.toLocaleTimeString('pt-PT', {
    hour: '2-digit', minute: '2-digit'
  });
}

function mostrarSugestoes(elementoLista, sugestoes) {
  elementoLista.replaceChildren();
  if (sugestoes.length === 0) {
    const vazio = document.createElement('li');
    vazio.textContent = 'Não há sugestões para mostrar.';
    elementoLista.append(vazio);
    return;
  }

  for (const sugestao of sugestoes) {
    const item = document.createElement('li');
    const titulo = document.createElement('span');
    titulo.className = 'titulo';
    titulo.textContent = sugestao.titulo;
    const detalhe = document.createElement('span');
    detalhe.className = 'detalhe';
    detalhe.textContent = `Categoria: ${sugestao.categoria} · Estado: ${sugestao.estado}`;
    item.append(titulo, detalhe);
    elementoLista.append(item);
  }
}

async function atualizarListasLocais() {
  try {
    const lista = await lerSugestoes(configuracoes.ordenacao);
    mostrarSugestoes(porId('lista-sugestoes'), lista);
    mostrarSugestoes(porId('lista-sugestoes-offline'), lista);
    const atualizadoEm = await lerAtualizadoEm();
    porId('atualizado-em').textContent = atualizadoEm
      ? `Atualizado às ${formatarHora(atualizadoEm)}.` : 'Ainda não há uma cópia local atualizada.';
    porId('hora-copia').textContent = formatarHora(atualizadoEm);
  } catch (erro) {
    mostrarMensagem(`Não foi possível ler a IndexedDB: ${erro.message}`);
  }
}

async function atualizarListaPendentes() {
  try {
    const todas = await lerPendentes();
    const utilizador = sessaoAtual?.utilizador ?? proprietarioLocal?.utilizador;
    pendentesVisiveis = utilizador
      ? todas.filter((pendente) => pendente.utilizador === utilizador)
      : [];

    const lista = porId('lista-pendentes');
    lista.replaceChildren();
    for (const pendente of pendentesVisiveis) {
      const item = document.createElement('li');
      const texto = document.createElement('span');
      texto.textContent = `${pendente.titulo} — ${pendente.erro ?? 'Por enviar'}`;
      const descartar = document.createElement('button');
      descartar.type = 'button';
      descartar.textContent = 'Descartar';
      descartar.addEventListener('click', async () => {
        await descartarPendente(pendente.idLocal);
        await atualizarListaPendentes();
        mudarEstado(document.body.dataset.estado);
      });
      item.append(texto, descartar);
      lista.append(item);
    }
    mudarEstado(document.body.dataset.estado);
  } catch (erro) {
    mostrarMensagem(`Não foi possível ler as sugestões pendentes: ${erro.message}`);
  }
}

async function atualizarCopiaOffline() {
  try {
    proprietarioLocal = await lerProprietario();
    const expiracao = Date.parse(proprietarioLocal?.expiracao ?? '');
    copiaOfflineValida = Boolean(proprietarioLocal && Number.isFinite(expiracao) && expiracao > Date.now());

    porId('copia-local').hidden = !copiaOfflineValida;
    if (copiaOfflineValida) {
      porId('nome-proprietario').textContent = proprietarioLocal.nome;
      await atualizarListasLocais();
      await atualizarListaPendentes();
    } else {
      pendentesVisiveis = [];
      porId('lista-sugestoes-offline').replaceChildren();
      porId('lista-pendentes').replaceChildren();
      porId('area-pendentes').hidden = true;
    }
  } catch (erro) {
    copiaOfflineValida = false;
    mostrarMensagem(`Não foi possível consultar a cópia local: ${erro.message}`);
  }
}

async function atualizarProprietario(sessao) {
  const anterior = await lerProprietario();
  if (anterior && anterior.utilizador !== sessao.utilizador) await limparBD();
  await guardarProprietario(sessao);
  proprietarioLocal = await lerProprietario();
  copiaOfflineValida = Boolean(proprietarioLocal && Date.parse(proprietarioLocal.expiracao) > Date.now());
}

function guardarRascunho() {
  try {
    sessionStorage.setItem('rascunhoSugestao', JSON.stringify({
      titulo: porId('titulo-sugestao').value,
      descricao: porId('descricao-sugestao').value,
      categoria: porId('categoria-sugestao').value
    }));
  } catch {
    mostrarMensagem('Não foi possível guardar o rascunho neste separador.');
  }
}

function reporRascunho() {
  try {
    const rascunho = JSON.parse(sessionStorage.getItem('rascunhoSugestao') ?? '{}');
    porId('titulo-sugestao').value = rascunho.titulo ?? '';
    porId('descricao-sugestao').value = rascunho.descricao ?? '';
    porId('categoria-sugestao').value = rascunho.categoria ?? '';
  } catch {
    sessionStorage.removeItem('rascunhoSugestao');
  }
}

function limparRascunho() {
  sessionStorage.removeItem('rascunhoSugestao');
  porId('formulario-sugestao').reset();
}

function iniciarTemporizador(sessao) {
  clearInterval(temporizadorSessao);
  const expiracao = Date.parse(sessao.expiracao ?? '');
  if (!Number.isFinite(expiracao)) {
    porId('hora-expiracao').textContent = 'desconhecida';
    porId('tempo-restante').textContent = '—';
    return;
  }

  porId('hora-expiracao').textContent = new Date(expiracao).toLocaleTimeString('pt-PT');
  const atualizar = () => {
    const restante = expiracao - Date.now();
    if (restante <= 0) {
      expirarSessao('A sessão expirou. Entre de novo.');
      return;
    }
    const segundos = Math.floor(restante / 1000);
    porId('tempo-restante').textContent =
      `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
  };
  atualizar();
  temporizadorSessao = setInterval(atualizar, 1000);
}

function expirarSessao(mensagem) {
  clearInterval(temporizadorSessao);
  temporizadorSessao = null;
  sessaoAtual = null;
  mostrarMensagem(mensagem);
  mudarEstado('sem-sessao');
}

async function carregarCategorias() {
  const campo = porId('categoria-sugestao');
  const fieldset = porId('campos-sugestao');
  try {
    const resposta = await fetch('/v2/categorias');
    if (!resposta.ok) throw new Error(`Resposta ${resposta.status}`);
    const categorias = await resposta.json();
    if (!Array.isArray(categorias) || categorias.length === 0) throw new Error('Lista vazia');

    campo.replaceChildren();
    const inicial = document.createElement('option');
    inicial.value = '';
    inicial.textContent = 'Escolha uma categoria';
    campo.append(inicial);
    for (const categoria of categorias) {
      const opcao = document.createElement('option');
      opcao.value = categoria.codigo;
      opcao.textContent = categoria.descricao;
      campo.append(opcao);
    }
    categoriasDisponiveis = true;
    fieldset.disabled = false;
    porId('mensagem-categorias').textContent = '';
    reporRascunho();
  } catch {
    categoriasDisponiveis = false;
    fieldset.disabled = true;
    porId('mensagem-categorias').textContent =
      'Não há categorias disponíveis na rede nem na cache; o formulário está desativado.';
  }
}

async function carregarSugestoes() {
  try {
    const resposta = await fetch('/v2/sugestoes', { credentials: 'include' });
    if (resposta.status === 401) {
      expirarSessao('A sessão expirou. Entre de novo.');
      return;
    }
    if (!resposta.ok) {
      mostrarMensagem(`Não foi possível carregar as sugestões (código ${resposta.status}).`);
      return;
    }

    const resultado = await resposta.json();
    await substituirSugestoes(Array.isArray(resultado) ? resultado : resultado.itens);
    await atualizarListasLocais();
  } catch {
    await ativarSemLigacao('Sem ligação: a lista pode estar desatualizada.');
  }
}

async function ativarSemLigacao(mensagem) {
  mostrarMensagem(mensagem);
  await atualizarCopiaOffline();
  mudarEstado('sem-ligacao');
}

async function sincronizarSessao({ veioDeOnline = false } = {}) {
  let resposta;
  try {
    resposta = await fetch('/v2/sessao', { credentials: 'include' });
  } catch {
    await ativarSemLigacao('Sem ligação: não é possível confirmar a sessão.');
    return;
  }

  if (resposta.status === 200) {
    const sessao = await resposta.json();
    await atualizarProprietario(sessao);
    sessaoAtual = sessao;
    mostrarMensagem('');
    iniciarTemporizador(sessao);
    mudarEstado('com-sessao');
    await atualizarListaPendentes();
    await carregarSugestoes();
    if (document.body.dataset.estado === 'com-sessao') await enviarPendentesAgora();
    return;
  }

  if (resposta.status === 401) {
    let mensagem = veioDeOnline ? 'A sessão expirou. Entre de novo.' : '';
    const pendentes = await lerPendentes();
    if (veioDeOnline && pendentes.length > 0) {
      mensagem = `Há ${pendentes.length} sugestões por enviar. Entre de novo para as enviar.`;
    }
    expirarSessao(mensagem);
    return;
  }

  mostrarMensagem(`Não foi possível confirmar a sessão (código ${resposta.status}).`);
}

async function enviarPendentesAgora() {
  if (!sessaoAtual) return;
  await enviarPendentes(sessaoAtual, {
    aoExpirar: async (quantidade) => {
      expirarSessao(`Há ${quantidade} sugestões por enviar. Entre de novo para as enviar.`);
    },
    aoSemLigacao: async () => {
      await ativarSemLigacao('Sem ligação: as sugestões pendentes aguardam rede.');
    },
    aoAtualizar: async () => {
      await atualizarListasLocais();
      await atualizarListaPendentes();
    }
  });
}

async function entrar(evento) {
  evento.preventDefault();
  mostrarMensagem('');
  const botao = porId('botao-entrar');
  botao.disabled = true;
  botao.textContent = 'A entrar…';

  try {
    const resposta = await fetch('/v2/sessao', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        utilizador: porId('utilizador').value.trim(),
        palavraPasse: porId('palavra-passe').value
      })
    });

    if (resposta.status === 200) {
      const sessao = await resposta.json();
      await atualizarProprietario(sessao);
      sessaoAtual = sessao;
      iniciarTemporizador(sessao);
      mostrarMensagem('');
      mudarEstado('com-sessao');
      reporRascunho();
      porId('titulo-sessao').focus();
      await atualizarListaPendentes();
      await carregarSugestoes();
      if (document.body.dataset.estado === 'com-sessao') await enviarPendentesAgora();
    } else if (resposta.status === 400 || resposta.status === 401) {
      const erro = await resposta.json();
      porId('palavra-passe').value = '';
      mostrarMensagem(erro.mensagem);
      porId('palavra-passe').focus();
    } else {
      mostrarMensagem(`Erro inesperado do servidor (código ${resposta.status}).`);
    }
  } catch {
    await ativarSemLigacao('Sem ligação: não é possível entrar.');
  } finally {
    botao.disabled = false;
    botao.textContent = 'Entrar';
  }
}

function dadosFormularioSugestao() {
  return {
    titulo: porId('titulo-sugestao').value.trim(),
    descricao: porId('descricao-sugestao').value.trim(),
    categoria: porId('categoria-sugestao').value
  };
}

async function guardarComoPendente(dados, utilizador) {
  await acrescentarPendente(dados, utilizador);
  limparRascunho();
  mostrarMensagem('Sem ligação: sugestão guardada para envio posterior.');
  await atualizarCopiaOffline();
  await atualizarListaPendentes();
  mudarEstado('sem-ligacao');
}

async function submeterSugestao(evento) {
  evento.preventDefault();
  if (!categoriasDisponiveis) return;
  const dados = dadosFormularioSugestao();

  if (document.body.dataset.estado === 'sem-ligacao') {
    if (!copiaOfflineValida || proprietarioLocal?.papel !== 'aluno') {
      mostrarMensagem('Sem uma sessão local válida, não é possível guardar esta sugestão para envio.');
      return;
    }
    await guardarComoPendente(dados, proprietarioLocal.utilizador);
    return;
  }

  if (document.body.dataset.estado !== 'com-sessao' || !sessaoAtual) return;
  try {
    const resposta = await fetch('/v2/sugestoes', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    if (resposta.status === 201) {
      const sugestao = await resposta.json();
      await guardarSugestao(sugestao);
      limparRascunho();
      mostrarMensagem('Sugestão criada com sucesso.');
      await atualizarListasLocais();
    } else if (resposta.status === 401) {
      expirarSessao('A sessão expirou. Entre de novo.');
    } else if (resposta.status === 400) {
      const erro = await resposta.json();
      mostrarMensagem(erro.mensagem);
    } else {
      mostrarMensagem(`Erro inesperado do servidor (código ${resposta.status}).`);
    }
  } catch {
    await guardarComoPendente(dados, sessaoAtual.utilizador);
  }
}

function pedirConfirmacaoTermino(quantidade) {
  return new Promise((resolve) => {
    const dialogo = porId('dialog-terminar');
    porId('texto-dialog-terminar').textContent =
      `Há ${quantidade} sugestões por enviar, que serão apagadas. Terminar sessão?`;

    const terminar = () => concluir(true);
    const cancelar = () => concluir(false);
    const concluir = (confirmado) => {
      dialogo.close();
      porId('confirmar-terminar').removeEventListener('click', terminar);
      porId('cancelar-terminar').removeEventListener('click', cancelar);
      resolve(confirmado);
    };

    porId('confirmar-terminar').addEventListener('click', terminar);
    porId('cancelar-terminar').addEventListener('click', cancelar);
    dialogo.showModal();
  });
}

async function terminarSessao() {
  const pendentes = pendentesVisiveis.length ? pendentesVisiveis : await lerPendentes();
  if (pendentes.length > 0 && !(await pedirConfirmacaoTermino(pendentes.length))) return;

  try {
    const resposta = await fetch('/v2/sessao', {
      method: 'DELETE',
      credentials: 'include'
    });
    if (resposta.status !== 204) {
      if (resposta.status === 401) expirarSessao('A sessão expirou. Entre de novo.');
      else mostrarMensagem(`Não foi possível terminar a sessão (código ${resposta.status}).`);
      return;
    }

    await limparBD();
    limparRascunho();
    clearInterval(temporizadorSessao);
    temporizadorSessao = null;
    sessaoAtual = null;
    proprietarioLocal = null;
    copiaOfflineValida = false;
    pendentesVisiveis = [];
    mostrarMensagem('');
    mudarEstado('sem-sessao');
    porId('utilizador').focus();
  } catch {
    await ativarSemLigacao('Sem ligação: não é possível terminar a sessão.');
  }
}

async function registarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registo = await navigator.serviceWorker.register('/sw.js');
    atualizacaoSW = registo;

    const verificarAguardar = () => {
      if (registo.waiting && navigator.serviceWorker.controller) {
        porId('botao-atualizar').hidden = false;
      }
    };
    verificarAguardar();
    registo.addEventListener('updatefound', () => {
      const instalando = registo.installing;
      instalando?.addEventListener('statechange', verificarAguardar);
    });

    porId('botao-atualizar').addEventListener('click', () => {
      if (!registo.waiting) return;
      recarregarQuandoControlado = true;
      registo.waiting.postMessage({ tipo: 'ativar' });
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (recarregarQuandoControlado) location.reload();
    });
  } catch {
    // A interface continua utilizável online se o registo do SW falhar.
  }
}

porId('formulario-entrada').addEventListener('submit', entrar);
porId('formulario-sugestao').addEventListener('input', guardarRascunho);
porId('formulario-sugestao').addEventListener('submit', submeterSugestao);
porId('botao-terminar').addEventListener('click', terminarSessao);
porId('botao-sugestoes').addEventListener('click', carregarSugestoes);

window.addEventListener('online', async () => {
  porId('indicacao-ligacao').textContent = 'Ligação disponível; a confirmar sessão…';
  await sincronizarSessao({ veioDeOnline: true });
});
window.addEventListener('offline', () => {
  porId('indicacao-ligacao').textContent = 'O browser indica que não há ligação.';
});
porId('indicacao-ligacao').textContent = navigator.onLine
  ? 'Ligação disponível.' : 'O browser indica que não há ligação.';

const promessaServiceWorker = registarServiceWorker();
mudarEstado('a-verificar');
(async () => {
  try {
    await promessaServiceWorker;
    await abrirBD();
    await atualizarListaPendentes();
    await Promise.all([carregarCategorias(), sincronizarSessao()]);
  } catch (erro) {
    mostrarMensagem(`Não foi possível iniciar o armazenamento local: ${erro.message}`);
  }
})();
