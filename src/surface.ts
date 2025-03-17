import { BufferGeometry, ClampToEdgeWrapping, Data3DTexture, DataTexture, FloatType, LinearFilter, Mesh, RedFormat, RepeatWrapping, RGBAFormat, SphereGeometry, Vector3 } from 'three';
import { ImprovedNoise } from 'three/examples/jsm/Addons.js';
import { cameraPosition, float, Fn, mix, normalLocal, normalWorld, ShaderNodeObject, texture, texture3D, uniform, vec2, vec4 } from 'three/tsl';
import { MeshBasicNodeMaterial, UniformNode } from 'three/webgpu';

export class Surface extends Mesh<BufferGeometry, MeshBasicNodeMaterial> {

  private static readonly SUN_SPOT_SIZE = 32;
  private static readonly RADIUS = 0.5;
  private static readonly TURBULENCE_SIZE = 32;
  private static readonly VORONOI_SIZE = 64;
  private static readonly VORONOI_SIZE_RECIPROCAL = 1 / Surface.VORONOI_SIZE;
  private static readonly COLOR_GRADIENT = new Uint8Array([
    255, 192, 0, 255,
    255, 70, 0, 255,
    255, 50, 0, 255,
    205, 40, 0, 255,
    155, 20, 0, 255,
    75, 16, 0, 255,
    20, 4, 0, 255,
    10, 2, 0, 255
  ]);

  public readonly time: ShaderNodeObject<UniformNode<number>>;

  private constructor(heatConvectionTexture: Data3DTexture, turbulenceTexture: Data3DTexture, sunSpotTexture: Data3DTexture) {
    super(new SphereGeometry(Surface.RADIUS, 50, 50), new MeshBasicNodeMaterial());
    this.time = uniform(0);

    const colorGradientTexture = new DataTexture(Surface.COLOR_GRADIENT, Surface.COLOR_GRADIENT.length * 0.25, 1);
    colorGradientTexture.format = RGBAFormat;
    colorGradientTexture.minFilter = LinearFilter;
    colorGradientTexture.magFilter = LinearFilter;
    colorGradientTexture.wrapS = ClampToEdgeWrapping;
    colorGradientTexture.wrapT = ClampToEdgeWrapping;
    colorGradientTexture.generateMipmaps = true;
    colorGradientTexture.needsUpdate = true;

    const renderColor = Fn(() => {
      const timeOffset = texture3D(turbulenceTexture, normalLocal.mul(0.5)).a;

      const heatOffset = texture3D(
        turbulenceTexture,
        normalLocal.mul(10).add(this.time.mul(0.00001))
      );
      const heat = texture3D(
        heatConvectionTexture,
        normalLocal.mul(this.time.mul(0.001).add(timeOffset).sin().mul(0.1).add(12)).add(heatOffset)
      ).r;
      const halo = cameraPosition.normalize().dot(normalWorld).oneMinus().smoothstep(0.25, 0.75);

      const heatColor = texture(
        colorGradientTexture,
        vec2(mix(heat, float(0), halo),
        0.5));
      const sunSpot = texture3D(
        sunSpotTexture,
        normalLocal.mul(2).add(this.time.mul(0.00001))
      ).r;

      return mix(heatColor, vec4(0, 0, 0, 1), sunSpot);
    });

    this.material.outputNode = renderColor();
  }

  public static async createAsync(): Promise<Surface> {
    return new Surface(
      Surface.createHeatConvectionTexture3D(),
      Surface.createTurbulenceTexture3D(),
      Surface.createSunSpotTexture3D()
    );
  }

  private static createSunSpotTexture3D(): Data3DTexture {
    const data = new Float32Array(Surface.SUN_SPOT_SIZE * Surface.SUN_SPOT_SIZE * Surface.SUN_SPOT_SIZE);

    const perlin = new ImprovedNoise();
    const frequency0 = 0.1;
    const frequency1 = frequency0 * 2;
    const frequency2 = frequency1 * 2;
    const frequency3 = frequency2 * 2;
    const amplitude0 = 10;
    const amplitude1 = amplitude0 * 0.5;
    const amplitude2 = amplitude1 * 0.5;
    const amplitude3 = amplitude2 * 0.5;

    let value: number;
    let offset = 0;
    for (let z = 0; z < Surface.SUN_SPOT_SIZE; z++) {
      for (let y = 0; y < Surface.SUN_SPOT_SIZE; y++) {
        for (let x = 0; x < Surface.SUN_SPOT_SIZE; x++) {
          value = perlin.noise(x * frequency0, y * frequency0, z * frequency0) * amplitude0;
          value += perlin.noise(x * frequency1, y * frequency1, z * frequency1) * amplitude1;
          value += perlin.noise(x * frequency2, y * frequency2, z * frequency2) * amplitude2;
          value += perlin.noise(x * frequency3, y * frequency3, z * frequency3) * amplitude3;
          data[offset] = Math.min(0.7, Math.max(0, Math.abs(value)));
          offset++;
        } 
      }
    }

    const texture = new Data3DTexture(data, Surface.SUN_SPOT_SIZE, Surface.SUN_SPOT_SIZE, Surface.SUN_SPOT_SIZE);
    texture.format = RedFormat;
    texture.type = FloatType;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.wrapR = RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }

  private static createHeatConvectionTexture3D(): Data3DTexture {
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
    const data = new Float32Array(Surface.VORONOI_SIZE * Surface.VORONOI_SIZE * Surface.VORONOI_SIZE);

    let distance: number;
    let distance0: number;
    let distance1: number;
    let distance2: number;
    for (z = 0; z < Surface.VORONOI_SIZE; z++) {
      for (y = 0; y < Surface.VORONOI_SIZE; y++) {
        for (x = 0; x < Surface.VORONOI_SIZE; x++) {
          point = new Vector3(x, y, z).multiplyScalar(Surface.VORONOI_SIZE_RECIPROCAL);

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

    const texture = new Data3DTexture(data, Surface.VORONOI_SIZE, Surface.VORONOI_SIZE, Surface.VORONOI_SIZE);
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

  private static createTurbulenceTexture3D(): Data3DTexture {
    const data = new Float32Array(Surface.TURBULENCE_SIZE * Surface.TURBULENCE_SIZE * Surface.TURBULENCE_SIZE * 4);

    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = (Math.random() - 0.5) * 0.05;
      data[offset + 1] = (Math.random() - 0.5) * 0.05;
      data[offset + 2] = (Math.random() - 0.5) * 0.05;
      data[offset + 3] = Math.random() * 10;
    }

    const texture = new Data3DTexture(data, Surface.TURBULENCE_SIZE, Surface.TURBULENCE_SIZE, Surface.TURBULENCE_SIZE);
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
}