import { BufferGeometry, ClampToEdgeWrapping, Data3DTexture, IcosahedronGeometry, LinearFilter, Mesh, RGBAFormat, Texture } from 'three';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { cameraPosition, float, Fn, normalLocal, normalWorld, texture, texture3D, time, vec2, vec4 } from 'three/tsl';
import { NodeMaterial } from 'three/webgpu';
import { Settings } from './settings';
import { Instrument } from './instrument';

export class Surface extends Mesh<BufferGeometry, NodeMaterial> {

  private static readonly GEOMETRY_DETAILS = 15;

  public static readonly GEOMETRY_RADIUS = 0.5;

  private readonly renderHMIItensitygram: ShaderNodeFn<[]>;
  private readonly renderHMIItensitygramColored: ShaderNodeFn<[]>;
  private readonly renderAIA304A: ShaderNodeFn<[]>;

  public constructor(
    voronoiTexture: Data3DTexture,
    randomNoiseTexture: Data3DTexture,
    simplexTexture: Data3DTexture,
    colorGradient: Texture) {
    super(new IcosahedronGeometry(Surface.GEOMETRY_RADIUS, Surface.GEOMETRY_DETAILS), new NodeMaterial());
    const colorGradientTexture = Surface.configureToGradient(colorGradient);

    const latitude = normalLocal.y.abs().oneMinus();

    const activityMask = texture3D(
      simplexTexture,
      normalLocal.mul(float(1).add(time.mul(0.05).sin().mul(0.1)))
    ).x.mul(latitude.smoothstep(0.5, 0.6)).smoothstep(0.7, 0.75);

    const sunSpotShape = texture3D(
      simplexTexture,
      normalLocal.mul(float(5).add(time.mul(0.1).sin().mul(0.1)))
    ).r.smoothstep(0.55, 0.7);

    const sunSpot = activityMask.mul(sunSpotShape);
    const timeOffset = texture3D(randomNoiseTexture, normalLocal.mul(0.5)).a;

    const intensityTrubulence = texture3D(
      randomNoiseTexture,
      normalLocal.mul(10).add(time.mul(0.01).sin())
    );
    const intensityConvection = texture3D(
      voronoiTexture,
      normalLocal.mul(time.mul(0.5).add(timeOffset).sin().mul(0.1).add(20)).add(intensityTrubulence)
    ).r.mul(0.25).add(0.75);

    const halo = cameraPosition.normalize().dot(normalWorld).mul(Math.PI).sin().smoothstep(1, 0);

    this.renderHMIItensitygram = Fn(() => {
      const temperature = intensityConvection.mul(halo.mul(0.25)).sub(sunSpot);
      return vec4(temperature, temperature, temperature, 1);
    });

    this.renderHMIItensitygramColored = Fn(() => {
      const intensity = intensityConvection.mul(halo.mul(0.75).add(0.25)).sub(sunSpot);
      return texture(colorGradientTexture, vec2(intensity, 0.5));
    });

    this.renderAIA304A = Fn(() => {
      const brightness = float(0.05).toVar();
      return vec4(brightness, brightness.mul(0.5), 0, 1);
    });

    this.material.outputNode = this.renderHMIItensitygram();
  }

  public applySettings(settings: Settings): void {
    this.visible = settings.surface;
    switch (settings.instrument) {
      case Instrument.AIA_304_A:
        this.material.outputNode = this.renderAIA304A();
        break;
      case Instrument.HMI_INTENSITYGRAM:
        this.material.outputNode = this.renderHMIItensitygram();
        break;
      case Instrument.HMI_INTENSITYGRAM_COLORED:
        this.material.outputNode = this.renderHMIItensitygramColored();
        break;
    }
    this.material.needsUpdate = true;
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