export type Category = 'biling' | 'technical' | 'account' | 'other'; 
export type Priority = 'low' | 'medium' | 'high';

export interface Classification {
    category: Category;
    priority: Priority;
    summary: string
}

export interface ClassifyError {
    code: string;
    message: string;
    retryable: boolean;
}