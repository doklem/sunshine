import { ClampToEdgeWrapping, FloatType, LinearFilter, Quaternion, RGBAFormat, Vector3 } from 'three';
import { Surface } from './surface';
import { Node, StorageBufferAttribute, StorageTexture, WebGPURenderer } from 'three/webgpu';
import { float, Fn, instanceIndex, Loop, mix, PI, storage, textureStore, vec2, vec4 } from 'three/tsl';
import { ShaderNodeFn, ShaderNodeObject } from 'three/src/nodes/TSL.js';

export class MagneticFieldLines {

  public static readonly LINE_RESOLUTION = 32;
  public static readonly HIGH_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 1.2;

  private static readonly VECTOR_SIZE = 3;
  private static readonly CONTROL_POINT_COUNT = 4;
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

  public readonly count: number;
  public readonly upperLines: StorageTexture;
  public readonly lowerLines: StorageTexture;

  private readonly computeUpperLines: ShaderNodeFn<[]>;
  private readonly computeLowerLines: ShaderNodeFn<[]>;

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
    const bufferLength = this.count * MagneticFieldLines.VECTOR_SIZE * MagneticFieldLines.CONTROL_POINT_COUNT;
    const upperLinePointsBuffer = new StorageBufferAttribute(new Float32Array(bufferLength), MagneticFieldLines.VECTOR_SIZE);
    const lowerLinePointsBuffer = new StorageBufferAttribute(new Float32Array(bufferLength), MagneticFieldLines.VECTOR_SIZE);

    const upperLineRotation = new Quaternion();
    const lowerLineRotation = new Quaternion();
    let offset = 0;

    connections.forEach(connection => {
      const controlPoints = MagneticFieldLines.createControlPoints(connection[0], connection[1]);

      const rotationAxis = controlPoints[3].clone().sub(controlPoints[0]).normalize();
      upperLineRotation.setFromAxisAngle(rotationAxis, -MagneticFieldLines.LINE_ANGLE);
      lowerLineRotation.setFromAxisAngle(rotationAxis, MagneticFieldLines.LINE_ANGLE);

      upperLinePointsBuffer.set(controlPoints[0].toArray(), offset);
      lowerLinePointsBuffer.set(controlPoints[0].toArray(), offset);
      offset += MagneticFieldLines.VECTOR_SIZE;

      upperLinePointsBuffer.set(controlPoints[1].clone().applyQuaternion(upperLineRotation).toArray(), offset);
      lowerLinePointsBuffer.set(controlPoints[1].clone().applyQuaternion(lowerLineRotation).toArray(), offset);
      offset += MagneticFieldLines.VECTOR_SIZE;

      upperLinePointsBuffer.set(controlPoints[2].clone().applyQuaternion(upperLineRotation).toArray(), offset);
      lowerLinePointsBuffer.set(controlPoints[2].clone().applyQuaternion(lowerLineRotation).toArray(), offset);
      offset += MagneticFieldLines.VECTOR_SIZE;

      upperLinePointsBuffer.set(controlPoints[3].toArray(), offset);
      lowerLinePointsBuffer.set(controlPoints[3].toArray(), offset);
      offset += MagneticFieldLines.VECTOR_SIZE;
    });

    this.upperLines = MagneticFieldLines.createLinesTexture(MagneticFieldLines.LINE_RESOLUTION + 1, this.count);
    this.lowerLines = MagneticFieldLines.createLinesTexture(MagneticFieldLines.LINE_RESOLUTION + 1, this.count);

    this.computeUpperLines = MagneticFieldLines.createUpdateFunction(upperLinePointsBuffer, this.upperLines);
    this.computeLowerLines = MagneticFieldLines.createUpdateFunction(lowerLinePointsBuffer, this.lowerLines);
  }

  public async updateAsync(renderer: WebGPURenderer): Promise<void> {
    await Promise.all([
      renderer.computeAsync(this.computeUpperLines().compute(this.count)),
      renderer.computeAsync(this.computeLowerLines().compute(this.count))
    ]);
  }

  private static createUpdateFunction(pointsBuffer: StorageBufferAttribute, linesTexture: StorageTexture): ShaderNodeFn<[]> {
    return Fn(() => {
      const lineId = instanceIndex.mul(MagneticFieldLines.CONTROL_POINT_COUNT).toVar();
      const storageBuffer = storage(pointsBuffer, 'vec3');
      const firstPoint = storageBuffer.element(lineId).toVar();
      const secondPoint = storageBuffer.element(lineId.add(1)).toVar();
      const thirdPoint = storageBuffer.element(lineId.add(2)).toVar();
      const fourthPoint = storageBuffer.element(lineId.add(3)).toVar();

      Loop(
        MagneticFieldLines.LINE_RESOLUTION + 1,
        ({ i }) => {
          const progress = float(i).mul(MagneticFieldLines.LINE_RESOLUTION_RECIPROCAL).toVar();
          const point = MagneticFieldLines.qubicBezier(
            firstPoint,
            secondPoint,
            thirdPoint,
            fourthPoint,
            progress
          );
          const alpha = progress.mul(PI).sin().oneMinus().mul(0.8).add(0.2);
          const uv = vec2(i, instanceIndex).toVar();
          textureStore(linesTexture, uv, vec4(point, alpha));
        }
      );
    });
  }

  private static createLinesTexture(width: number, height: number): StorageTexture {
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

  private static createControlPoints(start: Vector3, end: Vector3): Vector3[] {
    return [
      start.clone(),
      start.clone().normalize().multiplyScalar(MagneticFieldLines.HIGH_ALTITUDE_RADIUS),
      end.clone().normalize().multiplyScalar(MagneticFieldLines.HIGH_ALTITUDE_RADIUS),
      end.clone()
    ];
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