import type { AppSettings } from '@transcript/shared';
interface SettingsContextValue {
    settings: AppSettings | null;
    setSettings: (s: AppSettings) => void;
}
export declare function useAppSettings(): SettingsContextValue;
export default function App(): import("react").JSX.Element;
export {};
//# sourceMappingURL=App.d.ts.map