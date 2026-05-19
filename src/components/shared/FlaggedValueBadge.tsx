type FlagStatus = "HIGH" | "LOW" | "BORDERLINE" | "NORMAL";

const COLOR: Record<FlagStatus, { bg: string; text: string; label: string }> = {
  HIGH: { bg: "bg-red-100", text: "text-red-700", label: "HIGH" },
  LOW: { bg: "bg-amber-100", text: "text-amber-700", label: "LOW" },
  BORDERLINE: { bg: "bg-orange-100", text: "text-orange-600", label: "BORDERLINE" },
  NORMAL: { bg: "bg-green-100", text: "text-green-700", label: "NORMAL" },
};

interface FlaggedValueBadgeProps {
  status: FlagStatus;
  className?: string;
}

export function FlaggedValueBadge({ status, className = "" }: FlaggedValueBadgeProps) {
  const { bg, text, label } = COLOR[status];
  return (
    <span
      data-testid="flagged-status-pill"
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${text} ${className}`}
    >
      {label}
    </span>
  );
}
