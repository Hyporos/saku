const runtimeOrigin = typeof window !== "undefined" ? window.location.origin : "";

const isLocalRuntime = runtimeOrigin.includes("localhost") || runtimeOrigin.includes("127.0.0.1");

export const apiBase = import.meta.env.VITE_BOT_API_URL ?? (isLocalRuntime ? "http://localhost:8000" : runtimeOrigin);
