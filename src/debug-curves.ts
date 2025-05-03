import { BufferGeometry, LineSegments, Texture, Vector2 } from 'three';
import { Node, NodeMaterial } from 'three/webgpu';
import { Settings } from './settings';
import { Fn, positionLocal, texture } from 'three/tsl';

export class DebugCurves extends LineSegments<BufferGeometry, NodeMaterial> {

  private static readonly DEFAULT_RESOLUTION = 32;

  public constructor(
    points: Texture,
    count: number,
    colorNode: Node,
    private visibility: (settings: Settings) => boolean,
    resolution?: number) {
    super(
      DebugCurves.createGeometry(count, resolution ?? DebugCurves.DEFAULT_RESOLUTION),
      new NodeMaterial()
    );

    this.material.positionNode = Fn(() => {
      return texture(points, positionLocal.xy).xyz;
    })();

    this.material.colorNode = colorNode;
  }

  public applySettings(settings: Settings): void {
    this.visible = this.visibility(settings);
  }

  private static createGeometry(count: number, resolution: number): BufferGeometry {
    const points: Vector2[] = [];
    const countReciprocal = 1 / count;
    const resolutionReciprocal = 1 / resolution;
    for (let y = 0; y < count; y++) {
      const v = (y + 0.5) * countReciprocal;
      for (let x = 0; x < resolution; x++) {
        points.push(new Vector2(x * resolutionReciprocal, v));
        points.push(new Vector2((x + 1) * resolutionReciprocal, v));
      }
    }
    return new BufferGeometry().setFromPoints(points);
  }
}