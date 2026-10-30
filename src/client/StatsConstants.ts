export const COLUMN_IDS = [
  // Identity (only clan is hideable; rank/player/team are not).
  "rank",
  "clan",
  "player",
  "team",
  // Territory.
  "tiles",
  // Economy.
  "gold",
  "goldEarned",
  "piracyGold",
  // Military.
  "troops",
  "maxtroops",
  "warshipsKilled",
  // Buildings & units.
  "cities",
  "ports",
  "factories",
  "silos",
  "sams",
  "warships",
  // Diplomacy.
  "allies",
  "betrayals",
  // Bombs.
  "atomBombsSent",
  "hydrogenBombsSent",
  "mirvsSent",
] as const;

export type ColumnId = (typeof COLUMN_IDS)[number];

export type StatsTableKind = "player" | "team";

export const STATS_TAB_IDS = ["info", "structures", "stats", "bombs"] as const;

export type StatsTabId = (typeof STATS_TAB_IDS)[number];

export interface StatsTabDef {
  readonly id: StatsTabId;
  readonly labelKey: string;
  /**
   * Every column the tab offers, left to right. "player" and "team" share
   * the name slot: each table keeps the one its kind renders.
   */
  readonly columns: readonly ColumnId[];
  /** Hideable columns shown until the player picks their own. */
  readonly defaultColumns: readonly ColumnId[];
  readonly defaultSort: ColumnId;
}

// Tabs, columns, defaults and sorts follow #4797, ordered from the most
// needed information to the most situational.
export const STATS_TABS: readonly StatsTabDef[] = [
  {
    id: "info",
    labelKey: "leaderboard.tab_info",
    columns: [
      "rank",
      "player",
      "team",
      "tiles",
      "gold",
      "troops",
      "maxtroops",
      "clan",
    ],
    defaultColumns: ["tiles", "gold", "maxtroops"],
    defaultSort: "tiles",
  },
  {
    id: "structures",
    labelKey: "leaderboard.tab_structures",
    columns: [
      "rank",
      "player",
      "team",
      "cities",
      "ports",
      "factories",
      "silos",
      "sams",
      "warships",
    ],
    defaultColumns: [
      "cities",
      "ports",
      "factories",
      "silos",
      "sams",
      "warships",
    ],
    defaultSort: "rank",
  },
  {
    // Troops lost attacking/defending are part of #4797's Stats tab, but the
    // engine does not track them, so the tab leaves them out.
    id: "stats",
    labelKey: "leaderboard.tab_stats",
    columns: [
      "rank",
      "player",
      "team",
      "goldEarned",
      "piracyGold",
      "warshipsKilled",
      "allies",
      "betrayals",
    ],
    defaultColumns: ["goldEarned", "piracyGold", "warshipsKilled", "betrayals"],
    defaultSort: "rank",
  },
  {
    // Gold spent bombing and the structures/troops each bomb type destroyed
    // are part of #4797's Bombs tab, but the engine does not track them.
    id: "bombs",
    labelKey: "leaderboard.tab_bombs",
    columns: [
      "rank",
      "player",
      "team",
      "atomBombsSent",
      "hydrogenBombsSent",
      "mirvsSent",
    ],
    defaultColumns: ["atomBombsSent", "hydrogenBombsSent", "mirvsSent"],
    defaultSort: "rank",
  },
];

export const DEFAULT_STATS_TAB: StatsTabId = "info";

export function statsTabById(id: StatsTabId): StatsTabDef {
  return STATS_TABS.find((tab) => tab.id === id)!;
}
