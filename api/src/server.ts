import { createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { handleClassify } from './routes/classify.js';

if (existsSync('.env')) {
    process.loadEnvFile('.env');
}

if (!process.env.GEMINI_API_KEY) {
    console.log('[server] GEMINI_API_KEY is not set. Check api/ .env');
    process.exit(1);
}

const PORT = Number(process.env.PORT ?? 3000);

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json'});
    res.end(JSON.stringify(body))
}

function logRequest(requestId: string, req: IncomingMessage, status: number, startedAt: number): void {
    const durationMs = Date.now() - startedAt;
    console.log(`[${requestId} ${req.method} ${req.url} -> ${status} (${durationMs}ms)]`);
}

const server = createServer(async (req, res) => {
    const requestId = randomUUID();
    const startedAt = Date.now();
    const url = new URL(req.url ?? '/', 'http:localhost');

    res.on('finish', () => logRequest(requestId, req, res.statusCode, startedAt));

    if (req.method === 'GET' && url.pathname == '/health') {
        sendJson(res, 200, {status: 'ok'});
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/classify') {
        try {
            await handleClassify(req, res, requestId);
        } catch (error) {
            console.error(`[${requestId}] unhandled error:`, error);
            if (!res.headersSent) {
                sendJson(res, 500, { error: 'internal_error', requestId });
            } else {
                res.end();
            }
        }

        return;
    }
    
    sendJson(res, 404, { error: 'not_found' });
    
})

server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
});

for (const signal of ['SIGNIT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        console.log(`[server] received ${signal}, shutting down`);
        server.close(() => process.exit(0))
    })
}