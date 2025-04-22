import { ClampToEdgeWrapping, FloatType, LinearFilter, RGBAFormat, Vector3 } from 'three';
import { Surface } from './surface';
import { Node, StorageBufferAttribute, StorageTexture, WebGPURenderer } from 'three/webgpu';
import { float, Fn, instanceIndex, Loop, mix, PI, storage, textureStore, vec2, vec3, vec4 } from 'three/tsl';
import { ShaderNodeFn, ShaderNodeObject } from 'three/src/nodes/TSL.js';

export class MagneticFieldLines {

  public static readonly LINE_RESOLUTION = 32;
  public static readonly HIGH_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 1.2;

  private static readonly VECTOR_SIZE = 3;
  private static readonly NORTH_POLE_COUNT = 15;
  private static readonly SOUTH_POLE_COUNT = 25;
  private static readonly BASE_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 0.99;
  private static readonly MIN_POLE_DISTANCE = 0.001;
  private static readonly MAX_POLE_DISTANCE = 0.05;
  private static readonly LINE_RESOLUTION_RECIPROCAL = 1 / MagneticFieldLines.LINE_RESOLUTION;
  private static readonly LINE_ANGLE = Math.PI * 0.05;

  private static readonly quadraticBezier = Fn<[
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>
  ]>(([firstPoint, secondPoint, thirdPoint, progress]) => {
    const firstHigherPoint = mix(firstPoint, secondPoint, progress).toVar();
    const secondHigherPoint = mix(secondPoint, thirdPoint, progress).toVar();
    return mix(firstHigherPoint, secondHigherPoint, progress);
  });

  private static readonly qubicBezier = Fn<[
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>
  ]>(([firstPoint, secondPoint, thirdPoint, fourthPoint, progress]) => {
    const firstHigherPoint = mix(firstPoint, secondPoint, progress).toVar();
    const secondHigherPoint = mix(secondPoint, thirdPoint, progress).toVar();
    const thirdHigherPoint = mix(thirdPoint, fourthPoint, progress).toVar();
    return MagneticFieldLines.quadraticBezier(firstHigherPoint, secondHigherPoint, thirdHigherPoint, progress);
  });

  private static readonly quaternionFromAxisAngle = Fn<[
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>
  ]>(([axis, angle]) => {
    const halfAngle = angle.mul(0.5).toVar();
    const s = halfAngle.sin().toVar();
    return vec4(
      axis.x.mul(s),
      axis.y.mul(s),
      axis.z.mul(s),
      halfAngle.cos()
    );
  });

  private static readonly applyQuaternion = Fn<[
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>
  ]>(([vector, quaternion]) => {
    const tx = quaternion.y.mul(vector.z).sub(quaternion.z.mul(vector.y)).mul(2).toVar();
    const ty = quaternion.z.mul(vector.x).sub(quaternion.x.mul(vector.z)).mul(2).toVar();
    const tz = quaternion.x.mul(vector.y).sub(quaternion.y.mul(vector.x)).mul(2).toVar();
    return vec3(
      vector.x.add(quaternion.w.mul(tx)).add(quaternion.y.mul(tz)).sub(quaternion.z.mul(ty)),
      vector.y.add(quaternion.w.mul(ty)).add(quaternion.z.mul(tx)).sub(quaternion.x.mul(tz)),
      vector.z.add(quaternion.w.mul(tz)).add(quaternion.x.mul(ty)).sub(quaternion.y.mul(tx))
    );
  });

  public readonly count: number;
  public readonly upperBounds: StorageTexture;
  public readonly lowerBounds: StorageTexture;

  private readonly compute: ShaderNodeFn<[]>;
  private readonly connectionsBuffer: StorageBufferAttribute;

  public constructor() {
    const northPoles: Vector3[] = MagneticFieldLines.fibonacciSphere(MagneticFieldLines.NORTH_POLE_COUNT, MagneticFieldLines.BASE_ALTITUDE_RADIUS);
    const southPoles: Vector3[] = MagneticFieldLines.fibonacciSphere(MagneticFieldLines.SOUTH_POLE_COUNT, MagneticFieldLines.BASE_ALTITUDE_RADIUS);
    const connections: Vector3[][] = [];
    let distance: number;
    southPoles.forEach(southPole => {
      let closestNorthPole: Vector3 | undefined;
      let closestDistance = Number.MAX_SAFE_INTEGER;
      northPoles.forEach(northPole => {
        distance = northPole.distanceToSquared(southPole);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNorthPole = northPole;
        }
      });

      if (closestNorthPole && MagneticFieldLines.MIN_POLE_DISTANCE < closestDistance && closestDistance < MagneticFieldLines.MAX_POLE_DISTANCE) {
        connections.push([closestNorthPole, southPole]);
      }
    });

    this.count = connections.length;
    this.connectionsBuffer = new StorageBufferAttribute(
      new Float32Array(connections.flatMap(connection => [
        connection[0].x, connection[0].y, connection[0].z,
        connection[1].x, connection[1].y, connection[1].z
      ])),
      MagneticFieldLines.VECTOR_SIZE
    );

    this.upperBounds = MagneticFieldLines.createBoundsTexture(MagneticFieldLines.LINE_RESOLUTION + 1, this.count);
    this.lowerBounds = MagneticFieldLines.createBoundsTexture(MagneticFieldLines.LINE_RESOLUTION + 1, this.count);

    this.compute = Fn(() => {
      const connectionId = instanceIndex.mul(2).toVar();
      const connectionsBuffer = storage(this.connectionsBuffer, 'vec3');

      const firstPoint = connectionsBuffer.element(connectionId).toVar();
      const secondPoint = firstPoint.normalize().mul(MagneticFieldLines.HIGH_ALTITUDE_RADIUS).toVar();
      const fourthPoint = connectionsBuffer.element(connectionId.add(1)).toVar();
      const thirdPoint = fourthPoint.normalize().mul(MagneticFieldLines.HIGH_ALTITUDE_RADIUS).toVar();

      const rotationAxis = fourthPoint.sub(firstPoint).normalize().toVar();
      const upperBoundRotation = MagneticFieldLines.quaternionFromAxisAngle(rotationAxis, -MagneticFieldLines.LINE_ANGLE);
      const lowerBoundRotation = MagneticFieldLines.quaternionFromAxisAngle(rotationAxis, MagneticFieldLines.LINE_ANGLE);

      const secondPointUpperBound = MagneticFieldLines.applyQuaternion(secondPoint, upperBoundRotation).toVar();
      const secondPointLowerBound = MagneticFieldLines.applyQuaternion(secondPoint, lowerBoundRotation).toVar();
      const thirdPointUpperBound = MagneticFieldLines.applyQuaternion(thirdPoint, upperBoundRotation).toVar();
      const thirdPointLowerBound = MagneticFieldLines.applyQuaternion(thirdPoint, lowerBoundRotation).toVar();

      Loop(
        MagneticFieldLines.LINE_RESOLUTION + 1,
        ({ i }) => {
          const progress = float(i).mul(MagneticFieldLines.LINE_RESOLUTION_RECIPROCAL).toVar();
          const uppwerBoundPoint = MagneticFieldLines.qubicBezier(
            firstPoint,
            secondPointUpperBound,
            thirdPointUpperBound,
            fourthPoint,
            progress
          );
          const lowerBoundPoint = MagneticFieldLines.qubicBezier(
            firstPoint,
            secondPointLowerBound,
            thirdPointLowerBound,
            fourthPoint,
            progress
          );
          const alpha = progress.mul(PI).sin().oneMinus().mul(0.8).add(0.2).toVar();
          const uv = vec2(i, instanceIndex).toVar();
          textureStore(this.upperBounds, uv, vec4(uppwerBoundPoint, alpha));
          textureStore(this.lowerBounds, uv, vec4(lowerBoundPoint, alpha));
        }
      );
    });
  }

  public async updateAsync(renderer: WebGPURenderer): Promise<void> {
    await renderer.computeAsync(this.compute().compute(this.count));
  }

  private static createBoundsTexture(width: number, height: number): StorageTexture {
    const texture = new StorageTexture(width, height);
    texture.format = RGBAFormat;
    texture.type = FloatType;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  private static fibonacciSphere(count: number, height: number): Vector3[] {
    const positions: Vector3[] = [];
    positions.length = count;
    const phi = Math.PI * (Math.sqrt(5) - 1); // Golden angle
    const doubleCountReciprocal = (1 / (count - 1)) * 2;

    let y: number;
    let radius: number;
    let theta: number;
    for (let i = 0; i < count; i++) {
      y = 1 - i * doubleCountReciprocal;
      radius = Math.sqrt(1 - y * y);
      theta = phi * i;
      positions[i] = new Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).multiplyScalar(height);
    }

    return positions;
  }
}