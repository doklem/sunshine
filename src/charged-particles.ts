import { InstancedMesh, PlaneGeometry } from 'three';
import { AdditiveBlending, SpriteNodeMaterial, StorageBufferNode, Texture, Vector3, WebGPURenderer } from 'three/webgpu';
import { MagneticFieldLines } from './magnetic-field-lines';
import { float, Fn, instancedArray, instanceIndex, int, ShaderNodeObject, texture3D, time, vec3 } from 'three/tsl';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { BezierFunctions } from './bezier-functions';
import { MagneticFieldLineSet } from './magnetic-field-line-set';
import { Settings } from './settings';
import { Instrument } from './instrument';
import { Surface } from './surface';

export class ChargedParticles extends InstancedMesh<PlaneGeometry, SpriteNodeMaterial> {

  private static readonly PARTICLE_SIZE = 0.1;
  private static readonly GEOMETRY = new PlaneGeometry(ChargedParticles.PARTICLE_SIZE, ChargedParticles.PARTICLE_SIZE);
  private static readonly OFFSET_STRENGTH = 0.2;

  private readonly positionBuffer: ShaderNodeObject<StorageBufferNode>;
  private readonly progressBuffer: ShaderNodeObject<StorageBufferNode>;
  private readonly computeUpdate: ShaderNodeFn<[]>;

  public constructor(
    magneticFieldLines: MagneticFieldLines,
    map: Texture,
    count: number,
    lowAtitude: boolean) {
    super(
      ChargedParticles.GEOMETRY,
      new SpriteNodeMaterial({ blending: AdditiveBlending, map, depthWrite: false }),
      count
    );

    const value = new Vector3();
    const initialPositions: number[] = [];
    const initialProgress: number[] = [];
    for (let i = 0; i < count; i++) {
      value.set(Math.random(), Math.random(), Math.random()).subScalar(0.5).normalize();
      initialPositions.push(value.x, value.y, value.z);
      initialProgress.push(Math.random());
    }
    this.positionBuffer = instancedArray(count, 'vec3');
    this.positionBuffer.value.set(new Float32Array(initialPositions));
    this.progressBuffer = instancedArray(count, 'float');
    this.progressBuffer.value.set(new Float32Array(initialProgress));

    const fieldLines: MagneticFieldLineSet = lowAtitude ? magneticFieldLines.lowAltitudeFieldLines : magneticFieldLines.highAltitudeFieldLines;

    const fieldLineId = instanceIndex.mod(int(fieldLines.count)).toVar();
    const incrementedProgress = this.progressBuffer.element(instanceIndex).add(fieldLines.speedsBuffer.element(fieldLineId)).mod(1).toVar();

    const position = lowAtitude
      ? BezierFunctions.QUADRATIC_CURVE(
        fieldLines.controlPointBuffers[0].element(fieldLineId),
        fieldLines.controlPointBuffers[1].element(fieldLineId),
        fieldLines.controlPointBuffers[2].element(fieldLineId),
        incrementedProgress
      ).toVar()
      : BezierFunctions.QUBIC_CURVE(
        fieldLines.controlPointBuffers[0].element(fieldLineId),
        fieldLines.controlPointBuffers[1].element(fieldLineId),
        fieldLines.controlPointBuffers[2].element(fieldLineId),
        fieldLines.controlPointBuffers[3].element(fieldLineId),
        incrementedProgress
      ).toVar();

    const height = position.length().toVar();

    this.computeUpdate = Fn(() => {
      this.progressBuffer.element(instanceIndex).assign(incrementedProgress);
      const offset = texture3D(magneticFieldLines.distortionTexture, position.mul(time.mul(0.1).sin()), int(0)).rgb.mul(ChargedParticles.OFFSET_STRENGTH);
      this.positionBuffer
        .element(instanceIndex)
        .assign(position.add(offset).normalize().mul(height));
    });

    this.material.positionNode = this.positionBuffer.element(instanceIndex);
    this.material.scaleNode = Fn(() => {
      const scale = height.smoothstep(Surface.GEOMETRY_RADIUS, Surface.GEOMETRY_RADIUS * 1.1).toVar();
      return vec3(scale, scale, scale);
    })();
    this.material.opacityNode = float(0.25);

    this.computeBoundingSphere();
    this.boundingSphere!.radius = lowAtitude ? MagneticFieldLines.LOW_ALTITUDE_RADIUS : MagneticFieldLines.HIGH_ALTITUDE_RADIUS;
  }

  public applySettings(settings: Settings): void {
    this.visible = settings.instrument === Instrument.DEBUG_CHARGED_PARTICLES;
  }

  public onAnimationFrame(renderer: WebGPURenderer): void {
    if (this.visible) {
      renderer.compute(this.computeUpdate().compute(this.count));
    }
  }
}