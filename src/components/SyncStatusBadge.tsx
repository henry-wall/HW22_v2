import type { SyncStatus } from "../hooks/useTournamentState";

interface SyncStatusBadgeProps {
    status: SyncStatus;
    lastSavedAt: Date | null;
}

export default function SyncStatusBadge({ status, lastSavedAt }: SyncStatusBadgeProps) {
    const formatTime = (date: Date | null) => {
        if (!date) return "";
        return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    const config: Record<SyncStatus, { icon: string; text: string; color: string; bgColor: string; pulse: boolean }> = {
        loading: {
            icon: "⏳",
            text: "Carregando...",
            color: "#6B7280",
            bgColor: "#F3F4F6",
            pulse: true,
        },
        saved: {
            icon: "✅",
            text: lastSavedAt ? `Salvo ${formatTime(lastSavedAt)}` : "Salvo",
            color: "#059669",
            bgColor: "#D1FAE5",
            pulse: false,
        },
        saving: {
            icon: "💾",
            text: "Salvando...",
            color: "#D97706",
            bgColor: "#FEF3C7",
            pulse: true,
        },
        error: {
            icon: "❌",
            text: "Erro ao salvar",
            color: "#DC2626",
            bgColor: "#FEE2E2",
            pulse: false,
        },
        offline: {
            icon: "📡",
            text: "Offline (local)",
            color: "#9333EA",
            bgColor: "#F3E8FF",
            pulse: false,
        },
    };

    const statusConfig = config[status] || config.loading; // Safety fallback
    const { icon, text, color, bgColor, pulse } = statusConfig;

    return (
        <div
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 10px",
                borderRadius: "9999px",
                fontSize: "0.75rem",
                fontWeight: 600,
                color,
                backgroundColor: bgColor,
                border: `1px solid ${color}30`,
                animation: pulse ? "pulse-badge 1.5s ease-in-out infinite" : "none",
                transition: "all 0.3s ease",
            }}
        >
            <span style={{ fontSize: "0.85rem" }}>{icon}</span>
            <span>{text}</span>

            <style>{`
        @keyframes pulse-badge {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
        </div>
    );
}
