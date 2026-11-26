# Comparação: API Node/TypeScript x FastAPI

Este documento compara a mesma API de classificação com streaming SSE, implementada em duas versões:

- **Node/TypeScript** (`api/`, semana 3): Zod, Vitest, SDK `@google/genai`, retry com backoff.
- **FastAPI** (`api-fastapi/`, semana 4): Pydantic, pytest, `StreamingResponse`.

Ambas expõem `POST /api/classify` e emitem os eventos `token`, `result` e `error`. Diferença de contrato: o Node recebe o campo `message`, e o FastAPI recebe `text`.

## Resumo

| Tópico | Node/TypeScript | FastAPI |
|---|---|---|
| Tipagem | `as const` e `z.enum`; schema para o Gemini escrito à mão | Anotações e `Literal`; schema para o Gemini derivado do modelo Pydantic |
| Validação de entrada | Manual (`parseMessage`), resposta 400 `invalid_request` | Automática pelo Pydantic, resposta 422 |
| Validação de saída | `JSON.parse` e `safeParse` em etapas, com motivo do erro | `model_validate_json` em uma etapa, sem motivo distinto |
| Concorrência | `async function*` com `for await` | `async def` com gerador e `anext` |
| SSE | `res.write` na rota, com evento `done` e `requestId` | `StreamingResponse` com `format_sse`, sem `done` |
| Retry | `withRetry` antes de abrir o stream, até 3 tentativas | Não implementado |
| Erros | `toAppError` mapeia status para código e `retryable` | `except` genérico, sempre `retryable=true` |
| Testes | Vitest chamando `handleClassify` com req e res falsos | pytest com `TestClient`, pela pilha HTTP completa |
| Injeção | Parâmetro `deps`, com `??=` como padrão | `Depends` e `dependency_overrides` |

## 1. Tipagem

**Node/TypeScript** (`api/src/schemas/classification.constants.ts`)

```typescript
export const CATEGORIES = ['billing', 'technical', 'account', 'other'] as const;
export const PRIORITIES = ['low', 'medium', 'high'] as const;
```

(`api/src/schemas/classification.schema.ts`)

```typescript
category: z.enum(CATEGORIES),
```

(`api/src/services/gemini-client.ts`, schema enviado ao Gemini, escrito à mão)

```typescript
const classificationJsonSchema = {
    type: Type.OBJECT,
    properties: {
        category: { type: 'string', enum: [...CATEGORIES] },
        // ...
    },
    required: ['category', 'priority', 'summary'],
};
```

**FastAPI** (`app/schemas/classification.py`)

```python
category: Literal["billing", "technical", "account", "other"]
```

Essa mesma classe é passada como `response_schema=ClassificationResult` ao Gemini.

**Diferença observada:** no Node, o formato existe em duas definições, o Zod para validar e o `classificationJsonSchema` para o modelo, que precisam ser mantidas em sincronia à mão. No FastAPI, um único modelo Pydantic faz as duas coisas. Nos testes, um método inexistente (`splut`) só apareceu na execução do pytest, com `AttributeError`. No TypeScript, o compilador acusaria o erro antes de rodar.

## 2. Validação de entrada e saída

**Node/TypeScript, entrada** (`api/src/routes/classify.ts`)

```typescript
const trimmed = message.trim();
if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_CHARS) {
    return null;
}
```

Quando `parseMessage` devolve `null`, a rota responde `sendJson(res, 400, { error: 'invalid_request', requestId })`.

**FastAPI, entrada** (`app/schemas/classification.py`, classe `ClassifyRequest`): o Pydantic rejeita texto vazio e acima do limite, e o FastAPI responde 422 sem código de tratamento.

**Node/TypeScript, saída** (`api/src/schemas/classification.schema.ts`)

```typescript
try {
    json = JSON.parse(raw);
} catch {
    return { ok: false, reason: 'malformed_json' };
}

const result = classificationSchema.safeParse(json);
if (!result.success) {
    return { ok: false, reason: 'schema_mismatch' };
}
```

**FastAPI, saída** (`app/routes/classify.py`)

```python
result = ClassificationResult.model_validate_json("".join(chunks))
```

**Diferença observada:**
- **Entrada:** o Node faz a validação à mão e responde 400. O FastAPI responde 422 automaticamente. O Node também limita o corpo a 4096 bytes, o que o FastAPI não faz. Não há teste no Node para texto vazio, então o 400 é verificado só pelo código.
- **Saída:** o Node separa JSON malformado de campo inválido e registra o motivo no log. O FastAPI usa uma única chamada, e os dois casos viram o mesmo `invalid_output`.

## 3. Concorrência (async)

**Node/TypeScript** (`api/src/services/gemini-client.ts`)

```typescript
export async function* readClassificationText(
    stream: AsyncIterable<{ text?: string }>,
): AsyncGenerator<string> {
    try {
        for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
                yield text;
            }
        }
    } catch (error) {
        throw toAppError(error);
    }
}
```

No handler (`api/src/routes/classify.ts`), o evento é escrito fora do gerador:

```typescript
for await (const text of readClassificationText(stream)) {
    if (res.destroyed) {
        clientGone = true;
        break;
    }
    fullText += text;
    writeEvent(res, 'token', { text });
}
```

**FastAPI** (`app/routes/classify.py`)

```python
async def classify_events(text: str, client: ModelClient) -> AsyncIterator[str]:
    chunks: list[str] = []
    stream = client.stream_classification(text)

    while True:
        try:
            token = await anext(stream)
        except StopAsyncIteration:
            break
        except Exception:
            # ... evento error com provider_error
            return

        chunks.append(token)
        yield format_sse("token", {"text": token})
```

**Diferença observada:** o Node separa o erro do provedor, tratado no gerador por `toAppError`, da escrita do evento, feita pelo handler. No FastAPI, o primeiro bug apareceu porque o `try` cobria também a formatação. A correção aproximou o código do Node. O Node ainda verifica `res.destroyed` para cliente desconectado, e o FastAPI não tem equivalente. Os logs também mostraram `200 OK` antes do traceback, porque os cabeçalhos já tinham sido enviados. Depois do primeiro byte, o erro precisa ir como evento.

## 4. SSE (StreamingResponse x stream do Node)

**Node/TypeScript** (`api/src/sse/write-event.ts`)

```typescript
export function writeEvent(res: ServerResponse, event: string, data: unknown): void {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}
```

No sucesso, o handler emite também `writeEvent(res, 'done', { requestId })`.

**FastAPI** (`app/sse/events.py` e `app/routes/classify.py`)

```python
def format_sse(event: str, data: dict[str, Any]) -> str:
    payload = json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"

return StreamingResponse(
    classify_events(request.text, client),
    media_type="text/event-stream",
    headers={"Cache-Control": "no-cache"},
)
```

**Diferença observada:** o formato básico é igual nas duas versões, e os acentos são preservados (`JSON.stringify` e `ensure_ascii=False`). O Node adiciona `requestId` a todos os eventos de erro e emite `done` no sucesso. O FastAPI não faz nenhum dos dois. No FastAPI, a formatação é uma função pura, testável sem servidor. Um erro de `json.dump` (sem o `s`) só apareceu na primeira requisição real, porque a função não tinha teste.

## 5. Testes (Vitest x pytest)

**Node/TypeScript** (`api/tests/classify.test.ts`)

```typescript
it('retries 500 three times and emits provider_error as retryable', async () => {
    const generate = vi.fn().mockRejectedValue(httpError(500));

    const { events } = await classify(generate);

    expect(generate).toHaveBeenCalledTimes(3);
    expect(errorData(events)).toMatchObject({ code: 'provider_error', retryable: true });
});
```

**FastAPI** (`tests/test_classify.py`)

```python
def test_client_failure_emits_provider_error(client, use_model):
    use_model(FakeModelClient(error=RuntimeError("falha simulada")))

    response = client.post("/api/classify", json={"text": "Meu pedido não chegou"})
    events = parse_sse_events(response.text)

    name, data = events[0]
    assert name == "error"
    assert data["code"] == "provider_error"
    assert data["retryable"] is True
```

**Diferença observada:**
- **Nível do mock:** o Node mocka o SDK (`generateContentStream`). O FastAPI mocka a interface `ModelClient`, um nível acima.
- **Nível do teste:** o Vitest chama `handleClassify` diretamente, com req e res falsos, sem HTTP. O `TestClient` passa pela pilha ASGI completa. Por isso o FastAPI precisou de `parse_sse_events`, para separar a resposta em uma string só.
- **Cobertura:** o Node testa retry (3 tentativas), 429, 500, timeout, 400, JSON malformado e enum errado. O FastAPI testa 422, sucesso, falha do cliente e saída inválida, mas não testa retry.
- **Conclusão:** o FastAPI reduz código de validação e de dependências, mas o Node tem mais controle de erro e retry hoje.

## 6. Injeção de dependências

**Node/TypeScript** (`api/src/routes/classify.ts`)

```typescript
let geminiClient: GeminiClient | undefined;

function getGeminiClient(): GeminiClient {
    geminiClient ??= createGeminiClient(process.env.GEMINI_API_KEY ?? '');
    return geminiClient;
}

export async function handleClassify(req, res, requestId, deps: ClassifyDeps = {}) {
    // ...
    const client = deps.client ?? getGeminiClient();
    // ...
}
```

Nos testes (`api/tests/classify.test.ts`), o helper passa o cliente como argumento:

```typescript
await handleClassify(fakeRequest({ message: 'Fui cobrado duas vezes.' }), res, 'req-test', {
    client,
    retryOptions,
});
```

**FastAPI** (`app/dependencies.py` e `tests/conftest.py`)

```python
@lru_cache
def get_model_client() -> ModelClient:
    return GeminiClient()

app.dependency_overrides[get_model_client] = lambda: fake_client
```

**Diferença observada:** no Node, o cliente chega por parâmetro, e o teste nunca toca o módulo. No FastAPI, o override é global, feito pelo registro `dependency_overrides`, e a rota não muda. O `retryOptions` do Node também zera o `sleep` do backoff, para o teste não esperar. O FastAPI não precisou disso porque ainda não tem retry.

## Verificação de comportamento

**Node/TypeScript** (`curl -N`, campo `message`):

- Eventos: `token`, `token`, `token`, `result`, `done`
- Erros: nenhum
- Formato: `data` compacto, sem espaços (`{"text":"..."}`), gerado por `JSON.stringify`
- `done` contém `requestId`

**FastAPI** (`curl -N`, campo `text`):

- Eventos: `token`, `token`, `result`
- Erros: nenhum
- Formato: `data` com espaços (`{"text": "..."}`), gerado por `json.dumps`
- Não há evento `done`

**Comparação:**

- As duas versões seguem a mesma sequência básica: tokens, depois `result`, sem `error`.
- Os campos `category` e `priority` foram iguais (`other` e `medium`). O `summary` mudou de redação, o que é esperado, porque o modelo não é determinístico.
- A quantidade de tokens varia entre execuções (3 no Node e 2 no FastAPI), porque o provedor decide como fragmentar a saída.
- As diferenças de contrato estão no evento `done` e no `requestId`, que só existem no Node, e na espaçamento do JSON, que não altera a interpretação do cliente.