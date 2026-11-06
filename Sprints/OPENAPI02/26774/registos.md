# Ficha API02 · Autenticação com JWT (registo)

## Utilizadores de teste

| utilizador   | nome        | papel    | palavra-passe |
| ------------ | ----------- | -------- | ------------- |
| `12345`      | Ana Silva   | aluno    | 12345678 |
| `67890`      | Bruno Costa | aluno    | 87654321 |
| `rita.sousa` | Rita Sousa  | servicos | qwertyui |

Ferramentas usadas: PyYAML (sintaxe) e `npx @redocly/cli lint` (OpenAPI e exemplos). Em todas as alterações o PyYAML respondeu `OK`, porque a sintaxe YAML se mantinha correta.

| Alteração introduzida | Sintaxe YAML errada, OpenAPI inválido, exemplo inválido ou válido? | Ferramenta | Mensagem obtida | O que a mensagem permitiu (ou não) concluir |
| --- | --- | --- | --- | --- |
| Referir `tokenJWT` no `security` da raiz sem o declarar em `securitySchemes` | OpenAPI inválido | Redocly (regra `security-defined`, erro) | `There is no tokenJWT security scheme defined.` (e um aviso de que o esquema que sobrou nunca é usado) | O YAML estava correto; só o validador cruza o nome usado em `security` com os esquemas declarados. |
| Escrever `type: bearer` em vez de `type: http` | OpenAPI inválido | Redocly (regra `struct`, erro) | `type can be one of the following only: "apiKey", "http", "oauth2", "openIdConnect".` e `The field scheme is not allowed here.` | `bearer` não é um tipo de esquema; é o valor de `scheme` dentro de `type: http`. Os erros em `scheme` e `bearerFormat` são consequência do tipo errado. |
| Escrever `- tokenJWT: [servicos]` em `registarAcompanhamento` | Válido para as ferramentas | Redocly (sem erro nem aviso novo) | Nenhuma mensagem nova | O linter não apanha o problema. Para esquemas `http`, a lista tem de ficar vazia (os scopes só existem em `oauth2` e `openIdConnect`), por isso o papel não se exprime de forma estruturada, só em texto na `description`. |
| Retirar o `security: []` de `listarCategorias` | Válido | Redocly (sem erro nem aviso novo) | Nenhuma mensagem nova | A operação passa a herdar o `security` da raiz, ou seja, a exigir token. O linter não sabe que devia ser pública; para um cliente sem `Authorization`, a operação passaria a responder `401`. |
| Manter `numeroAluno` no `required` de `SugestaoNova` após a remoção da propriedade | Válido (contrato incoerente) | Redocly (sem erro nem aviso novo) | Nenhuma mensagem nova | O `required` aceita nomes que não constam de `properties`. O contrato passa a exigir no pedido um campo que já não descreve, e o linter não o assinala. |
| Indicar `tipo: bearer` (minúsculas) no exemplo do `Token` | Exemplo inválido | Redocly (regra `no-invalid-media-type-examples`, aviso) | `Example value must conform to the schema: tipo property must be equal to one of the allowed values "Bearer".` | O documento continua OpenAPI válido; o aviso diz que o exemplo não cumpre o `enum` do schema. |

## Passo 28 · Testes ao servidor

Todos os pedidos feitos com `curl.exe -i`, com o corpo num ficheiro (`-d "@pedido.json"`).

| # | Pedido | Código | `Cache-Control` | `WWW-Authenticate` | Corpo | Conforme o esperado? |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | `POST /v2/tokens`, credenciais da Ana | 200 | `no-store` | (não tem) | `token`, `tipo: Bearer`, `expiraEm: 900` | Sim |
| T2 | `POST /v2/tokens`, palavra-passe errada | 401 | `no-store` | (não tem) | `{"codigo":401,"mensagem":"Utilizador ou palavra-passe incorretos."}` | Sim |
| T3 | `POST /v2/tokens`, `"utilizador":"99999"` | 401 | `no-store` | (não tem) | Idêntico a T2: mesmo `Content-Length` (67) e mesmo `ETag` | Sim |
| T4 | `POST /v2/tokens`, `"utilizador":12345` (número) | 400 | `no-store` | (não tem) | `Erro` com `detalhes` (`campo: utilizador`) | Sim |
| T5 | `POST /v2/tokens`, corpo `{utilizador:` | 400 | `no-store` | (não tem) | `{"codigo":400,"mensagem":"O corpo do pedido não é JSON válido."}`, `Content-Type: application/json` | Sim |
| T6 | `GET /v2/sugestoes` sem `Authorization` | 401 | `no-store` | `Bearer` | `{"codigo":401,"mensagem":"Token ausente."}` | Sim |
| T7 | `GET /v2/sugestoes`, token da Ana | 200 | `private, no-cache` | (não tem) | `total: 2`, só as sugestões da Ana (ids 1 e 2) | Sim |
| T8 | `GET /v2/sugestoes`, token da Rita | 200 | `private, no-cache` | (não tem) | `total: 4`, todas as sugestões | Sim |
| T9 | T7 com um carácter do payload alterado | 401 | `no-store` | `Bearer error="invalid_token"` | `{"codigo":401,"mensagem":"Token inválido ou expirado."}` | Sim |
| T10 | T7 com token expirado (`JWT_VALIDADE=10`, pedido repetido após 11 s) | 200 antes de expirar, 401 depois | `no-store` (no 401) | `Bearer error="invalid_token"` | `{"codigo":401,"mensagem":"Token inválido ou expirado."}` | Sim |
| T11 | T7 com token `alg: none`, payload da Ana e assinatura vazia | 401 | `no-store` | `Bearer error="invalid_token"` | `{"codigo":401,"mensagem":"Token inválido ou expirado."}` | Sim |
| T12 | T7 após «Terminar sessão» no cliente, com o token copiado antes | 200 | `private, no-cache` | (não tem) | `total: 2`, só as sugestões da Ana (ids 1 e 2) | Sim, o servidor continuou a aceitar o token. «Terminar sessão» só descarta o token no cliente; o servidor não guarda sessões e só verifica a assinatura e o `exp`, por isso o token é válido até expirar. |

Observação sobre T9, T10 e T11: as três respostas são iguais (mesmo `Content-Length` e mesmo `ETag`), pelo que a resposta não revela se o token falhou por assinatura, por expiração ou por algoritmo.

## Passo 29 · Observações no browser

- (a) Pedido `POST http://localhost:3000/v2/tokens` com `Content-Type: application/json` e corpo `{"utilizador":"12345","palavraPasse":"..."}` (`content-length: 48`), sem cabeçalho `Authorization`, por ser uma operação pública. Resposta `200 OK` com `cache-control: no-store`, `content-type: application/json; charset=utf-8` e corpo `{"token":"eyJ...","tipo":"Bearer","expiraEm":900}`.
- (b) O pedido `GET http://localhost:3000/v2/sugestoes` leva o cabeçalho `Authorization: Bearer eyJ...` (o token obtido em `POST /v2/tokens`). A resposta foi `304 Not Modified` com `cache-control: private, no-cache` e o mesmo `etag` de uma resposta anterior: o browser reenviou o pedido com `if-none-match` (a validação que o `no-cache` obriga a fazer) e o servidor confirmou que a lista não mudou.
- (c) Com o servidor arrancado com `JWT_VALIDADE=30`, entrei no cliente e não fiz mais nada. A contagem do tempo restante chegou a `00:00` e o cliente terminou a sessão sozinho, sem esperar por um pedido: voltou ao formulário de entrada e mostrou «Sessão expirada. É necessária nova autenticação.». O termo é decidido pelo cliente, a partir do `exp` do payload, e não por uma resposta `401` do servidor.
- (d) Recarregamento da página com sessão ativa: volta ao formulário, porque o token só existe numa variável do módulo, que se perde ao recarregar.
- (e) Conteúdo de `localStorage` e `sessionStorage`: ambos estão vazios, logo o token não é guardado no browser.

## Passo 30 · Construções utilizadas

| Construção | Onde foi utilizada | O que passou a ser exigido | O que continua a ser permitido |
| --- | --- | --- | --- |
| `securitySchemes` `http`/`bearer` | `components.securitySchemes.tokenJWT` | Um token no cabeçalho `Authorization: Bearer <token>` | O OpenAPI não valida o conteúdo do token (`bearerFormat` é só informativo); qualquer string é aceite pelo contrato. |
| `security` na raiz | Raiz do documento (`- tokenJWT: []`) | Que todas as operações exijam o token | Isentar operações com `security: []`. |
| `security: []` | `listarCategorias`, as duas operações de estatísticas e `criarToken` | Nada: a operação não exige autenticação | Qualquer cliente, mesmo sem `Authorization`. |
| `readOnly` em `numeroAluno` | Schema `Sugestao`, 2.º subesquema do `allOf` | O campo existe e é obrigatório nas respostas | Deixa de ser exigido nos pedidos (`SugestaoNova`); o contrato não impede que um cliente o envie, já que não há `additionalProperties: false`. |
| Resposta `401` + `WWW-Authenticate` | `NaoAutenticado`, usada em `GET /sugestoes` e nas outras operações protegidas | Corpo `Erro`, cabeçalho `WWW-Authenticate` (`Bearer` ou `Bearer error="invalid_token"`) e `Cache-Control: no-store` | O contrato só distingue token ausente de inválido pelo valor do cabeçalho. |
| Resposta `403` | `Proibido`, em `criarSugestao`, `substituirSugestao`, `retirarSugestao` e `registarAcompanhamento` | Corpo `Erro` e `Cache-Control: no-store` | A regra de quem pode o quê está só em texto; no servidor existe `exigirPapel`, mas nenhuma rota implementada o usa. |
| `exigirToken` + `jwt.verify` | `servidor/autenticacao.js`, em `GET /v2/sugestoes` | Cabeçalho `Bearer`, assinatura `HS256` válida, `exp` não ultrapassado e claims `sub`, `nome` e `papel` válidos | Qualquer cliente com um token válido, mesmo depois de «Terminar sessão» no cliente, até o token expirar (T12). |
| `Cache-Control: no-store` em `criarToken` | `200` de `POST /v2/tokens` | Que nenhuma cache guarde a resposta que contém o token | O cliente pode usar o token em memória; confirmado em T1, em que o servidor envia o cabeçalho. |