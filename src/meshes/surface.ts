import { BufferGeometry, Data3DTexture, IcosahedronGeometry, Mesh, Texture } from 'three';
import { ShaderNodeFn, ShaderNodeObject } from 'three/src/nodes/TSL.js';
import { abs, cameraPosition, Fn, fract, mix, normalLocal, normalWorld, texture, texture3D, uv, vec2, vec3, vec4 } from 'three/tsl';
import { Node, NodeMaterial } from 'three/webgpu';
import { Settings } from '../configuration/settings';
import { Instrument } from '../configuration/instrument';
import { Configurable } from '../configuration/configurable';
import MathNode from 'three/src/nodes/math/MathNode.js';

export class Surface extends Mesh<BufferGeometry, NodeMaterial> implements Configurable {

  private static readonly GEOMETRY_DETAILS = 15;
  private static readonly CONVECTION_SPEED = 0.005;
  private static readonly CONVECTION_ZOOM = 12;

  public static readonly GEOMETRY_RADIUS = 0.5;

  private readonly renderHMIItensitygram: ShaderNodeFn<[]>;
  private readonly renderHMIItensitygramColored: ShaderNodeFn<[]>;
  private readonly renderAIA304A: ShaderNodeFn<[]>;
  private readonly renderDebug: ShaderNodeFn<[]>;

  private currentInstrument?: Instrument;

  public constructor(
    voronoiTexture: Data3DTexture,
    simplexNoiseTexture: Data3DTexture,
    convectionFlowAndSunspotTexture: Texture,
    intensitygramGradient: Texture,
    aia304aGradient: Texture,
    private readonly time: ShaderNodeObject<Node>) {
    super(new IcosahedronGeometry(Surface.GEOMETRY_RADIUS, Surface.GEOMETRY_DETAILS), new NodeMaterial());

    const convectionFlowAndSunspot = texture(
      convectionFlowAndSunspotTexture,
      uv().add(texture3D(simplexNoiseTexture, vec3(uv(), 0)).xy.mul(0.3))
    ).toVar();
    const sunspot = convectionFlowAndSunspot.a;
    const convection = this.createFlowNode(convectionFlowAndSunspot.xyz, Surface.CONVECTION_SPEED, Surface.CONVECTION_ZOOM, voronoiTexture);
    const halo = cameraPosition.normalize().dot(normalWorld).mul(Math.PI).sin().smoothstep(1, 0);

    this.renderHMIItensitygram = Fn(() => {
      const intensity = convection.mul(halo.mul(0.25)).sub(sunspot);
      return vec4(intensity, intensity, intensity, 1);
    });

    this.renderHMIItensitygramColored = Fn(() => {
      const intensity = convection.mul(halo.mul(0.75).add(0.25)).sub(sunspot);
      return texture(intensitygramGradient, vec2(intensity, 0.5));
    });

    this.renderAIA304A = Fn(() => {
      return texture(aia304aGradient, vec2(sunspot, 0.5));
    });

    this.renderDebug = Fn(() => {
      return vec4(convection, convection, convection, 1);
    });

    this.material.outputNode = this.renderAIA304A();
  }

  public applySettings(settings: Settings): void {
    this.visible = settings.surface;
    if (!this.visible || this.currentInstrument === settings.instrument) {
      return;
    }

    this.currentInstrument = settings.instrument;
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

  private createFlowNode(
    flowDirection: ShaderNodeObject<Node>,
    speed: number,
    zoom: number,
    texture: Data3DTexture): ShaderNodeObject<MathNode> {
    const time0 = fract(this.time.mul(speed)).toVar();
    const time1 = fract(time0.add(0.5));
    const value0 = texture3D(
      texture,
      normalLocal.add(flowDirection.mul(time0)).mul(zoom)
    ).x;
    const value1 = texture3D(
      texture,
      normalLocal.add(flowDirection.mul(time1)).mul(zoom)
    ).x;
    return mix(value0, value1, abs(time0.sub(0.5).mul(2)));
  }
}