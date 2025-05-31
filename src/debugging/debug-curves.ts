import { BufferGeometry, LineSegments, Vector2 } from 'three';
import { Node, NodeMaterial, StorageBufferAttribute } from 'three/webgpu';
import { Settings } from '../configuration/settings';
import { Fn, positionLocal, storage } from 'three/tsl';
import { Configurable } from '../configuration/configurable';

export class DebugCurves
  extends LineSegments<BufferGeometry, NodeMaterial>
  implements Configurable
{
  public constructor(
    points: StorageBufferAttribute,
    count: number,
    colorNode: Node,
    private visibility: (settings: Settings) => boolean,
    resolution: number,
  ) {
    super(DebugCurves.createGeometry(count, resolution), new NodeMaterial());

    this.material.positionNode = Fn(() => {
      return storage(points, 'vec4').element(positionLocal.x).xyz;
    })();

    this.material.colorNode = colorNode;
  }

  public applySettings(settings: Settings): void {
    this.visible = this.visibility(settings);
  }

  private static createGeometry(
    count: number,
    resolution: number,
  ): BufferGeometry {
    const points: Vector2[] = [];
    for (let y = 0; y < count; y++) {
      const offset = y * resolution;
      for (let x = 0; x < resolution - 1; x++) {
        points.push(new Vector2(x + offset));
        points.push(new Vector2(x + 1 + offset));
      }
    }
    return new BufferGeometry().setFromPoints(points);
  }
}
