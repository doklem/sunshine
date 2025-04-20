import { Data3DTexture, DataTexture, FloatType, LinearFilter, MathUtils, RedFormat, RepeatWrapping, RGBAFormat, RGFormat, Vector3 } from 'three';
import { SimplexNoise } from 'three/examples/jsm/Addons.js';
import { RandomValues } from './random-values';

export class NoiseTextureHelper {

  private readonly noise = new SimplexNoise();

  public createSimplexTexture2D(
    size: number,
    seam: number,
    frequency: number,
    amplitude: number,
    octaves: number,
    components: number,
    adapt?: (value: number, component: number) => number): DataTexture {
    const seamSize = Math.round(size * seam);
    const seamSizeReciprocal = 1 / seamSize;
    const data = new Float32Array(size * size * components);
    let offset = 0;
    let value: number;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        for (let w = 0; w < components; w++) {
          if (x < seamSize && seamSize <= y) {

            // Linear interpolation
            value = MathUtils.lerp(
              this.noise3dWithOctaves(x + size, y, w, frequency, amplitude, octaves),
              this.noise3dWithOctaves(x, y, w, frequency, amplitude, octaves),
              x * seamSizeReciprocal
            );
          } else if (seamSize <= x && y < seamSize) {

            // Linear interpolation
            value = MathUtils.lerp(
              this.noise3dWithOctaves(x, y + size, w, frequency, amplitude, octaves),
              this.noise3dWithOctaves(x, y, w, frequency, amplitude, octaves),
              y * seamSizeReciprocal
            );
          } else if (x < seamSize && y < seamSize) {

            // Bilinear interpolation
            value = MathUtils.lerp(
              MathUtils.lerp(
                this.noise3dWithOctaves(x + size, y + size, w, frequency, amplitude, octaves),
                this.noise3dWithOctaves(x + size, y, w, frequency, amplitude, octaves),
                y * seamSizeReciprocal
              ),
              MathUtils.lerp(
                this.noise3dWithOctaves(x, y + size, w, frequency, amplitude, octaves),
                this.noise3dWithOctaves(x, y, w, frequency, amplitude, octaves),
                y * seamSizeReciprocal
              ),
              x * seamSizeReciprocal
            );
          } else {
            
            // No interpolation
            value = this.noise3dWithOctaves(x, y, w, frequency, amplitude, octaves);
          }
          
          data[offset] = adapt ? adapt(value, w) : value;
          offset++;
        }
      }
    }

    return NoiseTextureHelper.configureTexture(new DataTexture(data, size, size), components);
  }

  public createSimplexTexture3D(
    size: number,
    seam: number,
    frequency: number,
    amplitude: number,
    octaves: number,
    components: number): Data3DTexture {
    const seamSize = Math.round(size * seam);
    const seamSizeReciprocal = 1 / seamSize;
    const data = new Float32Array(size * size * size * components);
    let offset = 0;

    for (let z = 0; z < size; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          for (let w = 0; w < components; w++) {
            if (x < seamSize && seamSize <= y && seamSize <= z) {

              // Linear interpolation
              data[offset] = MathUtils.lerp(
                this.noise4dWithOctaves(x + size, y, z, w, frequency, amplitude, octaves),
                this.noise4dWithOctaves(x, y, z, w, frequency, amplitude, octaves),
                x * seamSizeReciprocal
              );
            } else if (seamSize <= x && y < seamSize && seamSize <= z) {

              // Linear interpolation
              data[offset] = MathUtils.lerp(
                this.noise4dWithOctaves(x, y + size, z, w, frequency, amplitude, octaves),
                this.noise4dWithOctaves(x, y, z, w, frequency, amplitude, octaves),
                y * seamSizeReciprocal
              );
            } else if (seamSize <= x && seamSize <= y && z < seamSize) {

              // Linear interpolation
              data[offset] = MathUtils.lerp(
                this.noise4dWithOctaves(x, y, z + size, w, frequency, amplitude, octaves),
                this.noise4dWithOctaves(x, y, z, w, frequency, amplitude, octaves),
                z * seamSizeReciprocal
              );
            } else if (x < seamSize && y < seamSize && seamSize <= z) {

              // Bilinear interpolation
              data[offset] = MathUtils.lerp(
                MathUtils.lerp(
                  this.noise4dWithOctaves(x + size, y + size, z, w, frequency, amplitude, octaves),
                  this.noise4dWithOctaves(x + size, y, z, w, frequency, amplitude, octaves),
                  y * seamSizeReciprocal
                ),
                MathUtils.lerp(
                  this.noise4dWithOctaves(x, y + size, z, w, frequency, amplitude, octaves),
                  this.noise4dWithOctaves(x, y, z, w, frequency, amplitude, octaves),
                  y * seamSizeReciprocal
                ),
                x * seamSizeReciprocal
              );
            } else if (x < seamSize && seamSize <= y && z < seamSize) {

              // Bilinear interpolation
              data[offset] = MathUtils.lerp(
                MathUtils.lerp(
                  this.noise4dWithOctaves(x + size, y, z + size, w, frequency, amplitude, octaves),
                  this.noise4dWithOctaves(x + size, y, z, w, frequency, amplitude, octaves),
                  z * seamSizeReciprocal
                ),
                MathUtils.lerp(
                  this.noise4dWithOctaves(x, y, z + size, w, frequency, amplitude, octaves),
                  this.noise4dWithOctaves(x, y, z, w, frequency, amplitude, octaves),
                  z * seamSizeReciprocal
                ),
                x * seamSizeReciprocal
              );
            } else if (seamSize <= x && y < seamSize && z < seamSize) {

              // Bilinear interpolation
              data[offset] = MathUtils.lerp(
                MathUtils.lerp(
                  this.noise4dWithOctaves(x, y + size, z + size, w, frequency, amplitude, octaves),
                  this.noise4dWithOctaves(x, y + size, z, w, frequency, amplitude, octaves),
                  z * seamSizeReciprocal
                ),
                MathUtils.lerp(
                  this.noise4dWithOctaves(x, y, z + size, w, frequency, amplitude, octaves),
                  this.noise4dWithOctaves(x, y, z, w, frequency, amplitude, octaves),
                  z * seamSizeReciprocal
                ),
                y * seamSizeReciprocal
              );
            } else if (x < seamSize && y < seamSize && z < seamSize) {

              // Trilinear interpolation
              data[offset] = MathUtils.lerp(
                MathUtils.lerp(
                  MathUtils.lerp(
                    this.noise4dWithOctaves(x + size, y + size, z + size, w, frequency, amplitude, octaves),
                    this.noise4dWithOctaves(x + size, y + size, z, w, frequency, amplitude, octaves),
                    z * seamSizeReciprocal
                  ),
                  MathUtils.lerp(
                    this.noise4dWithOctaves(x + size, y, z + size, w, frequency, amplitude, octaves),
                    this.noise4dWithOctaves(x + size, y, z, w, frequency, amplitude, octaves),
                    z * seamSizeReciprocal
                  ),
                  y * seamSizeReciprocal
                ),
                MathUtils.lerp(
                  MathUtils.lerp(
                    this.noise4dWithOctaves(x, y + size, z + size, w, frequency, amplitude, octaves),
                    this.noise4dWithOctaves(x, y + size, z, w, frequency, amplitude, octaves),
                    z * seamSizeReciprocal
                  ),
                  MathUtils.lerp(
                    this.noise4dWithOctaves(x, y, z + size, w, frequency, amplitude, octaves),
                    this.noise4dWithOctaves(x, y, z, w, frequency, amplitude, octaves),
                    z * seamSizeReciprocal
                  ),
                  y * seamSizeReciprocal
                ),
                x * seamSizeReciprocal
              );
            } else {

              // No interpolation
              data[offset] = this.noise4dWithOctaves(x, y, z, w, frequency, amplitude, octaves);
            }

            offset++;
          }
        }
      }
    }

    return NoiseTextureHelper.configureTexture(new Data3DTexture(data, size, size, size), components);
  }

  public createVoronoiTexture3D(size: number, volumeSize: number): Data3DTexture {
    const sizeReciprocal = volumeSize / size;

    const points = RandomValues.createPoints(volumeSize);
    const data = new Float32Array(size * size * size);
    let point: Vector3;
    let offset = 0;
    let x: number;
    let y: number;
    let z: number;
    let distance: number;
    let distance0: number;
    let distance1: number;
    let distance2: number;
    for (z = 0; z < size; z++) {
      for (y = 0; y < size; y++) {
        for (x = 0; x < size; x++) {
          point = new Vector3(x, y, z).multiplyScalar(sizeReciprocal);

          distance1 = volumeSize;
          distance2 = volumeSize;
          for (let i = 0; i < points.length; i++) {
            distance0 = points[i].distanceToSquared(point);
            if (distance0 < distance1) {
              distance2 = distance1;
              distance1 = distance0;
            }
          }

          distance = distance1 / distance2;
          data[offset] = volumeSize - distance;
          offset++;
        }
      }
    }

    return NoiseTextureHelper.configureTexture(new Data3DTexture(data, size, size, size), 1);
  }

  public createWhiteNoiseTexture3D(size: number): Data3DTexture {
    const texture = new Data3DTexture(RandomValues.createValues(size), size, size, size);
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

  private noise3dWithOctaves(x: number, y: number, w: number, frequency: number, amplitude: number, octaves: number): number {
    let value = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise.noise3d(x * frequency, y * frequency, w) * amplitude;
      frequency *= 2;
      amplitude *= 0.5;
    }
    return value;
  }

  private noise4dWithOctaves(x: number, y: number, z: number, w: number, frequency: number, amplitude: number, octaves: number): number {
    let value = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise.noise4d(x * frequency, y * frequency, z * frequency, w) * amplitude;
      frequency *= 2;
      amplitude *= 0.5;
    }
    return value;
  }

  private static configureTexture<TTexture extends DataTexture | Data3DTexture>(texture: TTexture, components: number): TTexture {
    switch (components) {
      case 1:
        texture.format = RedFormat;
        texture.unpackAlignment = components;
        break;
      case 2:
        texture.format = RGFormat;
        texture.unpackAlignment = components;
        break;
      case 4:
        texture.format = RGBAFormat;
        break;
      default:
        throw new Error('Invalid number of color channels. Only 1, 2 or 4 are supported.');
    }
    texture.type = FloatType;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    if (texture instanceof Data3DTexture) {
      texture.wrapR = RepeatWrapping;
    }
    texture.needsUpdate = true;
    return texture;
  }
}