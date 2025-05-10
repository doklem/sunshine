import { ClampToEdgeWrapping, FloatType, LinearFilter, RGBAFormat, Texture } from 'three';
import { Surface } from '../meshes/surface';
import { StorageBufferAttribute, StorageTexture, WebGPURenderer } from 'three/webgpu';
import { float, Fn, instanceIndex, Loop, mix, storage, textureStore, vec2, vec3, vec4 } from 'three/tsl';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { MagneticConnections } from './magnetic-connections';
import { HelperFunctions } from './helper-functions';

export class MagneticFieldLines {

  public static readonly CLOSED_LINE_RESOLUTION = 64;
  public static readonly OPEN_LINE_RESOLUTION = 4;
  public static readonly CLOSED_LARGE_HIGH_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 1.4;
  public static readonly OPEN_HIGH_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 1.5;

  private static readonly CLOSED_SMALL_HIGH_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 1.1;
  private static readonly CLOSED_MEDIUM_HIGH_ALTITUDE_RADIUS = Surface.GEOMETRY_RADIUS * 1.2;
  private static readonly CLOSED_LINE_RESOLUTION_RECIPROCAL = 1 / MagneticFieldLines.CLOSED_LINE_RESOLUTION;
  private static readonly CLOSED_LINE_HIGHT_VARIANCE = 0.2;
  private static readonly CLOSED_MEDIUM_LINE_STRETCH = 0.1;
  private static readonly CLOSED_LARGE_LINE_STRETCH = 0.2;
  private static readonly OPEN_LINE_RESOLUTION_RECIPROCAL = 1 / MagneticFieldLines.OPEN_LINE_RESOLUTION;
  private static readonly CLOSED_SMALL_LINE_MIN_ANGLE = Math.PI * 0.01;
  private static readonly CLOSED_MEDIUM_LINE_MIN_ANGLE = Math.PI * 0.03;
  private static readonly CLOSED_LARGE_LINE_MIN_ANGLE = Math.PI * 0.04;
  private static readonly OPEN_LINE_ANGLE = Math.PI * 0.04;
  private static readonly CLOSED_LOW_ALTITUDE_STIFFNESS = Math.pow(Surface.GEOMETRY_RADIUS * 1.02, 2);
  private static readonly CLOSED_HIGH_ALTITUDE_STIFFNESS = Math.pow(Surface.GEOMETRY_RADIUS * 1.5, 2);

  public readonly closedCount: number;
  public readonly closedLeftBounds: Texture;
  public readonly closedRightBounds: Texture;
  public readonly openCount: number;
  public readonly openLeftBounds: Texture;
  public readonly openRightBounds: Texture;

  private readonly computeSmallClosed: ShaderNodeFn<[]>;
  private readonly computeMediumClosed: ShaderNodeFn<[]>;
  private readonly computeLargeClosed: ShaderNodeFn<[]>;
  private readonly computeOpen: ShaderNodeFn<[]>;

  public constructor(private readonly magneticConnections: MagneticConnections) {
    this.closedCount = magneticConnections.closedConnections.length * 3; // Small, medium and large lines
    this.closedLeftBounds = MagneticFieldLines.createBoundsTexture(MagneticFieldLines.CLOSED_LINE_RESOLUTION, this.closedCount);
    this.closedRightBounds = MagneticFieldLines.createBoundsTexture(MagneticFieldLines.CLOSED_LINE_RESOLUTION, this.closedCount);
    this.computeSmallClosed = this.createComputeClosed(
      magneticConnections.closedConnectionsBuffer,
      0,
      MagneticFieldLines.CLOSED_SMALL_HIGH_ALTITUDE_RADIUS,
      MagneticFieldLines.CLOSED_SMALL_LINE_MIN_ANGLE
    );
    this.computeMediumClosed = this.createComputeClosed(
      magneticConnections.closedConnectionsBuffer,
      this.magneticConnections.closedConnections.length,
      MagneticFieldLines.CLOSED_MEDIUM_HIGH_ALTITUDE_RADIUS,
      MagneticFieldLines.CLOSED_MEDIUM_LINE_MIN_ANGLE,
      MagneticFieldLines.CLOSED_MEDIUM_LINE_STRETCH,
    );
    this.computeLargeClosed = this.createComputeClosed(
      magneticConnections.closedConnectionsBuffer,
      this.magneticConnections.closedConnections.length * 2,
      MagneticFieldLines.CLOSED_LARGE_HIGH_ALTITUDE_RADIUS,
      MagneticFieldLines.CLOSED_LARGE_LINE_MIN_ANGLE,
      MagneticFieldLines.CLOSED_LARGE_LINE_STRETCH
    );

    this.openCount = magneticConnections.openConnections.length;
    this.openLeftBounds = MagneticFieldLines.createBoundsTexture(MagneticFieldLines.OPEN_LINE_RESOLUTION, magneticConnections.openConnections.length);
    this.openRightBounds = MagneticFieldLines.createBoundsTexture(MagneticFieldLines.OPEN_LINE_RESOLUTION, magneticConnections.openConnections.length);
    this.computeOpen = Fn(() => {
      const connectionsBuffer = storage(magneticConnections.openConnectionsBuffer, 'vec3');
      const point = connectionsBuffer.element(instanceIndex).toVar();

      const rotationAxis = vec3(instanceIndex.mod(5).sub(2), instanceIndex.mod(7).sub(4), instanceIndex.mod(9).sub(4)).normalize().toVar();

      const leftPointLow = HelperFunctions.rotate(point, rotationAxis, MagneticFieldLines.OPEN_LINE_ANGLE).toVar();
      const rightPointLow = HelperFunctions.rotate(point, rotationAxis, -MagneticFieldLines.OPEN_LINE_ANGLE).toVar();
      const leftPointHigh = leftPointLow.normalize().mul(MagneticFieldLines.OPEN_HIGH_ALTITUDE_RADIUS).toVar();
      const rightPointHigh = rightPointLow.normalize().mul(MagneticFieldLines.OPEN_HIGH_ALTITUDE_RADIUS).toVar();

      Loop(
        MagneticFieldLines.OPEN_LINE_RESOLUTION + 1,
        ({ i }) => {
          const progress = float(i).mul(MagneticFieldLines.OPEN_LINE_RESOLUTION_RECIPROCAL).toVar();
          const rightPoint = mix(rightPointLow, rightPointHigh, progress);
          const leftPoint = mix(leftPointLow, leftPointHigh, progress);
          const leftStiffness = leftPoint.lengthSq().smoothstep(MagneticFieldLines.CLOSED_HIGH_ALTITUDE_STIFFNESS, MagneticFieldLines.CLOSED_LOW_ALTITUDE_STIFFNESS);
          const rightStiffness = rightPoint.lengthSq().smoothstep(MagneticFieldLines.CLOSED_HIGH_ALTITUDE_STIFFNESS, MagneticFieldLines.CLOSED_LOW_ALTITUDE_STIFFNESS);
          const uv = vec2(i, instanceIndex).toVar();
          textureStore(this.openLeftBounds, uv, vec4(leftPoint, leftStiffness));
          textureStore(this.openRightBounds, uv, vec4(rightPoint, rightStiffness));
        }
      );
    });
  }

  public async updateAsync(renderer: WebGPURenderer): Promise<void> {
    await Promise.all([
      renderer.computeAsync(this.computeSmallClosed().compute(this.magneticConnections.closedConnections.length)),
      renderer.computeAsync(this.computeMediumClosed().compute(this.magneticConnections.closedConnections.length)),
      renderer.computeAsync(this.computeLargeClosed().compute(this.magneticConnections.closedConnections.length)),
      renderer.computeAsync(this.computeOpen().compute(this.openCount))
    ]);
  }

  private createComputeClosed(
    connectionsBufferAttribute: StorageBufferAttribute,
    offset: number,
    highRadius: number,
    minLineAngle: number,
    lineStretch?: number): ShaderNodeFn<[]> {
    return Fn(() => {
      const lineId = instanceIndex.add(offset).toVar();
      const connectionId = instanceIndex.mul(2).toVar();
      const connectionsBuffer = storage(connectionsBufferAttribute, 'vec3');

      const firstPoint = connectionsBuffer.element(connectionId).toVar();
      const fourthPoint = connectionsBuffer.element(connectionId.add(1)).toVar();

      const rotationAxis = fourthPoint.sub(firstPoint).normalize().toVar();
      const rotationAngle = float(lineId).mul(0.26).fract().mul(0.1).add(minLineAngle).toVar();

      const secondPointLeft = HelperFunctions.rotate(firstPoint, rotationAxis, rotationAngle.negate())
        .normalize().mul(float(lineId).mul(0.31).fract().mul(MagneticFieldLines.CLOSED_LINE_HIGHT_VARIANCE).add(highRadius))
        .toVar();
      const secondPointRight = HelperFunctions.rotate(firstPoint, rotationAxis, rotationAngle)
        .normalize().mul(float(lineId).mul(0.42).fract().mul(MagneticFieldLines.CLOSED_LINE_HIGHT_VARIANCE).add(highRadius))
        .toVar();
      const thirdPointLeft = HelperFunctions.rotate(fourthPoint, rotationAxis, rotationAngle.negate())
        .normalize().mul(float(lineId).mul(0.53).fract().mul(MagneticFieldLines.CLOSED_LINE_HIGHT_VARIANCE).add(highRadius))
        .toVar();
      const thirdPointRight = HelperFunctions.rotate(fourthPoint, rotationAxis, rotationAngle)
        .normalize().mul(float(lineId).div(0.64).fract().mul(MagneticFieldLines.CLOSED_LINE_HIGHT_VARIANCE).add(highRadius))
        .toVar();

      if (lineStretch !== undefined) {
        const stretchAxis = secondPointLeft.sub(thirdPointLeft).normalize().mul(lineStretch).toVar();
        secondPointLeft.addAssign(stretchAxis);
        thirdPointLeft.addAssign(stretchAxis.negate());

        stretchAxis.assign(secondPointRight.sub(thirdPointRight).normalize().mul(lineStretch));
        secondPointRight.addAssign(stretchAxis);
        thirdPointRight.addAssign(stretchAxis.negate());
      }

      Loop(
        MagneticFieldLines.CLOSED_LINE_RESOLUTION + 1,
        ({ i }) => {
          const progress = float(i).mul(MagneticFieldLines.CLOSED_LINE_RESOLUTION_RECIPROCAL).toVar();
          const leftPoint = HelperFunctions.qubicBezier(
            firstPoint,
            secondPointLeft,
            thirdPointLeft,
            fourthPoint,
            progress
          );
          const rightPoint = HelperFunctions.qubicBezier(
            firstPoint,
            secondPointRight,
            thirdPointRight,
            fourthPoint,
            progress
          );
          const leftStiffness = leftPoint.lengthSq().smoothstep(MagneticFieldLines.CLOSED_HIGH_ALTITUDE_STIFFNESS, MagneticFieldLines.CLOSED_LOW_ALTITUDE_STIFFNESS);
          const rightStiffness = rightPoint.lengthSq().smoothstep(MagneticFieldLines.CLOSED_HIGH_ALTITUDE_STIFFNESS, MagneticFieldLines.CLOSED_LOW_ALTITUDE_STIFFNESS);
          const uv = vec2(i, lineId).toVar();
          textureStore(this.closedLeftBounds, uv, vec4(leftPoint, leftStiffness));
          textureStore(this.closedRightBounds, uv, vec4(rightPoint, rightStiffness));
        }
      );
    });
  }

  private static createBoundsTexture(width: number, height: number): Texture {
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