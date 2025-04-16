import { AdditiveBlending, InstancedMesh, PlaneGeometry, Texture, Vector3 } from 'three';
import { Fn, instancedArray, instanceIndex, ShaderNodeObject, vec3 } from 'three/tsl';
import { ComputeNode, SpriteNodeMaterial, StorageBufferNode, WebGPURenderer } from 'three/webgpu';
import { Settings } from './settings';
import { WaveLength } from './wave-length';
import { MagneticFieldLines } from './magnetic-field-lines';
import { BezierFunctions } from './bezier-functions';

export class HighAltitudeChargedParticles extends InstancedMesh<PlaneGeometry, SpriteNodeMaterial> {

  private static readonly PARTICLE_SIZE = 0.1;
  private static readonly RAMPED_PROGRES_START = 0.02;
  private static readonly RAMPED_PROGRES_END = HighAltitudeChargedParticles.RAMPED_PROGRES_START + 0.1;

  private readonly positionBuffer: ShaderNodeObject<StorageBufferNode>;
  private readonly progressBuffer: ShaderNodeObject<StorageBufferNode>;
  private readonly computeUpdate: ShaderNodeObject<ComputeNode>;

  public constructor(private readonly magneticFieldLines: MagneticFieldLines, map: Texture, count: number) {
    super(
      new PlaneGeometry(HighAltitudeChargedParticles.PARTICLE_SIZE, HighAltitudeChargedParticles.PARTICLE_SIZE),
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
    const rampedProgress = progress.smoothstep(HighAltitudeChargedParticles.RAMPED_PROGRES_START, HighAltitudeChargedParticles.RAMPED_PROGRES_END);

    this.computeUpdate = Fn(() => {
      const fieldLineId = instanceIndex.modInt(this.magneticFieldLines.highAltitudeFieldLines.count).toVar();
      const incrementedProgress = progress.add(this.magneticFieldLines.highAltitudeFieldLines.speedsBuffer.element(fieldLineId)).mod(1).toVar();
      this.progressBuffer.element(instanceIndex).assign(incrementedProgress);
      this.positionBuffer
        .element(instanceIndex)
        .assign(
          BezierFunctions.QUBIC_CURVE(
            this.magneticFieldLines.highAltitudeFieldLines.controlPointBuffers[0].element(fieldLineId),
            this.magneticFieldLines.highAltitudeFieldLines.controlPointBuffers[1].element(fieldLineId),
            this.magneticFieldLines.highAltitudeFieldLines.controlPointBuffers[2].element(fieldLineId),
            this.magneticFieldLines.highAltitudeFieldLines.controlPointBuffers[3].element(fieldLineId),
            incrementedProgress
          )
        );
    })().compute(this.count);

    this.material.positionNode = this.positionBuffer.element(instanceIndex);
    this.material.scaleNode = Fn(() => {
      const scale = rampedProgress.toVar();
      return vec3(scale, scale, scale);
    })();
    this.material.opacityNode = Fn(() => {
      const opacity = rampedProgress.mul(0.2).toVar();
      return vec3(opacity, opacity, opacity);
    })();

    this.computeBoundingSphere();
    this.boundingSphere!.radius = MagneticFieldLines.HIGH_ALTITUDE_RADIUS;
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