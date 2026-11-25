from app.sse.events import format_sse


def test_format_sse_ends_with_blank_line():
    output = format_sse("token", {"text": "olá"})
    assert output == 'event: token\ndata: {"text": "olá"}\n\n'


def test_format_sse_preserves_accents():
    output = format_sse("result", {"text": "Pedido atrasado"})
    assert "Pedido atrasado" in output