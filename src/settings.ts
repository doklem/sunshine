import GUI from 'lil-gui';
import { WaveLength } from './wave-length';

export class Settings {

  private readonly gui = new GUI({ title: 'Sunshine' });

  public waveLength = WaveLength.VISIBLE_LIGHT;
  public bloomStrength = 0.1;
  public surface = true;

  public constructor(onFinishedChange: () => void) {
    this.gui.onFinishChange(() => onFinishedChange());
    this.gui.add(
      this,
      'waveLength',
      {
        'Visible Light': WaveLength.VISIBLE_LIGHT,
        'Extreme Ultraviolet': WaveLength.EXTREME_ULTRAVIOLET
      }
    ).name('Wave Length');
    this.gui.add(this, 'bloomStrength', 0, 1, 0.01).name('Bloom Strength');
    this.gui.add(this, 'surface').name('Surface');
  }
}