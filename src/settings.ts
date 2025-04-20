import GUI from 'lil-gui';
import { WaveLength } from './wave-length';

export class Settings {

  private readonly gui = new GUI({ title: 'Sunshine' });

  public waveLength = WaveLength.DEBUG_SURFACE_FLARE;
  public bloomStrength = 1;
  public surface = false;
  public rotation = false;

  public constructor(onFinishedChange: () => void) {
    this.gui.onFinishChange(() => onFinishedChange());
    this.gui.add(
      this,
      'waveLength',
      {
        'HMI Intensitygram': WaveLength.HMI_INTENSITYGRAM,
        'HMI Intensitygram Colored': WaveLength.HMI_INTENSITYGRAM_COLORED,
        'AIA 304 A': WaveLength.AIA_304_A,
        'Debug Surface Flare': WaveLength.DEBUG_SURFACE_FLARE
      }
    ).name('Wave Length');
    this.gui.add(this, 'bloomStrength', 0, 1, 0.01).name('Bloom Strength');
    this.gui.add(this, 'surface').name('Surface');
    this.gui.add(this, 'rotation').name('Rotation');
  }
}