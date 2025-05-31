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

  public constructor(
    magneticPoles: MagneticPoles,
    magneticConnections: MagneticConnections,
  ) {
    super();
    this.configurableDebugElements = [];

    let debugElement: Configurable & Object3D;
    debugElement = new DebugSprites(
      magneticPoles.northPoles,
      vec4(0, 0, 1, 1),
      (settings: Settings) => settings.magentosphre.northPoles,
      MagneticPoles.POLE_ALTITUDE_RADIUS,
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugSprites(
      magneticPoles.southPoles,
      vec4(1, 0, 0, 1),
      (settings: Settings) => settings.magentosphre.southPoles,
      MagneticPoles.POLE_ALTITUDE_RADIUS,
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugLineSegments(
      magneticConnections.closedConnections.flat(),
      vec4(0, 0.3, 0, 1),
      (settings: Settings) => settings.magentosphre.closedConnections,
      MagneticFieldLines.CLOSED_LARGE_HIGH_ALTITUDE_RADIUS,
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugLineSegments(
      magneticConnections.openConnections.flatMap((pole) => [
        pole,
        pole
          .clone()
          .normalize()
          .multiplyScalar(MagneticFieldLines.OPEN_HIGH_ALTITUDE_RADIUS),
      ]),
      vec4(0.3, 0.3, 0, 1),
      (settings: Settings) => settings.magentosphre.openConnections,
      MagneticFieldLines.OPEN_HIGH_ALTITUDE_RADIUS,
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);
  }

  public addCurves(magneticFieldLines: MagneticFieldLines): void {
    let debugElement: Configurable & Object3D;
    debugElement = new DebugCurves(
      magneticFieldLines.closedRightBounds,
      magneticFieldLines.closedCount,
      vec4(0, 1, 0, 1),
      (settings: Settings) => settings.magentosphre.closedMagenticFieldLines,
      MagneticFieldLines.CLOSED_LINE_RESOLUTION,
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugCurves(
      magneticFieldLines.closedLeftBounds,
      magneticFieldLines.closedCount,
      vec4(0, 1, 0, 1),
      (settings: Settings) => settings.magentosphre.closedMagenticFieldLines,
      MagneticFieldLines.CLOSED_LINE_RESOLUTION,
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugCurves(
      magneticFieldLines.openRightBounds,
      magneticFieldLines.openCount,
      vec4(1, 1, 0, 1),
      (settings: Settings) => settings.magentosphre.openMagenticFieldLines,
      MagneticFieldLines.OPEN_LINE_RESOLUTION,
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);

    debugElement = new DebugCurves(
      magneticFieldLines.openLeftBounds,
      magneticFieldLines.openCount,
      vec4(1, 1, 0, 1),
      (settings: Settings) => settings.magentosphre.openMagenticFieldLines,
      MagneticFieldLines.OPEN_LINE_RESOLUTION,
    );
    this.add(debugElement);
    this.configurableDebugElements.push(debugElement);
  }

  public applySettings(settings: Settings): void {
    this.children.forEach((child) => {
      const debugElement = child as unknown as Configurable;
      if (debugElement) {
        debugElement.applySettings(settings);
      }
    });
  }
}
