import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleClassify } from '../src/routes/classify.js';
import type { GeminiClient } from '../src/services/gemini-client.js';


const retryOptions = { sleep: async () => {}, random: () => 0 };

const VALID_JSON = JSON.stringify({
  category: 'billing',
  priority: 'high',
  summary: 'Cliente foi cobrado duas vezes.',
});

function fakeRequest(body: unknown): IncomingMessage {
  return Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;
}

function fakeResponse() {
  const writes: string[] = [];
  const raw = {
    destroyed: false,
    writeHead: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((chunk: string) => {
      writes.push(chunk);
      return true;
    }),
    end: vi.fn(),
  };
  return { res: raw as unknown as ServerResponse, writes, raw };
}

function parseEvents(writes: string[]) {
  return writes
    .join('')
    .split('\n\n')
    .filter(Boolean)
    .map((block) => {
      const event = /^event: (.+)$/m.exec(block)?.[1];
      const data = /^data: (.+)$/m.exec(block)?.[1];
      return { event, data: data ? JSON.parse(data) : undefined };
    });
}

function errorData(events: ReturnType<typeof parseEvents>) {
  return events.find((e) => e.event === 'error')?.data;
}

function streamOf(...texts: string[]) {
  return (async function* () {
    for (const text of texts) {
      yield { text };
    }
  })();
}

function httpError(status: number) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

function timeoutError() {
  const error = new Error('The operation timed out.');
  error.name = 'TimeoutError';
  return error;
}

async function classify(generate: ReturnType<typeof vi.fn>) {
  const client = { models: { generateContentStream: generate } } as unknown as GeminiClient;
  const { res, writes, raw } = fakeResponse();

  await handleClassify(fakeRequest({ message: 'Fui cobrado duas vezes.' }), res, 'req-test', {
    client,
    retryOptions,
  });

  return { events: parseEvents(writes), raw };
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/classify', () => {
  it('emits result and done on the happy path', async () => {
    const generate = vi.fn().mockResolvedValue(streamOf(VALID_JSON));

    const { events } = await classify(generate);

    expect(events.find((e) => e.event === 'result')?.data).toMatchObject({ category: 'billing' });
    expect(events.at(-1)?.event).toBe('done');
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('retries 429 three times and emits rate_limited', async () => {
    const generate = vi.fn().mockRejectedValue(httpError(429));

    const { events } = await classify(generate);

    expect(generate).toHaveBeenCalledTimes(3);
    expect(errorData(events)).toMatchObject({ code: 'rate_limited', retryable: true });
    expect(events.some((e) => e.event === 'result')).toBe(false);
  });

  it('retries 500 three times and emits provider_error as retryable', async () => {
    const generate = vi.fn().mockRejectedValue(httpError(500));

    const { events } = await classify(generate);

    expect(generate).toHaveBeenCalledTimes(3);
    expect(errorData(events)).toMatchObject({ code: 'provider_error', retryable: true });
  });

  it('retries timeout three times and emits timeout', async () => {
    const generate = vi.fn().mockRejectedValue(timeoutError());

    const { events } = await classify(generate);

    expect(generate).toHaveBeenCalledTimes(3);
    expect(errorData(events)).toMatchObject({ code: 'timeout', retryable: true });
  });

  it('does not retry a 400 and emits provider_error as non-retryable', async () => {
    const generate = vi.fn().mockRejectedValue(httpError(400));

    const { events } = await classify(generate);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(errorData(events)).toMatchObject({ code: 'provider_error', retryable: false });
  });

  it('recovers when a retry succeeds before any token is sent', async () => {
    const generate = vi
      .fn()
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce(streamOf(VALID_JSON));

    const { events } = await classify(generate);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(events.find((e) => e.event === 'result')?.data).toMatchObject({ category: 'billing' });
    expect(events.some((e) => e.event === 'error')).toBe(false);
  });

  it('emits invalid_output for malformed JSON without retrying', async () => {
    const generate = vi.fn().mockResolvedValue(streamOf('{"category":"billing",'));

    const { events } = await classify(generate);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(errorData(events)).toMatchObject({ code: 'invalid_output', retryable: false });
    expect(events.some((e) => e.event === 'result')).toBe(false);
    expect(events.some((e) => e.event === 'done')).toBe(false);
  });

  it('emits invalid_output when the category is misspelled', async () => {
    const badCategory = JSON.stringify({ category: 'biling', priority: 'high', summary: 'x' });
    const generate = vi.fn().mockResolvedValue(streamOf(badCategory));

    const { events } = await classify(generate);

    expect(errorData(events)).toMatchObject({ code: 'invalid_output', retryable: false });
    expect(events.some((e) => e.event === 'result')).toBe(false);
  });
});