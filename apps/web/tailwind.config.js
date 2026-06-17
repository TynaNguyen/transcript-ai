const config = {
    content: ['./index.html', './src/**/*.{ts,tsx}'],
    theme: {
        extend: {
            // ── Design tokens từ DESIGN.md ──────────────────────────────
            colors: {
                bg: '#F2F2F2',
                surface: '#FFFFFF',
                'surface-2': '#F8F8F8',
                border: '#E5E5E5',
                'border-2': '#D0D0D0',
                text: '#1A1A1A',
                'text-2': '#6B6B6B',
                'text-3': '#9B9B9B',
                primary: '#1A1A1A',
                accent: '#E8692A',
            },
            fontFamily: {
                sans: ['Geist Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
            },
            fontSize: {
                display: ['2.5rem', { lineHeight: '1.1', fontWeight: '700', letterSpacing: '-0.02em' }],
                title: ['1.75rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],
                heading: ['1.25rem', { lineHeight: '1.3', fontWeight: '600' }],
                body: ['1rem', { lineHeight: '1.5', fontWeight: '400' }],
                small: ['0.9375rem', { lineHeight: '1.4', fontWeight: '400' }],
                tiny: ['0.875rem', { lineHeight: '1.3', fontWeight: '500' }],
            },
            borderRadius: {
                DEFAULT: '10px',
                sm: '6px',
                md: '10px',
                lg: '14px',
                xl: '20px',
            },
            boxShadow: {
                card: '0 1px 3px rgba(0,0,0,0.06)',
                // Không thêm shadow lớn — xem DESIGN.md
            },
            maxWidth: {
                content: '860px',
            },
            animation: {
                'pulse-dot': 'pulse 1.5s ease-in-out infinite',
            },
        },
    },
    plugins: [],
};
export default config;
//# sourceMappingURL=tailwind.config.js.map