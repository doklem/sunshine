import { AdditiveBlending, InstancedMesh, PlaneGeometry, Texture, Vector3 } from 'three';
import { Fn, instancedArray, instanceIndex, ShaderNodeObject, vec3 } from 'three/tsl';
import { ComputeNode, SpriteNodeMaterial, StorageBufferNode, WebGPURenderer } from 'three/webgpu';
import { Settings } from './settings';
import { WaveLength } from './wave-length';
import { MagneticFieldLines } from './magnetic-field-lines';
import { BezierFunctions } from './bezier-functions';

export class LowAltitudeChargedParticles extends InstancedMesh<PlaneGeometry, SpriteNodeMaterial> {

  private static readonly PARTICLE_SIZE = 0.1;

  private readonly positionBuffer: ShaderNodeObject<StorageBufferNode>;
  private readonly progressBuffer: ShaderNodeObject<StorageBufferNode>;
  private readonly computeUpdate: ShaderNodeObject<ComputeNode>;

  public constructor(private readonly magneticFieldLines: MagneticFieldLines, map: Texture, count: number) {
    super(
      new PlaneGeometry(LowAltitudeChargedParticles.PARTICLE_SIZE, LowAltitudeChargedParticles.PARTICLE_SIZE),
      new SpriteNodeMaterial({ blending: AdditiveBlending, map, depthWrite: false }),
      count
    );

    const value = new Vector3();
    const initialPositions: number[] = [];
    const initialProgress: number[] = [];
    for (let i = 0; i < this.count; i++) {
      value.set(Math.random(), Math.random(), Math.random()).subScalar(0.5).normalize();
      initialPositions.push(value.x, value.y, value.z);
      initialProgress.push(Math.random());
    }
    this.positionBuffer = instancedArray(this.count, 'vec3');
    this.positionBuffer.value.set(new Float32Array(initialPositions));
    this.progressBuffer = instancedArray(this.count, 'float');
    this.progressBuffer.value.set(new Float32Array(initialProgress));

    const progress = this.progressBuffer.element(instanceIndex);
    const inversProgressArc = progress.sub(0.5).abs().mul(2);

    this.computeUpdate = Fn(() => {
      const fieldLineId = instanceIndex.modInt(this.magneticFieldLines.lowAltitudeFieldLines.count).toVar();
      const incrementedProgress = progress.add(this.magneticFieldLines.lowAltitudeFieldLines.speedsBuffer.element(fieldLineId)).mod(1).toVar();
      this.progressBuffer.element(instanceIndex).assign(incrementedProgress);
      this.positionBuffer
        .element(instanceIndex)
        .assign(
          BezierFunctions.QUADRATIC_CURVE(
            this.magneticFieldLines.lowAltitudeFieldLines.controlPointBuffers[0].element(fieldLineId),
            this.magneticFieldLines.lowAltitudeFieldLines.controlPointBuffers[1].element(fieldLineId),
            this.magneticFieldLines.lowAltitudeFieldLines.controlPointBuffers[2].element(fieldLineId),
            incrementedProgress
          )
        );
    })().compute(this.count);

    this.material.positionNode = this.positionBuffer.element(instanceIndex);
    this.material.scaleNode = Fn(() => {
      const scale = inversProgressArc.oneMinus().add(0.1).toVar();
      return vec3(scale, scale, scale);
    })();
    this.material.opacityNode = Fn(() => {
      const opacity = inversProgressArc.toVar();
      return vec3(opacity, opacity, opacity);
    })();

    this.computeBoundingSphere();
    this.boundingSphere!.radius = MagneticFieldLines.LOW_ALTITUDE_RADIUS;
  }

  public applySettings(settings: Settings): void {
    this.visible = settings.waveLength === WaveLength.AIA_304_A;
  }

  public onAnimationFrame(renderer: WebGPURenderer): void {
    if (this.visible) {
      renderer.compute(this.computeUpdate);
    }
  }
}