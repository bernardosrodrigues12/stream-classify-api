import { useState } from "react";
import { ClassifyForm } from "./components/classify-form";
import { ErrorMessage } from "./components/error-message";
import { ResultPanel } from "./components/result-panel";
import { useClassifyStream } from "./hooks/use-classify-stream";

export default function App() {
  const [message, setMessage] = useState('');
  const { status, partialText, result, error, run } = useClassifyStream();
  
  const busy = status === 'loading' || status === 'streaming';
  const submit = () => run(message.trim());

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 bg-slate-50 px-4 py-10">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Classificador de mensagens</h1>
        <p className="mt-1 text-sm text-slate-600">
          Categoria, prioridade e resumo de mensagens de suporte.
        </p>
      </header>

      <ClassifyForm value={message} disabled={busy} onChange={setMessage} onSubmit={submit} />

      <ResultPanel status={status} partialText={partialText} result={result} />

      {status === 'error' && error && <ErrorMessage error={error} onRetry={submit} />}
    </main>
  )
}