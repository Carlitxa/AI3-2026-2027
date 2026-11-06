const CACHE_INTERFACE = 'interface-v1';
const CACHE_DADOS_PUBLICOS = 'dados-publicos';
const FICHEIROS_INTERFACE = [
  '/',
  '/index.html',
  '/estilos.css',
  '/app.js',
  '/configuracoes.js',
  '/bd.js',
  '/pendentes.js'
];
const CAMINHOS_INTERFACE = new Set(FICHEIROS_INTERFACE);

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_INTERFACE).then((cache) => cache.addAll(FICHEIROS_INTERFACE))
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes
      .filter((nome) => nome !== CACHE_INTERFACE && nome !== CACHE_DADOS_PUBLICOS)
      .map((nome) => caches.delete(nome)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (evento) => {
  if (evento.data?.tipo === 'ativar') self.skipWaiting();
});

async function cachePrimeiro(pedido) {
  const cache = await caches.open(CACHE_INTERFACE);
  const copia = await cache.match(pedido);
  if (copia) return copia;

  const resposta = await fetch(pedido);
  if (resposta.ok) await cache.put(pedido, resposta.clone());
  return resposta;
}

function cacheEAtualizacaoEmSegundoPlano(evento) {
  const cache = caches.open(CACHE_DADOS_PUBLICOS);
  const atualizacao = cache.then(async (dados) => {
    const resposta = await fetch(evento.request);
    if (resposta.ok) await dados.put(evento.request, resposta.clone());
    return resposta;
  });

  evento.waitUntil(atualizacao.then(() => undefined).catch(() => undefined));
  return cache.then(async (dados) => {
    const copia = await dados.match(evento.request);
    return copia ?? atualizacao;
  });
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname === '/v2/categorias') {
    evento.respondWith(cacheEAtualizacaoEmSegundoPlano(evento));
    return;
  }
  if (url.pathname === '/v2' || url.pathname.startsWith('/v2/')) return;
  if (CAMINHOS_INTERFACE.has(url.pathname)) {
    evento.respondWith(cachePrimeiro(pedido));
  }
});
