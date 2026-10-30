export const COLUMN_IDS = [
  // Identity (only clan is hideable; rank/player/team are not).
  "rank",
  "clan",
  "player",
  "team",
  // Territory.
  "tiles",
  // Economy: balance, totals, then the per-source income rates.
  "gold",
  "goldEarned",
  "goldIncomePerMin",
  "shipTradeGoldPerMin",
  "piracyGoldPerMin",
  "trainTradeGoldPerMin",
  // Military.
  "troops",
  "maxtroops",
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
] as const;

export type ColumnId = (typeof COLUMN_IDS)[number];

export type StatsTableKind = "player" | "team";

export const STATS_TAB_IDS = ["economy", "buildings", "diplomacy"] as const;

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

// The tabs #5595 names, laid out on #4797's principles: the most needed
// information first and as the default, Pos # and the name on every tab,
// and every tab but the first sorted by Pos #.
export const STATS_TABS: readonly StatsTabDef[] = [
  {
    // Territory, gold and troops: the resources a player grows and spends,
    // and what the panel showed before the tabs.
    id: "economy",
    labelKey: "leaderboard.tab_economy",
    columns: [
      "rank",
      "player",
      "team",
      "tiles",
      "gold",
      "troops",
      "maxtroops",
      "goldIncomePerMin",
      "goldEarned",
      "shipTradeGoldPerMin",
      "trainTradeGoldPerMin",
      "piracyGoldPerMin",
    ],
    defaultColumns: ["tiles", "gold", "maxtroops", "goldIncomePerMin"],
    defaultSort: "tiles",
  },
  {
    id: "buildings",
    labelKey: "leaderboard.tab_buildings",
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
    id: "diplomacy",
    labelKey: "leaderboard.tab_diplomacy",
    columns: ["rank", "player", "team", "clan", "allies", "betrayals"],
    defaultColumns: ["clan", "allies", "betrayals"],
    defaultSort: "rank",
  },
];

export const DEFAULT_STATS_TAB: StatsTabId = "economy";

export function statsTabById(id: StatsTabId): StatsTabDef {
  return STATS_TABS.find((tab) => tab.id === id)!;
}
