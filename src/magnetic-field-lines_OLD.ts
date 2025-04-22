import { Data3DTexture, Vector3 } from 'three';
import { instancedArray, ShaderNodeObject } from 'three/tsl';
import { Surface } from './surface';
import { StorageBufferNode } from 'three/webgpu';

export class MagneticFieldLines_OLD {

  private static readonly BASE_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 0.9;
  private static readonly HIGH_ALTITUDE_DISTANCE = 0.02;
  private static readonly SPEED_MIN = 0.001;
  private static readonly SPEED_DELTA = 0.001;

  public static readonly LOW_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 1.4;
  public static readonly HIGH_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 1.6;

  public readonly count: number;
  public readonly speedsBuffer: ShaderNodeObject<StorageBufferNode>;
  public readonly controlPointBuffers: ShaderNodeObject<StorageBufferNode>[];

  public constructor(
    countNorthPole: number,
    countSouthPole: number,
    public readonly distortionTexture: Data3DTexture) {
    const northPolePositions: Vector3[] = MagneticFieldLines_OLD.fibonacciSphere(countNorthPole, MagneticFieldLines_OLD.BASE_ALTITUDE_RADIUS);
    const southPolePositions: Vector3[] = MagneticFieldLines_OLD.fibonacciSphere(countSouthPole, Surface.GEOMETRY_RADIUS);
    const lowAltitudeConnections: Vector3[][] = [];
    const highAltitudeConnections: Vector3[][] = [];
    let distance: number;

    southPolePositions.forEach(southPole => {
      let closestNorthPole: Vector3 | undefined;
      let closestDistance = Number.MAX_SAFE_INTEGER;
      northPolePositions.forEach(northPole => {
        distance = northPole.distanceToSquared(southPole);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNorthPole = northPole;
        }
      });

      if (closestNorthPole) {
        if (closestDistance < MagneticFieldLines_OLD.HIGH_ALTITUDE_DISTANCE) {
          highAltitudeConnections.push([closestNorthPole, southPole]);
        } else {
          lowAltitudeConnections.push([closestNorthPole, southPole]);
        }
      }
    });

    this.count = lowAltitudeConnections.length + highAltitudeConnections.length;
    const speeds = new Float32Array(this.count);    
    const firstControlPoints = new Float32Array(speeds.length * 3);
    const secondControlPoints = new Float32Array(firstControlPoints.length);
    const thridControlPoints = new Float32Array(firstControlPoints.length);
    const fourthControlPoints = new Float32Array(firstControlPoints.length);
    let vectorOffset = 0;
    let scalarOffset = 0;

    lowAltitudeConnections.forEach(connection => {
      const controlPoints = MagneticFieldLines_OLD.createControlPoints(connection[0], connection[1], true);
      firstControlPoints.set(controlPoints[0].toArray(), vectorOffset);
      secondControlPoints.set(controlPoints[1].toArray(), vectorOffset);
      thridControlPoints.set(controlPoints[2].toArray(), vectorOffset);
      fourthControlPoints.set(controlPoints[3].toArray(), vectorOffset);
      vectorOffset += 3;

      speeds.set([Math.random() * MagneticFieldLines_OLD.SPEED_DELTA + MagneticFieldLines_OLD.SPEED_MIN], scalarOffset);
      scalarOffset++;
    });

    highAltitudeConnections.forEach(connection => {
      const controlPoints = MagneticFieldLines_OLD.createControlPoints(connection[0], connection[1], false);
      firstControlPoints.set(controlPoints[0].toArray(), vectorOffset);
      secondControlPoints.set(controlPoints[1].toArray(), vectorOffset);
      thridControlPoints.set(controlPoints[2].toArray(), vectorOffset);
      fourthControlPoints.set(controlPoints[3].toArray(), vectorOffset);
      vectorOffset += 3;

      speeds.set([Math.random() * MagneticFieldLines_OLD.SPEED_DELTA + MagneticFieldLines_OLD.SPEED_MIN], scalarOffset);
      scalarOffset++;
    });

    this.speedsBuffer = instancedArray(speeds, 'float');
    this.controlPointBuffers = [
      instancedArray(firstControlPoints, 'vec3'),
      instancedArray(secondControlPoints, 'vec3'),
      instancedArray(thridControlPoints, 'vec3'),
      instancedArray(fourthControlPoints, 'vec3')
    ];
  }

  private static createControlPoints(start: Vector3, end: Vector3, backToSurface: boolean): Vector3[] {
    return [
      start.clone(),
      start.clone().normalize().multiplyScalar(MagneticFieldLines_OLD.LOW_ALTITUDE_RADIUS),
      end.clone().normalize().multiplyScalar(MagneticFieldLines_OLD.LOW_ALTITUDE_RADIUS),
      backToSurface ? end.clone() : end.clone().normalize().multiplyScalar(MagneticFieldLines_OLD.HIGH_ALTITUDE_RADIUS)
    ]
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