// @vitest-environment jsdom
import { GameMode } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import type { StatsTable } from "../src/client/components/StatsTable";
import { GameLeftSidebar } from "../src/client/hud/layers/GameLeftSidebar";
import { PlayerStats } from "../src/client/hud/layers/PlayerStats";
import { TeamStats } from "../src/client/hud/layers/TeamStats";
import { UserSettings } from "../src/client/UserSettings";
import type { GameView, PlayerView } from "../src/client/view";

interface FakePlayer {
  id: string;
  tiles: number;
  gold?: number;
  cities?: number;
  allies?: number;
  team?: string | null;
}

function fakePlayer({
  id,
  tiles,
  gold = 0,
  cities = 0,
  allies = 0,
  team = null,
}: FakePlayer): PlayerView {
  return {
    id: () => id,
    smallID: () => 0,
    name: () => id,
    clanTag: () => null,
    team: () => team,
    numTilesOwned: () => tiles,
    gold: () => BigInt(gold),
    goldEarned: () => gold * 2,
    tradeGold: () => 0,
    trainGold: () => 0,
    piracyGold: () => 0,
    troops: () => 0,
    totalUnitLevels: () => cities,
    allies: () => Array.from({ length: allies }),
    betrayals: () => 0,
    isAlive: () => true,
    isOnSameTeam: () => false,
  } as unknown as PlayerView;
}

function fakeGame(players: PlayerView[], gameMode = GameMode.FFA): GameView {
  return {
    config: () => ({
      gameConfig: () => ({ gameMode }),
      maxTroops: () => 1_000,
    }),
    gameID: () => "test-game",
    inSpawnPhase: () => false,
    myPlayer: () => players[0],
    numLandTiles: () => 100,
    numTilesWithFallout: () => 0,
    ticks: () => 600,
    playerViews: () => players,
    teamClanTag: () => null,
  } as unknown as GameView;
}

async function mount<T extends StatsTable>(table: T, game: GameView) {
  table.game = game;
  table.visible = true;
  document.body.append(table);
  table.refresh();
  await table.updateComplete;
  return table;
}

function rows(table: StatsTable): string[][] {
  return [...table.querySelectorAll(".stats-table-row")].map((row) =>
    [...row.querySelectorAll('[role="cell"]')].map(
      (cell) => cell.textContent?.trim() ?? "",
    ),
  );
}

function headers(table: StatsTable): HTMLElement[] {
  return [
    ...table.querySelectorAll<HTMLElement>(
      '.stats-table-header > [role="columnheader"]',
    ),
  ];
}

const titles = (table: StatsTable) =>
  headers(table)
    .map((header) => header.getAttribute("title"))
    .filter((title) => title !== null);

async function clickHeader(table: StatsTable, title: string) {
  headers(table)
    .find((header) => header.getAttribute("title") === title)!
    .querySelector("button")!
    .click();
  await table.updateComplete;
}

beforeEach(() => {
  localStorage.clear();
  (
    UserSettings as unknown as { cache: Map<string, string | null> }
  ).cache.clear();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Leaderboard tab defaults", () => {
  it("opens Economy sorted by owned territory, leader first", async () => {
    const table = await mount(
      new PlayerStats(),
      fakeGame([
        fakePlayer({ id: "small", tiles: 5 }),
        fakePlayer({ id: "big", tiles: 50 }),
      ]),
    );

    expect(rows(table).map((row) => row.slice(0, 2))).toEqual([
      ["1", "big"],
      ["2", "small"],
    ]);
    expect(headers(table)[2].getAttribute("aria-sort")).toBe("descending");
  });

  it("opens Buildings and Diplomacy sorted by Pos #, ascending", async () => {
    const table = await mount(
      new PlayerStats(),
      fakeGame([
        fakePlayer({ id: "small", tiles: 5 }),
        fakePlayer({ id: "big", tiles: 50 }),
      ]),
    );
    for (const tab of ["buildings", "diplomacy"] as const) {
      table.tab = tab;
      await table.updateComplete;
      expect(headers(table)[0].getAttribute("aria-sort")).toBe("ascending");
      expect(rows(table).map((row) => row[1])).toEqual(["big", "small"]);
    }
  });

  it("shows each tab's default columns in order", async () => {
    const table = await mount(
      new PlayerStats(),
      fakeGame([fakePlayer({ id: "a", tiles: 5 })]),
    );

    expect(titles(table)).toEqual([
      "leaderboard.rank",
      "leaderboard.player",
      "leaderboard.owned",
      "leaderboard.gold",
      "leaderboard.maxtroops",
      "leaderboard.goldIncomePerMin",
    ]);
    table.tab = "buildings";
    await table.updateComplete;
    expect(titles(table)).toEqual([
      "leaderboard.rank",
      "leaderboard.player",
      "leaderboard.cities",
      "leaderboard.ports",
      "leaderboard.factories",
      "leaderboard.launchers",
      "leaderboard.sams",
      "leaderboard.warships",
    ]);
    table.tab = "diplomacy";
    await table.updateComplete;
    expect(titles(table)).toEqual([
      "leaderboard.rank",
      "leaderboard.player",
      "leaderboard.clan",
      "leaderboard.allies",
      "leaderboard.betrayals",
    ]);
  });
});

describe("Leaderboard sorting", () => {
  const players = () => [
    fakePlayer({ id: "poor-leader", tiles: 50, gold: 1, cities: 0 }),
    fakePlayer({ id: "rich-runner-up", tiles: 40, gold: 900, cities: 4 }),
    fakePlayer({ id: "middle", tiles: 10, gold: 300, cities: 2 }),
  ];

  it("keeps Pos # with the player when sorted by another column", async () => {
    const table = await mount(new PlayerStats(), fakeGame(players()));

    await clickHeader(table, "leaderboard.gold");
    expect(rows(table).map((row) => row.slice(0, 2))).toEqual([
      ["2", "rich-runner-up"],
      ["3", "middle"],
      ["1", "poor-leader"],
    ]);

    await clickHeader(table, "leaderboard.gold");
    expect(rows(table).map((row) => row[1])).toEqual([
      "poor-leader",
      "middle",
      "rich-runner-up",
    ]);
  });

  it("first sorts Pos # leader first, then reverses", async () => {
    const table = await mount(new PlayerStats(), fakeGame(players()));
    await clickHeader(table, "leaderboard.rank");
    expect(rows(table).map((row) => row[0])).toEqual(["1", "2", "3"]);
    await clickHeader(table, "leaderboard.rank");
    expect(rows(table).map((row) => row[0])).toEqual(["3", "2", "1"]);
  });

  it("remembers each tab's sort when switching tabs", async () => {
    const table = await mount(new PlayerStats(), fakeGame(players()));
    await clickHeader(table, "leaderboard.gold");

    table.tab = "buildings";
    await table.updateComplete;
    // Buildings has its own default: Pos #.
    expect(rows(table).map((row) => row[0])).toEqual(["1", "2", "3"]);
    await clickHeader(table, "leaderboard.cities");
    expect(rows(table).map((row) => row[1])[0]).toBe("rich-runner-up");

    table.tab = "economy";
    await table.updateComplete;
    expect(rows(table).map((row) => row[1])[0]).toBe("rich-runner-up");
    expect(
      headers(table)
        .find((h) => h.getAttribute("title") === "leaderboard.gold")!
        .getAttribute("aria-sort"),
    ).toBe("descending");
  });

  it("falls back to the tab's default when the sorted column is hidden", async () => {
    const table = await mount(new PlayerStats(), fakeGame(players()));
    await clickHeader(table, "leaderboard.gold");

    new UserSettings().setStatsColumns("player", "economy", ["tiles"]);
    table.refresh();
    await table.updateComplete;
    expect(rows(table).map((row) => row[1])).toEqual([
      "poor-leader",
      "rich-runner-up",
      "middle",
    ]);
  });
});

describe("Leaderboard column preferences", () => {
  it("applies a picker change to the active tab only", async () => {
    const table = await mount(
      new PlayerStats(),
      fakeGame([fakePlayer({ id: "a", tiles: 5 })]),
    );
    table.tab = "buildings";
    await table.updateComplete;

    table
      .querySelector("column-picker")!
      .dispatchEvent(
        new CustomEvent("columns-changed", { detail: ["ports", "sams"] }),
      );
    await table.updateComplete;
    expect(titles(table)).toEqual([
      "leaderboard.rank",
      "leaderboard.player",
      "leaderboard.ports",
      "leaderboard.sams",
    ]);

    const settings = new UserSettings();
    expect(settings.statsColumns("player", "buildings")).toEqual([
      "ports",
      "sams",
    ]);
    expect(settings.statsColumns("player", "economy")).toHaveLength(4);
    expect(settings.statsColumns("team", "buildings")).toHaveLength(6);
  });

  it("offers only the active tab's hideable columns in the picker", async () => {
    const table = await mount(
      new PlayerStats(),
      fakeGame([fakePlayer({ id: "a", tiles: 5 })]),
    );
    const offered = () =>
      (
        table.querySelector("column-picker") as unknown as {
          columns: { id: string }[];
        }
      ).columns.map((column) => column.id);

    expect(offered()).toEqual([
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
    table.tab = "diplomacy";
    await table.updateComplete;
    expect(offered()).toEqual(["clan", "allies", "betrayals"]);
  });
});

describe("Leaderboard team view", () => {
  const teamPlayers = () => [
    fakePlayer({ id: "red-1", tiles: 10, cities: 1, allies: 1, team: "Red" }),
    fakePlayer({ id: "red-2", tiles: 30, cities: 2, allies: 2, team: "Red" }),
    fakePlayer({ id: "blue-1", tiles: 20, cities: 5, team: "Blue" }),
  ];

  it("ranks teams by summed territory on every tab", async () => {
    const table = await mount(
      new TeamStats(),
      fakeGame(teamPlayers(), GameMode.Team),
    );
    expect(rows(table).map((row) => row.slice(0, 2))).toEqual([
      ["1", "Red"],
      ["2", "Blue"],
    ]);

    table.tab = "buildings";
    await table.updateComplete;
    // rank | team | cities | ...: buildings are summed per team.
    expect(rows(table).map((row) => row.slice(0, 3))).toEqual([
      ["1", "Red", "3"],
      ["2", "Blue", "5"],
    ]);
    await clickHeader(table, "leaderboard.cities");
    expect(rows(table).map((row) => row.slice(0, 2))).toEqual([
      ["2", "Blue"],
      ["1", "Red"],
    ]);

    // The team table has no clan column; Diplomacy shows the sums.
    table.tab = "diplomacy";
    await table.updateComplete;
    expect(titles(table)).toEqual([
      "leaderboard.rank",
      "leaderboard.team",
      "leaderboard.allies",
      "leaderboard.betrayals",
    ]);
    expect(rows(table).map((row) => row.slice(0, 3))).toEqual([
      ["1", "Red", "3"],
      ["2", "Blue", "0"],
    ]);
  });
});

describe("Leaderboard tab bar", () => {
  async function mountSidebar(gameMode = GameMode.FFA) {
    const sidebar = new GameLeftSidebar();
    sidebar.game = fakeGame(
      [
        fakePlayer({ id: "a", tiles: 5, team: "Red" }),
        fakePlayer({ id: "b", tiles: 9, team: "Blue" }),
      ],
      gameMode,
    );
    sidebar.eventBus = new EventBus();
    document.body.append(sidebar);
    sidebar.init();
    await sidebar.updateComplete;
    return sidebar;
  }

  const tabs = (sidebar: GameLeftSidebar) => [
    ...sidebar.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
  ];
  const selected = (sidebar: GameLeftSidebar) =>
    tabs(sidebar).find((tab) => tab.getAttribute("aria-selected") === "true")
      ?.id;

  it("appears with the table, Economy selected", async () => {
    const sidebar = await mountSidebar();
    expect(tabs(sidebar)).toHaveLength(0);

    sidebar.querySelector<HTMLElement>('[role="button"]')!.click();
    await sidebar.updateComplete;
    expect(tabs(sidebar).map((tab) => tab.textContent?.trim())).toEqual([
      "leaderboard.tab_economy",
      "leaderboard.tab_buildings",
      "leaderboard.tab_diplomacy",
    ]);
    expect(selected(sidebar)).toBe("leaderboard-tab-economy");
    expect(tabs(sidebar).map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
  });

  it("switches both tables on click and remembers the tab", async () => {
    const sidebar = await mountSidebar(GameMode.Team);
    const [playerToggle, teamToggle] =
      sidebar.querySelectorAll<HTMLElement>('[role="button"]');
    playerToggle.click();
    teamToggle.click();
    await sidebar.updateComplete;

    tabs(sidebar)[1].click();
    await sidebar.updateComplete;

    expect(sidebar.querySelector<PlayerStats>("player-stats")!.tab).toBe(
      "buildings",
    );
    expect(sidebar.querySelector<TeamStats>("team-stats")!.tab).toBe(
      "buildings",
    );
    expect(new UserSettings().statsTab()).toBe("buildings");
    expect(
      sidebar
        .querySelector('[role="tabpanel"]')!
        .getAttribute("aria-labelledby"),
    ).toBe("leaderboard-tab-buildings");
  });

  it("moves between tabs with the arrow, Home and End keys", async () => {
    const sidebar = await mountSidebar();
    sidebar.querySelector<HTMLElement>('[role="button"]')!.click();
    await sidebar.updateComplete;

    const press = async (key: string) => {
      document.activeElement!.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true }),
      );
      await sidebar.updateComplete;
      await sidebar.updateComplete;
    };

    tabs(sidebar)[0].focus();
    await press("ArrowRight");
    expect(selected(sidebar)).toBe("leaderboard-tab-buildings");
    expect(document.activeElement?.id).toBe("leaderboard-tab-buildings");
    await press("End");
    expect(selected(sidebar)).toBe("leaderboard-tab-diplomacy");
    await press("ArrowRight");
    expect(selected(sidebar)).toBe("leaderboard-tab-economy");
    await press("ArrowLeft");
    expect(selected(sidebar)).toBe("leaderboard-tab-diplomacy");
    await press("Home");
    expect(selected(sidebar)).toBe("leaderboard-tab-economy");
  });

  it("steps from the focused tab and keeps the arrows off the map", async () => {
    const sidebar = await mountSidebar();
    sidebar.querySelector<HTMLElement>('[role="button"]')!.click();
    await sidebar.updateComplete;
    tabs(sidebar)[2].click();
    await sidebar.updateComplete;

    // The game pans the camera from a window keydown listener.
    const mapKeys = vi.fn();
    window.addEventListener("keydown", mapKeys);
    tabs(sidebar)[0].focus();
    tabs(sidebar)[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await sidebar.updateComplete;
    window.removeEventListener("keydown", mapKeys);

    expect(selected(sidebar)).toBe("leaderboard-tab-buildings");
    expect(mapKeys).not.toHaveBeenCalled();
  });

  it("reopens on the tab the player left", async () => {
    new UserSettings().setStatsTab("diplomacy");
    const sidebar = await mountSidebar();
    sidebar.querySelector<HTMLElement>('[role="button"]')!.click();
    await sidebar.updateComplete;
    expect(sidebar.querySelector<PlayerStats>("player-stats")!.tab).toBe(
      "diplomacy",
    );
  });
});
