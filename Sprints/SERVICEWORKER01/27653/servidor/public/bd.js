const NOME_BD = 'sugestoes-bd';
const VERSAO_BD = 1;

let promessaAbertura;

export function abrirBD() {
  if (!('indexedDB' in globalThis)) {
    return Promise.reject(new Error('IndexedDB não está disponível neste browser.'));
  }
  if (promessaAbertura) return promessaAbertura;

  promessaAbertura = new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BD, VERSAO_BD);

    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      if (!bd.objectStoreNames.contains('sugestoes')) {
        const loja = bd.createObjectStore('sugestoes', { keyPath: 'id' });
        loja.createIndex('porEstado', 'estado', { unique: false });
        loja.createIndex('porData', 'dataCriacao', { unique: false });
      }
      if (!bd.objectStoreNames.contains('pendentes')) {
        bd.createObjectStore('pendentes', { keyPath: 'idLocal', autoIncrement: true });
      }
      if (!bd.objectStoreNames.contains('meta')) {
        bd.createObjectStore('meta', { keyPath: 'chave' });
      }
    };

    pedido.onsuccess = () => {
      pedido.result.onversionchange = () => pedido.result.close();
      resolve(pedido.result);
    };
    pedido.onerror = () => reject(pedido.error);
    pedido.onblocked = () => reject(new Error('A atualização da IndexedDB está bloqueada por outra página.'));
  }).catch((erro) => {
    promessaAbertura = null;
    throw erro;
  });

  return promessaAbertura;
}

function transacionar(lojas, modo, preparar) {
  return abrirBD().then((bd) => new Promise((resolve, reject) => {
    const transacao = bd.transaction(lojas, modo);
    let resultado;

    transacao.oncomplete = () => resolve(resultado);
    transacao.onerror = () => reject(transacao.error ?? new Error('A transação IndexedDB falhou.'));
    transacao.onabort = () => reject(transacao.error ?? new Error('A transação IndexedDB foi cancelada.'));

    try {
      preparar(transacao, (valor) => { resultado = valor; });
    } catch (erro) {
      transacao.abort();
      reject(erro);
    }
  }));
}

export function substituirSugestoes(lista) {
  return transacionar(['sugestoes', 'meta'], 'readwrite', (transacao) => {
    const sugestoes = transacao.objectStore('sugestoes');
    sugestoes.clear();
    for (const sugestao of lista) sugestoes.put(sugestao);
    transacao.objectStore('meta').put({
      chave: 'sugestoesAtualizadoEm',
      valor: new Date().toISOString()
    });
  });
}

export function guardarSugestao(sugestao) {
  return transacionar(['sugestoes', 'meta'], 'readwrite', (transacao) => {
    transacao.objectStore('sugestoes').put(sugestao);
    transacao.objectStore('meta').put({
      chave: 'sugestoesAtualizadoEm',
      valor: new Date().toISOString()
    });
  });
}

export function lerSugestoes(ordenacao = 'recentes') {
  return transacionar(['sugestoes'], 'readonly', (transacao, definirResultado) => {
    const indice = ordenacao === 'estado' ? 'porEstado' : 'porData';
    const direcao = ordenacao === 'estado' ? 'next' : 'prev';
    const pedido = transacao.objectStore('sugestoes').index(indice).openCursor(null, direcao);
    const lista = [];
    pedido.onsuccess = () => {
      const cursor = pedido.result;
      if (!cursor) {
        definirResultado(lista);
        return;
      }
      lista.push(cursor.value);
      cursor.continue();
    };
  });
}

export function lerAtualizadoEm() {
  return transacionar(['meta'], 'readonly', (transacao, definirResultado) => {
    const pedido = transacao.objectStore('meta').get('sugestoesAtualizadoEm');
    pedido.onsuccess = () => definirResultado(pedido.result?.valor ?? null);
  });
}

export function acrescentarPendente(dados, utilizador) {
  return transacionar(['pendentes'], 'readwrite', (transacao, definirResultado) => {
    const pedido = transacao.objectStore('pendentes').add({
      utilizador,
      titulo: dados.titulo,
      descricao: dados.descricao,
      categoria: dados.categoria,
      criadaEm: new Date().toISOString(),
      erro: null
    });
    pedido.onsuccess = () => definirResultado(pedido.result);
  });
}

export function lerPendentes() {
  return transacionar(['pendentes'], 'readonly', (transacao, definirResultado) => {
    const pedido = transacao.objectStore('pendentes').getAll();
    pedido.onsuccess = () => definirResultado(pedido.result);
  });
}

export function marcarErro(idLocal, mensagem) {
  return transacionar(['pendentes'], 'readwrite', (transacao) => {
    const loja = transacao.objectStore('pendentes');
    const pedido = loja.get(idLocal);
    pedido.onsuccess = () => {
      if (pedido.result) loja.put({ ...pedido.result, erro: mensagem });
    };
  });
}

export function descartarPendente(idLocal) {
  return transacionar(['pendentes'], 'readwrite', (transacao) => {
    transacao.objectStore('pendentes').delete(idLocal);
  });
}

export function confirmarPendente(idLocal, sugestao) {
  return transacionar(['pendentes', 'sugestoes'], 'readwrite', (transacao) => {
    transacao.objectStore('pendentes').delete(idLocal);
    transacao.objectStore('sugestoes').put(sugestao);
  });
}

export function lerProprietario() {
  return transacionar(['meta'], 'readonly', (transacao, definirResultado) => {
    const pedido = transacao.objectStore('meta').get('proprietario');
    pedido.onsuccess = () => definirResultado(pedido.result ?? null);
  });
}

export function guardarProprietario(sessao) {
  return transacionar(['meta'], 'readwrite', (transacao) => {
    transacao.objectStore('meta').put({
      chave: 'proprietario',
      utilizador: sessao.utilizador,
      nome: sessao.nome,
      papel: sessao.papel,
      expiracao: sessao.expiracao,
      atualizadoEm: new Date().toISOString()
    });
  });
}

export function limparBD() {
  return transacionar(['sugestoes', 'pendentes', 'meta'], 'readwrite', (transacao) => {
    transacao.objectStore('sugestoes').clear();
    transacao.objectStore('pendentes').clear();
    transacao.objectStore('meta').clear();
  });
}
