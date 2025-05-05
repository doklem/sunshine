import { DoubleSide, InstancedMesh, PlaneGeometry, Texture } from 'three';
import { NodeMaterial } from 'three/webgpu';
import { MagneticFieldLines } from './magnetic-field-lines';
import { float, Fn, instanceIndex, mix, PI, texture, time, uv, vec2, vec4 } from 'three/tsl';
import { Settings } from './settings';
import { Instrument } from './instrument';
import { vertexStage } from 'three/src/nodes/TSL.js';

export class Flares extends InstancedMesh<PlaneGeometry, NodeMaterial> {

  public constructor(open: boolean, magneticFieldLines: MagneticFieldLines, vertexNoise: Texture, fragmentNoise: Texture) {
    super(
      new PlaneGeometry(
        1,
        1,
        (open ? MagneticFieldLines.OPEN_LINE_RESOLUTION : MagneticFieldLines.CLOSED_LINE_RESOLUTION) - 1,
        10
      ),
      new NodeMaterial(),
      open ? magneticFieldLines.openCount : magneticFieldLines.closedCount
    );
    this.material.transparent = true;
    this.material.depthWrite = false;
    this.material.side = DoubleSide;

    const pixelStart = 0.5 / (open ? MagneticFieldLines.OPEN_LINE_RESOLUTION : MagneticFieldLines.CLOSED_LINE_RESOLUTION);
    const pixelRange = 1 - 1 / (open ? MagneticFieldLines.OPEN_LINE_RESOLUTION : MagneticFieldLines.CLOSED_LINE_RESOLUTION);
    const lineSizeReciprocal = 1 / (open ? magneticFieldLines.openCount : magneticFieldLines.closedCount);
    const lineId = float(instanceIndex).add(0.5).mul(lineSizeReciprocal);
    const lookupUv = vec2(uv().x.mul(pixelRange).add(pixelStart), lineId).toVar();
    const pointOnLineA = texture(open ? magneticFieldLines.openUpperBounds : magneticFieldLines.closedUpperBounds, lookupUv).toVar();
    const pointOnLineB = texture(open ? magneticFieldLines.openLowerBounds : magneticFieldLines.closedLowerBounds, lookupUv).toVar();
    const positionBetweenLines = uv().y.toVar();
    const edgeMask = positionBetweenLines.mul(PI).sin();
    const lineAlpha = mix(pointOnLineA.a, pointOnLineB.a, positionBetweenLines).toVar();
    const alpha = vertexStage(lineAlpha.mul(edgeMask));

    this.material.positionNode = Fn(() => {
      const offset = texture(vertexNoise, vec2(time.mul(0.1), lineId)).xyz.mul(lineAlpha.oneMinus());
      return mix(pointOnLineA.xyz, pointOnLineB.xyz, positionBetweenLines).add(offset);
    })();

    const massProgress = open ? uv().sub(vec2(time, instanceIndex)).mul(vec2(0.01, 0.37)) : uv().add(vec2(time, instanceIndex)).mul(vec2(0.01, 0.37));
    this.material.colorNode = Fn(() => {
      const noise = texture(fragmentNoise, massProgress).x;
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