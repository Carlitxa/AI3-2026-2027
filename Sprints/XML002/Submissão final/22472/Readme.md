| Falha introduzida | Ficheiro | Mal formado ou inválido? | Mensagem obtida | O que a mensagem permitiu (ou não) concluir |
|---|---|---|---|---|
| Retirar uma etiqueta de fecho | aviso-valida.xml | invalido | This page contains the following errors: error on line 8 at column 9: Opening and ending tag mismatch: telefone line 7 and aviso | Que existe uma tag com erros de abertura ou fexamento. |
| Pôr texto onde é esperado um número | aviso-valida.xml | Mal formado | cvc-type.3.1.3: The value 'ug' of element 'telefone' is not valid. | O valor não é valido no elemento telefone|
| Trocar a ordem de dois elementos | aviso-valida.xml | Mal formado | Element name 'numerotrabalho' is invalid. One of the following is expected: - nome Error indicated by: {the schema} with code:xml(cvc-complex-type.2.4.a) | Algo esta a ser esperado pelo xml. |


| Construção | Onde a usou | O que ficou a ser exigido | O que continua a ser permitido |
|---|---|---|---|
| `xsd:complexType` | elemento produto | O tipo de elemento | Criação de outros elementos |
| `xsd:sequence` | elemento produto  | A ordem necessaria de elementos necessaria | Criar os elementos listados pela ordem criada |
| `xsd:attribute` com `use` | productID | A necessidade de um atributo | Criar 1 atributo com o tipo necessario |
| `minOccurs` / `maxOccurs` | provider | A necessidade de criar um elemento e quantas vezes este pode estar presente | No minimo 0, No maximo 3 |
| `mixed="true"` *(de `aviso.xsd`)* | aviso | Nada | Colocar texto dentro do elemento de forma livre |