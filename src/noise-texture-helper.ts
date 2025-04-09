import { Data3DTexture, FloatType, LinearFilter, MathUtils, RedFormat, RepeatWrapping, RGBAFormat, Vector3 } from 'three';
import { SimplexNoise } from 'three/examples/jsm/Addons.js';
import { RandomValues } from './random-values';

export class NoiseTextureHelper {

  private readonly noise = new SimplexNoise();

  public constructor(
    public simplex: {
      size: number,
      seam: number,
      frequency: number,
      amplitude: number,
      octaves: number
    },
    public voronoi: {
      size: number,
      volumeSize: number
    },
    public whiteNoise: {
      size: number
    }
  ) {
  }

  public createSimplexTexture3D(): Data3DTexture {
    const seamSize = Math.round(this.simplex.size * this.simplex.seam);
    const seamSizeReciprocal = 1 / seamSize;
    const data = new Float32Array(this.simplex.size * this.simplex.size * this.simplex.size);
    let offset = 0;

    for (let z = 0; z < this.simplex.size; z++) {
      for (let y = 0; y < this.simplex.size; y++) {
        for (let x = 0; x < this.simplex.size; x++) {
          if (x < seamSize && seamSize <= y && seamSize <= z) {

            // Linear interpolation
            data[offset] = MathUtils.lerp(
              this.noise3dWithOctaves(x + this.simplex.size, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
              this.noise3dWithOctaves(x, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
              x * seamSizeReciprocal
            );
          } else if (seamSize <= x && y < seamSize && seamSize <= z) {

            // Linear interpolation
            data[offset] = MathUtils.lerp(
              this.noise3dWithOctaves(x, y + this.simplex.size, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
              this.noise3dWithOctaves(x, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
              y * seamSizeReciprocal
            );
          } else if (seamSize <= x && seamSize <= y && z < seamSize) {

            // Linear interpolation
            data[offset] = MathUtils.lerp(
              this.noise3dWithOctaves(x, y, z + this.simplex.size, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
              this.noise3dWithOctaves(x, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
              z * seamSizeReciprocal
            );
          } else if (x < seamSize && y < seamSize && seamSize <= z) {

            // Bilinear interpolation
            data[offset] = MathUtils.lerp(
              MathUtils.lerp(
                this.noise3dWithOctaves(x + this.simplex.size, y + this.simplex.size, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                this.noise3dWithOctaves(x + this.simplex.size, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                y * seamSizeReciprocal
              ),
              MathUtils.lerp(
                this.noise3dWithOctaves(x, y + this.simplex.size, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                this.noise3dWithOctaves(x, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                y * seamSizeReciprocal
              ),
              x * seamSizeReciprocal
            );
          } else if (x < seamSize && seamSize <= y && z < seamSize) {

            // Bilinear interpolation
            data[offset] = MathUtils.lerp(
              MathUtils.lerp(
                this.noise3dWithOctaves(x + this.simplex.size, y, z + this.simplex.size, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                this.noise3dWithOctaves(x + this.simplex.size, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                z * seamSizeReciprocal
              ),
              MathUtils.lerp(
                this.noise3dWithOctaves(x, y, z + this.simplex.size, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                this.noise3dWithOctaves(x, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                z * seamSizeReciprocal
              ),
              x * seamSizeReciprocal
            );
          } else if (seamSize <= x && y < seamSize && z < seamSize) {

            // Bilinear interpolation
            data[offset] = MathUtils.lerp(
              MathUtils.lerp(
                this.noise3dWithOctaves(x, y + this.simplex.size, z + this.simplex.size, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                this.noise3dWithOctaves(x, y + this.simplex.size, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                z * seamSizeReciprocal
              ),
              MathUtils.lerp(
                this.noise3dWithOctaves(x, y, z + this.simplex.size, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                this.noise3dWithOctaves(x, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                z * seamSizeReciprocal
              ),
              y * seamSizeReciprocal
            );
          } else if (x < seamSize && y < seamSize && z < seamSize) {

            // Trilinear interpolation
            data[offset] = MathUtils.lerp(
              MathUtils.lerp(
                MathUtils.lerp(
                  this.noise3dWithOctaves(x + this.simplex.size, y + this.simplex.size, z + this.simplex.size, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                  this.noise3dWithOctaves(x + this.simplex.size, y + this.simplex.size, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                  z * seamSizeReciprocal
                ),
                MathUtils.lerp(
                  this.noise3dWithOctaves(x + this.simplex.size, y, z + this.simplex.size, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                  this.noise3dWithOctaves(x + this.simplex.size, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                  z * seamSizeReciprocal
                ),
                y * seamSizeReciprocal
              ),
              MathUtils.lerp(
                MathUtils.lerp(
                  this.noise3dWithOctaves(x, y + this.simplex.size, z + this.simplex.size, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                  this.noise3dWithOctaves(x, y + this.simplex.size, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                  z * seamSizeReciprocal
                ),
                MathUtils.lerp(
                  this.noise3dWithOctaves(x, y, z + this.simplex.size, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                  this.noise3dWithOctaves(x, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves),
                  z * seamSizeReciprocal
                ),
                y * seamSizeReciprocal
              ),
              x * seamSizeReciprocal
            );
          } else {

            // No interpolation
            data[offset] = this.noise3dWithOctaves(x, y, z, this.simplex.frequency, this.simplex.amplitude, this.simplex.octaves);
          }

          offset++;
        }
      }
    }

    return NoiseTextureHelper.configureTo3dValue(new Data3DTexture(data, this.simplex.size, this.simplex.size, this.simplex.size));
  }

  public createVoronoiTexture3D(): Data3DTexture {
    const sizeReciprocal = this.voronoi.volumeSize / this.voronoi.size;

    const points = RandomValues.createPoints(this.voronoi.volumeSize);
    const data = new Float32Array(this.voronoi.size * this.voronoi.size * this.voronoi.size);
    let point: Vector3;
    let offset = 0;
    let x: number;
    let y: number;
    let z: number;
    let distance: number;
    let distance0: number;
    let distance1: number;
    let distance2: number;
    for (z = 0; z < this.voronoi.size; z++) {
      for (y = 0; y < this.voronoi.size; y++) {
        for (x = 0; x < this.voronoi.size; x++) {
          point = new Vector3(x, y, z).multiplyScalar(sizeReciprocal);

          distance1 = this.voronoi.volumeSize;
          distance2 = this.voronoi.volumeSize;
          for (let i = 0; i < points.length; i++) {
            distance0 = points[i].distanceToSquared(point);
            if (distance0 < distance1) {
              distance2 = distance1;
              distance1 = distance0;
            }
          }

          distance = distance1 / distance2;
          data[offset] = this.voronoi.volumeSize - distance;
          offset++;
        }
      }
    }

    return NoiseTextureHelper.configureTo3dValue(new Data3DTexture(data, this.voronoi.size, this.voronoi.size, this.voronoi.size));
  }

  public createWhiteNoiseTexture3D(): Data3DTexture {
    const texture = new Data3DTexture(RandomValues.createValues(this.whiteNoise.size), this.whiteNoise.size, this.whiteNoise.size, this.whiteNoise.size);
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