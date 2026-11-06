| Alteração introduzida | Sintaxe YAML errada, OpenAPI inválido, exemplo inválido ou válido? | Ferramenta | Mensagem obtida | O que a mensagem permitiu (ou não) concluir |
| --- | --- | --- | --- | --- |
| Usar uma tabulação na indentação de uma linha | válido | VS code | --- | --- |
| Retirar as plicas de um `$ref` | OpenApi Invalido | OpenApi(Swagger) | Incorrect type Expected "string". | Que era esperado uma string, e um valor sem pelicas não é uma string |
| Retirar a `description` de uma resposta | OpenApi Invalido | OpenApi(Swagger) | Missing property "description". | Todas as respostas necessitam de uma descrição |
| Retirar o `required: true` do parâmetro de caminho `id` |  OpenApi Invalido | OpenApi(Swagger) | Missing property "required". | É necessario ter uma tag de required |
| Pôr `estado: fechada` no exemplo da sugestão | Valido | OpenApi(Swagger) | --- | --- |
| Retirar o cabeçalho `Cache-Control` do `200` de `listarCategorias` | OpenApi Invalido | OpenApi(Swagger) | Incorrect type. Expected "object(OpenAPI 3.0.X)". | Headers: precisam de ter algum objeto respetivo ao cabeçalho |


| Construção | Onde a usou | O que ficou a ser exigido | O que continua a ser permitido |
| --- | --- | --- | --- |
| parâmetro `in: path` | IdSugestao | que o url contenha um campo de ID | O resto do URL, desde que este campo esteja no url, aplicam-se as normas normais do caminho. |
| parâmetro `in: query` | Listar sugestões, parameters | Nada | Tudo |
| `requestBody` + `$ref` | Posts | Restringe que o corpo do pedido siga a formatação e regras do esquema referenciado. | Nada |
| `allOf` + `readOnly` | Estado em Sugestao | Apenas pode ser recebido pelo pedido | Tudo menos enviar aplicar esta restrição em resposta |
| `nullable` | dataResolucao | nada | tudo, incluindo deixar este campo vazio ("null") |
| resposta `201` + `Location` | Post, sugestões | O URL do host do servidor | Tudo |
| `Cache-Control` | Post, sugestões | Delimita as regras de armazenamento em cache da informação | Depende das regras incluidas nesta tag |
| `ETag` + `If-Match` | Sugestões/{id} PUT | É necessario que a Etag do header seja igual ao corpo do pedido | Tudo |
