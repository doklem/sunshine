import GUI from 'lil-gui';
import { Instrument } from './instrument';

export class Settings {
  private readonly gui = new GUI({ title: 'Sunshine' });

  public instrument: Instrument;
  public surface: boolean;
  public rotation: boolean;
  public playbackSpeed = 1;

  public readonly magentosphre = {
    northPoles: false,
    southPoles: false,
    closedConnections: false,
    openConnections: false,
    closedMagenticFieldLines: false,
    openMagenticFieldLines: false,
  };

  public readonly aia304a = {
    closedFlares: true,
    openFlares: true,
    bloomStrength: 1,
  };

  public constructor(onFinishedChange: () => void, debugMode: boolean) {
    this.gui.onFinishChange(() => onFinishedChange());

    this.instrument = debugMode
      ? Instrument.AIA_304_A
      : Instrument.HMI_INTENSITYGRAM_COLORED;
    this.gui
      .add(this, 'instrument', {
        'HMI Intensitygram': Instrument.HMI_INTENSITYGRAM,
        'HMI Intensitygram Colored': Instrument.HMI_INTENSITYGRAM_COLORED,
        'AIA 304 A': Instrument.AIA_304_A,
      })
      .name('Instrument');
    this.gui.add(this, 'playbackSpeed', -5, 5, 0.1).name('Playback Speed');

    if (debugMode) {
      this.surface = true;
      this.rotation = false;
      this.gui.add(this, 'surface').name('Surface');
      this.gui.add(this, 'rotation').name('Rotation');

      const magentosphreFolder = this.gui.addFolder('Magnetosphere');
      magentosphreFolder
        .add(this.magentosphre, 'northPoles')
        .name('North Poles');
      magentosphreFolder
        .add(this.magentosphre, 'southPoles')
        .name('South Poles');
      magentosphreFolder
        .add(this.magentosphre, 'closedConnections')
        .name('Closed Connections');
      magentosphreFolder
        .add(this.magentosphre, 'closedMagenticFieldLines')
        .name('Closed Field Lines');
      magentosphreFolder
        .add(this.magentosphre, 'openConnections')
        .name('Open Connections');
      magentosphreFolder
        .add(this.magentosphre, 'openMagenticFieldLines')
        .name('Open Field Lines');

      this.aia304a.closedFlares = true;
      this.aia304a.openFlares = true;
      const aia304aFolder = this.gui.addFolder('AIA 304 A');
      aia304aFolder.add(this.aia304a, 'closedFlares').name('Closed Flares');
      aia304aFolder.add(this.aia304a, 'openFlares').name('Open Flares');
      aia304aFolder
        .add(this.aia304a, 'bloomStrength', 0, 1, 0.01)
        .name('Bloom Strength');
    } else {
      this.surface = true;
      this.rotation = true;
    }
  }
}
