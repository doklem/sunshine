import { InstancedMesh, PlaneGeometry, Vector3 } from 'three';
import { Node, SpriteNodeMaterial } from 'three/webgpu';
import { instancedArray, instanceIndex } from 'three/tsl';
import { Settings } from '../configuration/settings';
import { Configurable } from '../configuration/configurable';

export class DebugSprites
  extends InstancedMesh<PlaneGeometry, SpriteNodeMaterial>
  implements Configurable
{
  private static readonly DEFAULT_SPRITE_SIZE = 0.01;

  public constructor(
    points: Vector3[],
    colorNode: Node,
    private visibility: (settings: Settings) => boolean,
    radius: number,
    spriteSize?: number,
  ) {
    super(
      new PlaneGeometry(
        spriteSize ?? DebugSprites.DEFAULT_SPRITE_SIZE,
        spriteSize ?? DebugSprites.DEFAULT_SPRITE_SIZE,
        1,
        1,
      ),
      new SpriteNodeMaterial(),
      points.length,
    );

    const positionBuffer = instancedArray(this.count, 'vec3');
    positionBuffer.value.set(
      new Float32Array(points.flatMap((point) => point.toArray())),
    );
    this.material.positionNode = positionBuffer.element(instanceIndex);
    this.material.colorNode = colorNode;

    this.computeBoundingSphere();
    this.boundingSphere!.radius = radius;
  }

  public applySettings(settings: Settings): void {
    this.visible = this.visibility(settings);
  }
}
