import { Data3DTexture, FloatType, LinearFilter, MathUtils, RedFormat, RepeatWrapping, RGBAFormat, Vector3 } from 'three';
import { SimplexNoise } from 'three/examples/jsm/Addons.js';

export class Noise3dTextureHelper {

  private readonly noise = new SimplexNoise();

  public createSimplexTexture3D(size: number, seam: number, frequency: number, amplitude: number, octaves: number): Data3DTexture {
    const seamSize = Math.round(size * seam);
    const seamSizeReciprocal = 1 / seamSize;
    const data = new Float32Array(size * size * size);
    let offset = 0;

    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (x < seamSize && seamSize <= y && seamSize <= z) {

            // Linear interpolation
            data[offset] = MathUtils.lerp(
              this.noise3dWithOctaves(x + size, y, z, frequency, amplitude, octaves),
              this.noise3dWithOctaves(x, y, z, frequency, amplitude, octaves),
              x * seamSizeReciprocal
            );
          } else if (seamSize <= x && y < seamSize && seamSize <= z) {

            // Linear interpolation
            data[offset] = MathUtils.lerp(
              this.noise3dWithOctaves(x, y + size, z, frequency, amplitude, octaves),
              this.noise3dWithOctaves(x, y, z, frequency, amplitude, octaves),
              y * seamSizeReciprocal
            );
          } else if (seamSize <= x && seamSize <= y && z < seamSize) {

            // Linear interpolation
            data[offset] = MathUtils.lerp(
              this.noise3dWithOctaves(x, y, z + size, frequency, amplitude, octaves),
              this.noise3dWithOctaves(x, y, z, frequency, amplitude, octaves),
              z * seamSizeReciprocal
            );
          } else if (x < seamSize && y < seamSize && seamSize <= z) {

            // Bilinear interpolation
            data[offset] = MathUtils.lerp(
              MathUtils.lerp(
                this.noise3dWithOctaves(x + size, y + size, z, frequency, amplitude, octaves),
                this.noise3dWithOctaves(x + size, y, z, frequency, amplitude, octaves),
                y * seamSizeReciprocal
              ),
              MathUtils.lerp(
                this.noise3dWithOctaves(x, y + size, z, frequency, amplitude, octaves),
                this.noise3dWithOctaves(x, y, z, frequency, amplitude, octaves),
                y * seamSizeReciprocal
              ),
              x * seamSizeReciprocal
            );
          } else if (x < seamSize && seamSize <= y && z < seamSize) {

            // Bilinear interpolation
            data[offset] = MathUtils.lerp(
              MathUtils.lerp(
                this.noise3dWithOctaves(x + size, y, z + size, frequency, amplitude, octaves),
                this.noise3dWithOctaves(x + size, y, z, frequency, amplitude, octaves),
                z * seamSizeReciprocal
              ),
              MathUtils.lerp(
                this.noise3dWithOctaves(x, y, z + size, frequency, amplitude, octaves),
                this.noise3dWithOctaves(x, y, z, frequency, amplitude, octaves),
                z * seamSizeReciprocal
              ),
              x * seamSizeReciprocal
            );
          } else if (seamSize <= x && y < seamSize && z < seamSize) {

            // Bilinear interpolation
            data[offset] = MathUtils.lerp(
              MathUtils.lerp(
                this.noise3dWithOctaves(x, y + size, z + size, frequency, amplitude, octaves),
                this.noise3dWithOctaves(x, y + size, z, frequency, amplitude, octaves),
                z * seamSizeReciprocal
              ),
              MathUtils.lerp(
                this.noise3dWithOctaves(x, y, z + size, frequency, amplitude, octaves),
                this.noise3dWithOctaves(x, y, z, frequency, amplitude, octaves),
                z * seamSizeReciprocal
              ),
              y * seamSizeReciprocal
            );
          } else if (x < seamSize && y < seamSize && z < seamSize) {

            // Trilinear interpolation
            data[offset] = MathUtils.lerp(
              MathUtils.lerp(
                MathUtils.lerp(
                  this.noise3dWithOctaves(x + size, y + size, z + size, frequency, amplitude, octaves),
                  this.noise3dWithOctaves(x + size, y + size, z, frequency, amplitude, octaves),
                  z * seamSizeReciprocal
                ),
                MathUtils.lerp(
                  this.noise3dWithOctaves(x + size, y, z + size, frequency, amplitude, octaves),
                  this.noise3dWithOctaves(x + size, y, z, frequency, amplitude, octaves),
                  z * seamSizeReciprocal
                ),
                y * seamSizeReciprocal
              ),
              MathUtils.lerp(
                MathUtils.lerp(
                  this.noise3dWithOctaves(x, y + size, z + size, frequency, amplitude, octaves),
                  this.noise3dWithOctaves(x, y + size, z, frequency, amplitude, octaves),
                  z * seamSizeReciprocal
                ),
                MathUtils.lerp(
                  this.noise3dWithOctaves(x, y, z + size, frequency, amplitude, octaves),
                  this.noise3dWithOctaves(x, y, z, frequency, amplitude, octaves),
                  z * seamSizeReciprocal
                ),
                y * seamSizeReciprocal
              ),
              x * seamSizeReciprocal
            );
          } else {

            // No interpolation
            data[offset] = this.noise3dWithOctaves(x, y, z, frequency, amplitude, octaves);
          }

          offset++;
        }
      }
    }

    return Noise3dTextureHelper.configureTo3dValue(new Data3DTexture(data, size, size, size));
  }

  public static createVoronoiTexture3D(size: number): Data3DTexture {
    const sizeReciprocal = 1 / size;
    const points: Vector3[] = [];
    const step = 0.1;
    const originVector = new Vector3();
    let point: Vector3;
    let x: number;
    let y: number;
    let z: number;
    for (z = 0; z < 1; z += step) {
      for (y = 0; y < 1; y += step) {
        for (x = 0; x < 1; x += step) {
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

    let offset = 0;
    const data = new Float32Array(size * size * size);

    let distance: number;
    let distance0: number;
    let distance1: number;
    let distance2: number;
    for (z = 0; z < size; z++) {
      for (y = 0; y < size; y++) {
        for (x = 0; x < size; x++) {
          point = new Vector3(x, y, z).multiplyScalar(sizeReciprocal);

          distance1 = Number.MAX_SAFE_INTEGER;
          distance2 = Number.MAX_SAFE_INTEGER;
          for (let i = 0; i < points.length; i++) {
            distance0 = points[i].distanceToSquared(point);
            if (distance0 < distance1) {
              distance2 = distance1;
              distance1 = distance0;
            }
          }

          distance = distance1 / distance2;
          data[offset] = distance;
          offset++;
        }
      }
    }

    return Noise3dTextureHelper.configureTo3dValue(new Data3DTexture(data, size, size, size));
  }

  public static createRandomNoiseTexture3D(size: number): Data3DTexture {
    const data = new Float32Array(size * size * size * 4);

    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = (Math.random() - 0.5) * 0.05;
      data[offset + 1] = (Math.random() - 0.5) * 0.05;
      data[offset + 2] = (Math.random() - 0.5) * 0.05;
      data[offset + 3] = Math.random() * 10;
    }

    const texture = new Data3DTexture(data, size, size, size);
    texture.format = RGBAFormat;
    texture.type = FloatType;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.wrapR = RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  private noise3dWithOctaves(x: number, y: number, z: number, frequency: number, amplitude: number, octaves: number): number {
    let value = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise.noise3d(x * frequency, y * frequency, z * frequency) * amplitude;
      frequency *= 2;
      amplitude *= 0.5;
    }
    return value;
  }

  private static configureTo3dValue(texture: Data3DTexture): Data3DTexture {
    texture.format = RedFormat;
    texture.type = FloatType;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.wrapR = RepeatWrapping;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
  }
}