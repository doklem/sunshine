import GUI from 'lil-gui';
import { Instrument } from './instrument';

export class Settings {

  private readonly gui = new GUI({ title: 'Sunshine' });

  public instrument = Instrument.AIA_304_A;
  public bloomStrength = 0;
  public surface = true;
  public rotation = true;
  public particles = true;

  public constructor(onFinishedChange: () => void) {
    this.gui.onFinishChange(() => onFinishedChange());
    this.gui.add(
      this,
      'instrument',
      {
        'HMI Intensitygram': Instrument.HMI_INTENSITYGRAM,
        'HMI Intensitygram Colored': Instrument.HMI_INTENSITYGRAM_COLORED,
        'AIA 304 A': Instrument.AIA_304_A
      }
    ).name('Instrument');
    this.gui.add(this, 'bloomStrength', 0, 1, 0.01).name('Bloom Strength');
    this.gui.add(this, 'surface').name('Surface');
    this.gui.add(this, 'rotation').name('Rotation')
    this.gui.add(this, 'particles').name('Particles');
  }
}