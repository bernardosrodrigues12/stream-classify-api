import type { IncomingMessage, ServerResponse } from 'node:http';
import { AppError } from '../errors/app-error.js';
import { parseClassification } from '../schemas/classification.schema.js';
import {
    createGeminiClient,
    openClassificationStream,
    readClassificationText,
    type GeminiClient,
} from '../services/gemini-client.js';
import { withRetry, type RetryOptions } from '../services/retry.js';
import { writeEvent } from '../sse/write-event.js';

const MAX_BODY_BYTES = 4_096;
const MAX_MESSAGE_CHARS = 2_000;

let geminiClient: GeminiClient | undefined;

function getGeminiClient(): GeminiClient {
    geminiClient ??= createGeminiClient(process.env.GEMINI_API_KEY ?? '');
    return geminiClient;
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string | null> {
    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of req) {
        size += (chunk as Buffer).length;
        if (size > MAX_BODY_BYTES) {
        return null;
        }
        chunks.push(chunk as Buffer);
    }

    return Buffer.concat(chunks).toString('utf8');
}

function parseMessage(raw: string): string | null {
    try {
        const body: unknown = JSON.parse(raw);

    if (typeof body !== 'object' || body === null || !('message' in body)) {
        return null;
    }

    const message = (body as { message: unknown }).message;
    if (typeof message !== 'string') {
        return null;
    }

    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_MESSAGE_CHARS) {
        return null;
    }

    return trimmed;
    } catch {
        return null;
    }
}

export interface ClassifyDeps {
    client?: GeminiClient;
    retryOptions?: Partial<RetryOptions>;
}

export async function handleClassify(
    req: IncomingMessage,
    res: ServerResponse,
    requestId: string,
    deps: ClassifyDeps = {},
): Promise<void> {
    const raw = await readBody(req);
    const message = raw === null ? null : parseMessage(raw);

    if (message === null) {
        sendJson(res, 400, { error: 'invalid_request', requestId });
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    res.flushHeaders();

    let fullText = '';
    let clientGone = false;

    try {
        const client = deps.client ?? getGeminiClient();

        const stream = await withRetry(() =>
            openClassificationStream(client, message),
            deps.retryOptions,
        );

        for await (const text of readClassificationText(stream)) {
            if (res.destroyed) {
                clientGone = true;
                break;
            }
            fullText += text;
            writeEvent(res, 'token', { text });
        }

        if (!clientGone) {
            const parsed = parseClassification(fullText);

            if (parsed.ok) {
                writeEvent(res, 'result', parsed.data);
                writeEvent(res, 'done', { requestId });
            } else {
                console.error(`[${requestId}] invalid model output: ${parsed.reason}`);
                writeEvent(res, 'error', {
                    code: 'invalid_output',
                    message: 'The model returned an invalid classification.',
                    retryable: false,
                    requestId,
                });
            }
        }
    } catch (error) {
        const appError =
            error instanceof AppError
                ? error
                : new AppError('provider_error', 'Unexpected error while classifying.', false);

        if (!(error instanceof AppError)) {
            console.error(`[${requestId}] unexpected error:`, error);
        }

        writeEvent(res, 'error', {
            code: appError.code,
            message: appError.message,
            retryable: appError.retryable,
            requestId,
        });
    } finally {
        res.end();
    }
}