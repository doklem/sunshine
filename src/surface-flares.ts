import { DoubleSide, InstancedMesh, PlaneGeometry, Texture } from 'three';
import { NodeMaterial } from 'three/webgpu';
import { MagneticFieldLines } from './magnetic-field-lines';
import { float, Fn, instanceIndex, mix, PI, texture, time, uv, vec2, vec4 } from 'three/tsl';
import { Settings } from './settings';
import { Instrument } from './instrument';
import { vertexStage } from 'three/src/nodes/TSL.js';

export class SurfaceFlares extends InstancedMesh<PlaneGeometry, NodeMaterial> {

  private static readonly GEOMETRY = new PlaneGeometry(1, 1, MagneticFieldLines.CLOSED_LINE_RESOLUTION, 10);

  public constructor(magneticFieldLines: MagneticFieldLines, vertexNoise: Texture, fragmentNoise: Texture) {
    super(SurfaceFlares.GEOMETRY, new NodeMaterial(), magneticFieldLines.closedCount);
    this.material.transparent = true;
    this.material.depthWrite = false;
    this.material.side = DoubleSide;

    const lineSizeReciprocal = 1 / magneticFieldLines.closedCount;
    const lineId = float(instanceIndex).add(0.5).mul(lineSizeReciprocal);
    const lookupUv = vec2(uv().x, lineId).toVar();
    const pointOnLineA = texture(magneticFieldLines.closedUpperBounds, lookupUv).toVar();
    const pointOnLineB = texture(magneticFieldLines.closedLowerBounds, lookupUv).toVar();
    const positionBetweenLines = uv().y.toVar();
    const edgeMask = positionBetweenLines.mul(PI).sin();
    const lineAlpha = mix(pointOnLineA.a, pointOnLineB.a, positionBetweenLines).toVar();
    const alpha = vertexStage(lineAlpha.mul(edgeMask));

    this.material.positionNode = Fn(() => {
      const offset = texture(vertexNoise, vec2(time.mul(0.1), lineId)).xyz.mul(lineAlpha.oneMinus());
      return mix(pointOnLineA.xyz, pointOnLineB.xyz, positionBetweenLines).add(offset);
    })();

    this.material.colorNode = Fn(() => {
      const noise = texture(fragmentNoise, uv().add(vec2(time, instanceIndex)).mul(vec2(0.01, 0.37))).x;
      return vec4(1, alpha, 0, alpha.mul(noise));
    })();

    this.computeBoundingSphere();
    this.boundingSphere!.radius = MagneticFieldLines.HIGH_ALTITUDE_RADIUS;
  }

  public applySettings(settings: Settings): void {
    this.visible = settings.instrument === Instrument.AIA_304_A;
  }

  public static adpatFragmentNoise(value: number, _: number): number {
    if (value < 0) {
      value *= -0.8;
    }
    value = Math.max(0.1, value);
    return value;
  }
}