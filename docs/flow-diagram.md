# Fluxo da requisição

Este documento descreve o caminho de `POST /api/classify`, desde a requisição até o último evento SSE.

## Diagrama

```mermaid
flowchart TD
    A[Cliente envia POST /api/classify] --> B{Body válido?}
    B -- não --> C[HTTP 400 em JSON<br/>invalid_request]
    B -- sim --> D[Responde 200 com text/event-stream]
    D --> E[Abre stream com o Gemini]
    E -- falha retryable<br/>antes do 1º token --> R[Backoff exponencial com jitter<br/>até 3 tentativas]
    R --> E
    E -- falha sem retry possível --> X[event: error]
    E -- conexão aberta --> F[Lê fragmentos do modelo]
    F -- fragmento --> G[event: token]
    G --> F
    F -- erro durante o stream --> X
    F -- fim do stream --> H{Texto valida no schema Zod?}
    H -- sim --> I[event: result<br/>event: done]
    H -- não --> X
    F -- cliente desconectou --> Z[Interrompe a leitura]
```

## Regras

- **Retry só antes do primeiro token.** Depois que um `token` foi enviado, uma falha gera `error` direto, sem nova tentativa.
- **Nenhum `result` sem validação.** Os tokens são exibidos como texto parcial. O JSON só vira `result` depois de passar pelo schema.
- **Erros tipados.** Todo `error` traz `code`, `message`, `retryable` e `requestId`.

## Códigos de erro

| `code` | Quando ocorre | `retryable` |
|---|---|---|
| `rate_limited` | Gemini respondeu 429 | `true` |
| `provider_error` | Gemini respondeu 5xx | `true` |
| `provider_error` | Gemini respondeu outro 4xx | `false` |
| `timeout` | A chamada excedeu o tempo limite | `true` |
| `invalid_output` | A saída não passou no schema | `false` |
| `invalid_request` | Body inválido (resposta HTTP 400, sem SSE) | `false` |