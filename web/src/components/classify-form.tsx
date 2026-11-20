import type { FormEvent } from "react";

interface ClassifyFormprops {
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
    onSubmit: () => void;
}

export function ClassifyForm({ value, disabled, onChange, onSubmit }: ClassifyFormprops) {
    const canSubmit = !disabled && value.trim().length > 0;

    function handleSubit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (canSubmit) onSubmit();
    }

    return (
        <form onSubmit={handleSubit} className="flex flex-col gap-3">
            <label htmlFor="message" className="text-sm font-medium text-slate-700">
                Mensagem do cliente
            </label>
            <textarea
                id="message"
                rows={5}
                maxLength={2000}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className="rounded-md border border-slate-300 p-3 text-slate-900 focus:border-indigo-50 focus:outline-none focus:ring-2 focus:indigo-200 disabled:bg-slate-100"
            />
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{value.length}/2000</span>
                <button
                    type="submit"
                    disabled={!canSubmit}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                    Classificar
                </button>
            </div>
        </form>
    )
}