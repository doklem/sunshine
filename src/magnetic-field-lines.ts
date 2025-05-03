import { ClampToEdgeWrapping, FloatType, LinearFilter, RGBAFormat } from 'three';
import { Surface } from './surface';
import { StorageTexture, WebGPURenderer } from 'three/webgpu';
import { float, Fn, instanceIndex, Loop, storage, textureStore, vec2, vec3, vec4 } from 'three/tsl';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { MagneticConnections } from './magnetic-connections';
import { HelperFunctions } from './helper-functions';

export class MagneticFieldLines {

  public static readonly CLOSED_LINE_RESOLUTION = 32;
  public static readonly HIGH_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 1.2;

  private static readonly CLOSED_LINE_RESOLUTION_RECIPROCAL = 1 / MagneticFieldLines.CLOSED_LINE_RESOLUTION;
  private static readonly CLOSED_LINE_ANGLE = Math.PI * 0.05;
  private static readonly OPEN_LINE_ANGLE = Math.PI * 0.03;
  private static readonly LOW_ALTITUDE_ALPHA_THRESHOLD = Math.pow(Surface.GEOMETRY_RADIUS * 1.01, 2);
  private static readonly HIGH_ALTITUDE_ALPHA_THRESHOLD = Math.pow(MagneticFieldLines.HIGH_ALTITUDE_RADIUS * 0.98, 2);

  public readonly closedCount: number;
  public readonly closedUpperBounds: StorageTexture;
  public readonly closedLowerBounds: StorageTexture;
  public readonly openCount: number;
  public readonly openRightBounds: StorageTexture;
  public readonly openLeftBounds: StorageTexture;

  private readonly computeClosed: ShaderNodeFn<[]>;
  private readonly computeOpen: ShaderNodeFn<[]>;

  public constructor(magneticConnections: MagneticConnections) {
    this.closedCount = magneticConnections.closedConnections.length;
    this.closedUpperBounds = MagneticFieldLines.createBoundsTexture(MagneticFieldLines.CLOSED_LINE_RESOLUTION + 1, magneticConnections.closedConnections.length);
    this.closedLowerBounds = MagneticFieldLines.createBoundsTexture(MagneticFieldLines.CLOSED_LINE_RESOLUTION + 1, magneticConnections.closedConnections.length);

    this.computeClosed = Fn(() => {
      const connectionId = instanceIndex.mul(2).toVar();
      const connectionsBuffer = storage(magneticConnections.closedConnectionsBuffer, 'vec3');

      const firstPoint = connectionsBuffer.element(connectionId).toVar();
      const secondPoint = firstPoint.normalize().mul(MagneticFieldLines.HIGH_ALTITUDE_RADIUS).toVar();
      const fourthPoint = connectionsBuffer.element(connectionId.add(1)).toVar();
      const thirdPoint = fourthPoint.normalize().mul(MagneticFieldLines.HIGH_ALTITUDE_RADIUS).toVar();

      const rotationAxis = fourthPoint.sub(firstPoint).normalize().toVar();

      const secondPointUpperBound = HelperFunctions.rotate(secondPoint, rotationAxis, -MagneticFieldLines.CLOSED_LINE_ANGLE).toVar();
      const secondPointLowerBound = HelperFunctions.rotate(secondPoint, rotationAxis, MagneticFieldLines.CLOSED_LINE_ANGLE).toVar();
      const thirdPointUpperBound = HelperFunctions.rotate(thirdPoint, rotationAxis, -MagneticFieldLines.CLOSED_LINE_ANGLE).toVar();
      const thirdPointLowerBound = HelperFunctions.rotate(thirdPoint, rotationAxis, MagneticFieldLines.CLOSED_LINE_ANGLE).toVar();

      Loop(
        MagneticFieldLines.CLOSED_LINE_RESOLUTION + 1,
        ({ i }) => {
          const progress = float(i).mul(MagneticFieldLines.CLOSED_LINE_RESOLUTION_RECIPROCAL).toVar();
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
          textureStore(this.closedUpperBounds, uv, vec4(upperBoundPoint, upperAlpha));
          textureStore(this.closedLowerBounds, uv, vec4(lowerBoundPoint, lowerAlpha));
        }
      );
    });

    this.openCount = magneticConnections.openConnections.length;
    this.openRightBounds = MagneticFieldLines.createBoundsTexture(2, magneticConnections.openConnections.length);
    this.openLeftBounds = MagneticFieldLines.createBoundsTexture(2, magneticConnections.openConnections.length);

    this.computeOpen = Fn(() => {
      const connectionsBuffer = storage(magneticConnections.openConnectionsBuffer, 'vec3');
      const point = connectionsBuffer.element(instanceIndex).toVar();

      const rotationAxis = vec3(instanceIndex.mod(5).sub(2), instanceIndex.mod(7).sub(4), instanceIndex.mod(9).sub(4)).normalize().toVar();

      const leftPointLowerBound = HelperFunctions.rotate(point, rotationAxis, MagneticFieldLines.OPEN_LINE_ANGLE).toVar();
      const rightPointLowerBound = HelperFunctions.rotate(point, rotationAxis, -MagneticFieldLines.OPEN_LINE_ANGLE).toVar();
      const leftPointUpperBound = leftPointLowerBound.normalize().mul(MagneticFieldLines.HIGH_ALTITUDE_RADIUS).toVar();
      const rightPointUpperBound = rightPointLowerBound.normalize().mul(MagneticFieldLines.HIGH_ALTITUDE_RADIUS).toVar();

      textureStore(this.openLeftBounds, vec2(0, instanceIndex), vec4(leftPointLowerBound));
      textureStore(this.openLeftBounds, vec2(1, instanceIndex), vec4(rightPointLowerBound));
      textureStore(this.openRightBounds, vec2(0, instanceIndex), vec4(leftPointUpperBound));
      textureStore(this.openRightBounds, vec2(1, instanceIndex), vec4(rightPointUpperBound));
    });
  }

  public async updateAsync(renderer: WebGPURenderer): Promise<void> {
    await Promise.all([
      renderer.computeAsync(this.computeClosed().compute(this.closedCount)),
      renderer.computeAsync(this.computeOpen().compute(this.openCount))
    ]);
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