import Link from "next/link";

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: "proximos", label: "Próximos" },
  { key: "ao_vivo", label: "Ao vivo" },
  { key: "encerrados", label: "Encerrados" },
];

const GAME_TABS: Array<{ key: string; label: string }> = [
  { key: "", label: "Todos" },
  { key: "free_fire", label: "Free Fire" },
  { key: "valorant", label: "Valorant" },
  { key: "cs2", label: "CS2" },
  { key: "lol", label: "LoL" },
  { key: "ea_fc", label: "EA FC" },
  { key: "fortnite", label: "Fortnite" },
  { key: "gta", label: "GTA" },
  { key: "clash_royale", label: "Clash Royale" },
  { key: "rocket_league", label: "Rocket League" },
  { key: "dota2", label: "Dota 2" },
  { key: "pubg", label: "PUBG" },
  { key: "codm", label: "COD Mobile" },
  { key: "r6", label: "Rainbow Six" },
];

function href(status: string, game: string) {
  const p = new URLSearchParams();
  if (status) p.set("status", status);
  if (game) p.set("game", game);
  const q = p.toString();
  return q ? `/games?${q}` : "/games";
}

export default function GameFilterTabs({ status, game }: { status: string; game: string }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-1 bg-muted rounded-lg p-1 overflow-x-auto">
        {STATUS_TABS.map((t) => (
          <Link
            key={t.key}
            href={href(t.key, game)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              status === t.key ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="flex gap-1 overflow-x-auto">
        {GAME_TABS.map((t) => (
          <Link
            key={t.key || "all"}
            href={href(status, t.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              game === t.key
                ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
                : "text-muted-foreground border-border hover:text-white"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
