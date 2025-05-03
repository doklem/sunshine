import { InstancedMesh, PlaneGeometry } from 'three';
import { SpriteNodeMaterial, StorageBufferNode } from 'three/webgpu';
import { instancedArray, instanceIndex, ShaderNodeObject, vec4 } from 'three/tsl';
import { Settings } from './settings';
import { Surface } from './surface';
import { MagneticPoles } from './magnetic-poles';
import { Instrument } from './instrument';

export class MagneticPolesMesh extends InstancedMesh<PlaneGeometry, SpriteNodeMaterial> {
  
  private static readonly SIZE = 0.01;

  private readonly positionBuffer: ShaderNodeObject<StorageBufferNode>;
  private readonly chargeBuffer: ShaderNodeObject<StorageBufferNode>;

  public constructor(poles: MagneticPoles) {
    super(
      new PlaneGeometry(MagneticPolesMesh.SIZE, MagneticPolesMesh.SIZE, 1, 1),
      new SpriteNodeMaterial(),
      poles.northPoles.length + poles.southPoles.length
    );

    const positions = new Float32Array(this.count * 3);
    const charges = new Float32Array(this.count);
    let positionOffset = 0;
    let chargeOffset = 0;
    poles.northPoles.forEach(pole => {
      positions.set(pole.toArray(), positionOffset);
      positionOffset += 3;

      charges[chargeOffset] = 0;
      chargeOffset++;
    });
    poles.southPoles.forEach(pole => {
      positions.set(pole.toArray(), positionOffset);
      positionOffset += 3;

      charges[chargeOffset] = 1;
      chargeOffset++;
    });

    this.positionBuffer = instancedArray(this.count, 'vec3');
    this.positionBuffer.value.set(positions);
    this.chargeBuffer = instancedArray(this.count, 'float');
    this.chargeBuffer.value.set(charges);

    this.material.positionNode = this.positionBuffer.element(instanceIndex);
    
    const charge = this.chargeBuffer.element(instanceIndex).toVar();
    this.material.colorNode = vec4(charge, 0, charge.oneMinus(), 1);

    this.computeBoundingSphere();
    this.boundingSphere!.radius = Surface.GEOMETRY_RADIUS;
  }

  public applySettings(settings: Settings): void {
      this.visible = settings.instrument === Instrument.DEBUG_MAGNETOSPHERE;
  }
}