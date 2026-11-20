import type { ClassifyError } from "../types/classification";

const MESSAGES: Record<string, string> = {
    rate_limited: 'Limite de uso atingido. Aguarde um pouco e tente de novo.',
    timeout: 'O modelo demorou para responder.',
    provider_error: 'O provedor do modelo está indisponível ou recusou a requisição.',
    invali_output: 'O modelo retornou uma resposta inválida',
};

interface ErrorMessageProps {
    error: ClassifyError;
    onRetry: () => void;
}

export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
    return (
        <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-4">
            <p className="text-sm text-red-800">{MESSAGES[error.code] ?? error.message}</p>
            {error.retryable && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                    >
                        Tentar Novamente
                </button>
            )}
    </div>
    );
}