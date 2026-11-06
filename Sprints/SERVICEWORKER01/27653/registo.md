# Ficha 6 · Service Worker e IndexedDB

## Etapa 4.1 · Contrato e estratégia de cache

O contrato OpenAPI mantém a versão `2.1.0` e não é alterado nesta ficha.

| Pedido | `Cache-Control` no contrato | Depende do cookie? | Estratégia no service worker | Guardado em IndexedDB? |
| --- | --- | --- | --- | --- |
| Ficheiros da interface (`/`, `/app.js`, `/estilos.css`, …) | — | Não | Cache-first (`interface-v1`) | Não |
| `GET /v2/categorias` | `public, max-age=86400` | Não | Cache e atualização em segundo plano (`dados-publicos`) | Não |
| `POST /v2/sessao` | `no-store` | Não | Só rede | Não |
| `GET /v2/sessao` | `no-store` | Sim | Só rede | Não |
| `DELETE /v2/sessao` | `no-store` | Não | Só rede | Não |
| `GET /v2/sugestoes` | `private, no-cache` | Sim | Só rede | Sim |
| `POST /v2/sugestoes` | `no-store` | Sim | Só rede | Sim: sugestão criada na loja `sugestoes`; se offline, fica em `pendentes` |

O cabeçalho `Cache-Control` descreve a política HTTP do recurso. A Cache API não aplica automaticamente esse prazo: o service worker controla a utilização e atualização das respostas que guarda.

> **Discrepância de autenticação:** o OpenAPI atual declara `security: tokenJWT` em `GET /sessao`, enquanto o fluxo desta ficha utiliza o cookie de sessão `HttpOnly`. O contrato foi mantido intacto; a implementação segue o fluxo pedido na ficha e utiliza o cookie de sessão.

## Etapa 4.6 · Verificação do servidor

Pedidos executados com `curl -i` em `localhost:3000`:

| # | Pedido | Resultado observado | Conforme? |
| --- | --- | --- | --- |
| T1 | `GET /v2/categorias` sem cookie | `200`; `Cache-Control: public, max-age=86400`; cinco categorias com `codigo` e `descricao` | Sim |
| T2 | `POST /v2/sugestoes` com cookie da Ana e título com 5 caracteres | `400`; `Cache-Control: no-store`; `detalhes` contém `campo: titulo` | Sim |
| T3 | `POST /v2/sugestoes` com cookie da Ana e `numeroAluno: "99999"` no corpo | `201`; `Location: /v2/sugestoes/5`; `Cache-Control: no-store`; a resposta usa `numeroAluno: "12345"` | Sim |

### Verificação no browser

Resultados dos testes manuais realizados no browser:

| Ponto | Resultado |
| --- | --- |
| (a) Service worker ativo e conteúdo das caches, sem respostas de sessão ou sugestões | Service Worker ativo. `interface-v1` continha os recursos estáticos; `dados-publicos` continha `/v2/categorias`. |
| (b) Pedidos servidos pelo service worker na coluna Tamanho da Rede | `app.js` e `estilos.css` foram servidos pelo Service Worker com status `200`. |
| (c) Estado `a-verificar` com limitação 3G lento | Foi selecionado throttling 3G; a aplicação mostrou “Ligação disponível”. O estado `a-verificar` não foi observado. Resultado parcial. |
| (d) Recarregar Offline e observar cópia local | A página carregou através da cache e mostrou “Sem ligação”. |
| (e) Criar uma pendente offline e confirmar o envio online | A sugestão apareceu como “Por enviar” offline. Ao voltar online, o pedido apresentou status `201`; a sugestão passou para `sugestoes` e `pendentes` ficou vazio. Sincronização confirmada. Foi observada a mensagem visual incorreta “Erro: Sugestão criada com sucesso.”, possível problema a corrigir. |
| (f) Expiração da sessão enquanto há pendentes offline | Parcial: a sugestão manteve-se “Por enviar”; a aplicação informou que não conseguia confirmar a sessão offline. O Console mostrou `ERR_INTERNET_DISCONNECTED` no pedido `GET /v2/sessao`. A expiração real neste cenário não foi confirmada. |
| (g) Alterar ordenação sem ligação | A ordenação das sugestões mudou sem ligação. Concluído. |
| (h) Terminar sessão da Ana e entrar como Bruno | Ana e Bruno apresentaram os respetivos dados, sem misturar informação. Concluído. |
| (i) Expiração da Ana e entrada do Bruno no mesmo browser | A sessão da Ana foi expirada; depois foi iniciada a sessão do Bruno e apenas os dados do Bruno foram apresentados. Concluído. |
| (j) Atualização de `interface-v1` para `interface-v2` | A atualização foi testada no browser. Concluído. |

### Mecanismos de armazenamento

| Dado | Mecanismo usado | Quem escreve | Quando é apagado | Porque não se usou outro mecanismo |
| --- | --- | --- | --- | --- |
| Token | Cookie `sessao` com `HttpOnly` | Servidor | Ao expirar ou terminar a sessão | A página não deve guardar nem ler o token em armazenamento acessível a JavaScript. |
| Configurações | `localStorage` | Página | Quando o utilizador as remove | As preferências persistem entre separadores e sessões e não precisam de ser enviadas ao servidor. |
| Rascunho | `sessionStorage` | Página | Ao terminar sessão ou fechar a sessão do separador | O rascunho é temporário e isolado por separador. |
| Ficheiros da interface | Cache API (`interface-v1`) | Service worker | Quando uma versão nova é ativada e a cache antiga é removida | São respostas HTTP estáticas, não objetos de domínio para a IndexedDB. |
| Categorias | Cache API (`dados-publicos`) | Service worker | Quando a cache de dados públicos é removida | São dados públicos servidos pelo service worker; não precisam da IndexedDB. |
| Lista de sugestões | IndexedDB (`sugestoes`) | Página | Ao terminar sessão ou mudar de utilizador | São dados privados e estruturados, não devem ir para a Cache API nem para o armazenamento síncrono. |
| Sugestões pendentes | IndexedDB (`pendentes`) | Página | Após envio confirmado, descarte, terminação de sessão ou mudança de utilizador | Têm de sobreviver ao fecho do separador e guardar estado de envio. |

## Etapa 4.7 · Reflexão

1. Sem ligação não é possível autenticar credenciais ou criar uma sessão nova: essas operações precisam que o servidor valide a palavra-passe e emita o cookie.
2. Se o servidor criar a sugestão e a resposta se perder, a página pode guardar a pendente e reenviá-la, causando duplicação. Uma chave de idempotência, reconhecida e guardada pelo servidor para devolver o mesmo resultado em reenvios, evitaria a duplicação. Assumindo versionamento SemVer, esta alteração compatível acrescentaria uma versão minor (`2.2.0`); a issue não declara explicitamente a política de versionamento.
3. Background Sync poderia tentar enviar pendentes com a página fechada. O browser pode anexar automaticamente o cookie `HttpOnly` a um `fetch` same-origin, mas o worker não consegue ler nem renovar o cookie ou pedir credenciais. Se a sessão expirou ou foi terminada, o pedido recebe `401` e o utilizador terá de voltar à página e entrar para enviar as pendentes.
4. Num computador partilhado, a cópia local da Ana continua a conter dados pessoais depois da expiração. A ficha evita mostrá-la offline quando a sessão/proprietário expirou e apaga a base ao terminar sessão ou ao entrar outro utilizador. Os dados permanecem no armazenamento do browser até serem apagados, pelo que o risco local não desaparece totalmente.
5. As configurações ficam no `localStorage` e não são sincronizadas para outro computador. As pendentes ficam na IndexedDB do browser local e também não acompanham a Ana para outro dispositivo; no API03, o rascunho era igualmente local ao separador através do `sessionStorage`.
