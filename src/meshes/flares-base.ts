import { DoubleSide, InstancedMesh, PlaneGeometry, Texture, Vector2 } from 'three';
import { Node, NodeMaterial, StorageBufferAttribute, VarNode } from 'three/webgpu';
import { float, Fn, instanceIndex, mix, PI, positionLocal, storage, texture, uv, vec2, vec4 } from 'three/tsl';
import { Settings } from '../configuration/settings';
import { ShaderNodeObject, vertexStage } from 'three/src/nodes/TSL.js';
import { Configurable } from '../configuration/configurable';
import { Surface } from './surface';

export abstract class FlaresBase extends InstancedMesh<PlaneGeometry, NodeMaterial> implements Configurable {

  private static readonly DISPLACEMENT_SPEED = 0.05;
  private static readonly OFFSET_SPEED = 0.6;

  protected static readonly SURFACE_RADIUS_SQUARED = Surface.GEOMETRY_RADIUS * Surface.GEOMETRY_RADIUS;

  protected constructor(
    count: number,
    resolution: Vector2,
    leftBounds: StorageBufferAttribute,
    rightBounds: StorageBufferAttribute,
    vertexNoise: Texture,
    fragmentNoise: Texture,
    fragmentNoiseZoom: Vector2,
    colorGradient: Texture,
    time: ShaderNodeObject<Node>) {
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
    const pointIndex = positionLocal.x.add(instanceIndex.mul(resolution.x)).toVar();
    const leftLinePoint = storage(leftBounds, 'vec4').element(pointIndex).toVar();
    const rightLinePoint = storage(rightBounds, 'vec4').element(pointIndex).toVar();
    const positionBetweenLines = uv().y.toVar();
    const edgeMask = positionBetweenLines.mul(PI).sin();

    const stiffness = mix(leftLinePoint.a, rightLinePoint.a, positionBetweenLines);
    const displacement = texture(vertexNoise, vec2(time.mul(FlaresBase.DISPLACEMENT_SPEED), lineId)).xyz.mul(stiffness.oneMinus());
    const position = mix(leftLinePoint.xyz, rightLinePoint.xyz, positionBetweenLines).add(displacement).toVar();
    const heightSqVertexStage = position.lengthSq().toVar();
    const heightMask = this.createHightMask(heightSqVertexStage);
    const alpha = vertexStage(heightMask.mul(edgeMask));
    const heightSq = vertexStage(heightSqVertexStage);

    this.material.positionNode = position;

    this.material.colorNode = Fn(() => {
      const offset = vec2(time.mul(FlaresBase.OFFSET_SPEED), instanceIndex);
      const noise = texture(
        fragmentNoise,
        uv().add(offset).mul(vec2(fragmentNoiseZoom.x, fragmentNoiseZoom.y))
      ).x;

      const intensity = heightSq.smoothstep(FlaresBase.SURFACE_RADIUS_SQUARED * 1.2, FlaresBase.SURFACE_RADIUS_SQUARED).add(alpha.mul(1));
      const color = texture(colorGradient, vec2(intensity, 0.5)).xyz;

      return vec4(color, alpha.mul(noise));
    })();
  }

  public abstract applySettings(settings: Settings): void;

  public static adpatFragmentNoise(value: number): number {
    if (value < 0) {
      value *= -0.8;
    }
    value = Math.max(0.1, value);
    return value;
  }

  protected abstract createHightMask(heightSq: ShaderNodeObject<VarNode>): ShaderNodeObject<Node>;

  private static createGeometry(resolution: Vector2): PlaneGeometry {
    const width = resolution.x - 1;
    return new PlaneGeometry(width, 1, width, resolution.y)
      .translate(width * 0.5, 0, 0);
  }
}