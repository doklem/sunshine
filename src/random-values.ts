import { Vector3 } from 'three';

export class RandomValues {

  public static createPoints(volumeeSize: number): Vector3[] {
    const points: Vector3[] = [];
    const step = volumeeSize * 0.1;
    const originVector = new Vector3();
    let point: Vector3;
    let x: number;
    let y: number;
    let z: number;
    for (z = 0; z < volumeeSize; z += step) {
      for (y = 0; y < volumeeSize; y += step) {
        for (x = 0; x < volumeeSize; x += step) {
          point = new Vector3(step, step, step)
            .multiply(new Vector3(Math.random(), Math.random(), Math.random()))
            .add(originVector.set(x, y, z));
          points.push(point);

          point = new Vector3(step, step, step)
            .multiply(new Vector3(Math.random(), Math.random(), Math.random()))
            .add(originVector.set(x, y, z));
          points.push(point);
        }
      }
    }
    return points;
  }

  public static createValues(size: number): Float32Array {
    const size3d = size * size * size * 4;
    const values: number[] = [];
    for (let offset = 0; offset < size3d; offset += 4) {
      values.push((Math.random() - 0.5) * 0.05);
      values.push((Math.random() - 0.5) * 0.05);
      values.push((Math.random() - 0.5) * 0.05);
      values.push(Math.random() * 10);
    }
    return new Float32Array(values);
  }
}