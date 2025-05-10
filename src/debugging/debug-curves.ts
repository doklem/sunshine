import { BufferGeometry, LineSegments, Texture, Vector2 } from 'three';
import { Node, NodeMaterial } from 'three/webgpu';
import { Settings } from '../configuration/settings';
import { Fn, positionLocal, texture } from 'three/tsl';
import { Configurable } from '../configuration/configurable';

export class DebugCurves extends LineSegments<BufferGeometry, NodeMaterial> implements Configurable {

  public constructor(
    points: Texture,
    count: number,
    colorNode: Node,
    private visibility: (settings: Settings) => boolean,
    radius: number,
    resolution: number) {
    super(
      DebugCurves.createGeometry(count, resolution),
      new NodeMaterial()
    );

    this.material.positionNode = Fn(() => {
      return texture(points, positionLocal.xy).xyz;
    })();

    this.material.colorNode = colorNode;

    this.geometry.computeBoundingSphere();
    this.geometry.boundingSphere!.radius = radius;
  }

  public applySettings(settings: Settings): void {
    this.visible = this.visibility(settings);
  }

  private static createGeometry(count: number, resolution: number): BufferGeometry {
    const points: Vector2[] = [];
    const countReciprocal = 1 / count;
    const resolutionReciprocal = 1 / resolution;
    const pixelStart = 0.5 / resolution;
    const pixelRange = 1 - 1 / resolution;
    const xScale = resolutionReciprocal * pixelRange;
    for (let y = 0; y < count; y++) {
      const v = (y + 0.5) * countReciprocal;
      for (let x = 0; x < resolution; x++) {
        points.push(new Vector2(x * xScale + pixelStart, v));
        points.push(new Vector2((x + 1) * xScale + pixelStart, v));
      }
    }
    return new BufferGeometry().setFromPoints(points);
  }
}