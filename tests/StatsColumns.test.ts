// @vitest-environment jsdom
import { profileIcon, teamIcon } from "../src/client/hud/HotbarIcons";
import {
  COLUMN_DEFS,
  columnById,
  columnsFor,
} from "../src/client/hud/layers/lib/StatsColumns";
import {
  COLUMN_IDS,
  STATS_TAB_IDS,
  STATS_TABS,
} from "../src/client/StatsConstants";
import { makeGameView, makePlayerView, stubConfig } from "./util/viewStubs";

const emptyRow = {
  name: "alice",
  clanTag: null,
  value: 0,
};

describe("Stats column registry", () => {
  it("has unique column ids", () => {
    expect(new Set(COLUMN_IDS).size).toBe(COLUMN_DEFS.length);
    expect(COLUMN_DEFS.map((column) => column.id)).toEqual(COLUMN_IDS);
  });

  it("columnById returns the matching def for every id", () => {
    for (const def of COLUMN_DEFS) {
      expect(columnById(def.id)).toBe(def);
    }
  });

  it("marks exactly the columns with a value, plus Pos #, as orderable", () => {
    for (const def of COLUMN_DEFS) {
      if (def.id === "rank") continue;
      expect(def.isOrderable).toBe(def.value !== undefined);
    }
    // Pos # sorts on the standing StatsTable fills in, leader first.
    expect(columnById("rank").isOrderable).toBe(true);
    expect(columnById("rank").firstSortOrder).toBe("asc");
    expect(columnById("tiles").firstSortOrder).toBe("desc");
    expect(columnById("clan").isOrderable).toBe(false);
    expect(columnById("player").isOrderable).toBe(false);
    expect(columnById("tiles").isOrderable).toBe(true);
  });

  it("gives the team column its own icon, not the player one", () => {
    expect(columnById("team").headerVisual).toEqual({
      kind: "icon",
      src: teamIcon,
    });
    expect(columnById("player").headerVisual).toEqual({
      kind: "icon",
      src: profileIcon,
    });
  });

  it("keeps rank and the identity column out of the cog menu", () => {
    expect(columnById("rank").isHideable).toBe(false);
    expect(columnById("player").isHideable).toBe(false);
    expect(columnById("team").isHideable).toBe(false);
    expect(columnById("clan").isHideable).toBe(true);
    expect(columnById("gold").isHideable).toBe(true);
  });

  it("gives identity columns a fixed track and stat columns a shared one", () => {
    for (const def of COLUMN_DEFS) {
      expect(def.width === "auto").toBe(def.value !== undefined);
    }
  });

  it("splits the tables on clan and the identity column", () => {
    expect(columnsFor("player").map((column) => column.id)).toEqual(
      COLUMN_IDS.filter((id) => id !== "team"),
    );
    // The team table has no clan: a team has no single tag.
    expect(columnsFor("team").map((column) => column.id)).toEqual(
      COLUMN_IDS.filter((id) => id !== "clan" && id !== "player"),
    );
  });

  it("renders a cell for every column", () => {
    const game = makeGameView({
      config: stubConfig({ maxTroops: () => 1_000 }),
    });
    const player = makePlayerView({ game });

    for (const column of COLUMN_DEFS) {
      if (column.value !== undefined) {
        expect(typeof column.value(player, game)).toBe("number");
      }
      expect(typeof column.cell(emptyRow, game)).toBe("string");
    }
  });

  it("reads identity cells off the row, not the value map", () => {
    const game = makeGameView();
    const row = { ...emptyRow, value: 7, clanTag: "ABCDE" };

    expect(columnById("rank").cell(row, game)).toBe("7");
    expect(columnById("clan").cell(row, game)).toBe("ABCDE");
    expect(columnById("player").cell(row, game)).toBe("alice");
    expect(columnById("team").cell(row, game)).toBe("alice");
    expect(columnById("clan").cell(emptyRow, game)).toBe("");
  });

  it("renders zero owned percentage when no valid land remains", () => {
    const game = makeGameView();
    vi.spyOn(game, "numLandTiles").mockReturnValue(0);
    vi.spyOn(game, "numTilesWithFallout").mockReturnValue(0);

    expect(columnById("tiles").cell(emptyRow, game)).toBe("0.0%");
  });
});

describe("Stats tabs", () => {
  const tab = (id: (typeof STATS_TAB_IDS)[number]) =>
    STATS_TABS.find((def) => def.id === id)!;

  it("orders the tabs Economy, Buildings, Diplomacy", () => {
    expect(STATS_TABS.map((def) => def.id)).toEqual([
      "economy",
      "buildings",
      "diplomacy",
    ]);
    expect(STATS_TAB_IDS).toEqual(STATS_TABS.map((def) => def.id));
  });

  it("lists each tab's columns left to right", () => {
    expect(tab("economy").columns).toEqual([
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
    ]);
    expect(tab("buildings").columns).toEqual([
      "rank",
      "player",
      "team",
      "cities",
      "ports",
      "factories",
      "silos",
      "sams",
      "warships",
    ]);
    expect(tab("diplomacy").columns).toEqual([
      "rank",
      "player",
      "team",
      "clan",
      "allies",
      "betrayals",
    ]);
  });

  it("sorts Economy by owned territory and the other tabs by Pos #", () => {
    expect(STATS_TABS.map((def) => def.defaultSort)).toEqual([
      "tiles",
      "rank",
      "rank",
    ]);
  });

  it("defaults reference hideable columns the tab offers", () => {
    for (const def of STATS_TABS) {
      for (const id of def.defaultColumns) {
        expect(def.columns).toContain(id);
        expect(columnById(id).isHideable).toBe(true);
      }
      expect(def.columns).toContain(def.defaultSort);
      expect(columnById(def.defaultSort).isOrderable).toBe(true);
    }
  });

  it("offers every column on some tab", () => {
    const offered = new Set(STATS_TABS.flatMap((def) => def.columns));
    expect(COLUMN_IDS.filter((id) => !offered.has(id))).toEqual([]);
  });
});
