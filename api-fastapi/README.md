# API FastAPI: classificação de mensagens com streaming

Versão FastAPI da API de classificação de mensagens de suporte. Recebe um texto, envia a resposta do modelo como eventos SSE e termina com o resultado validado.

## Pré-requisitos

- Python 3.13 ou superior
- Chave de API do Google AI Studio

## Como rodar

```bat
cd api-fastapi
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Abra o `.env` e preencha `GEMINI_API_KEY`. Depois suba o servidor:

```bat
uvicorn app.main:app --reload
```

A documentação automática fica em `http://127.0.0.1:8000/docs`.

## Testes

```bat
pytest -v
```

Os testes não chamam o provedor: usam um cliente falso injetado por `app.dependency_overrides`.

## Endpoints

- `GET /health`: retorna `{"status": "ok"}`.
- `POST /api/classify`: recebe `{"text": "..."}` e responde com `text/event-stream`, emitindo eventos `token`, `result` ou `error`.

## Arquitetura

A requisição `POST /api/classify` chega em `app/routes/classify.py`, onde o corpo é validado pelo modelo `ClassifyRequest` (Pydantic): texto vazio ou acima do limite recebe `422` sem código de tratamento. A rota obtém o cliente do modelo pela dependência `get_model_client` (`app/dependencies.py`), que os testes substituem por um cliente falso via `dependency_overrides`. O cliente implementa o Protocol `ModelClient` e entrega os fragmentos de texto do modelo. Cada fragmento é formatado como evento `token` por `format_sse` (`app/sse/events.py`) e enviado por `StreamingResponse` com `text/event-stream`. Ao final, o texto acumulado passa por `ClassificationResult.model_validate_json`: se for válido, a rota emite `result`; se não for, emite `error` com `invalid_output`. Falhas do provedor viram `error` com `provider_error`. Os erros sempre saem como evento, porque o status HTTP já foi enviado com o primeiro byte do stream.