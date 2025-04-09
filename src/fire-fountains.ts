import { BufferAttribute, BufferGeometry, DoubleSide, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three';
import { attribute, Fn, mix, vec4 } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Settings } from './settings';
import { WaveLength } from './wave-length';

export class FireFountains extends InstancedMesh<BufferGeometry, MeshBasicNodeMaterial> {

  private constructor(geometry: BufferGeometry) {
    super(
      geometry,
      new MeshBasicNodeMaterial(
        {
          side: DoubleSide,
          transparent: true
        }
      ),
      1
    );

    const renderColor = Fn(() => {
      const radius = attribute('radius', 'float');
      const edgeAlpha = attribute('edgeAlpha', 'float');

      const coreColor = vec4(0.8, 0, 0, 1);
      const edgeColor = vec4(1, 1, 0, edgeAlpha);

      return mix(
        coreColor,
        edgeColor,
        radius.smoothstep(0.7, 0.98)
      );
    });

    this.material.outputNode = renderColor();

    const matrices = new Float32Array(this.count * 16);
    const position = new Vector3();
    const scale = new Vector3(1, 1, 1);
    const rotationXY = new Quaternion();
    const rotationZ = new Quaternion();
    const matrixXY = new Matrix4();
    const matrixZ = new Matrix4();
    const axisZ = new Vector3(0, 0, 1);

    let offset = 0;
    for (let i = 0; i < this.count; i++) {
      rotationXY.setFromAxisAngle(
        new Vector3(
          Math.random() * 2 - 1,
          Math.random() * 2 - 1,
          0
        ).normalize(),
        Math.PI * 2 * Math.random()
      );
      matrixXY.compose(position, rotationXY, scale);

      rotationZ.setFromAxisAngle(axisZ, Math.PI * 2 * Math.random());
      matrixZ.compose(position, rotationZ, scale);

      matrixXY.multiply(matrixZ);

      matrices.set(matrixXY.elements, offset);
      offset += 16;
    }

    this.instanceMatrix.set(matrices);
    this.instanceMatrix.needsUpdate = true;
  }

  public static create(): FireFountains {
    const points: Vector3[] = [];
    const indices: number[] = [];
    const radiuses: number[] = [];
    const edgeAlphas: number[] = [];
    const radius = 0.52;
    const stepCount = 200;
    const step = 2 / stepCount;
    let theta: number;

    edgeAlphas.push(0);
    radiuses.push(0);
    points.push(new Vector3());

    for (let i = 0; i < 2 - step; i += step) {
      theta = i * Math.PI;
      edgeAlphas.push(Math.max(0, (Math.random() - 0.5) * 0.2));
      radiuses.push(1);
      points.push(new Vector3(Math.sin(theta) * radius, Math.cos(theta) * radius, (Math.random() - 0.5) * 0.05));
    }

    indices.push(0);
    indices.push(1);
    indices.push(points.length - 1);

    for (let i = 1; i < points.length; i++) {
      indices.push(0);
      indices.push(i + 1);
      indices.push(i);
    }

    const geometry = new BufferGeometry().setFromPoints(points);
    geometry.setIndex(new BufferAttribute(new Int32Array(indices), 1));
    geometry.setAttribute('radius', new BufferAttribute(new Float32Array(radiuses), 1));
    geometry.setAttribute('edgeAlpha', new BufferAttribute(new Float32Array(edgeAlphas), 1));

    return new FireFountains(geometry);
  }

  public applySettings(settings: Settings): void {
    this.visible = settings.waveLength === WaveLength.AIA_304_A;
  }
}