import { BufferGeometry, LineSegments, Vector3 } from 'three';
import { Node, NodeMaterial } from 'three/webgpu';
import { Settings } from '../configuration/settings';
import { Configurable } from '../configuration/configurable';

export class DebugLineSegments
  extends LineSegments<BufferGeometry, NodeMaterial>
  implements Configurable
{
  public constructor(
    points: Vector3[],
    colorNode: Node,
    private visibility: (settings: Settings) => boolean,
    radius: number,
  ) {
    super(new BufferGeometry().setFromPoints(points), new NodeMaterial());
    this.material.colorNode = colorNode;

    this.geometry.computeBoundingSphere();
    this.geometry.boundingSphere!.radius = radius;
  }

  public applySettings(settings: Settings): void {
    this.visible = this.visibility(settings);
  }
}
