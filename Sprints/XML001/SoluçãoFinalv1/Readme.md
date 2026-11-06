| Nó | Tipo | Pai | Irmãos | Justificação |
|---|---|---|---|---|
| fatura | raiz | - | - | Sendo o nó inicial, não tem nem irmão, nem pai. Caso contrario deixaria de ser um nó tipo raiz. |
| cliente | intermédio | fatura | cabecalho | |
| preco | terminal | produto | quantidade | |
| id | atributo | produto | - | Um atributo não tem irmãos. Um atributo é um valor associado a um nó. Apesar de que este nó pode ter outros atributos, eles não são relacionados entre-se, apenas se relancionando com o pai. |
| 0.99 | texto | preco | - | Nós de texto são valores associados a um nó pai. Não é necessario nem possivel ter um nó irmão, pois isto seria apenas uma alteração no texto deste nó |