import { Vector3 } from 'three';
import { StorageBufferAttribute } from 'three/webgpu';
import { MagneticPoles } from './magnetic-poles';
import { HelperFunctions } from './helper-functions';

export class MagneticConnections {

  private static readonly VECTOR_SIZE = 3;
  private static readonly MIN_OPEN_CONNECTION_DISTANCE = 0.08;
  private static readonly MIN_CLOSED_CONNECTION_DISTANCE = 0.001;
  private static readonly MAX_CLOSED_CONNECTION_DISTANCE = 0.02;

  public readonly closedConnections: Vector3[][];
  public readonly closedConnectionsBuffer: StorageBufferAttribute;

  public readonly openConnections: Vector3[];
  public readonly openConnectionsBuffer: StorageBufferAttribute;

  public constructor(magneticPoles: MagneticPoles) {
    this.closedConnections = [];
    let distance: number;
    let northPoles = [...magneticPoles.northPoles];
    magneticPoles.southPoles.forEach(southPole => {
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