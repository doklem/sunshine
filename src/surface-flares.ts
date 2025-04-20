import { InstancedMesh, PlaneGeometry } from 'three';
import { DoubleSide, NodeMaterial, Texture } from 'three/webgpu';
import { Settings } from './settings';
import { Instrument } from './instrument';
import { float, Fn, instanceIndex, PI, positionLocal, texture, time, uv, vec2, vec3, vec4 } from 'three/tsl';

export class SurfaceFlares extends InstancedMesh<PlaneGeometry, NodeMaterial> {

  private static readonly DISTORTION = -0.8;
  private static readonly GEOMETRY = new PlaneGeometry(1, 1, 15, 13);

  public constructor(vertexShaderNoise: Texture, fragmentShaderNoise: Texture) {
    super(SurfaceFlares.GEOMETRY, new NodeMaterial(), 1);
    this.material.transparent = true;
    this.material.side = DoubleSide;
    this.material.depthWrite = false;

    const countReciprocal = 1 / this.count;    
    const centeredUV = uv().sub(0.5).toVar();
    const distanceToSource = centeredUV.x.abs().mul(2).mul(centeredUV.y.abs().mul(2).smoothstep(2, 0.7)).toVar();

    this.material.positionNode = Fn(() => {
      const scale = float(instanceIndex.add(1)).mul(countReciprocal).toVar();
      const arcUV = uv().mul(PI).sin().toVar();

      const position = vec3(
        positionLocal.x,
        positionLocal.y.mul(scale.mul(0.8)),
        positionLocal.z.add(
          arcUV.x.mul(arcUV.y).mul(scale).mul(0.2)
        )
      ).toVar();

      const offset = texture(
        vertexShaderNoise,
        position.xy.mul(0.01).add(vec2(time.mul(0.01), 0))
      ).xyz.mul(distanceToSource.oneMinus());

      return position.add(offset);
    })();

    this.material.colorNode = Fn(() => {
      const scaledUV = uv().add(vec2(instanceIndex, 0)).mul(vec2(0.01, 5)).toVar();

      const unityUV = uv().add(vec2(0, -0.5)).mul(PI).toVar();
      const vOffset = unityUV.y.sin().mul(unityUV.x.sin()).mul(SurfaceFlares.DISTORTION).toVar();

      const edgeMask = unityUV.add(vec2(0, vOffset)).y.abs().smoothstep(0.6, 0.19);
      const alpha = texture(
        fragmentShaderNoise,
        scaledUV.add(
          vec2(time.mul(0.01), vOffset.mul(1.5))
        )
      ).x.mul(distanceToSource.smoothstep(0.6, 1).add(0.2));
      const hue = distanceToSource.smoothstep(0.6, 1.2).mul(0.5).toVar();

      return vec4(1, hue.add(0.5), hue, edgeMask.mul(alpha));
    })();
    return;
  }

  public applySettings(settings: Settings): void {
    this.visible = settings.instrument === Instrument.DEBUG_SURFACE_FLARE;
  }

  public static adpatFragmentNoise(value: number, _: number): number {
    if (value < 0) {
      value *= -0.8;
    }
    value = Math.max(0.1, value);
    return value;
  }

  public static adpatVertexNoise(value: number, _: number): number {
    return value * 0.05;
  }
}