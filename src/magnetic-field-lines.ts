import { ClampToEdgeWrapping, FloatType, LinearFilter, RGBAFormat } from 'three';
import { Surface } from './surface';
import { StorageTexture, WebGPURenderer } from 'three/webgpu';
import { float, Fn, instanceIndex, Loop, storage, textureStore, vec2, vec4 } from 'three/tsl';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { MagneticConnections } from './magnetic-connections';
import { HelperFunctions } from './helper-functions';

export class MagneticFieldLines {

  public static readonly LINE_RESOLUTION = 32;
  public static readonly HIGH_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 1.2;

  private static readonly LINE_RESOLUTION_RECIPROCAL = 1 / MagneticFieldLines.LINE_RESOLUTION;
  private static readonly LINE_ANGLE = Math.PI * 0.05;
  private static readonly LOW_ALTITUDE_ALPHA_THRESHOLD = Math.pow(Surface.GEOMETRY_RADIUS * 1.01, 2);
  private static readonly HIGH_ALTITUDE_ALPHA_THRESHOLD = Math.pow(MagneticFieldLines.HIGH_ALTITUDE_RADIUS * 0.98, 2);

  public readonly count: number;
  public readonly upperBounds: StorageTexture;
  public readonly lowerBounds: StorageTexture;

  private readonly compute: ShaderNodeFn<[]>;

  public constructor(magneticConnections: MagneticConnections) {
    this.count = magneticConnections.closedConnections.length;
    this.upperBounds = MagneticFieldLines.createBoundsTexture(MagneticFieldLines.LINE_RESOLUTION + 1, magneticConnections.closedConnections.length);
    this.lowerBounds = MagneticFieldLines.createBoundsTexture(MagneticFieldLines.LINE_RESOLUTION + 1, magneticConnections.closedConnections.length);

    this.compute = Fn(() => {
      const connectionId = instanceIndex.mul(2).toVar();
      const connectionsBuffer = storage(magneticConnections.closedConnectionsBuffer, 'vec3');

      const firstPoint = connectionsBuffer.element(connectionId).toVar();
      const secondPoint = firstPoint.normalize().mul(MagneticFieldLines.HIGH_ALTITUDE_RADIUS).toVar();
      const fourthPoint = connectionsBuffer.element(connectionId.add(1)).toVar();
      const thirdPoint = fourthPoint.normalize().mul(MagneticFieldLines.HIGH_ALTITUDE_RADIUS).toVar();

      const rotationAxis = fourthPoint.sub(firstPoint).normalize().toVar();

      const secondPointUpperBound = HelperFunctions.rotate(secondPoint, rotationAxis, -MagneticFieldLines.LINE_ANGLE).toVar();
      const secondPointLowerBound = HelperFunctions.rotate(secondPoint, rotationAxis, MagneticFieldLines.LINE_ANGLE).toVar();
      const thirdPointUpperBound = HelperFunctions.rotate(thirdPoint, rotationAxis, -MagneticFieldLines.LINE_ANGLE).toVar();
      const thirdPointLowerBound = HelperFunctions.rotate(thirdPoint, rotationAxis, MagneticFieldLines.LINE_ANGLE).toVar();

      Loop(
        MagneticFieldLines.LINE_RESOLUTION + 1,
        ({ i }) => {
          const progress = float(i).mul(MagneticFieldLines.LINE_RESOLUTION_RECIPROCAL).toVar();
          const upperBoundPoint = HelperFunctions.qubicBezier(
            firstPoint,
            secondPointUpperBound,
            thirdPointUpperBound,
            fourthPoint,
            progress
          );
          const lowerBoundPoint = HelperFunctions.qubicBezier(
            firstPoint,
            secondPointLowerBound,
            thirdPointLowerBound,
            fourthPoint,
            progress
          );
          const upperAlpha = upperBoundPoint.lengthSq().smoothstep(MagneticFieldLines.HIGH_ALTITUDE_ALPHA_THRESHOLD, MagneticFieldLines.LOW_ALTITUDE_ALPHA_THRESHOLD);
          const lowerAlpha = lowerBoundPoint.lengthSq().smoothstep(MagneticFieldLines.HIGH_ALTITUDE_ALPHA_THRESHOLD, MagneticFieldLines.LOW_ALTITUDE_ALPHA_THRESHOLD);
          const uv = vec2(i, instanceIndex).toVar();
          textureStore(this.upperBounds, uv, vec4(upperBoundPoint, upperAlpha));
          textureStore(this.lowerBounds, uv, vec4(lowerBoundPoint, lowerAlpha));
        }
      );
    });
  }

  public async updateAsync(renderer: WebGPURenderer): Promise<void> {
    await renderer.computeAsync(this.compute().compute(this.count));
  }

  private static createBoundsTexture(width: number, height: number): StorageTexture {
    const texture = new StorageTexture(width, height);
    texture.format = RGBAFormat;
    texture.type = FloatType;
    texture.wrapS = ClampToEdgeWrapping;
    texture.wrapT = ClampToEdgeWrapping;
    texture.magFilter = LinearFilter;
    texture.minFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }
}