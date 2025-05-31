import { Vector3 } from 'three';
import { Surface } from '../meshes/surface';

export class MagneticPoles {
  private static readonly NORTH_POLE_COUNT = 40;
  private static readonly SOUTH_POLE_COUNT = 500;
  private static readonly NORTH_POLE_LATITUDE = 0.2;

  public static readonly POLE_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 0.95;

  public readonly northPoles: Vector3[];
  public readonly southPoles: Vector3[];

  public constructor() {
    this.northPoles = MagneticPoles.fibonacciSphere(
      MagneticPoles.NORTH_POLE_COUNT,
      MagneticPoles.POLE_ALTITUDE_RADIUS,
    ).filter((pole) => Math.abs(pole.y) < MagneticPoles.NORTH_POLE_LATITUDE);
    this.southPoles = MagneticPoles.fibonacciSphere(
      MagneticPoles.SOUTH_POLE_COUNT,
      MagneticPoles.POLE_ALTITUDE_RADIUS,
    );
  }

  private static fibonacciSphere(count: number, height: number): Vector3[] {
    const positions: Vector3[] = [];
    const phi = Math.PI * (Math.sqrt(5) - 1); // Golden angle
    const doubleCountReciprocal = (1 / (count - 1)) * 2;

    let y: number;
    let radius: number;
    let theta: number;
    for (let i = 0; i < count; i++) {
      y = 1 - i * doubleCountReciprocal;
      radius = Math.sqrt(1 - y * y);
      theta = phi * i;
      positions.push(
        new Vector3(
          Math.cos(theta) * radius,
          y,
          Math.sin(theta) * radius,
        ).multiplyScalar(height),
      );
    }

    return positions;
  }
}
