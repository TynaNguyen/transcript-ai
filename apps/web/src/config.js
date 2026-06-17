// Frontend config — chỉ đọc VITE_* env vars
// TUYỆT ĐỐI không đặt API key ở đây
export const config = {
    apiUrl: import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001',
    wsUrl: import.meta.env['VITE_WS_URL'] ?? 'ws://localhost:3001',
};
//# sourceMappingURL=config.js.map