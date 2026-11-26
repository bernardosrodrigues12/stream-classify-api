from conftest import VALID_CHUNKS, FakeModelClient, parse_sse_events

def test_empty_text_returns_422(client):
    response = client.post("/api/classify", json={"text": ""})

    assert response.status_code == 422


def test_valid_stream_emits_tokens_and_final_results(client, use_model):
    use_model(FakeModelClient(chunks=VALID_CHUNKS))

    response = client.post("/api/classify", json={"text": "Meu pedido não chegou"})
    events = parse_sse_events(response.text)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert [name for name, _ in events[:-1]] == ["token"] * len(VALID_CHUNKS)

    final_name, final_data = events[-1]
    assert final_name == "result"
    assert final_data == {
        "category": "billing",
        "priority": "high",
        "summary": "Pedido atrasado"
    }


def test_client_failure_emits_provider_error(client, use_model):
    use_model(FakeModelClient(error=RuntimeError("falha simulada")))

    response = client.post("/api/classify", json={"text": "Meu pedido não chegou"})
    events = parse_sse_events(response.text)

    assert len(events) == 1
    name, data = events[0]
    assert name == "error"
    assert data["code"] == "provider_error"
    assert data["retryable"] is True


def test_valid_output_emits_valid_output_error(client, use_model):
    use_model(FakeModelClient(chunks=['{"category": "none", "priority": "high"']))

    response = client.post("/api/classify", json={"text": "Meu pedido não chegou"})
    events = parse_sse_events(response.text)

    name, data = events[-1]
    assert name == "error"
    assert data["code"] == "invalid_output"
    assert data["retryable"] is False