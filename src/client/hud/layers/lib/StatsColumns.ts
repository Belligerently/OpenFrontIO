import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  BOMB_INDEX_LAUNCH,
  OTHER_INDEX_DESTROY,
} from "@openfront/engine-api/StatsSchemas";
import { renderNumber, renderTroops } from "@openfront/engine-lib/Format";
import type { ColumnId, StatsTableKind } from "../../../StatsConstants";
import { formatPercentage } from "../../../Utils";
import type { GameView, PlayerView } from "../../../view";
import {
  allianceIcon,
  atomBombIcon,
  cityIcon,
  claimIcon,
  factoryIcon,
  goldCoinIcon,
  guildIcon,
  hydrogenBombIcon,
  mirvIcon,
  missileSiloIcon,
  portIcon,
  profileIcon,
  samLauncherIcon,
  soldierIcon,
  teamIcon,
  traitorIcon,
  upperLimitIcon,
  warshipIcon,
} from "../../HotbarIcons";
import { humanStats } from "./HumanStats";

export { type ColumnId } from "../../../StatsConstants";

export type ColumnHeaderVisual =
  | {
      readonly kind: "icon";
      readonly src: string;
      readonly white?: true;
      /** Small icon or text rendered as a superscript on the main icon. */
      readonly superscript?:
        | { readonly src: string; readonly white?: true }
        | { readonly text: string };
    }
  // Text is a translation key or a literal symbol
  // ("#" reads the same in every language and falls back to itself).
  | { readonly kind: "text"; readonly text: string };
export type ColumnAlignment = "start" | "center" | "end";
export type SortOrder = "asc" | "desc";

/** One row as a column sees it. `value` is that column's own number. */
export interface ColumnRow {
  readonly name: string;
  readonly clanTag?: string | null;
  readonly value: number;
}

/** A column's number for one player, or null when it has none to show. */
export type ValueGetter = (player: PlayerView, game: GameView) => number | null;

export interface ColumnDef {
  readonly id: ColumnId;
  /** Tooltip copy, and the header text when there is no headerVisual. */
  readonly labelKey: string;
  readonly headerVisual?: ColumnHeaderVisual;
  /** Grid track: a fixed width, or "auto" to share the row's spare width. */
  readonly width: string;
  readonly align: ColumnAlignment;
  /** Tables this column appears on. */
  readonly kinds: readonly StatsTableKind[];
  /** Offered in the ⚙️ menu; non-hideable columns always render. */
  readonly isHideable: boolean;
  /** Header is a sort button. */
  readonly isOrderable: boolean;
  /** Direction of the first click on the header. */
  readonly firstSortOrder: SortOrder;
  /**
   * Read from the engine's stats record, which only humans have: nations
   * and bots show "—", and the header says so.
   */
  readonly isHumanOnly: boolean;
  /** Number behind the column — sorting and team totals. */
  readonly value?: ValueGetter;
  readonly cell: (row: ColumnRow, game: GameView) => string;
}

type ColumnInput = Pick<ColumnDef, "id" | "labelKey" | "cell"> &
  Partial<Omit<ColumnDef, "id" | "labelKey" | "cell">>;

function defineColumn(input: ColumnInput): ColumnDef {
  return {
    width: "auto",
    align: "end",
    kinds: ["player", "team"],
    isHideable: true,
    firstSortOrder: "desc",
    isHumanOnly: false,
    isOrderable: input.value !== undefined,
    ...input,
  };
}

function unitColumn(
  id: ColumnId,
  labelKey: string,
  unitType: UnitType,
  icon: string,
): ColumnDef {
  return defineColumn({
    id,
    labelKey,
    headerVisual: { kind: "icon", src: icon },
    align: "center",
    value: (player) => player.totalUnitLevels(unitType),
    cell: (row) => renderNumber(row.value),
  });
}

function bombsSentColumn(
  id: ColumnId,
  labelKey: string,
  bomb: "abomb" | "hbomb" | "mirv",
  icon: string,
): ColumnDef {
  return defineColumn({
    id,
    labelKey,
    headerVisual: { kind: "icon", src: icon },
    align: "center",
    isHumanOnly: true,
    value: (player) =>
      humanStats.value(
        player,
        (stats) => stats.bombs?.[bomb]?.[BOMB_INDEX_LAUNCH],
      ),
    cell: (row) => renderNumber(row.value),
  });
}

const troopHeaderVisual = {
  kind: "icon",
  src: soldierIcon,
  white: true,
} as const satisfies ColumnHeaderVisual;

// This registry is the source of truth for column IDs; each tab sets the
// order its columns display in (StatsConstants STATS_TABS).
export const COLUMN_DEFS: readonly ColumnDef[] = [
  defineColumn({
    id: "rank",
    labelKey: "leaderboard.rank",
    headerVisual: { kind: "text", text: "#" },
    width: "34px",
    align: "center",
    isHideable: false,
    // A standing by owned territory, not the row's index: it stays with the
    // player whatever the table is sorted by. StatsTable fills the value in,
    // since a standing needs every row; sorting it ascending lists the
    // leader first.
    isOrderable: true,
    firstSortOrder: "asc",
    cell: (row) => String(row.value),
  }),
  defineColumn({
    id: "clan",
    labelKey: "leaderboard.clan",
    headerVisual: { kind: "icon", src: guildIcon },
    // Fits "WWWWW" — the widest 5-character tag — in the row font.
    width: "80px",
    align: "center",
    kinds: ["player"],
    cell: (row) => row.clanTag ?? "",
  }),
  defineColumn({
    id: "player",
    labelKey: "leaderboard.player",
    headerVisual: { kind: "icon", src: profileIcon },
    width: "100px",
    align: "start",
    kinds: ["player"],
    isHideable: false,
    cell: (row) => row.name,
  }),
  defineColumn({
    id: "team",
    labelKey: "leaderboard.team",
    headerVisual: { kind: "icon", src: teamIcon },
    width: "100px",
    align: "start",
    kinds: ["team"],
    isHideable: false,
    cell: (row) => row.name,
  }),
  defineColumn({
    id: "tiles",
    labelKey: "leaderboard.owned",
    headerVisual: { kind: "icon", src: claimIcon, white: true },
    value: (player) => player.numTilesOwned(),
    cell: (row, game) => {
      const validTiles = game.numLandTiles() - game.numTilesWithFallout();
      return formatPercentage(validTiles > 0 ? row.value / validTiles : 0);
    },
  }),
  defineColumn({
    id: "gold",
    labelKey: "leaderboard.gold",
    headerVisual: { kind: "icon", src: goldCoinIcon },
    // Gold is a bigint, but game values remain safely below Number.MAX_SAFE_INTEGER.
    value: (player) => Number(player.gold()),
    cell: (row) => renderNumber(row.value),
  }),
  defineColumn({
    id: "goldEarned",
    labelKey: "leaderboard.goldEarned",
    headerVisual: {
      kind: "icon",
      src: goldCoinIcon,
      superscript: { text: "Σ" },
    },
    value: (player) => player.goldEarned(),
    cell: (row) => renderNumber(row.value),
  }),
  defineColumn({
    // Gold from captured trade ships.
    id: "piracyGold",
    labelKey: "leaderboard.piracyGold",
    headerVisual: {
      kind: "icon",
      src: warshipIcon,
      superscript: { src: goldCoinIcon },
    },
    value: (player) => player.piracyGold(),
    cell: (row) => renderNumber(row.value),
  }),
  defineColumn({
    id: "troops",
    labelKey: "leaderboard.troops",
    headerVisual: troopHeaderVisual,
    value: (player) => player.troops(),
    cell: (row) => renderTroops(row.value),
  }),
  defineColumn({
    id: "maxtroops",
    labelKey: "leaderboard.maxtroops",
    headerVisual: {
      ...troopHeaderVisual,
      superscript: { src: upperLimitIcon, white: true },
    },
    value: (player, game) => game.config().maxTroops(player),
    cell: (row) => renderTroops(row.value),
  }),
  defineColumn({
    id: "warshipsKilled",
    labelKey: "leaderboard.warshipsKilled",
    headerVisual: {
      kind: "icon",
      src: warshipIcon,
      superscript: { text: "✕" },
    },
    align: "center",
    isHumanOnly: true,
    value: (player) =>
      humanStats.value(
        player,
        (stats) => stats.units?.wshp?.[OTHER_INDEX_DESTROY],
      ),
    cell: (row) => renderNumber(row.value),
  }),
  unitColumn("cities", "leaderboard.cities", UnitType.City, cityIcon),
  unitColumn("ports", "leaderboard.ports", UnitType.Port, portIcon),
  unitColumn(
    "factories",
    "leaderboard.factories",
    UnitType.Factory,
    factoryIcon,
  ),
  unitColumn(
    "silos",
    "leaderboard.launchers",
    UnitType.MissileSilo,
    missileSiloIcon,
  ),
  unitColumn("sams", "leaderboard.sams", UnitType.SAMLauncher, samLauncherIcon),
  unitColumn("warships", "leaderboard.warships", UnitType.Warship, warshipIcon),
  defineColumn({
    id: "allies",
    labelKey: "leaderboard.allies",
    headerVisual: { kind: "icon", src: allianceIcon },
    align: "center",
    value: (player) => player.allies().length,
    cell: (row) => renderNumber(row.value),
  }),
  defineColumn({
    id: "betrayals",
    labelKey: "leaderboard.betrayals",
    headerVisual: { kind: "icon", src: traitorIcon },
    align: "center",
    value: (player) => player.betrayals(),
    cell: (row) => renderNumber(row.value),
  }),
  bombsSentColumn(
    "atomBombsSent",
    "leaderboard.atomBombsSent",
    "abomb",
    atomBombIcon,
  ),
  bombsSentColumn(
    "hydrogenBombsSent",
    "leaderboard.hydrogenBombsSent",
    "hbomb",
    hydrogenBombIcon,
  ),
  bombsSentColumn("mirvsSent", "leaderboard.mirvsSent", "mirv", mirvIcon),
];

export function columnsFor(kind: StatsTableKind): readonly ColumnDef[] {
  return COLUMN_DEFS.filter((column) => column.kinds.includes(kind));
}

/** A player's number for each column; columns with none are left out. */
export function columnValues(
  player: PlayerView,
  game: GameView,
  columns: readonly ColumnDef[],
): ReadonlyMap<ColumnId, number> {
  const values = new Map<ColumnId, number>();
  for (const column of columns) {
    const value = column.value?.(player, game) ?? null;
    if (value !== null) values.set(column.id, value);
  }
  return values;
}

const COLUMNS_BY_ID = new Map<ColumnId, ColumnDef>(
  COLUMN_DEFS.map((column) => [column.id, column] as const),
);

export function columnById(id: ColumnId): ColumnDef {
  return COLUMNS_BY_ID.get(id)!;
}
