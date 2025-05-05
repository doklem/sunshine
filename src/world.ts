import Stats from 'stats-gl';
import { Object3D, PerspectiveCamera, Scene, TextureLoader } from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { PostProcessing, WebGPURenderer } from 'three/webgpu';
import { Surface } from './meshes/surface';
import { pass } from 'three/tsl';
import BloomNode from 'three/examples/jsm/tsl/display/BloomNode.js';
import { Settings } from './configuration/settings';
import { NoiseTextureHelper } from './noise-texture-helper';
import { MagneticFieldLines } from './simulation/magnetic-field-lines';
import { MagneticPoles } from './simulation/magnetic-poles';
import { MagneticConnections } from './simulation/magnetic-connections';
import { Instrument } from './configuration/instrument';
import { Flares } from './meshes/flares';
import { DebugMeshes } from './debugging/debug-meshes';
import { Configurable } from './configuration/configurable';

export class World implements Configurable {

  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly renderer: WebGPURenderer;
  private readonly postProcessing: PostProcessing;
  private readonly bloomPass: BloomNode;
  private readonly noiseHelper: NoiseTextureHelper;
  private readonly magneticPoles: MagneticPoles;
  private readonly magneticConnections: MagneticConnections;
  private readonly debugMeshes?: DebugMeshes;
  private readonly configurables: Configurable[];

  private magneticFieldLines?: MagneticFieldLines;
  private lastFrame = 0;
  private rotation = true;

  public constructor(canvas: HTMLCanvasElement, private readonly debugMode: boolean, private readonly stats?: Stats) {
    this.renderer = new WebGPURenderer({
      antialias: true,
      canvas
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    this.camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.001, 100);
    this.camera.position.set(0, 0, 1.3);

    this.controls = new OrbitControls(this.camera, canvas);

    this.scene = new Scene();

    this.noiseHelper = new NoiseTextureHelper();
    this.magneticPoles = new MagneticPoles();
    this.magneticConnections = new MagneticConnections(this.magneticPoles);

    this.configurables = [];

    if (debugMode) {
      this.debugMeshes = new DebugMeshes(this.magneticPoles, this.magneticConnections);
      this.scene.add(this.debugMeshes);
      this.configurables.push(this.debugMeshes);
    }

    this.postProcessing = new PostProcessing(this.renderer);
    const scenePass = pass(this.scene, this.camera);
    const scenePassColor = scenePass.getTextureNode('output');
    this.bloomPass = new BloomNode(scenePassColor, 1, 0.1, 0.1);
    this.postProcessing.outputNode = scenePassColor.add(this.bloomPass);
  }

  public async startAsync(): Promise<void> {
    const loader = new TextureLoader();

    let sceneElement: Configurable & Object3D = new Surface(
      this.noiseHelper.createVoronoiTexture3D(64, 1),
      this.noiseHelper.createWhiteNoiseTexture3D(32),
      this.noiseHelper.createSimplexTexture3D(32, 0.25, 1 / 32, 1, 10, 1),
      await loader.loadAsync('hmi-intensitygram-colored.png')
    );
    this.scene.add(sceneElement);
    this.configurables.push(sceneElement);

    this.magneticFieldLines = new MagneticFieldLines(this.magneticConnections);
    await this.magneticFieldLines.updateAsync(this.renderer);

    const flareFragmentNoise = this.noiseHelper.createSimplexTexture2D(128, 128, 0.25, 1, 1, 3, 1, Flares.adpatFragmentNoise);
    flareFragmentNoise.generateMipmaps = true;
    flareFragmentNoise.needsUpdate = true;
    const flareVertexNoise = this.noiseHelper.createSimplexTexture2D(128, 128, 0.25, 0.01, 0.04, 3, 4);
    sceneElement = new Flares(
      false,
      this.magneticFieldLines,
      flareVertexNoise,
      flareFragmentNoise
    );
    this.scene.add(sceneElement);
    this.configurables.push(sceneElement);
    sceneElement = new Flares(
      true,
      this.magneticFieldLines,
      flareVertexNoise,
      flareFragmentNoise
    );
    this.scene.add(sceneElement);
    this.configurables.push(sceneElement);

    if (this.debugMeshes) {
      this.debugMeshes.addCurves(this.magneticFieldLines);
    }

    this.renderer.setAnimationLoop(this.onAnimationFrame.bind(this));
  }

  public applySettings(settings: Settings): void {
    if (this.debugMode) {
      this.bloomPass.strength.value = settings.bloomStrength;
      this.rotation = settings.rotation;
    } else {
      this.bloomPass.strength.value = settings.instrument === Instrument.AIA_304_A ? 0.5 : 0;
    }

    this.configurables.forEach(configurable => configurable.applySettings(settings));
  }

  public onResize(width: number, height: number, devicePixelRatio: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(width, height, false);
  }

  private onAnimationFrame(time: DOMHighResTimeStamp): void {
    var delta = this.lastFrame - time;
    this.lastFrame = time;

    this.controls.update(delta);
    if (this.rotation) {
      this.scene.rotateY(delta * -0.00002);
    }

    if (this.bloomPass.strength.value > 0) {
      this.postProcessing.render();
    }
    else {
      this.renderer.render(this.scene, this.camera);
    }

    this.stats?.update();
  }
}