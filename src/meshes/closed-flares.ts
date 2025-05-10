import { Texture, Vector2 } from 'three';
import { MagneticFieldLines } from '../simulation/magnetic-field-lines';
import { FlaresBase } from './flares-base';
import { Instrument } from '../configuration/instrument';
import { Settings } from '../configuration/settings';
import { ShaderNodeObject } from 'three/tsl';
import { Node, VarNode } from 'three/webgpu';

export class ClosedFlares extends FlaresBase {

  public constructor(
    magneticFieldLines: MagneticFieldLines,
    vertexNoise: Texture,
    fragmentNoise: Texture,
    colorGradient: Texture) {
    super(
      magneticFieldLines.closedCount,
      new Vector2(MagneticFieldLines.CLOSED_LINE_RESOLUTION, 8),
      magneticFieldLines.closedLeftBounds,
      magneticFieldLines.closedRightBounds,
      vertexNoise,
      fragmentNoise,
      new Vector2(0.01, 0.37),
      colorGradient
    );
  }

  public override applySettings(settings: Settings): void {
    this.visible = settings.instrument === Instrument.AIA_304_A && settings.aia304a.closedFlares;
  }

  protected override createHightMask(heightSq: ShaderNodeObject<VarNode>): ShaderNodeObject<Node> {
    return heightSq.smoothstep(FlaresBase.SURFACE_RADIUS_SQUARED * 1.7, FlaresBase.SURFACE_RADIUS_SQUARED * 1.3);
  }
}