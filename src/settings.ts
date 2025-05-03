import GUI from 'lil-gui';
import { Instrument } from './instrument';

export class Settings {

  private readonly gui = new GUI({ title: 'Sunshine' });

  public instrument: Instrument;
  public bloomStrength: number;
  public surface: boolean;
  public rotation: boolean;

  public constructor(onFinishedChange: () => void, debugMode: boolean) {
    this.gui.onFinishChange(() => onFinishedChange());

    const instruments: any = {
      'HMI Intensitygram': Instrument.HMI_INTENSITYGRAM,
      'HMI Intensitygram Colored': Instrument.HMI_INTENSITYGRAM_COLORED,
      'AIA 304 A': Instrument.AIA_304_A
    };
    if (debugMode) {
      instruments['Debug Magnetosphere'] = Instrument.DEBUG_MAGNETOSPHERE;
      instruments['Debug Flow'] = Instrument.DEBUG_FLOW;
      this.instrument = Instrument.DEBUG_FLOW;
    } else {
      this.instrument = Instrument.AIA_304_A;
    }
    this.gui.add(this, 'instrument', instruments).name('Instrument');

    if (debugMode) {
      this.bloomStrength = 0;
      this.surface = false;
      this.rotation = false;
      this.gui.add(this, 'bloomStrength', 0, 1, 0.01).name('Bloom Strength');
      this.gui.add(this, 'surface').name('Surface');
      this.gui.add(this, 'rotation').name('Rotation');
    } else {
      this.bloomStrength = 0;
      this.surface = true;
      this.rotation = true;
    }
  }
}