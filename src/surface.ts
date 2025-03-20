import { BufferGeometry, ClampToEdgeWrapping, Data3DTexture, IcosahedronGeometry, LinearFilter, Mesh, RGBAFormat, Texture, TextureLoader } from 'three';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { cameraPosition, float, Fn, mix, normalLocal, normalWorld, ShaderNodeObject, texture, texture3D, uniform, vec2, vec4 } from 'three/tsl';
import { MeshBasicNodeMaterial, UniformNode } from 'three/webgpu';
import { Settings } from './settings';
import { WaveLength } from './wave-length';
import { Noise3dTextureHelper } from './noise-3d-texture-helper';

export class Surface extends Mesh<BufferGeometry, MeshBasicNodeMaterial> {

  private static readonly GEOMETRY_RADIUS = 0.5;
  private static readonly GEOMETRY_DETAILS = 15;

  private readonly renderVisibleLight: ShaderNodeFn<[]>;

  public readonly time: ShaderNodeObject<UniformNode<number>>;

  private constructor(
    voronoiTexture: Data3DTexture,
    randomNoiseTexture: Data3DTexture,
    simplexTexture: Data3DTexture,
    visibleLightSurfaceTexture: Texture,
    visibleLightHaloTexture: Texture,
    visibleLightSpotsTexture: Texture) {
    super(new IcosahedronGeometry(Surface.GEOMETRY_RADIUS, Surface.GEOMETRY_DETAILS), new MeshBasicNodeMaterial());
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

    this.renderVisibleLight = Fn(() => {
      const timeOffset = texture3D(randomNoiseTexture, normalLocal.mul(0.5)).a;

      const heatTrubulence = texture3D(
        randomNoiseTexture,
        normalLocal.mul(10).add(this.time.mul(0.00001).sin())
      );
      const heat = texture3D(
        voronoiTexture,
        normalLocal.mul(this.time.mul(0.0005).add(timeOffset).sin().mul(0.1).add(20)).add(heatTrubulence)
      ).r;
      const heatColor = texture(visibleLightSurfaceTexture, vec2(heat, 0.5));

      const halo = cameraPosition.normalize().dot(normalWorld).oneMinus().smoothstep(-0.5, 0.5);
      const haloColor = texture(visibleLightHaloTexture, vec2(halo, 0.5));

      const surfaceColor = mix(heatColor, haloColor, halo);

      const sunSpotColor = texture(
        visibleLightSpotsTexture,
        vec2(sunSpot.sub(heat.mul(0.5)),
        0.5)
      );

      return mix(surfaceColor, sunSpotColor, sunSpot);
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
      Noise3dTextureHelper.createVoronoiTexture3D(64),
      Noise3dTextureHelper.createRandomNoiseTexture3D(32),
      new Noise3dTextureHelper().createSimplexTexture3D(32, 0.25, 1 / 32, 1, 10),
      Surface.configureToGradient(await loader.loadAsync('visible-light_surface.png')),
      Surface.configureToGradient(await loader.loadAsync('visible-light_halo.png')),
      Surface.configureToGradient(await loader.loadAsync('visible-light_spots.png'))
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