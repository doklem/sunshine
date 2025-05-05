import { Vector3 } from 'three';
import { Surface } from '../meshes/surface';

export class MagneticPoles {

  private static readonly NORTH_POLE_COUNT = 45;
  private static readonly SOUTH_POLE_COUNT = 600;
  
  public static readonly POLE_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 0.99;

  public readonly northPoles: Vector3[];
  public readonly southPoles: Vector3[];

  public constructor() {
    this.northPoles = MagneticPoles.fibonacciSphere(
      MagneticPoles.NORTH_POLE_COUNT,
      MagneticPoles.POLE_ALTITUDE_RADIUS
    );
    this.southPoles = MagneticPoles.fibonacciSphere(
      MagneticPoles.SOUTH_POLE_COUNT,
      MagneticPoles.POLE_ALTITUDE_RADIUS
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
          Math.sin(theta) * radius
        ).multiplyScalar(height)
      );
    }

    return positions;
  }
}