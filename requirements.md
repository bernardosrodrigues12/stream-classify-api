

**Modelo:** `gemini-3.5-flash-lite` (Google AI Studio) **Streaming:** SSE sobre `POST /api/classify`

---

## Fase 0: Preparação (antes de segunda)

- Ler a documentação oficial de saída estruturada (JSON) do Gemini
- Criar ou confirmar a chave de API no Google AI Studio
- Confirmar que o modelo `gemini-3.5-flash-lite` aparece na lista de modelos da conta
- Instalar Node.js LTS e Git, e verificar as versões no terminal
- Criar a conta ou confirmar acesso ao GitHub

---

## Passo 1: Setup do repositório (Seg 16/11, parte de 4h)

**Branch:** `main`, depois `develop`

- Criar a pasta `stream-classify-api/`
- Executar `git init` na raiz
- Criar o `.gitignore` com `node_modules/`, `.env`, `dist/`, `coverage/`
- Criar o `README.md` (esqueleto com título e seção "Como rodar")
- Criar o `CHANGELOG.md` com a seção `[Unreleased]`
- Criar o `requirements.md` na raiz
- Criar a pasta `docs/` com `flow-diagram.md` vazio
- Fazer o commit inicial em `main`: `chore: initialize repository with base documentation`
- Criar a branch `develop` a partir de `main`
- Confirmar com `git branch` que `main` e `develop` existem

**Critério de conclusão:** `git branch` mostra `main` e `develop`, e o `.env` está ignorado pelo Git.

---

## Passo 2: Endpoint SSE com Gemini (Seg 16/11 e Ter 17/11)

**Branch:** `feature/streaming-endpoint`

### Setup da API

- Criar a branch `feature/streaming-endpoint` a partir de `develop`
- Criar a pasta `api/`
- Inicializar com `npm init -y` e instalar TypeScript, `tsx`, `@types/node`
- Criar o `tsconfig.json`
- Criar o `.env.example` com `GEMINI_API_KEY=` e `PORT=3000`
- Criar o `.env` local com a chave real (sem commitar)
- Adicionar os scripts `dev`, `build`, `start` e `test` no `package.json`
- Criar a estrutura de pastas: `src/routes/`, `src/services/`, `src/schemas/`, `src/errors/`, `src/sse/`, `tests/`

### Servidor e rota

- Criar `src/server.ts` com carregamento do `.env` e inicialização na porta configurada
- Criar `src/routes/classify.ts` com `POST /api/classify`
- Definir o cabeçalho `Content-Type: text/event-stream` e `Cache-Control: no-cache`
- Criar `src/sse/write-event.ts` com a função que formata eventos SSE

### Cliente Gemini

- Instalar o SDK oficial do Gemini
- Criar `src/services/gemini-client.ts` com a constante do modelo `gemini-3.5-flash-lite`
- Implementar a chamada em streaming
- Emitir eventos `token` conforme os fragmentos chegam
- Tornar o cliente injetável, para permitir mocks nos testes

### Verificação

- Testar com `curl -N -X POST` e confirmar que os tokens aparecem progressivamente
- Confirmar que o evento final é emitido
- Commit: `chore(api): scaffold node typescript project`
- Commit: `feat(api): add SSE streaming endpoint for gemini`
- Merge em `develop` com `git merge --no-ff feature/streaming-endpoint`

**Critério de conclusão:** o `curl` exibe tokens em tempo real e o evento final é emitido.

---

## Passo 3: Validação com Zod (Ter 17/11)

**Branch:** `feature/schema-validation`

- Criar a branch `feature/schema-validation` a partir de `develop`
- Instalar `zod`
- Criar `src/schemas/classification.schema.ts` com `category` (enum fechado), `priority` e `summary`
- Configurar o Gemini para responder em JSON conforme o schema
- Acumular o texto do stream ao final
- Validar com `safeParse`
- Emitir evento `result` em caso de sucesso
- Emitir evento `error` com código `invalid_output` em caso de falha
- Instalar e configurar o Vitest (`vitest.config.ts`)
- Criar `tests/schema.test.ts` com os casos: JSON válido, enum fora do esperado, campo ausente e JSON malformado
- Commit: `feat(schema): validate classification output with zod`
- Commit: `test(schema): cover invalid enum and missing fields`
- Merge em `develop`

**Critério de conclusão:** testes do schema passando e nenhum resultado inválido chega como `result`.

---

## Passo 4: Retry, erros por tipo e testes de falha (Qua 18/11, 6h)

**Branch:** `feature/retry-backoff`

### Erros

- Criar a branch `feature/retry-backoff` a partir de `develop`
- Criar `src/errors/app-error.ts` com `code`, `message` e `retryable`
- Mapear 429 para `rate_limited` (retryable)
- Mapear 5xx para `provider_error` (retryable)
- Mapear timeout para `timeout` (retryable)
- Mapear JSON inválido para `invalid_output` (não retryable)

### Retry

- Criar `src/services/retry.ts` com backoff exponencial e jitter
- Limitar a 3 tentativas
- Aplicar retry somente a erros retryable
- Garantir que não há nova tentativa depois que tokens já foram enviados ao cliente (emitir `error` direto)

### Testes

- Criar `tests/retry.test.ts` com: backoff crescente, limite de tentativas e jitter dentro do intervalo
- Criar `tests/classify.test.ts` com mocks de 429, 500, timeout e JSON inválido
- Rodar `npm test` e confirmar que tudo passa
- Commit: `feat(retry): add exponential backoff with jitter`
- Commit: `feat(errors): classify provider errors by retryability`
- Commit: `test(retry): cover 429, 500 and timeout scenarios`
- Merge em `develop`

**Critério de conclusão:** `npm test` passa e cada tipo de erro produz o `code` e o `retryable` corretos.

---

## Passo 5: Interface React com streaming (Qui 19/11, 4h)

**Branch:** `feature/react-ui`

### Setup

- Criar a branch `feature/react-ui` a partir de `develop`
- Criar a pasta `web/` com Vite, React e TypeScript
- Configurar o proxy de `/api` para a API no `vite.config.ts`
- Criar a estrutura: `src/hooks/`, `src/components/`, `src/types/`
- Criar `src/types/classification.ts` com o tipo do resultado
- Commit: `chore(web): scaffold vite react typescript app`

### Hook de streaming

- Criar `src/hooks/use-classify-stream.ts` com `fetch` e leitura de `ReadableStream`
- Interpretar os eventos SSE (`token`, `result`, `error`)
- Modelar os estados: `idle`, `loading`, `streaming`, `success`, `error`
- Commit: `feat(web): consume SSE stream in react`

### Componentes

- Criar `src/components/classify-form.tsx` (campo de texto e botão "Classificar")
- Criar `src/components/result-panel.tsx` (cartões de categoria, prioridade e resumo)
- Criar `src/components/error-message.tsx` (mensagem por tipo e botão "Tentar novamente")
- Garantir que "Tentar novamente" preserva o texto digitado
- Commit: `feat(web): render loading, streaming and error states`

### Critérios de UI (validar um a um)

- **Ocioso:** campo de texto e botão "Classificar", desabilitado com campo vazio
- **Carregando:** indicador visível até o primeiro token
- **Streaming parcial:** texto aparece token a token, com aviso de que ainda não está validado
- **Sucesso:** cartões com categoria, prioridade e resumo, substituindo o texto parcial
- **Erro:** mensagem por tipo (limite de taxa, timeout, erro do provedor, resposta inválida) com botão "Tentar novamente"
- Testar o erro manualmente com uma chave inválida
- Merge em `develop`

**Critério de conclusão:** os cinco estados são reproduzíveis manualmente.

---

## Passo 6: Diagrama e documentação (Sex 20/11 opcional, Sáb 21/11)

**Branch:** `docs/flow-diagram`

- Sex 20/11 (opcional, 2h): estudar a parte de erros e retry da documentação, ou realocar para sábado
- Criar a branch `docs/flow-diagram` a partir de `develop`
- Criar `docs/flow-diagram.md` com o fluxo: requisição → stream → validação → erro
- Atualizar o `README.md` com: descrição, pré-requisitos, variáveis de ambiente, como rodar API e UI, endpoints
- Atualizar o `CHANGELOG.md` na seção `[0.2.0]`, em português
- Commit: `docs: add request-stream-validation-error flow`
- Merge em `develop`

**Critério de conclusão:** alguém consegue rodar o projeto do zero seguindo só o README.

---

## Passo 7: Release (Sáb 21/11)

- Revisar o `CHANGELOG.md` e o `README.md`
- Merge de `develop` em `main` com `git merge --no-ff develop`
- Criar a tag: `git tag -a v0.2.0 -m "release: stream classification api v0.2.0"`
- Publicar: `git push origin main develop --tags`
- Confirmar no GitHub que a tag `v0.2.0` aparece e que o repositório está público

**Critério de conclusão:** `main` contém todo o trabalho, a tag `v0.2.0` existe no GitHub e o repositório está público.

---

## Estrutura de pastas (referência)

```text
stream-classify-api/
├── api/
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/classify.ts
│   │   ├── services/gemini-client.ts
│   │   ├── services/retry.ts
│   │   ├── schemas/classification.schema.ts
│   │   ├── errors/app-error.ts
│   │   └── sse/write-event.ts
│   ├── tests/
│   │   ├── schema.test.ts
│   │   ├── retry.test.ts
│   │   └── classify.test.ts
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── web/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── hooks/use-classify-stream.ts
│   │   ├── components/
│   │   │   ├── classify-form.tsx
│   │   │   ├── result-panel.tsx
│   │   │   └── error-message.tsx
│   │   └── types/classification.ts
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docs/
│   └── flow-diagram.md
├── .gitignore
├── CHANGELOG.md
├── README.md
└── requirements.md
```

---

## Convenções

- **Código e nomes de arquivo:** inglês, kebab-case
- **README, CHANGELOG, requirements e docs:** português
- **Commits:** inglês, Conventional Commits (`feat`, `fix`, `test`, `docs`, `chore`)
- **Branches:** `main` (estável), `develop` (integração), `feature/*` e `docs/*`
- **Merges:** sempre com `--no-ff`, sem commit direto em `main`

---

## Requisitos não funcionais

- A chave de API não aparece no código, nos logs nem no frontend
- Erros transitórios são repetidos com backoff; erros permanentes não são
- Logs registram `requestId`, duração e código de erro, sem a mensagem completa do usuário
- O cliente Gemini é injetável para permitir mocks

---

## Riscos e mitigações

- **Limite de taxa do AI Studio:** retry com backoff e mensagem clara na UI
- **JSON parcial no fim do stream:** validação só ao final, com erro `invalid_output`
- **Falha depois de tokens enviados:** sem retry; erro emitido diretamente
- **CORS entre `web/` e `api/`:** proxy do Vite em desenvolvimento
- **Mudança do nome do modelo:** constante isolada em `gemini-client.ts`

---

## Checklist final de entrega

- Estrutura de pastas conforme a seção acima
- `.env` ignorado e `.env.example` presente
- Branches `main`, `develop`, `feature/*` e `docs/*` criadas e mescladas
- Commits em inglês no padrão Conventional Commits
- `npm test` passa na API
- Os cinco estados da UI funcionam
- README e CHANGELOG em português
- Tag `v0.2.0` publicada no GitHub