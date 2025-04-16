import { BufferGeometry, ClampToEdgeWrapping, Data3DTexture, IcosahedronGeometry, LinearFilter, Mesh, RGBAFormat, Texture, TextureLoader } from 'three';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { cameraPosition, float, Fn, mix, normalLocal, normalWorld, ShaderNodeObject, texture, texture3D, uniform, vec2, vec4 } from 'three/tsl';
import { NodeMaterial, UniformNode } from 'three/webgpu';
import { Settings } from './settings';
import { WaveLength } from './wave-length';
import { NoiseTextureHelper } from './noise-texture-helper';

export class Surface extends Mesh<BufferGeometry, NodeMaterial> {

  private static readonly GEOMETRY_DETAILS = 15;

  public static readonly GEOMETRY_RADIUS = 0.5;

  private readonly renderHMIItensitygram: ShaderNodeFn<[]>;
  private readonly renderHMIItensitygramColored: ShaderNodeFn<[]>;
  private readonly renderAIA304A: ShaderNodeFn<[]>;

  public readonly time: ShaderNodeObject<UniformNode<number>>;

  private constructor(
    voronoiTexture: Data3DTexture,
    randomNoiseTexture: Data3DTexture,
    simplexTexture: Data3DTexture,
    visibleLightTexture: Texture) {
    super(new IcosahedronGeometry(Surface.GEOMETRY_RADIUS, Surface.GEOMETRY_DETAILS), new NodeMaterial());
    this.time = uniform(0);

    const latitude = normalLocal.y.abs().oneMinus();

    const activityMask = texture3D(
      simplexTexture,
      normalLocal.mul(float(1).add(this.time.mul(0.00005).sin().mul(0.1)))
    ).x.mul(latitude.smoothstep(0.5, 0.6)).smoothstep(0.7, 0.75);

    const sunSpotShape = texture3D(
      simplexTexture,
      normalLocal.mul(float(5).add(this.time.mul(0.0001).sin().mul(0.1)))
    ).r.smoothstep(0.55, 0.7);

    const sunSpot = activityMask.mul(sunSpotShape);
    const timeOffset = texture3D(randomNoiseTexture, normalLocal.mul(0.5)).a;

    const tempertureTrubulence = texture3D(
      randomNoiseTexture,
      normalLocal.mul(10).add(this.time.mul(0.00001).sin())
    );
    const convectionTemperatur = texture3D(
      voronoiTexture,
      normalLocal.mul(this.time.mul(0.0005).add(timeOffset).sin().mul(0.1).add(20)).add(tempertureTrubulence)
    ).r.mul(0.25).add(0.75);

    const halo = cameraPosition.normalize().dot(normalWorld).mul(Math.PI).sin().smoothstep(1, 0);

    this.renderHMIItensitygram = Fn(() => {
      const temperature = convectionTemperatur.mul(halo.mul(0.25)).sub(sunSpot);
      return vec4(temperature, temperature, temperature, 1);
    });

    this.renderHMIItensitygramColored = Fn(() => {
      const temperature = convectionTemperatur.mul(halo.mul(0.75).add(0.25)).sub(sunSpot);
      return texture(visibleLightTexture, vec2(temperature, 0.5));
    });

    this.renderAIA304A = Fn(() => {
      return mix(vec4(0.8, 0, 0, 1), vec4(1, 1, 0, 1), sunSpot);
    });

    this.material.outputNode = this.renderHMIItensitygram();
  }

  public applySettings(settings: Settings): void {
    this.visible = settings.surface;
    switch (settings.waveLength) {
      case WaveLength.AIA_304_A:
        this.material.outputNode = this.renderAIA304A();
        break;
      case WaveLength.HMI_INTENSITYGRAM:
        this.material.outputNode = this.renderHMIItensitygram();
        break;
      case WaveLength.HMI_INTENSITYGRAM_COLORED:
        this.material.outputNode = this.renderHMIItensitygramColored();
        break;
    }
    this.material.needsUpdate = true;
  }

  public static async createAsync(): Promise<Surface> {
    const loader = new TextureLoader();
    const noiseHelper = new NoiseTextureHelper(
      {
        size: 32,
        seam: 0.25,
        frequency: 1 / 32,
        amplitude: 1,
        octaves: 10
      },
      {
        size: 64,
        volumeSize: 1
      },
      {
        size: 32
      }
    );
    return new Surface(
      noiseHelper.createVoronoiTexture3D(),
      noiseHelper.createWhiteNoiseTexture3D(),
      noiseHelper.createSimplexTexture3D(),
      Surface.configureToGradient(await loader.loadAsync('hmi-intensitygram-colored.png'))
    );
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
}