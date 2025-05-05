import { DoubleSide, InstancedMesh, PlaneGeometry, Texture } from 'three';
import { NodeMaterial } from 'three/webgpu';
import { MagneticFieldLines } from '../simulation/magnetic-field-lines';
import { float, Fn, instanceIndex, mix, PI, positionLocal, texture, time, uv, vec2, vec4 } from 'three/tsl';
import { Settings } from '../configuration/settings';
import { Instrument } from '../configuration/instrument';
import { vertexStage } from 'three/src/nodes/TSL.js';
import { Configurable } from '../configuration/configurable';

export class Flares extends InstancedMesh<PlaneGeometry, NodeMaterial> implements Configurable {

  private static readonly HEIGHT_RESOLUTION = 10;

  public constructor(open: boolean, magneticFieldLines: MagneticFieldLines, vertexNoise: Texture, fragmentNoise: Texture) {
    super(
      Flares.createGeometry(open ? MagneticFieldLines.OPEN_LINE_RESOLUTION : MagneticFieldLines.CLOSED_LINE_RESOLUTION),
      new NodeMaterial(),
      open ? magneticFieldLines.openCount : magneticFieldLines.closedCount
    );
    this.material.transparent = true;
    this.material.depthWrite = false;
    this.material.side = DoubleSide;

    const lineCountReciprocal = 1 / (open ? magneticFieldLines.openCount : magneticFieldLines.closedCount);
    const lineId = float(instanceIndex).add(0.5).mul(lineCountReciprocal);
    const lookupUv = vec2(positionLocal.x, lineId).toVar();
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

  private static createGeometry(resolution: number): PlaneGeometry {
    const width = 1 - 1 / resolution;
    return new PlaneGeometry(width, 1, resolution - 1, Flares.HEIGHT_RESOLUTION)
      .translate(width * 0.5 + 0.5 / resolution, 0, 0);
  }
}