import { jsx as _jsx } from "react/jsx-runtime";
const BAR_COUNT = 20;
export default function Waveform({ level, isActive }) {
    return (_jsx("div", { className: "flex items-center gap-0.5 h-8", children: Array.from({ length: BAR_COUNT }, (_, i) => {
            // Each bar has a phase offset so they don't all move together
            const phase = (i / BAR_COUNT) * Math.PI;
            const baseHeight = isActive
                ? Math.max(0.15, Math.abs(Math.sin(phase + Date.now() / 300)) * level)
                : 0.15;
            return (_jsx("div", { className: "w-1 rounded-full transition-all duration-75", style: {
                    height: `${Math.max(4, baseHeight * 32)}px`,
                    backgroundColor: isActive ? '#E8692A' : '#D0D0D0',
                    opacity: isActive ? 0.7 + baseHeight * 0.3 : 0.4,
                } }, i));
        }) }));
}
//# sourceMappingURL=Waveform.js.map