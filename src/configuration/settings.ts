import GUI from 'lil-gui';
import { Instrument } from './instrument';

export class Settings {

  private readonly gui = new GUI({ title: 'Sunshine' });

  public instrument: Instrument;
  public bloomStrength: number;
  public surface: boolean;
  public rotation: boolean;

  public readonly magentosphre = {
    northPoles: false,
    southPoles: false,
    closedConnections: false,
    openConnections: false,
    closedMagenticFieldLines: false,
    openMagenticFieldLines: false
  };

  public readonly aia304a = {
    closedFlares: true,
    openFlares: true,
  };

  public constructor(onFinishedChange: () => void, debugMode: boolean) {
    this.gui.onFinishChange(() => onFinishedChange());

    const instruments: any = {
      'HMI Intensitygram': Instrument.HMI_INTENSITYGRAM,
      'HMI Intensitygram Colored': Instrument.HMI_INTENSITYGRAM_COLORED,
      'AIA 304 A': Instrument.AIA_304_A
    };
    if (debugMode) {
      instruments['Debug Empty'] = Instrument.DEBUG_EMPTY;
      this.instrument = Instrument.AIA_304_A;
    } else {
      this.instrument = Instrument.AIA_304_A;
    }
    this.gui.add(this, 'instrument', instruments).name('Instrument');

    if (debugMode) {
      this.bloomStrength = 0.5;
      this.surface = true;
      this.rotation = false;
      this.gui.add(this, 'bloomStrength', 0, 1, 0.01).name('Bloom Strength');
      this.gui.add(this, 'surface').name('Surface');
      this.gui.add(this, 'rotation').name('Rotation');

      const magentosphreFolder = this.gui.addFolder('Magnetosphere');
      magentosphreFolder.add(this.magentosphre, 'northPoles').name('North Poles');
      magentosphreFolder.add(this.magentosphre, 'southPoles').name('South Poles');
      magentosphreFolder.add(this.magentosphre, 'closedConnections').name('Closed Connections');
      magentosphreFolder.add(this.magentosphre, 'closedMagenticFieldLines').name('Closed Field Lines');
      magentosphreFolder.add(this.magentosphre, 'openConnections').name('Open Connections');
      magentosphreFolder.add(this.magentosphre, 'openMagenticFieldLines').name('Open Field Lines');

      this.aia304a.closedFlares = true;
      this.aia304a.openFlares = true;
      const aia304aFolder = this.gui.addFolder('AIA 304 A');
      aia304aFolder.add(this.aia304a, 'closedFlares').name('Closed Flares');
      aia304aFolder.add(this.aia304a, 'openFlares').name('Open Flares');
    } else {
      this.bloomStrength = 0;
      this.surface = true;
      this.rotation = true;
    }
  }
}