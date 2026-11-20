# stream-classify-api

API de classificação de mensagens de suporte com streaming SSE, validação de saída com Zod e interface React.

![Interface com streaming de tokens r esultado validado](docs/ui-streaming.gif.gif)

## Funcionalidades

- Streaming de tokens com Server-Sent Events.
- Validação da saída do modelo com Zod: categorias e prioridades fechadas.
- Retry com backoff exponencial e jitter, só para erros retryable e só antes do primeiro token.
- Erros tipados com `code`, `message` e `retryable`.
- Interface React com estados de carregamento, streaming parcial, sucesso e erro.

## Pré-requisitos

- Node.js LTS (20.19 ou superior).
- Git.
- Uma chave de API do Google AI Studio com acesso ao modelo `gemini-3.5-flash-lite`.

## Variáveis de ambiente

Crie `api/.env` a partir de `api/.env.example`:

```env
GEMINI_API_KEY=sua_chave_aqui
PORT=3000
```

Nunca commite o `.env`. Ele já está no `.gitignore`.

## Como rodar

### API

```bash
cd api
npm install
npm run dev
```

A API sobe em `http://localhost:3000`.

### Interface

Em outro terminal:

```bash
cd web
npm install
npm run dev
```

Abra o endereço que o Vite mostrar (geralmente `http://localhost:5173`). O Vite encaminha `/api` para a API na porta configurada, por isso a API precisa estar rodando.

### Testes

```bash
cd api
npm test
```

## Endpoint

### `POST /api/classify`

Corpo da requisição:

```json
{ "message": "Fui cobrado duas vezes no cartão este mês." }
```

Resposta: `text/event-stream` com os eventos abaixo.

   | Evento | Dados | Quando |
   |---|---|---|
   | `token` | `{ "text": string }` | A cada fragmento recebido do modelo |
   | `result` | `{ "category", "priority", "summary" }` | Saída validada com sucesso |
   | `done` | `{ "requestId" }` | Fim bem-sucedido do stream |
   |`error` | `{ "code", "message", "retryable", "requestId" }` | Falha em qualquer etapa |

Categorias: `billing`, `technical`, `account`, `other`.
Prioridades: `low`, `medium`, `high`.

Um body inválido retorna HTTP 400 em JSON, sem stream.

Exemplo com `curl`:

```bash
curl -N -X POST http://localhost:3000/api/classify \
  -H "Content-Type: application/json" \
  -d '{"message":"Fui cobrado duas vezes no cartão este mês."}'
```

Para o fluxo completo, veja [docs/flow-diagram.md](docs/flow-diagram.md).

## Estrutura

```text
api/   servidor, rota SSE, cliente Gemini, schema, retry e testes
web/   interface React com Vite
docs/  diagrama do fluxo
```

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE).
