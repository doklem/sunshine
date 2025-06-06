import { Texture, Vector2 } from 'three';
import { MagneticFieldLines } from '../simulation/magnetic-field-lines';
import { FlaresBase } from './flares-base';
import { Instrument } from '../configuration/instrument';
import { Settings } from '../configuration/settings';
import { ShaderNodeObject } from 'three/tsl';
import { Node, VarNode } from 'three/webgpu';

export class OpenFlares extends FlaresBase {
  public constructor(
    magneticFieldLines: MagneticFieldLines,
    vertexNoise: Texture,
    fragmentNoise: Texture,
    colorGradient: Texture,
    time: ShaderNodeObject<Node>,
  ) {
    super(
      magneticFieldLines.openCount,
      new Vector2(MagneticFieldLines.OPEN_LINE_RESOLUTION, 3),
      magneticFieldLines.openLeftBounds,
      magneticFieldLines.openRightBounds,
      vertexNoise,
      fragmentNoise,
      new Vector2(0.001, 0.04),
      colorGradient,
      time,
    );
  }

  public override applySettings(settings: Settings): void {
    this.visible =
      settings.instrument === Instrument.AIA_304_A &&
      settings.aia304a.openFlares;
  }

  protected override createHightMask(
    heightSq: ShaderNodeObject<VarNode>,
  ): ShaderNodeObject<Node> {
    return heightSq
      .smoothstep(
        FlaresBase.SURFACE_RADIUS_SQUARED * 2.24,
        FlaresBase.SURFACE_RADIUS_SQUARED * 0.5,
      )
      .mul(
        heightSq.smoothstep(
          FlaresBase.SURFACE_RADIUS_SQUARED * 1.29,
          FlaresBase.SURFACE_RADIUS_SQUARED * 1.295,
        ),
      );
  }
}
