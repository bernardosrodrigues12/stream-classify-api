import type { Classification } from "../types/classification";
import type { ClassifyStatus } from "../hooks/use-classify-stream";

const CATEGORY_LABELS: Record<Classification['category'], string> = {
    biling: 'Cobrança',
    technical: 'Técnico',
    account: 'Conta',
    other: 'Outro',
};

const PRIORITY_LABELS: Record<Classification['priority'], string> = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta'
};

const PRIORITY_STYLES: Record<Classification['priority'], string> = {
    low: 'bg-emerald-100 text-emerald-800',
    medium: 'bg-amber-100 text-amber-800',
    high: 'bg-red-100 text-red-800'
}

interface ResultPanelProps {
    status: ClassifyStatus;
    partialText: string;
    result: Classification | null;
}

export function ResultPanel({ status, partialText, result }: ResultPanelProps) {
    if(status === 'loading') {
        return (
            <div role="status" className="flex items-center gap-3 text-sm text-slate-600">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
                CLassificando a mensagem...
            </div>
        );
    }

    if (status === 'streaming') {
        return (
            <section className="rounded-md border border-amber-300 bg-amber-50 p-4">
                <p className="mb-2 text-sm font-medium text-amber-800">Ainda não validado</p>
                <pre className="whitespace-pre-wrap wrap-break-word font-mono text-sm text-slate-800">
                    {partialText}
                </pre>
            </section>
        );
    }

    if (status === 'success' && result) {
        return (
            <section className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-md border border-slate-200 bg-white p-4">
                    <h3 className="text-xs font-semibold uppercase text-slate-500">Categoria</h3>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                        {CATEGORY_LABELS[result.category]}
                    </p>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-4">
                    <h3 className="text-xs font-semibold uppercase text-slate-500">Prioridade</h3>
                    <span
                        className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-medium ${PRIORITY_STYLES[result.priority]}`}
                    >
                        {PRIORITY_LABELS[result.priority]}
                    </span>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-4 sm:col-span-3">
                    <h3 className="text-xs font-semibold uppercase text-slate-500">Resumo</h3>
                    <p className="mt-1 text-slate-800">{result.summary}</p>
                </div>
            </section>
        );
    }

    return null;
}