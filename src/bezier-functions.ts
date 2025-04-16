import { Fn, mix, ShaderNodeObject } from 'three/tsl';
import { Node } from 'three/webgpu';

export class BezierFunctions {
  public static readonly QUADRATIC_CURVE = Fn<[ShaderNodeObject<Node>, ShaderNodeObject<Node>, ShaderNodeObject<Node>, ShaderNodeObject<Node>]>
    (([firstControlPoint, secondControlPoint, thridControlPoint, progress]) => {
      const firstPosition = mix(firstControlPoint, secondControlPoint, progress);
      const secondPosition = mix(secondControlPoint, thridControlPoint, progress);
      return mix(firstPosition, secondPosition, progress);
    });

  public static readonly QUBIC_CURVE = Fn<[ShaderNodeObject<Node>, ShaderNodeObject<Node>, ShaderNodeObject<Node>, ShaderNodeObject<Node>, ShaderNodeObject<Node>]>
    (([firstControlPoint, secondControlPoint, thridControlPoint, fourthControlPoint, progress]) => {
      const firstLowerPosition = mix(firstControlPoint, secondControlPoint, progress);
      const secondLowerPosition = mix(secondControlPoint, thridControlPoint, progress);
      const thridLowerPosition = mix(thridControlPoint, fourthControlPoint, progress);

      const firstHigherPosition = mix(firstLowerPosition, secondLowerPosition, progress);
      const secondHigherPosition = mix(secondLowerPosition, thridLowerPosition, progress);
      return mix(firstHigherPosition, secondHigherPosition, progress);
    });
}