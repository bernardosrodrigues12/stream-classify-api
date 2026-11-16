import { IncomingMessage, ServerResponse } from "node:http";

export async function handleClassify(
    _req: IncomingMessage,
    res: ServerResponse,
    _requestId: string,
): Promise<void> {
    res.writeHead(501, { 'Content-Type': 'application/json'});
    res.end(JSON.stringify({ error: 'not_implemented'}));
}