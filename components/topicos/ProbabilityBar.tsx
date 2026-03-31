import { cn } from "@/lib/utils";

interface ProbabilityBarProps {
  probSim: number;
  className?: string;
  showLabels?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function ProbabilityBar({
  probSim,
  className,
  showLabels = true,
  size = "md",
}: ProbabilityBarProps) {
  const simPct = Math.round(probSim * 100);
  const naoPct = 100 - simPct;

  const heightClass = size === "sm" ? "h-1.5" : size === "lg" ? "h-3" : "h-2";

  return (
    <div className={cn("space-y-1", className)}>
      {showLabels && (
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-sim">SIM {simPct}%</span>
          <span className="text-nao">NÃO {naoPct}%</span>
        </div>
      )}
      <div className={cn("w-full rounded-full overflow-hidden bg-border flex", heightClass)}>
        <div
          className="bg-sim transition-all duration-500 rounded-l-full"
          style={{ width: `${simPct}%` }}
        />
        <div
          className="bg-nao transition-all duration-500 rounded-r-full flex-1"
        />
      </div>
    </div>
  );
}
