import { useCallback, useRef, useState } from "react";
import type { Classification, ClassifyError } from "../types/classification";

export type ClassifyStatus = 'idle' | 'loading' | 'streaming' | 'success' | 'error';

const GENERIC_ERROR: ClassifyError = {
    code: 'provider_error',
    message: 'Não foi possível classificar a mensagem.',
    retryable: true
};

export function useClassifyStream() {
    const [status, setStatus] = useState<ClassifyStatus>('idle');
    const [partialText, setPartialText] = useState('');
    const [result, setResult] = useState<Classification | null>(null);
    const [error, setError] = useState<ClassifyError | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const run = useCallback(async (message: string) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setStatus('loading');
        setPartialText('');
        setResult(null);
        setError(null);

        try {
            const res = await fetch('/api/classify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json'},
                body: JSON.stringify({ message }),
                signal: controller.signal
            });

            if (!res.ok || !res.body) {
                const gatewayDown = res.status === 502 || res.status === 503 || res.status === 504;

                setError(
                    res.status === 400 
                    ? { code: 'invalid_request', message: 'Mensagem Inválida', retryable: false }
                    : {
                        code: 'network_error',
                        message: 'Não foi possível falar com a API. Confirme se ela está rodando na porta 3000.',
                        retryable: gatewayDown
                    },
                );
                setStatus('error');
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let gotResult = false;
            let gotError = false;

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true});
                const blocks = buffer.split('\n\n');
                buffer = blocks.pop() ?? '';

                for (const block of blocks) {
                    const event = /^event: (.+)$/m.exec(block)?.[1];
                    const dataLine = /^data: (.+)$/m.exec(block)?.[1];
                    if (!event || !dataLine) continue;

                    const data = JSON.parse(dataLine);

                    if (event === 'token') {
                        gotResult = true;
                        setStatus('streaming');
                        setPartialText((prev) => prev + data.text);
                    } else if (event === 'result') {
                        setResult(data as Classification);
                        setStatus('success');
                    } else if (event === 'error') {
                        gotError = true
                        setError(data as ClassifyError);
                        setStatus('error');
                    }
                }

                if (!gotResult && !gotError) {
                    setError(GENERIC_ERROR);
                    setStatus('error');
                }
            }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            if (controller.signal.aborted) return;
            setError(GENERIC_ERROR);
            setStatus('error');
        }
    }, []);

    return { status, partialText, result, error, run}
}