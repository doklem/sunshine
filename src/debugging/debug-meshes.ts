import { Group, Object3D } from 'three';
import { DebugSprites } from './debug-sprites';
import { DebugLineSegments } from './debug-line-segments';
import { DebugCurves } from './debug-curves';
import { MagneticPoles } from '../simulation/magnetic-poles';
import { MagneticConnections } from '../simulation/magnetic-connections';
import { Settings } from '../configuration/settings';
import { vec4 } from 'three/tsl';
import { MagneticFieldLines } from '../simulation/magnetic-field-lines';
import { Configurable } from '../configuration/configurable';

export class DebugMeshes extends Group implements Configurable {

  private readonly configurableDebugElements: Configurable[];

  public constructor(magneticPoles: MagneticPoles, magneticConnections: MagneticConnections) {
    super();
    this.configurableDebugElements = [];

    let debugElement: Configurable & Object3D;
    debugElement = new DebugSprites(
      magneticPoles.northPoles,
      vec4(0, 0, 1, 1),
      (settings: Settings) => settings.magentosphre.northPoles,
      MagneticPoles.POLE_ALTITUDE_RADIUS
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugSprites(
      magneticPoles.southPoles,
      vec4(1, 0, 0, 1),
      (settings: Settings) => settings.magentosphre.southPoles,
      MagneticPoles.POLE_ALTITUDE_RADIUS
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugLineSegments(
      magneticConnections.closedConnections.flat(),
      vec4(0, 0.3, 0, 1),
      (settings: Settings) => settings.magentosphre.closedConnections,
      MagneticFieldLines.HIGH_ALTITUDE_RADIUS
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugLineSegments(
      magneticConnections.openConnections.flatMap(pole => [pole, pole.clone().normalize().multiplyScalar(MagneticFieldLines.HIGH_ALTITUDE_RADIUS)]),
      vec4(0.3, 0.3, 0, 1),
      (settings: Settings) => settings.magentosphre.openConnections,
      MagneticFieldLines.HIGH_ALTITUDE_RADIUS
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);
  }

  public addCurves(magneticFieldLines: MagneticFieldLines): void {
    let debugElement: Configurable & Object3D;
    debugElement = new DebugCurves(
      magneticFieldLines.closedLowerBounds,
      magneticFieldLines.closedCount,
      vec4(0, 1, 0, 1),
      (settings: Settings) => settings.magentosphre.closedMagenticFieldLines,
      MagneticPoles.POLE_ALTITUDE_RADIUS,
      MagneticFieldLines.CLOSED_LINE_RESOLUTION
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugCurves(
      magneticFieldLines.closedUpperBounds,
      magneticFieldLines.closedCount,
      vec4(0, 1, 0, 1),
      (settings: Settings) => settings.magentosphre.closedMagenticFieldLines,
      MagneticFieldLines.HIGH_ALTITUDE_RADIUS,
      MagneticFieldLines.CLOSED_LINE_RESOLUTION
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugCurves(
      magneticFieldLines.openLowerBounds,
      magneticFieldLines.openCount,
      vec4(1, 1, 0, 1),
      (settings: Settings) => settings.magentosphre.openMagenticFieldLines,
      MagneticPoles.POLE_ALTITUDE_RADIUS,
      MagneticFieldLines.OPEN_LINE_RESOLUTION
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugCurves(
      magneticFieldLines.openUpperBounds,
      magneticFieldLines.openCount,
      vec4(1, 1, 0, 1),
      (settings: Settings) => settings.magentosphre.openMagenticFieldLines,
      MagneticFieldLines.HIGH_ALTITUDE_RADIUS,
      MagneticFieldLines.OPEN_LINE_RESOLUTION
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);
  }

  public applySettings(settings: Settings): void {
    this.children.forEach(child => {
      const debugElement = child as unknown as Configurable;
      if (debugElement) {
        debugElement.applySettings(settings);
      }
    });
  }
}