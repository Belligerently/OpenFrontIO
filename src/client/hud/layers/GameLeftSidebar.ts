import { GameMode, type Team } from "@openfront/engine-api/game/GameTypes";
import { assetUrl } from "@openfront/shared/AssetUrls";
import type { EventBus } from "@openfront/shared/EventBus";
import { Colord } from "colord";
import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { isCompactViewport } from "../../CompactViewport";
import type { Controller } from "../../Controller";
import { Platform } from "../../Platform";
import { STATS_TABS, type StatsTabId } from "../../StatsConstants";
import { themeProvider } from "../../theme/ThemeProvider";
import { UserSettings } from "../../UserSettings";
import { getTranslatedPlayerTeamLabel, translateText } from "../../Utils";
import type { GameView } from "../../view";
import { ImmunityBarVisibleEvent } from "./ImmunityTimer";
import "./PlayerStats";
import type { PlayerStats } from "./PlayerStats";
import { SpawnBarVisibleEvent } from "./SpawnTimer";
import "./TeamStats";
import type { TeamStats } from "./TeamStats";
const playerStatsRegularIcon = assetUrl(
  "images/LeaderboardIconRegularWhite.svg",
);
const playerStatsSolidIcon = assetUrl("images/LeaderboardIconSolidWhite.svg");
const teamStatsRegularIcon = assetUrl("images/TeamIconRegularWhite.svg");
const teamStatsSolidIcon = assetUrl("images/TeamIconSolidWhite.svg");

@customElement("game-left-sidebar")
export class GameLeftSidebar extends LitElement implements Controller {
  @state()
  private isPlayerStatsShown = false;
  @state()
  private isTeamStatsShown = false;
  @state()
  private isVisible = false;
  @state()
  private isPlayerTeamLabelVisible = false;
  @state()
  private playerTeam: Team | null = null;
  @state()
  private spawnBarVisible = false;
  @state()
  private immunityBarVisible = false;
  private readonly userSettings = new UserSettings();
  // One tab for both tables, so a team row reads like a player row.
  @state()
  private activeTab: StatsTabId = this.userSettings.statsTab();

  private playerColor: Colord = new Colord("#FFFFFF");
  @property({ attribute: false }) public game: GameView | null = null;
  @property({ attribute: false }) public eventBus: EventBus | null = null;
  @query("player-stats") private playerStats?: PlayerStats;
  @query("team-stats") private teamStats?: TeamStats;
  private showPlayerStatsAfterSpawn = false;

  createRenderRoot() {
    return this;
  }

  init() {
    this.isVisible = true;
    this.eventBus?.on(SpawnBarVisibleEvent, (e) => {
      this.spawnBarVisible = e.visible;
    });
    this.eventBus?.on(ImmunityBarVisibleEvent, (e) => {
      this.immunityBarVisible = e.visible;
    });
    if (this.isTeamGame) {
      this.isPlayerTeamLabelVisible = true;
    }
    // Make it visible by default on large screens; compact ones (short laptops,
    // Poki's frame) need the room for the map.
    if (Platform.isDesktopWidth && !isCompactViewport()) {
      this.showPlayerStatsAfterSpawn = true;
    }
  }

  getTickIntervalMs() {
    return 1000;
  }

  tick() {
    if (this.game === null) return;

    const team = this.game.myPlayer()?.team();
    if (this.playerTeam === null && team !== null && team !== undefined) {
      this.playerTeam = team;
      this.playerColor = themeProvider.current().teamColor(team);
    }

    if (this.showPlayerStatsAfterSpawn && !this.game.inSpawnPhase()) {
      this.showPlayerStatsAfterSpawn = false;
      this.isPlayerStatsShown = true;
    }

    if (!this.game.inSpawnPhase() && this.isPlayerTeamLabelVisible) {
      this.isPlayerTeamLabelVisible = false;
    }

    this.playerStats?.refresh();
    this.teamStats?.refresh();
  }

  private get barOffset(): number {
    return (this.spawnBarVisible ? 7 : 0) + (this.immunityBarVisible ? 7 : 0);
  }

  private togglePlayerStats(): void {
    this.isPlayerStatsShown = !this.isPlayerStatsShown;
  }

  private toggleTeamStats(): void {
    this.isTeamStatsShown = !this.isTeamStatsShown;
  }

  private selectTab(tab: StatsTabId): void {
    this.activeTab = tab;
    this.userSettings.setStatsTab(tab);
  }

  // Arrow keys, Home and End move between tabs and select the one they
  // land on (the WAI-ARIA tabs pattern with automatic activation).
  private onTabKeydown(event: KeyboardEvent): void {
    const focused = (event.target as HTMLElement).id;
    const index = STATS_TABS.findIndex(
      (tab) => `leaderboard-tab-${tab.id}` === focused,
    );
    if (index === -1) return;
    const last = STATS_TABS.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % STATS_TABS.length
        : event.key === "ArrowLeft"
          ? (index + last) % STATS_TABS.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    // The arrows also pan the map (InputHandler listens on window).
    event.stopPropagation();
    this.selectTab(STATS_TABS[next].id);
    void this.updateComplete.then(() =>
      this.querySelector<HTMLElement>(
        `#leaderboard-tab-${STATS_TABS[next].id}`,
      )?.focus(),
    );
  }

  private renderTabs() {
    return html`
      <div
        class="flex gap-1 mt-2 overflow-x-auto text-white"
        role="tablist"
        aria-label=${translateText("leaderboard.tabs")}
        @keydown=${this.onTabKeydown}
      >
        ${STATS_TABS.map((tab) => {
          const selected = tab.id === this.activeTab;
          return html`
            <button
              id="leaderboard-tab-${tab.id}"
              class="leaderboard-tab shrink-0 px-2 py-1 lg:py-0.5 text-xs lg:text-sm rounded-md border transition-colors ${
                selected
                  ? "bg-slate-600 border-slate-300 font-bold"
                  : "bg-gray-700/50 border-slate-500 text-slate-300 hover:bg-gray-600"
              }"
              role="tab"
              aria-selected=${selected}
              aria-controls="leaderboard-tabpanel"
              tabindex=${selected ? 0 : -1}
              @click=${() => this.selectTab(tab.id)}
            >
              ${translateText(tab.labelKey)}
            </button>
          `;
        })}
      </div>
    `;
  }

  private get isTeamGame(): boolean {
    return this.game?.config().gameConfig().gameMode === GameMode.Team;
  }

  render() {
    return html`
      <aside
        class=${`max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:z-900 lg:pointer-events-auto flex flex-col max-h-[calc(100vh-80px)] overflow-y-auto p-2 bg-gray-800/92 backdrop-blur-sm shadow-xs rounded-br-lg ${this.isPlayerStatsShown || this.isTeamStatsShown ? "max-[400px]:w-full max-[400px]:rounded-none" : ""} transition-all duration-300 ease-out transform ${
          this.isVisible ? "translate-x-0" : "hidden"
        }`}
        style="margin-top: ${this.barOffset}px;"
      >
        <div class="flex items-center gap-4 xl:gap-6 text-white">
          <div
            class="cursor-pointer p-0.5 bg-gray-700/50 hover:bg-gray-600 border rounded-md border-slate-500 transition-colors"
            @click=${this.togglePlayerStats}
            role="button"
            tabindex="0"
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " " || e.code === "Space") {
                e.preventDefault();
                this.togglePlayerStats();
              }
            }}
          >
            <img
              src=${
                this.isPlayerStatsShown
                  ? playerStatsSolidIcon
                  : playerStatsRegularIcon
              }
              alt=${
                translateText("help_modal.icon_alt_player_leaderboard") ||
                "Player Leaderboard Icon"
              }
              width="20"
              height="20"
            />
          </div>
          ${
            this.isTeamGame
              ? html`
                  <div
                    class="cursor-pointer p-0.5 bg-gray-700/50 hover:bg-gray-600 border rounded-md border-slate-500 transition-colors"
                    @click=${this.toggleTeamStats}
                    role="button"
                    tabindex="0"
                    @keydown=${(e: KeyboardEvent) => {
                      if (
                        e.key === "Enter" ||
                        e.key === " " ||
                        e.code === "Space"
                      ) {
                        e.preventDefault();
                        this.toggleTeamStats();
                      }
                    }}
                  >
                    <img
                      src=${
                        this.isTeamStatsShown
                          ? teamStatsSolidIcon
                          : teamStatsRegularIcon
                      }
                      alt=${
                        translateText("help_modal.icon_alt_team_leaderboard") ||
                        "Team Leaderboard Icon"
                      }
                      width="20"
                      height="20"
                    />
                  </div>
                `
              : null
          }
          ${
            this.isPlayerStatsShown || this.isTeamStatsShown
              ? html`<span
                  class="ml-auto text-[10px] text-slate-500 select-all leading-none self-start"
                  title=${translateText("help_modal.game_id_tooltip")}
                  >${this.game?.gameID() ?? ""}</span
                >`
              : null
          }
        </div>
        ${
          this.isPlayerTeamLabelVisible
            ? html`
                <div
                  class="flex items-center w-full text-white mt-2"
                  @contextmenu=${(e: Event) => e.preventDefault()}
                >
                  ${translateText("help_modal.ui_your_team")}
                  <span
                    style="--color: ${this.playerColor.toRgbString()}"
                    class="text-(--color)"
                  >
                    &nbsp;${getTranslatedPlayerTeamLabel(
                      this.playerTeam,
                      this.game?.teamClanTag(this.playerTeam),
                    )}
                    &#10687;
                  </span>
                </div>
              `
            : null
        }
        ${
          this.isPlayerStatsShown || this.isTeamStatsShown
            ? this.renderTabs()
            : null
        }
        <div
          id="leaderboard-tabpanel"
          class="flex flex-col gap-2 min-w-0 w-full"
          role="tabpanel"
          aria-labelledby="leaderboard-tab-${this.activeTab}"
        >
          <player-stats
            class=${this.isPlayerStatsShown ? "block min-w-0" : "hidden"}
            .game=${this.game}
            .eventBus=${this.eventBus}
            .visible=${this.isPlayerStatsShown}
            .tab=${this.activeTab}
          ></player-stats>
          <team-stats
            class=${
              this.isTeamStatsShown && this.isTeamGame
                ? "block min-w-0"
                : "hidden"
            }
            .game=${this.game}
            .visible=${this.isTeamStatsShown && this.isTeamGame}
            .tab=${this.activeTab}
          ></team-stats>
        </div>
        <slot></slot>
      </aside>
    `;
  }
}
