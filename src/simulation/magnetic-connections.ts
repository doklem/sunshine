import { ClampToEdgeWrapping, FloatType, LinearFilter, RedFormat, Vector3 } from 'three';
import { StorageBufferAttribute, StorageTexture, WebGPURenderer } from 'three/webgpu';
import { MagneticPoles } from './magnetic-poles';
import { HelperFunctions } from './helper-functions';
import { ShaderNodeFn } from 'three/src/nodes/TSL.js';
import { float, Fn, instanceIndex, Loop, min, storage, textureStore, vec2 } from 'three/tsl';

export class MagneticConnections {

  private static readonly VECTOR_SIZE = 3;
  private static readonly MIN_OPEN_CONNECTION_DISTANCE = 0.08;
  private static readonly MIN_CLOSED_CONNECTION_DISTANCE = 0.001;
  private static readonly MAX_CLOSED_CONNECTION_DISTANCE = 0.02;
  private static readonly SUNSPOTS_TEXTURE_SIZE = 1024;
  private static readonly SUNSPOTS_TEXTURE_SIZE_RECIPROCAL = 1 / MagneticConnections.SUNSPOTS_TEXTURE_SIZE;
  private static readonly SUNSPOTS_START = 0.2755;
  private static readonly SUNSPOTS_END = MagneticConnections.SUNSPOTS_START + 0.001;

  public readonly closedConnections: Vector3[][];
  public readonly closedConnectionsBuffer: StorageBufferAttribute;

  public readonly openConnections: Vector3[];
  public readonly openConnectionsBuffer: StorageBufferAttribute;

  public readonly sunspotsTexture: StorageTexture;

  private readonly computeSunspots: ShaderNodeFn<[]>;

  public constructor(magneticPoles: MagneticPoles) {
    this.closedConnections = [];
    let distance: number;
    let northPoles = [...magneticPoles.northPoles];
    let southPoles = [...magneticPoles.southPoles];
    for (let i = 2; i < 10; i++) {
      const split = Math.floor(magneticPoles.southPoles.length / i);
      southPoles = southPoles.slice(split).concat(southPoles.slice(0, split).reverse());
    }

    southPoles.forEach(southPole => {
      let closestNorthPole: Vector3 | undefined;
      let closestDistance = Number.MAX_SAFE_INTEGER;

      northPoles.forEach(northPole => {
        distance = northPole.distanceToSquared(southPole);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestNorthPole = northPole;
        }
      });

      if (closestNorthPole
        && MagneticConnections.MIN_CLOSED_CONNECTION_DISTANCE < closestDistance
        && closestDistance < MagneticConnections.MAX_CLOSED_CONNECTION_DISTANCE) {
        this.closedConnections.push([closestNorthPole, southPole]);
        northPoles.splice(northPoles.indexOf(closestNorthPole), 1);
      }
    });

    this.closedConnectionsBuffer = new StorageBufferAttribute(
      new Float32Array(this.closedConnections.flatMap(connection => [
        connection[0].x, connection[0].y, connection[0].z,
        connection[1].x, connection[1].y, connection[1].z
      ])),
      MagneticConnections.VECTOR_SIZE
    );

    this.openConnections = magneticPoles.southPoles
      .filter(pole => MagneticConnections.validOpenConnection(pole, this.closedConnections)).flatMap(pole => [pole, pole]);
    this.openConnectionsBuffer = new StorageBufferAttribute(
      new Float32Array(this.openConnections.flatMap(pole => pole.toArray())),
      MagneticConnections.VECTOR_SIZE
    );

    this.sunspotsTexture = new StorageTexture(MagneticConnections.SUNSPOTS_TEXTURE_SIZE, MagneticConnections.SUNSPOTS_TEXTURE_SIZE);
    this.sunspotsTexture.format = RedFormat;
    this.sunspotsTexture.type = FloatType;
    this.sunspotsTexture.unpackAlignment = 1;
    this.sunspotsTexture.wrapS = ClampToEdgeWrapping;
    this.sunspotsTexture.wrapT = ClampToEdgeWrapping;
    this.sunspotsTexture.minFilter = LinearFilter;
    this.sunspotsTexture.magFilter = LinearFilter;
    this.sunspotsTexture.needsUpdate = true;

    this.computeSunspots = Fn(() => {
      const pixelCoordinates = vec2(
        instanceIndex.mod(MagneticConnections.SUNSPOTS_TEXTURE_SIZE),
        instanceIndex.div(MagneticConnections.SUNSPOTS_TEXTURE_SIZE)
      ).toVar();

      const uv = vec2(
        float(pixelCoordinates.x),
        float(instanceIndex).mul(MagneticConnections.SUNSPOTS_TEXTURE_SIZE_RECIPROCAL)
      ).mul(MagneticConnections.SUNSPOTS_TEXTURE_SIZE_RECIPROCAL).toVar();

      const pointOnSphere = HelperFunctions.uvToPointOnSphere(uv);

      const shortestDistanceSq = float(1).toVar();
      Loop(this.closedConnections.length * 2,
        ({ i }) => {
          const pole = storage(this.closedConnectionsBuffer, 'vec3').element(i);
          const distanceSq = pole.sub(pointOnSphere).lengthSq();
          shortestDistanceSq.assign(min(shortestDistanceSq, distanceSq));
        }
      );

      textureStore(
        this.sunspotsTexture,
        pixelCoordinates,
        shortestDistanceSq.smoothstep(MagneticConnections.SUNSPOTS_END, MagneticConnections.SUNSPOTS_START)
      );
    });
  }

  public async updateAsync(renderer: WebGPURenderer): Promise<void> {
    await renderer.computeAsync(this.computeSunspots().compute(MagneticConnections.SUNSPOTS_TEXTURE_SIZE * MagneticConnections.SUNSPOTS_TEXTURE_SIZE));
  }

  private static validOpenConnection(pole: Vector3, closedConnections: Vector3[][]): boolean {
    let closedConnection: Vector3[];
    for (let i = 0; i < closedConnections.length; i++) {
      closedConnection = closedConnections[i];
      if (closedConnection[0] === pole || closedConnection[1] === pole) {
        return false;
      }

      if (HelperFunctions.distanceToLine(closedConnection[0], closedConnection[1], pole) < MagneticConnections.MIN_OPEN_CONNECTION_DISTANCE) {
        return false;
      }

    }
    return true;
  }
}