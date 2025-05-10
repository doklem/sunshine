import { DoubleSide, InstancedMesh, PlaneGeometry, Texture, Vector2 } from 'three';
import { Node, NodeMaterial, StorageTexture, VarNode } from 'three/webgpu';
import { MagneticFieldLines } from '../simulation/magnetic-field-lines';
import { float, Fn, instanceIndex, mix, PI, positionLocal, texture, time, uv, vec2, vec4 } from 'three/tsl';
import { Settings } from '../configuration/settings';
import { ShaderNodeObject, vertexStage } from 'three/src/nodes/TSL.js';
import { Configurable } from '../configuration/configurable';
import { Surface } from './surface';

export abstract class FlaresBase extends InstancedMesh<PlaneGeometry, NodeMaterial> implements Configurable {

  protected static readonly SURFACE_RADIUS_SQUARED = Surface.GEOMETRY_RADIUS * Surface.GEOMETRY_RADIUS;

  protected constructor(
    count: number,
    resolution: Vector2,
    leftBounds: StorageTexture,
    rightBounds: StorageTexture,
    vertexNoise: Texture,
    fragmentNoise: Texture,
    fragmentNoiseZoom: Vector2,
    colorGradient: Texture) {
    super(
      FlaresBase.createGeometry(resolution),
      new NodeMaterial(),
      count
    );
    this.material.transparent = true;
    this.material.depthWrite = false;
    this.material.side = DoubleSide;

    const lineCountReciprocal = 1 / count;
    const lineId = float(instanceIndex).add(0.5).mul(lineCountReciprocal);
    const lookupUv = vec2(positionLocal.x, lineId).toVar();
    const leftLinePoint = texture(leftBounds, lookupUv).toVar();
    const rightLinePoint = texture(rightBounds, lookupUv).toVar();
    const positionBetweenLines = uv().y.toVar();
    const edgeMask = positionBetweenLines.mul(PI).sin();

    const stiffness = mix(leftLinePoint.a, rightLinePoint.a, positionBetweenLines);
    const offset = texture(vertexNoise, vec2(time.mul(0.1), lineId)).xyz.mul(stiffness.oneMinus());
    const position = mix(leftLinePoint.xyz, rightLinePoint.xyz, positionBetweenLines).add(offset).toVar();
    const heightSqVertexStage = position.lengthSq().toVar();
    const heightMask = this.createHightMask(heightSqVertexStage);
    const alpha = vertexStage(heightMask.mul(edgeMask));
    const heightSq = vertexStage(heightSqVertexStage);

    this.material.positionNode = position;

    this.material.colorNode = Fn(() => {
      const noise = texture(
        fragmentNoise,
        uv().sub(vec2(time, instanceIndex)).mul(vec2(fragmentNoiseZoom.x, fragmentNoiseZoom.y))
      ).x;

      const intensity = heightSq.smoothstep(FlaresBase.SURFACE_RADIUS_SQUARED * 1.2, FlaresBase.SURFACE_RADIUS_SQUARED).add(alpha.mul(1));
      const color = texture(colorGradient, vec2(intensity, 0.5)).xyz;

      return vec4(color, alpha.mul(noise));
    })();

    this.computeBoundingSphere();
    this.boundingSphere!.radius = MagneticFieldLines.CLOSED_HIGH_ALTITUDE_RADIUS;
  }

  public abstract applySettings(settings: Settings): void;

  public static adpatFragmentNoise(value: number, _: number): number {
    if (value < 0) {
      value *= -0.8;
    }
    value = Math.max(0.1, value);
    return value;
  }

  protected abstract createHightMask(heightSq: ShaderNodeObject<VarNode>): ShaderNodeObject<Node>;

  private static createGeometry(resolution: Vector2): PlaneGeometry {
    const width = 1 - 1 / resolution.x;
    return new PlaneGeometry(width, 1, resolution.x - 1, resolution.y)
      .translate(width * 0.5 + 0.5 / resolution.x, 0, 0);
  }
}