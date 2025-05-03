import { BufferGeometry, LineSegments, Vector3 } from 'three';
import { Node, NodeMaterial } from 'three/webgpu';
import { Settings } from './settings';

export class DebugLineSegments extends LineSegments<BufferGeometry, NodeMaterial> {

  public constructor(points: Vector3[], colorNode: Node, private visibility: (settings: Settings) => boolean) {
    super(
      new BufferGeometry().setFromPoints(points),
      new NodeMaterial()
    );
    this.material.colorNode = colorNode;
  }

  public applySettings(settings: Settings): void {
    this.visible = this.visibility(settings);
  }
}