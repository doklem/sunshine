import { BufferGeometry, ClampToEdgeWrapping, Data3DTexture, FloatType, IcosahedronGeometry, LinearFilter, Mesh, RedFormat, RepeatWrapping, RGBAFormat, Texture, TextureLoader, Vector3 } from 'three';
import { ImprovedNoise } from 'three/examples/jsm/Addons.js';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { cameraPosition, Fn, mix, normalLocal, normalWorld, ShaderNodeObject, texture, texture3D, uniform, vec2, vec4 } from 'three/tsl';
import { MeshBasicNodeMaterial, UniformNode } from 'three/webgpu';
import { Settings } from './settings';
import { WaveLength } from './wave-length';

export class Surface extends Mesh<BufferGeometry, MeshBasicNodeMaterial> {

  private static readonly SUN_SPOT_SIZE = 32;
  private static readonly SUN_SPOT_INITIAL_FREQUENCY = 0.1;
  private static readonly SUN_SPOT_INITIAL_AMPLITUDE = 10;
  private static readonly SUN_SPOT_INITIAL_OCTAVES = 8;
  private static readonly RADIUS = 0.5;
  private static readonly DETAILS = 15;
  private static readonly TURBULENCE_SIZE = 32;
  private static readonly VORONOI_SIZE = 64;
  private static readonly VORONOI_SIZE_RECIPROCAL = 1 / Surface.VORONOI_SIZE;

  private readonly renderVisibleLight: ShaderNodeFn<[]>;

  public readonly time: ShaderNodeObject<UniformNode<number>>;

  private constructor(
    heatConvectionTexture: Data3DTexture,
    turbulenceTexture: Data3DTexture,
    sunSpotTexture: Data3DTexture,
    visibleLightSurfaceTexture: Texture,
    visibleLightHaloTexture: Texture,
    visibleLightSpotsTexture: Texture) {
    super(new IcosahedronGeometry(Surface.RADIUS, Surface.DETAILS), new MeshBasicNodeMaterial());
    this.time = uniform(0);

    const sunSpot = texture3D(
      sunSpotTexture,
      normalLocal.add(this.time.mul(0.000001).sin()).add(normalLocal.mul(3))
    ).r;
    const latitude = normalLocal.y.abs().oneMinus().smoothstep(0.5, 0.6);

    this.renderVisibleLight = Fn(() => {
      const timeOffset = texture3D(turbulenceTexture, normalLocal.mul(0.5)).a;

      const heatTrubulence = texture3D(
        turbulenceTexture,
        normalLocal.mul(10).add(this.time.mul(0.00001).sin())
      );
      const heat = texture3D(
        heatConvectionTexture,
        normalLocal.mul(this.time.mul(0.0005).add(timeOffset).sin().mul(0.1).add(20)).add(heatTrubulence)
      ).r;
      const heatColor = texture(visibleLightSurfaceTexture, vec2(heat, 0.5));

      const halo = cameraPosition.normalize().dot(normalWorld).oneMinus().smoothstep(-0.5, 0.5);
      const haloColor = texture(visibleLightHaloTexture, vec2(halo, 0.5));

      const surfaceColor = mix(heatColor, haloColor, halo);

      const sunSpotHeat = sunSpot.mul(latitude);
      const sunSpotColor = texture(visibleLightSpotsTexture, vec2(sunSpotHeat.smoothstep(7.5, 9), 0.5));

      return mix(surfaceColor, sunSpotColor, sunSpotHeat.smoothstep(7.0, 7.5));
      return mix(heatColor, vec4(0, 0, 0, 1), sunSpot.mul(latitude));
    });

    this.material.outputNode = this.renderVisibleLight();
  }

  public applySettings(settings: Settings): void {
    this.visible = settings.surface;
    switch (settings.waveLength) {
    this.material.outputNode = renderColor();
      case WaveLength.VISIBLE_LIGHT:
        this.material.outputNode = this.renderVisibleLight();
        break;
    }
    this.material.needsUpdate = true;
  }

  public static async createAsync(): Promise<Surface> {
    const loader = new TextureLoader();
    return new Surface(
      Surface.createHeatConvectionTexture3D(),
      Surface.createTurbulenceTexture3D(),
      Surface.createSunSpotTexture3D(),
      Surface.configureToGradient(await loader.loadAsync('visible-light_surface.png')),
      Surface.configureToGradient(await loader.loadAsync('visible-light_halo.png')),
      Surface.configureToGradient(await loader.loadAsync('visible-light_spots.png'))
    );
  }

  private static createSunSpotTexture3D(): Data3DTexture {
    const data = new Float32Array(Surface.SUN_SPOT_SIZE * Surface.SUN_SPOT_SIZE * Surface.SUN_SPOT_SIZE);
    const perlin = new ImprovedNoise();
    let frequency: number;
    let amplitude: number;
    let value: number;
    let offset = 0;
    for (let z = 0; z < Surface.SUN_SPOT_SIZE; z++) {
      for (let y = 0; y < Surface.SUN_SPOT_SIZE; y++) {
        for (let x = 0; x < Surface.SUN_SPOT_SIZE; x++) {

          frequency = Surface.SUN_SPOT_INITIAL_FREQUENCY;
          amplitude = Surface.SUN_SPOT_INITIAL_AMPLITUDE;
          value = 0;
          for (let i = 0; i < Surface.SUN_SPOT_INITIAL_OCTAVES; i++) {
            value += perlin.noise(x * frequency, y * frequency, z * frequency) * amplitude;
            frequency *= 2;
            amplitude *= 0.5;
          }
          data[offset] = Math.abs(value);
          offset++;
        }
      }
    }

    return Surface.configureTo3dValue(new Data3DTexture(data, Surface.SUN_SPOT_SIZE, Surface.SUN_SPOT_SIZE, Surface.SUN_SPOT_SIZE));
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

    return Surface.configureTo3dValue(new Data3DTexture(data, Surface.VORONOI_SIZE, Surface.VORONOI_SIZE, Surface.VORONOI_SIZE));
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

  private static configureToGradient(texture: Texture): Texture {
    texture.format = RGBAFormat;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
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