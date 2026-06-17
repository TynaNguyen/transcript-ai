/**
 * Minimal toast notification system
 * Usage: const { addToast } = useToast()
 *        addToast({ title: 'Done', message: '...', action: { label: 'View', onClick } })
 */
interface Toast {
    id: string;
    title: string;
    message?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}
interface ToastContextValue {
    addToast: (toast: Omit<Toast, 'id'>) => void;
}
export declare function ToastProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function useToast(): ToastContextValue;
export {};
//# sourceMappingURL=Toast.d.ts.map