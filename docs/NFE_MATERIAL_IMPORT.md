# Importacao de materiais por NF-e

## Arquitetura

O sistema usa React/Vite no frontend, Django REST Framework no backend e
PostgreSQL em producao. O cadastro de materiais e global: nao existe no dominio
atual um modelo de projeto, seletor de projeto ou associacao material-projeto.
Por isso, a importacao grava no mesmo catalogo global usado pelo cadastro
manual e nao aceita um identificador de projeto enviado pelo cliente.

## Fluxo

1. Em Cadastros > Materiais, selecione `Importar NF-e XML`.
2. Selecione ou arraste ate 10 arquivos XML, com no maximo 2 MB por arquivo e
   10 MB no total.
3. Processe os arquivos e confira fornecedor, codigos, produto, unidade,
   valores, centro de custo e situacao.
4. Corrija unidades desconhecidas. A equivalencia pode ser lembrada para
   importacoes futuras.
5. Para materiais existentes, escolha entre ignorar, atualizar custo e dados da
   compra ou cadastrar como novo.
6. Confirme o salvamento. Nenhum material e gravado durante a previa.

## Endpoints

- `POST /api/v1/inventory/nfe/preview/`: recebe multipart no campo `files`.
- `POST /api/v1/inventory/nfe/confirm/`: recebe o token assinado da previa e os
  itens revisados.

Os endpoints exigem autenticacao e a mesma permissao de escrita usada pelo
cadastro de materiais. Administradores possuem acesso direto.

## Regras

- `cProd` e salvo como codigo de compra; o codigo interno recebe uma sugestao
  independente e pode ser revisado.
- `xProd` e normalizado novamente no backend antes do salvamento.
- `uCom` sempre e convertido para a enumeracao oficial de unidades.
- Unidades desconhecidas nunca recebem valor automatico.
- A deteccao de material considera codigo de compra junto de CNPJ/fornecedor e
  usa o nome normalizado como alternativa.
- Materiais existentes sao ignorados por padrao.
- Chave da NF-e e hash do documento impedem reimportacao.
- A confirmacao e atomica: em caso de falha, nenhum item do lote e gravado.
- O XML original nao e armazenado. O historico registra chave, hash, arquivo,
  fornecedor, data, usuario e quantidade processada.
- O parser bloqueia DTD, entidades e referencias externas.

## Testes

```powershell
cd backend
..\.venv\Scripts\python.exe -m pytest tests/test_nfe_material_import.py -q
..\.venv\Scripts\ruff.exe check apps/inventory tests/test_nfe_material_import.py
cd ..
npm run deploy:check
```

## Limitacoes

- Nao ha consulta ou validacao online na SEFAZ.
- Como o sistema nao possui entidade de projeto, nao existe associacao por
  projeto a registrar no historico. Uma futura introducao de multiempresa ou
  multiprojeto deve adicionar esse relacionamento aos materiais e importacoes.
- A equivalencia de unidade aprendida e global, acompanhando o catalogo atual.
