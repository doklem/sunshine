import { InstancedMesh, PlaneGeometry } from 'three';
import { AdditiveBlending, SpriteNodeMaterial, StorageBufferNode, Texture, Vector3, WebGPURenderer } from 'three/webgpu';
import { MagneticFieldLines_OLD } from './magnetic-field-lines_OLD';
import { float, Fn, instancedArray, instanceIndex, int, mix, ShaderNodeObject, vec3 } from 'three/tsl';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { Surface } from './surface';

export class ChargedParticles extends InstancedMesh<PlaneGeometry, SpriteNodeMaterial> {

  private static readonly PARTICLE_SIZE = 0.1;
  private static readonly GEOMETRY = new PlaneGeometry(ChargedParticles.PARTICLE_SIZE, ChargedParticles.PARTICLE_SIZE);

  private readonly positionBuffer: ShaderNodeObject<StorageBufferNode>;
  private readonly progressBuffer: ShaderNodeObject<StorageBufferNode>;
  private readonly computeUpdate: ShaderNodeFn<[]>;

  public constructor(
    magneticFieldLines: MagneticFieldLines_OLD,
    map: Texture,
    count: number) {
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

    const fieldLineId = instanceIndex.mod(int(magneticFieldLines.count)).toVar();
    const incrementedProgress = this.progressBuffer.element(instanceIndex).add(magneticFieldLines.speedsBuffer.element(fieldLineId)).mod(1).toVar();


    const qubicBezier = Fn<[]>
      (() => {
        const firstControlPoint = magneticFieldLines.controlPointBuffers[0].element(fieldLineId);
        const secondControlPoint = magneticFieldLines.controlPointBuffers[1].element(fieldLineId);
        const thirdControlPoint = magneticFieldLines.controlPointBuffers[2].element(fieldLineId);
        const fourthControlPoint = magneticFieldLines.controlPointBuffers[3].element(fieldLineId);

        const firstLowerPosition = mix(firstControlPoint, secondControlPoint, incrementedProgress);
        const secondLowerPosition = mix(secondControlPoint, thirdControlPoint, incrementedProgress);
        const thridLowerPosition = mix(thirdControlPoint, fourthControlPoint, incrementedProgress);

        const firstHigherPosition = mix(firstLowerPosition, secondLowerPosition, incrementedProgress);
        const secondHigherPosition = mix(secondLowerPosition, thridLowerPosition, incrementedProgress);
        return mix(firstHigherPosition, secondHigherPosition, incrementedProgress);
      });

    const position = qubicBezier().toVar();

    const height = position.length().toVar();

    this.computeUpdate = Fn(() => {
      this.progressBuffer.element(instanceIndex).assign(incrementedProgress);
      this.positionBuffer
        .element(instanceIndex)
        .assign(position.normalize().mul(height));
    });

    this.material.positionNode = this.positionBuffer.element(instanceIndex);
    this.material.scaleNode = Fn(() => {
      const scale = height.smoothstep(Surface.GEOMETRY_RADIUS, Surface.GEOMETRY_RADIUS * 1.1).toVar();
      return vec3(scale, scale, scale);
    })();
    this.material.opacityNode = float(0.25);

    this.computeBoundingSphere();
    this.boundingSphere!.radius = MagneticFieldLines_OLD.HIGH_ALTITUDE_RADIUS;
  }

  public onAnimationFrame(renderer: WebGPURenderer): void {
    if (this.visible) {
      renderer.compute(this.computeUpdate().compute(this.count));
    }
  }
}