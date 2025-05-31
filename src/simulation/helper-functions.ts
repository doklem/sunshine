import { Node, Vector3 } from 'three/webgpu';
import { Fn, mix, ShaderNodeObject, vec3, vec4 } from 'three/tsl';

export class HelperFunctions {
  public static readonly quadraticBezier = Fn<
    [
      ShaderNodeObject<Node>,
      ShaderNodeObject<Node>,
      ShaderNodeObject<Node>,
      ShaderNodeObject<Node>,
    ]
  >(([firstPoint, secondPoint, thirdPoint, progress]) => {
    return mix(
      mix(firstPoint, secondPoint, progress),
      mix(secondPoint, thirdPoint, progress),
      progress,
    );
  });

  public static readonly qubicBezier = Fn<
    [
      ShaderNodeObject<Node>,
      ShaderNodeObject<Node>,
      ShaderNodeObject<Node>,
      ShaderNodeObject<Node>,
      ShaderNodeObject<Node>,
    ]
  >(([firstPoint, secondPoint, thirdPoint, fourthPoint, progress]) => {
    return HelperFunctions.quadraticBezier(
      mix(firstPoint, secondPoint, progress),
      mix(secondPoint, thirdPoint, progress),
      mix(thirdPoint, fourthPoint, progress),
      progress,
    );
  });

  public static readonly rotate = Fn<
    [ShaderNodeObject<Node>, ShaderNodeObject<Node>, ShaderNodeObject<Node>]
  >(([vector, axis, angle]) => {
    const halfAngle = angle.mul(0.5).toVar();
    const q = vec4(axis.mul(halfAngle.sin()), halfAngle.cos()).toVar();
    const t = q.yzx.mul(vector.zxy).sub(q.zxy.mul(vector.yzx)).mul(2).toVar();
    return vector.add(t.mul(q.w)).add(q.yzx.mul(t.zxy)).sub(q.zxy.mul(t.yzx));
  });

  public static readonly uvToPointOnSphere = Fn<[ShaderNodeObject<Node>]>(
    ([uv]) => {
      const latitude = uv.y
        .mul(Math.PI)
        .sub(Math.PI / 2)
        .toVar(); // v -> [-π/2, π/2]
      const longitude = uv.x
        .mul(2 * Math.PI)
        .sub(Math.PI)
        .toVar(); // u -> [-π, π]
      return vec3(
        latitude.cos().mul(longitude.cos()).negate(),
        latitude.sin(),
        latitude.cos().mul(longitude.sin()),
      );
    },
  );

  public static closestPointOnLine(
    lineStart: Vector3,
    lineEnd: Vector3,
    point: Vector3,
  ): Vector3 {
    const aSide = point
      .clone()
      .sub(lineStart)
      .dot(lineEnd.clone().sub(lineStart));
    if (aSide < 0.0) {
      return lineStart;
    }

    const bSide = point
      .clone()
      .sub(lineEnd)
      .dot(lineStart.clone().sub(lineEnd));
    if (bSide < 0.0) {
      return lineEnd;
    }

    return lineStart
      .clone()
      .multiplyScalar(bSide)
      .add(lineEnd.clone().multiplyScalar(aSide))
      .divideScalar(Math.pow(lineStart.clone().sub(lineEnd).length(), 2));
  }

  public static distanceToLine(
    lineStart: Vector3,
    lineEnd: Vector3,
    point: Vector3,
  ): number {
    const closestPointOnLine = HelperFunctions.closestPointOnLine(
      lineStart,
      lineEnd,
      point,
    );
    return point.clone().sub(closestPointOnLine).length();
  }
}
