# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

## [Unreleased]

### Adicionado
- Endpoint `POST /api/classify`, que recebe `{ "message": string }` e responde com SSE. Eventos: `token`, `result`, `done` e `error` (com `code`, `message` e `retryable`).
- Validação da saída do modelo com Zod, com categorias e prioridades fechadas.
- Retry com backoff exponencial e jitter, limitado a 3 tentativas e aplicado só a erros retryable.
- Erros tipados com `code`, `message` e `retryable`, cobrindo limite de taxa, erro do provedor, timeout e saída inválida.
- Testes automatizados para validação, retry e cenários de falha da rota.
- Interface React (Vite) que consome o stream SSE, com estados de carregamento, streaming parcial, sucesso e erro com "Tentar novamente".