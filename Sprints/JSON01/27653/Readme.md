## Passo 12

| Alteração introduzida | Ficheiro | Sintaxe errada, inválido ou válido? | Mensagem obtida | O que a mensagem permitiu (ou não) concluir |
| --- | --- | --- | --- | --- |
| Retirar a vírgula entre dois pares | `turma.json` | Sintaxe errada | `Expecting ',' delimiter: line 5 column 3 (char 93)` | Indicou onde o parser deixou de conseguir ler o JSON devido à ausência da vírgula. O documento nem chegou a ser validado pelo schema. |
| Pôr texto onde é esperado um número | `turma.json` | Inválido | `'vinte' is not of type 'integer'` | A sintaxe estava correta, mas a validação indicou que `totalAlunos` tem de ser do tipo `integer`. |
| Retirar uma propriedade obrigatória | `turma.json` | Inválido | `'disciplina' is a required property` | Indicou que `disciplina` é uma propriedade obrigatória definida no schema. |
| Trocar a ordem de duas propriedades | `turma.json` | Válido | `ok -- validation done` | Permitiu concluir que a ordem das propriedades de um objeto JSON não é relevante para a validação, ao contrário do `xsd:sequence` do XML Schema. |

## Passo 13

| Construção | Onde a usou | O que ficou a ser exigido | O que continua a ser permitido |
| --- | --- | --- | --- |
| `type` / `properties` | `teorica` em `disciplinas.schema.json` | Ser um objeto, com `horas` do tipo `integer` e `nome` do tipo `string` | Propriedades extra não declaradas, porque o schema de base não as proíbe |
| `required` | `["codigo", "nome", "teorica"]` em cada disciplina (`disciplinas.schema.json`) | Estas três propriedades têm de existir | Omitir `pratica` e `ano`, que são opcionais |
| `items` + `minItems` / `maxItems` | `cursos` em `turma.schema.json` | Exatamente 2 elementos, cada um entre `tdm`, `ei`, `msti` e `rsi` | Repetir o mesmo curso e usar qualquer ordem |
| `pattern` | `disciplina` em `turma.schema.json` (`^Aplicacoes .+`) | Começar por `Aplicacoes ` seguido de pelo menos um carácter | Qualquer texto depois desse início |
| `enum` | `data` em `turma.schema.json` | Ser exatamente `08-10-2026`, `09-10-2026` ou `18-11-2026` | Qualquer uma das três datas |
| `dependencies` | `numeroInscritosTp2` → `docenteTp2` em `turma.schema.json` | Se existir `numeroInscritosTp2`, tem de existir `docenteTp2` | `docenteTp2` sozinho, ou nenhum dos dois |
| `oneOf` | `planoAno1` em `turma.schema.json` | O array ser válido para exatamente um dos dois conjuntos definidos | Qualquer subconjunto ou repetição de elementos de um só conjunto |

## Reflexão
1. Conversão de XML para JSON

Ao converter XML para JSON, a distinção entre atributos e elementos deixa de existir. Por exemplo, codigo e horas, que eram atributos no XML, passam a ser propriedades dos objetos JSON. A informação não é perdida, mas deixa de ser possível saber apenas pelo JSON se uma propriedade veio originalmente de um atributo ou de um elemento.

2. Ordem das propriedades

No XML Schema, o xsd:sequence pode obrigar os elementos a aparecer numa determinada ordem. No JSON, a ordem das propriedades não é relevante para a validação. Considero isto uma vantagem, porque o programa que lê os dados não precisa de depender da ordem em que as propriedades aparecem.

3. Limites de totalAlunos

Definir totalAlunos entre 16 e 24 não impede todas as combinações possíveis. Por exemplo, o schema pode aceitar valores em que o número de alunos dos TP não corresponde ao total de alunos. Para garantir que numeroInscritosTp1 + numeroInscritosTp2 corresponde exatamente a totalAlunos, seriam necessários mecanismos que estão fora do âmbito desta ficha.

4. Adicionar uma nova propriedade obrigatória

Se fosse adicionada uma nova propriedade obrigatória ao schema, os documentos existentes que não tivessem essa propriedade deixariam de ser válidos. Para evitar esse problema, uma solução seria tornar a nova propriedade opcional, caso ela não seja indispensável para todos os documentos.

5. Custo da validação

A validação acrescenta algum processamento, mas considero que compensa porque permite detetar erros antes de os dados serem utilizados pelo programa. Assim, é possível evitar problemas causados por dados em falta, tipos incorretos ou valores que não respeitam as regras definidas.