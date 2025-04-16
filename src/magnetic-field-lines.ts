import { Vector3 } from 'three';
import { instancedArray } from 'three/tsl';
import { Surface } from './surface';
import { MagneticFieldLineSet } from './magnetic-field-line-set';

export class MagneticFieldLines {

  private static readonly RADIUS = Surface.GEOMETRY_RADIUS * 0.9;
  private static readonly HIGH_LEVEL_DISTANCE = 0.02;
  private static readonly LOW_LEVEL_DISTANCE = 0.04;
  private static readonly SPEED_MIN = 0.001;
  private static readonly SPEED_DELTA = 0.001;

  public static readonly LOW_LEVEL_RADIUS = Surface.GEOMETRY_RADIUS * 1.4;
  public static readonly HIGH_LEVEL_RADIUS = Surface.GEOMETRY_RADIUS * 1.6;

  public readonly lowLevelFieldLines: MagneticFieldLineSet;
  public readonly highLevelFieldLines: MagneticFieldLineSet;

  public constructor(public readonly countNorthPole: number, public readonly countSouthPole: number) {
    const northPolePositions: Vector3[] = MagneticFieldLines.fibonacciSphere(countNorthPole);
    const southPolePositions: Vector3[] = MagneticFieldLines.fibonacciSphere(countSouthPole);
    const lowLevelConnections: Vector3[][] = [];
    const highLevelConnections: Vector3[][] = [];
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
        if (closestDistance < MagneticFieldLines.HIGH_LEVEL_DISTANCE) {
          highLevelConnections.push([closestNorthPole, southPole]);
        } else if (MagneticFieldLines.LOW_LEVEL_DISTANCE < closestDistance) {
          lowLevelConnections.push([closestNorthPole, southPole]);
        }
      }
    });

    this.lowLevelFieldLines = MagneticFieldLines.createLowLevelFieldLines(lowLevelConnections);
    this.highLevelFieldLines = MagneticFieldLines.createHighLevelFieldLines(highLevelConnections);
  }

  private static createLowLevelFieldLines(connections: Vector3[][]): MagneticFieldLineSet {
    const firstControlPoints = new Float32Array(connections.length * 3);
    const secondControlPoints = new Float32Array(firstControlPoints.length);
    const thridControlPoints = new Float32Array(firstControlPoints.length);
    const speeds = new Float32Array(connections.length);
    const secondControlPoint = new Vector3();
    let offsetControlPoint = 0;
    let offsetSpeed = 0;

    connections.forEach(connection => {
      firstControlPoints.set(connection[0].toArray(), offsetControlPoint);
      secondControlPoint.lerpVectors(connection[0], connection[1], 0.5).normalize().multiplyScalar(MagneticFieldLines.LOW_LEVEL_RADIUS);
      secondControlPoints.set(secondControlPoint.toArray(), offsetControlPoint);
      thridControlPoints.set(connection[1].toArray(), offsetControlPoint);
      offsetControlPoint += 3;

      speeds.set([Math.random() * MagneticFieldLines.SPEED_DELTA + MagneticFieldLines.SPEED_MIN], offsetSpeed);
      offsetSpeed++;
    });

    return {
      count: connections.length,
      speedsBuffer: instancedArray(speeds, 'float'),
      controlPointBuffers: [
        instancedArray(firstControlPoints, 'vec3'),
        instancedArray(secondControlPoints, 'vec3'),
        instancedArray(thridControlPoints, 'vec3')
      ]
    };
  }

  private static createHighLevelFieldLines(connections: Vector3[][]): MagneticFieldLineSet {
    const firstControlPoints = new Float32Array(connections.length * 3);
    const secondControlPoints = new Float32Array(firstControlPoints.length);
    const thridControlPoints = new Float32Array(firstControlPoints.length);
    const fourthControlPoints = new Float32Array(firstControlPoints.length);
    const speeds = new Float32Array(connections.length);
    const controlPoint = new Vector3();
    let offsetControlPoint = 0;
    let offsetSpeed = 0;

    connections.forEach(connection => {
      firstControlPoints.set(connection[0].toArray(), offsetControlPoint);
      controlPoint.copy(connection[0]).normalize().multiplyScalar(MagneticFieldLines.LOW_LEVEL_RADIUS);
      secondControlPoints.set(controlPoint.toArray(), offsetControlPoint);
      controlPoint.copy(connection[1]).normalize().multiplyScalar(MagneticFieldLines.LOW_LEVEL_RADIUS);
      thridControlPoints.set(controlPoint.toArray(), offsetControlPoint);
      controlPoint.copy(connection[1]).normalize().multiplyScalar(MagneticFieldLines.HIGH_LEVEL_RADIUS);
      fourthControlPoints.set(controlPoint.toArray(), offsetControlPoint);
      offsetControlPoint += 3;

      speeds.set([Math.random() * MagneticFieldLines.SPEED_DELTA + MagneticFieldLines.SPEED_MIN], offsetSpeed);
      offsetSpeed++;
    });

    return {
      count: connections.length,
      speedsBuffer: instancedArray(speeds, 'float'),
      controlPointBuffers: [
        instancedArray(firstControlPoints, 'vec3'),
        instancedArray(secondControlPoints, 'vec3'),
        instancedArray(thridControlPoints, 'vec3'),
        instancedArray(fourthControlPoints, 'vec3')
      ]
    };
  }

  private static fibonacciSphere(count: number): Vector3[] {
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
      positions[i] = new Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).multiplyScalar(MagneticFieldLines.RADIUS);
    }

    return positions;
  }
}