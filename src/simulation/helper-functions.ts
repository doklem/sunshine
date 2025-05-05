import { Node, Vector3 } from 'three/webgpu';
import { Fn, mix, ShaderNodeObject, vec3 } from 'three/tsl';

export class HelperFunctions {

  public static readonly quadraticBezier = Fn<[
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>
  ]>(([firstPoint, secondPoint, thirdPoint, progress]) => {
    const firstHigherPoint = mix(firstPoint, secondPoint, progress).toVar();
    const secondHigherPoint = mix(secondPoint, thirdPoint, progress).toVar();
    return mix(firstHigherPoint, secondHigherPoint, progress);
  });

  public static readonly qubicBezier = Fn<[
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>
  ]>(([firstPoint, secondPoint, thirdPoint, fourthPoint, progress]) => {
    const firstHigherPoint = mix(firstPoint, secondPoint, progress).toVar();
    const secondHigherPoint = mix(secondPoint, thirdPoint, progress).toVar();
    const thirdHigherPoint = mix(thirdPoint, fourthPoint, progress).toVar();
    return HelperFunctions.quadraticBezier(firstHigherPoint, secondHigherPoint, thirdHigherPoint, progress);
  });

  public static readonly rotate = Fn<[
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>,
    ShaderNodeObject<Node>
  ]>(([vector, axis, angle]) => {
    const halfAngle = angle.mul(0.5).toVar();
    const s = halfAngle.sin().toVar();

    const x = axis.x.mul(s).toVar();
    const y = axis.y.mul(s).toVar();
    const z = axis.z.mul(s).toVar();
    const w = halfAngle.cos();

    const tx = y.mul(vector.z).sub(z.mul(vector.y)).mul(2).toVar();
    const ty = z.mul(vector.x).sub(x.mul(vector.z)).mul(2).toVar();
    const tz = x.mul(vector.y).sub(y.mul(vector.x)).mul(2).toVar();

    return vec3(
      vector.x.add(w.mul(tx)).add(y.mul(tz)).sub(z.mul(ty)),
      vector.y.add(w.mul(ty)).add(z.mul(tx)).sub(x.mul(tz)),
      vector.z.add(w.mul(tz)).add(x.mul(ty)).sub(y.mul(tx))
    );
  });

  public static closestPointOnLine(lineStart: Vector3, lineEnd: Vector3, point: Vector3): Vector3 {
    const aSide = point.clone().sub(lineStart).dot(lineEnd.clone().sub(lineStart));
    if (aSide < 0.0) {
      return lineStart;
    }

    const bSide = point.clone().sub(lineEnd).dot(lineStart.clone().sub(lineEnd));
    if (bSide < 0.0) {
      return lineEnd;
    }

    return lineStart.clone().multiplyScalar(bSide).add(lineEnd.clone().multiplyScalar(aSide)).divideScalar(Math.pow(lineStart.clone().sub(lineEnd).length(), 2));
  }

  public static distanceToLine(lineStart: Vector3, lineEnd: Vector3, point: Vector3): number {
    const closestPointOnLine = HelperFunctions.closestPointOnLine(lineStart, lineEnd, point);
    return point.clone().sub(closestPointOnLine).length();
    /*const aSide = point.clone().sub(lineStart).dot(lineEnd.clone().sub(lineStart));
    if (aSide < 0.0) {
      return point.clone().sub(lineStart).length();
    }

    const bSide = point.clone().sub(lineEnd).dot(lineStart.clone().sub(lineEnd));
    if (bSide < 0.0) {
      return point.clone().sub(lineEnd).length();
    }

    const pointOnLine = lineStart.clone().multiplyScalar(bSide).add(lineEnd.clone().multiplyScalar(aSide)).divideScalar(Math.pow(lineStart.clone().sub(lineEnd).length(), 2));
    return point.clone().sub(pointOnLine).length();*/
  }
}