import Stats from 'stats-gl';
import { World } from './world';
import { Settings } from './configuration/settings';

export class Main {
  private readonly world: World;
  private readonly canvas: HTMLCanvasElement;
  private readonly settings: Settings;
  private readonly stats?: Stats;

  public constructor() {
    const display = document.querySelector<HTMLCanvasElement>('#display');
    if (display === null) {
      throw new Error('Failed to obtain the HTML canvas element');
    }
    this.canvas = display;

    const debugMode =
      new URLSearchParams(window.location.search)
        .get('debug')
        ?.toUpperCase() === 'TRUE';

    this.settings = new Settings(this.applySettings.bind(this), debugMode);

    if (debugMode) {
      this.stats = new Stats({
        trackGPU: false,
        trackHz: false,
        trackCPT: false,
        logsPerSecond: 4,
        graphsPerSecond: 30,
        samplesLog: 40,
        samplesGraph: 10,
        precision: 2,
        horizontal: false,
        minimal: false,
        mode: 0,
      });
      document.body.appendChild(this.stats.dom);
    }

    this.world = new World(this.canvas, debugMode, this.stats);
  }

  public async runAsync(): Promise<void> {
    await this.world.startAsync();
    this.world.applySettings(this.settings);
    window.addEventListener('resize', this.onResize.bind(this));
  }

  public onResize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.world.onResize(
      window.innerWidth,
      window.innerHeight,
      window.devicePixelRatio,
    );
  }

  private applySettings(): void {
    this.world.applySettings(this.settings);
  }
}

new Main().runAsync();
