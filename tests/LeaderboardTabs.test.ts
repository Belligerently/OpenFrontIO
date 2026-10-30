// @vitest-environment jsdom
import { GameMode, PlayerType } from "@openfront/engine-api/game/GameTypes";
import type { AllPlayersStats } from "@openfront/engine-api/Schemas";
import { EventBus } from "@openfront/shared/EventBus";
import type { StatsTable } from "../src/client/components/StatsTable";
import { GameLeftSidebar } from "../src/client/hud/layers/GameLeftSidebar";
import { columnById } from "../src/client/hud/layers/lib/StatsColumns";
import { PlayerStats } from "../src/client/hud/layers/PlayerStats";
import {
  aggregateTeamValues,
  TeamStats,
} from "../src/client/hud/layers/TeamStats";
import { UserSettings } from "../src/client/UserSettings";
import type { GameView, PlayerView } from "../src/client/view";

interface FakePlayer {
  id: string;
  tiles: number;
  gold?: number;
  team?: string | null;
  type?: PlayerType;
  alive?: boolean;
}

function fakePlayer({
  id,
  tiles,
  gold = 0,
  team = null,
  type = PlayerType.Human,
  alive = true,
}: FakePlayer): PlayerView {
  return {
    id: () => id,
    smallID: () => 0,
    name: () => id,
    clanTag: () => null,
    clientID: () => (type === PlayerType.Human ? `client-${id}` : null),
    type: () => type,
    team: () => team,
    numTilesOwned: () => tiles,
    gold: () => BigInt(gold),
    goldEarned: () => gold * 2,
    piracyGold: () => 0,
    troops: () => 0,
    totalUnitLevels: () => 0,
    allies: () => [],
    betrayals: () => 0,
    isAlive: () => alive,
    isOnSameTeam: () => false,
  } as unknown as PlayerView;
}

function fakeGame(
  players: PlayerView[],
  stats: AllPlayersStats = {},
  gameMode = GameMode.FFA,
): GameView {
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
    worker: {
      humanStats: async () => ({ tick: 600, disconnectedAt: {}, stats }),
    },
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

async function clickHeader(table: StatsTable, title: string) {
  headers(table)
    .find((header) => header.getAttribute("title") === title)!
    .querySelector("button")!
    .click();
  await table.updateComplete;
}

// Lets the human-stats request resolve and the table re-render with it.
async function settle(table: StatsTable) {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
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
  it("opens Info sorted by owned territory, leader first", async () => {
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

  it("opens every other tab sorted by Pos #, ascending", async () => {
    const table = await mount(
      new PlayerStats(),
      fakeGame([
        fakePlayer({ id: "small", tiles: 5 }),
        fakePlayer({ id: "big", tiles: 50 }),
      ]),
    );
    for (const tab of ["structures", "stats", "bombs"] as const) {
      table.tab = tab;
      await table.updateComplete;
      expect(headers(table)[0].getAttribute("aria-sort")).toBe("ascending");
      expect(rows(table).map((row) => row[1])).toEqual(["big", "small"]);
    }
  });

  it("shows each tab's default columns in #4797's order", async () => {
    const table = await mount(
      new PlayerStats(),
      fakeGame([fakePlayer({ id: "a", tiles: 5 })]),
    );
    const titles = () =>
      headers(table)
        .map((header) => header.getAttribute("title"))
        .filter((title) => title !== null);

    expect(titles()).toEqual([
      "leaderboard.rank",
      "leaderboard.player",
      "leaderboard.owned",
      "leaderboard.gold",
      "leaderboard.maxtroops",
    ]);
    table.tab = "structures";
    await table.updateComplete;
    expect(titles()).toEqual([
      "leaderboard.rank",
      "leaderboard.player",
      "leaderboard.cities",
      "leaderboard.ports",
      "leaderboard.factories",
      "leaderboard.launchers",
      "leaderboard.sams",
      "leaderboard.warships",
    ]);
    table.tab = "stats";
    await table.updateComplete;
    expect(titles()).toEqual([
      "leaderboard.rank",
      "leaderboard.player",
      "leaderboard.goldEarned",
      "leaderboard.piracyGold",
      "leaderboard.warshipsKilled (leaderboard.human_only)",
      "leaderboard.betrayals",
    ]);
    table.tab = "bombs";
    await table.updateComplete;
    expect(titles()).toEqual([
      "leaderboard.rank",
      "leaderboard.player",
      "leaderboard.atomBombsSent (leaderboard.human_only)",
      "leaderboard.hydrogenBombsSent (leaderboard.human_only)",
      "leaderboard.mirvsSent (leaderboard.human_only)",
    ]);
  });
});

describe("Leaderboard sorting", () => {
  const players = () => [
    fakePlayer({ id: "poor-leader", tiles: 50, gold: 1 }),
    fakePlayer({ id: "rich-runner-up", tiles: 40, gold: 900 }),
    fakePlayer({ id: "middle", tiles: 10, gold: 300 }),
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

    table.tab = "structures";
    await table.updateComplete;
    // Structures has its own default: Pos #.
    expect(rows(table).map((row) => row[0])).toEqual(["1", "2", "3"]);

    table.tab = "info";
    await table.updateComplete;
    expect(rows(table).map((row) => row[1])[0]).toBe("rich-runner-up");
  });

  it("falls back to the tab's default when the sorted column is hidden", async () => {
    const table = await mount(new PlayerStats(), fakeGame(players()));
    await clickHeader(table, "leaderboard.gold");

    new UserSettings().setStatsColumns("player", "info", ["tiles"]);
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
    table.tab = "structures";
    await table.updateComplete;

    table
      .querySelector("column-picker")!
      .dispatchEvent(
        new CustomEvent("columns-changed", { detail: ["ports", "sams"] }),
      );
    await table.updateComplete;
    expect(headers(table).map((h) => h.getAttribute("title"))).toEqual([
      "leaderboard.rank",
      "leaderboard.player",
      "leaderboard.ports",
      "leaderboard.sams",
      null,
    ]);

    const settings = new UserSettings();
    expect(settings.statsColumns("player", "structures")).toEqual([
      "ports",
      "sams",
    ]);
    expect(settings.statsColumns("player", "info")).toEqual([
      "tiles",
      "gold",
      "maxtroops",
    ]);
    expect(settings.statsColumns("team", "structures")).toHaveLength(6);
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

    expect(offered()).toEqual(["tiles", "gold", "troops", "maxtroops", "clan"]);
    table.tab = "stats";
    await table.updateComplete;
    expect(offered()).toEqual([
      "goldEarned",
      "piracyGold",
      "warshipsKilled",
      "allies",
      "betrayals",
    ]);
  });
});

describe("Leaderboard human-only stats", () => {
  const stats: AllPlayersStats = {
    "client-human-a": { bombs: { abomb: [3n, 2n, 1n], mirv: [1n] } },
    "client-human-b": { bombs: { abomb: [7n] } },
  };

  it("shows tracked counts for humans and a dash, sorted last, for nations", async () => {
    const table = await mount(
      new PlayerStats(),
      fakeGame(
        [
          fakePlayer({ id: "human-a", tiles: 30 }),
          fakePlayer({ id: "nation", tiles: 50, type: PlayerType.Nation }),
          fakePlayer({ id: "human-b", tiles: 10 }),
          fakePlayer({ id: "human-c", tiles: 5 }),
        ],
        stats,
      ),
    );
    table.tab = "bombs";
    await settle(table);

    // rank | player | atom | hydrogen | mirv. A human the engine has
    // nothing on yet has sent nothing.
    expect(rows(table)).toEqual([
      ["1", "nation", "—", "—", "—"],
      ["2", "human-a", "3", "0", "1"],
      ["3", "human-b", "7", "0", "0"],
      ["4", "human-c", "0", "0", "0"],
    ]);

    await clickHeader(
      table,
      "leaderboard.atomBombsSent (leaderboard.human_only)",
    );
    expect(rows(table).map((row) => row[1])).toEqual([
      "human-b",
      "human-a",
      "human-c",
      "nation",
    ]);
    await clickHeader(
      table,
      "leaderboard.atomBombsSent (leaderboard.human_only)",
    );
    expect(rows(table).map((row) => row[1])).toEqual([
      "human-c",
      "human-a",
      "human-b",
      "nation",
    ]);
  });

  it("does not ask the worker while no human-only column is on screen", async () => {
    const game = fakeGame([fakePlayer({ id: "a", tiles: 5 })]);
    const humanStats = vi.spyOn(game.worker, "humanStats");
    const table = await mount(new PlayerStats(), game);
    table.tab = "structures";
    await table.updateComplete;
    expect(humanStats).not.toHaveBeenCalled();

    table.tab = "bombs";
    await table.updateComplete;
    expect(humanStats).toHaveBeenCalled();
  });
});

describe("Leaderboard team view", () => {
  const teamPlayers = () => [
    fakePlayer({ id: "red-human", tiles: 10, team: "Red" }),
    fakePlayer({
      id: "red-nation",
      tiles: 30,
      team: "Red",
      type: PlayerType.Nation,
    }),
    fakePlayer({ id: "blue-human", tiles: 20, team: "Blue" }),
    fakePlayer({
      id: "green-nation",
      tiles: 5,
      team: "Green",
      type: PlayerType.Nation,
    }),
  ];
  const teamStatsRecord: AllPlayersStats = {
    "client-red-human": { bombs: { abomb: [2n] } },
    "client-blue-human": { bombs: { abomb: [5n] } },
  };

  it("ranks teams by summed territory and follows the same tab", async () => {
    const table = await mount(
      new TeamStats(),
      fakeGame(teamPlayers(), teamStatsRecord, GameMode.Team),
    );
    expect(rows(table).map((row) => row.slice(0, 2))).toEqual([
      ["1", "Red"],
      ["2", "Blue"],
      ["3", "Green"],
    ]);

    table.tab = "bombs";
    await settle(table);
    // Red sums its one human; a nation-only team has nothing to show.
    expect(rows(table).map((row) => row.slice(0, 3))).toEqual([
      ["1", "Red", "2"],
      ["2", "Blue", "5"],
      ["3", "Green", "—"],
    ]);
  });

  it("sums only members with a value, and leaves out all-unavailable totals", () => {
    const game = fakeGame([], teamStatsRecord);
    const nation = fakePlayer({
      id: "n",
      tiles: 1,
      type: PlayerType.Nation,
    });
    const values = aggregateTeamValues(
      [nation],
      [columnById("tiles"), columnById("atomBombsSent")],
      game,
    );
    expect(Object.fromEntries(values)).toEqual({ tiles: 1 });
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
      {},
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

  it("appears with the table, Info selected", async () => {
    const sidebar = await mountSidebar();
    expect(tabs(sidebar)).toHaveLength(0);

    sidebar.querySelector<HTMLElement>('[role="button"]')!.click();
    await sidebar.updateComplete;
    expect(tabs(sidebar).map((tab) => tab.textContent?.trim())).toEqual([
      "leaderboard.tab_info",
      "leaderboard.tab_structures",
      "leaderboard.tab_stats",
      "leaderboard.tab_bombs",
    ]);
    expect(
      tabs(sidebar).map((tab) => tab.getAttribute("aria-selected")),
    ).toEqual(["true", "false", "false", "false"]);
    expect(tabs(sidebar).map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
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
      "structures",
    );
    expect(sidebar.querySelector<TeamStats>("team-stats")!.tab).toBe(
      "structures",
    );
    expect(new UserSettings().statsTab()).toBe("structures");
    expect(
      sidebar
        .querySelector('[role="tabpanel"]')!
        .getAttribute("aria-labelledby"),
    ).toBe("leaderboard-tab-structures");
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
    const selected = () =>
      tabs(sidebar).find((tab) => tab.getAttribute("aria-selected") === "true")
        ?.id;

    tabs(sidebar)[0].focus();
    await press("ArrowRight");
    expect(selected()).toBe("leaderboard-tab-structures");
    expect(document.activeElement?.id).toBe("leaderboard-tab-structures");
    await press("End");
    expect(selected()).toBe("leaderboard-tab-bombs");
    await press("ArrowRight");
    expect(selected()).toBe("leaderboard-tab-info");
    await press("ArrowLeft");
    expect(selected()).toBe("leaderboard-tab-bombs");
    await press("Home");
    expect(selected()).toBe("leaderboard-tab-info");
  });

  it("steps from the focused tab and keeps the arrows off the map", async () => {
    const sidebar = await mountSidebar();
    sidebar.querySelector<HTMLElement>('[role="button"]')!.click();
    await sidebar.updateComplete;
    tabs(sidebar)[3].click();
    await sidebar.updateComplete;

    // The game pans the camera from a window keydown listener.
    const mapKeys = vi.fn();
    window.addEventListener("keydown", mapKeys);
    tabs(sidebar)[1].focus();
    tabs(sidebar)[1].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await sidebar.updateComplete;
    window.removeEventListener("keydown", mapKeys);

    expect(
      tabs(sidebar).find((tab) => tab.getAttribute("aria-selected") === "true")
        ?.id,
    ).toBe("leaderboard-tab-stats");
    expect(mapKeys).not.toHaveBeenCalled();
  });

  it("reopens on the tab the player left", async () => {
    new UserSettings().setStatsTab("stats");
    const sidebar = await mountSidebar();
    sidebar.querySelector<HTMLElement>('[role="button"]')!.click();
    await sidebar.updateComplete;
    expect(sidebar.querySelector<PlayerStats>("player-stats")!.tab).toBe(
      "stats",
    );
  });
});
