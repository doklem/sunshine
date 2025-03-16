import { BufferGeometry, ClampToEdgeWrapping, Data3DTexture, DataTexture, FloatType, LinearFilter, Mesh, RedFormat, RepeatWrapping, RGBAFormat, SphereGeometry, Vector3 } from 'three';
import { Fn, normalLocal, ShaderNodeObject, texture, texture3D, uniform, vec2 } from 'three/tsl';
import { MeshBasicNodeMaterial, UniformNode } from 'three/webgpu';

export class Surface extends Mesh<BufferGeometry, MeshBasicNodeMaterial> {

  private static readonly TURBULENCE_SIZE = 32;
  private static readonly VORONOI_SIZE = 64;
  private static readonly VORONOI_SIZE_RECIPROCAL = 1 / Surface.VORONOI_SIZE;
  private static readonly COLOR_GRADIENT = new Uint8Array([
    255, 192, 0, 255,
    255, 70, 0, 255,
    255, 50, 0, 255,
    205, 40, 0, 255,
    155, 20, 0, 255,
    75, 16, 0, 255,
    20, 4, 0, 255,
    10, 2, 0, 255
  ]);

  public readonly time: ShaderNodeObject<UniformNode<number>>;

  private constructor(voronoiTexture: Data3DTexture, turbulenceTexture: Data3DTexture) {
    super(new SphereGeometry(0.5, 50, 50), new MeshBasicNodeMaterial());
    this.time = uniform(0);

    const colorGradientTexture = new DataTexture(Surface.COLOR_GRADIENT, Surface.COLOR_GRADIENT.length * 0.25, 1);
    colorGradientTexture.format = RGBAFormat;
    colorGradientTexture.minFilter = LinearFilter;
    colorGradientTexture.magFilter = LinearFilter;
    colorGradientTexture.wrapS = ClampToEdgeWrapping;
    colorGradientTexture.wrapT = ClampToEdgeWrapping;
    colorGradientTexture.generateMipmaps = true;
    colorGradientTexture.needsUpdate = true;

    const renderColor = Fn(() => {
      const timeOffset = texture3D(turbulenceTexture, normalLocal.mul(0.5)).a;
      const time = this.time.mul(0.001).add(timeOffset).sin().mul(0.1).add(12);

      const heatOffset = texture3D(turbulenceTexture, normalLocal.mul(10).add(this.time.mul(0.00001)));
      const heat = texture3D(voronoiTexture, normalLocal.mul(time).add(heatOffset)).r;

      return texture(colorGradientTexture, vec2(heat, 0.5));
    });

    this.material.outputNode = renderColor();
  }

  public static async createAsync(): Promise<Surface> {
    return new Surface(Surface.createVoronoiTexture3D(), Surface.createTurbulenceTexture3D());
  }

  private static createVoronoiTexture3D(): Data3DTexture {
    const points: Vector3[] = [];

    const step = 0.1;
    const originVector = new Vector3();
    let point: Vector3;
    let x: number;
    let y: number;
    let z: number;
    for (z = 0; z < 1; z += step) {
      for (y = 0; y < 1; y += step) {
        for (x = 0; x < 1; x += step) {
          point = new Vector3(step, step, step)
            .multiply(new Vector3(Math.random(), Math.random(), Math.random()))
            .add(originVector.set(x, y, z));
          points.push(point);

          point = new Vector3(step, step, step)
            .multiply(new Vector3(Math.random(), Math.random(), Math.random()))
            .add(originVector.set(x, y, z));
          points.push(point);
        }
      }
    }

    let offset = 0;
    const data = new Float32Array(Surface.VORONOI_SIZE * Surface.VORONOI_SIZE * Surface.VORONOI_SIZE);

    let distance: number;
    let distance0: number;
    let distance1: number;
    let distance2: number;
    for (z = 0; z < Surface.VORONOI_SIZE; z++) {
      for (y = 0; y < Surface.VORONOI_SIZE; y++) {
        for (x = 0; x < Surface.VORONOI_SIZE; x++) {
          point = new Vector3(x, y, z).multiplyScalar(Surface.VORONOI_SIZE_RECIPROCAL);

          distance1 = Number.MAX_SAFE_INTEGER;
          distance2 = Number.MAX_SAFE_INTEGER;
          for (let i = 0; i < points.length; i++) {
            distance0 = points[i].distanceToSquared(point);
            if (distance0 < distance1) {
              distance2 = distance1;
              distance1 = distance0;
            }
          }

          distance = distance1 / distance2;
          data[offset] = distance;
          offset++;
        }
      }
    }

    const texture = new Data3DTexture(data, Surface.VORONOI_SIZE, Surface.VORONOI_SIZE, Surface.VORONOI_SIZE);
    texture.format = RedFormat;
    texture.type = FloatType;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.wrapR = RepeatWrapping;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;
    return texture;
  }

  private static createTurbulenceTexture3D(): Data3DTexture {
    const data = new Float32Array(Surface.TURBULENCE_SIZE * Surface.TURBULENCE_SIZE * Surface.TURBULENCE_SIZE * 4);

    for (let offset = 0; offset < data.length; offset += 4) {
      data[offset] = (Math.random() - 0.5) * 0.05;
      data[offset + 1] = (Math.random() - 0.5) * 0.05;
      data[offset + 2] = (Math.random() - 0.5) * 0.05;
      data[offset + 3] = Math.random() * 10;
    }

    const texture = new Data3DTexture(data, Surface.TURBULENCE_SIZE, Surface.TURBULENCE_SIZE, Surface.TURBULENCE_SIZE);
    texture.format = RGBAFormat;
    texture.type = FloatType;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.wrapR = RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  }
}