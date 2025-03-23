import GUI from 'lil-gui';
import { WaveLength } from './wave-length';

export class Settings {

  private readonly gui = new GUI({ title: 'Sunshine' });

  public waveLength = WaveLength.HMI_INTENSITYGRAM_COLORED;
  public bloomStrength = 0;
  public surface = true;
  public rotation = false;

  public constructor(onFinishedChange: () => void) {
    this.gui.onFinishChange(() => onFinishedChange());
    this.gui.add(
      this,
      'waveLength',
      {
        'HMI Intensitygram Colored': WaveLength.HMI_INTENSITYGRAM_COLORED
      }
    ).name('Wave Length');
    this.gui.add(this, 'bloomStrength', 0, 1, 0.01).name('Bloom Strength');
    this.gui.add(this, 'surface').name('Surface');
    this.gui.add(this, 'rotation').name('Rotation');
  }
}