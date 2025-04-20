import GUI from 'lil-gui';
import { Instrument } from './instrument';

export class Settings {

  private readonly gui = new GUI({ title: 'Sunshine' });

  public instrument = Instrument.DEBUG_SURFACE_FLARE;
  public bloomStrength = 1;
  public surface = false;
  public rotation = false;

  public constructor(onFinishedChange: () => void) {
    this.gui.onFinishChange(() => onFinishedChange());
    this.gui.add(
      this,
      'instrument',
      {
        'HMI Intensitygram': Instrument.HMI_INTENSITYGRAM,
        'HMI Intensitygram Colored': Instrument.HMI_INTENSITYGRAM_COLORED,
        'AIA 304 A': Instrument.AIA_304_A,
        'Debug Surface Flare': Instrument.DEBUG_SURFACE_FLARE
      }
    ).name('Instrument');
    this.gui.add(this, 'bloomStrength', 0, 1, 0.01).name('Bloom Strength');
    this.gui.add(this, 'surface').name('Surface');
    this.gui.add(this, 'rotation').name('Rotation');
  }
}