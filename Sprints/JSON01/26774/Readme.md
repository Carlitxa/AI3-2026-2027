## Passo 12

| Alteração introduzida | Ficheiro | Sintaxe errada, inválido ou válido? | Mensagem obtida | O que a mensagem permitiu (ou não) concluir |
| --- | --- | --- | --- | --- |
| Retirar a vírgula entre dois pares | `turma.json` | Sintaxe errada | `Expecting ',' delimiter: line 4 column 3 (char 72)` | Indicou onde o parser deixou de conseguir ler (linha 4, coluna 3), mas não a causa: a vírgula em falta está no fim do par anterior. O documento nem chegou a ser validado. |
| Pôr texto onde é esperado um número | `turma.json` | Inválido | `/totalAlunos must be integer` | A sintaxe estava correta e o documento foi lido. A mensagem indicou a propriedade (`/totalAlunos`) e o tipo esperado (`integer`). |
| Retirar uma propriedade obrigatória | `turma.json` | Inválido | `must have required property 'codigo'` | Indicou o nome exato da propriedade em falta. O `instancePath` vazio mostra que o problema está no objeto de topo. |
| Trocar a ordem de duas propriedades | `turma.json` | Válido | `teste.json valid` | A ordem das propriedades de um objeto JSON não importa para a validação, ao contrário do `xsd:sequence` do XML Schema. |

## Passo 13

| Construção | Onde a usou | O que ficou a ser exigido | O que continua a ser permitido |
| --- | --- | --- | --- |
| `type` / `properties` | `teorica` em `disciplinas.schema.json` | Ser um objeto, com `horas` do tipo `integer` e `nome` do tipo `string` | Propriedades extra não declaradas, porque o schema de base não as proíbe |
| `required` | `["codigo", "nome", "teorica"]` em cada disciplina (`disciplinas.schema.json`) | Estas três propriedades têm de existir | Omitir `pratica` e `ano`, que são opcionais |
| `items` + `minItems` / `maxItems` | `cursos` em `turma.schema.json` | Exatamente 2 elementos, cada um entre `tdm`, `ei`, `msti` e `rsi` | Repetir o mesmo curso (`["tdm", "tdm"]`) e qualquer ordem |
| `pattern` | `disciplina` em `turma.schema.json` (`^Aplicacoes .+`) | Começar por `Aplicacoes ` seguido de pelo menos um carácter | Qualquer texto depois do início (ex.: `Aplicacoes xyz`) |
| `enum` | `data` em `turma.schema.json` | Ser exatamente `08-10-2026`, `09-10-2026` ou `18-11-2026` | Qualquer uma das três, mesmo que não faça sentido com os restantes dados |
| `dependencies` | `numeroInscritosTp2` → `docenteTp2` em `turma.schema.json` | Se existir `numeroInscritosTp2`, tem de existir `docenteTp2` | `docenteTp2` sozinho, ou nenhum dos dois (turno TP2 inteiro em falta) |
| `oneOf` | `planoAno1` em `turma.schema.json` | O array ser válido para exatamente um dos dois conjuntos (`ADM1`/`API1`/`BD1` ou `ID1`/`SI1`/`SD1`) | Qualquer subconjunto, ordem ou repetição de um só conjunto (ex.: `["ADM1"]`, `["BD1", "BD1"]`) |