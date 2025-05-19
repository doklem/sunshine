import { BufferGeometry, ClampToEdgeWrapping, Data3DTexture, IcosahedronGeometry, LinearFilter, Mesh, RGBAFormat, Texture } from 'three';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { abs, cameraPosition, Fn, fract, mix, normalLocal, normalWorld, texture, texture3D, time, uv, vec2, vec4 } from 'three/tsl';
import { NodeMaterial } from 'three/webgpu';
import { Settings } from '../configuration/settings';
import { Instrument } from '../configuration/instrument';
import { Configurable } from '../configuration/configurable';

export class Surface extends Mesh<BufferGeometry, NodeMaterial> implements Configurable {

  private static readonly GEOMETRY_DETAILS = 15;
  private static readonly CONVECTION_SPEED = 0.01;
  private static readonly CONVECTION_ZOOM = 12;

  public static readonly GEOMETRY_RADIUS = 0.5;

  private readonly renderHMIItensitygram: ShaderNodeFn<[]>;
  private readonly renderHMIItensitygramColored: ShaderNodeFn<[]>;
  private readonly renderAIA304A: ShaderNodeFn<[]>;
  private readonly renderDebug: ShaderNodeFn<[]>;

  public constructor(
    voronoiTexture: Data3DTexture,
    simplexNoiseTexture: Texture,
    sunspotTexture: Texture,
    intensitygramGradient: Texture,
    aia304aGradient: Texture) {
    super(new IcosahedronGeometry(Surface.GEOMETRY_RADIUS, Surface.GEOMETRY_DETAILS), new NodeMaterial());

    const sunspotAndFlow = texture(
      sunspotTexture,
      uv().add(texture(simplexNoiseTexture, uv()).xy.mul(0.3))
    ).toVar();
    const sunspot = sunspotAndFlow.a;

    const flowDirection = sunspotAndFlow.xyz;
    const phase0Time = fract(time.mul(Surface.CONVECTION_SPEED)).toVar();
    const phase1Time = fract(phase0Time.add(0.5));
    const flowMix = abs(phase0Time.sub(0.5).mul(2));

    const intensity0 = texture3D(
      voronoiTexture,
      normalLocal.add(flowDirection.mul(phase0Time)).mul(Surface.CONVECTION_ZOOM)
    ).x;
    const intensity1 = texture3D(
      voronoiTexture,
      normalLocal.add(flowDirection.mul(phase1Time)).mul(Surface.CONVECTION_ZOOM)
    ).x;
    const intensityConvection = mix(intensity0, intensity1, flowMix);

    const halo = cameraPosition.normalize().dot(normalWorld).mul(Math.PI).sin().smoothstep(1, 0);

    this.renderHMIItensitygram = Fn(() => {
      const intensity = intensityConvection.mul(halo.mul(0.25)).sub(sunspot);
      return vec4(intensity, intensity, intensity, 1);
    });

    this.renderHMIItensitygramColored = Fn(() => {
      const intensity = intensityConvection.mul(halo.mul(0.75).add(0.25)).sub(sunspot);
      return texture(Surface.configureToGradient(intensitygramGradient), vec2(intensity, 0.5));
    });

    this.renderAIA304A = Fn(() => {
      return texture(Surface.configureToGradient(aia304aGradient), vec2(sunspot, 0.5));
    });

    this.renderDebug = Fn(() => {
      return vec4(flowDirection, 1);
    });

    this.material.outputNode = this.renderAIA304A();
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
      case Instrument.DEBUG:
        this.material.outputNode = this.renderDebug();
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