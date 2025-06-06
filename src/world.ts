import Stats from 'stats-gl';
import { Object3D, PerspectiveCamera, Scene } from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { PostProcessing, UniformNode, WebGPURenderer } from 'three/webgpu';
import { Surface } from './meshes/surface';
import { float, pass } from 'three/tsl';
import BloomNode from 'three/examples/jsm/tsl/display/BloomNode.js';
import { Settings } from './configuration/settings';
import { NoiseTextureHelper } from './textures/noise-texture-helper';
import { MagneticFieldLines } from './simulation/magnetic-field-lines';
import { MagneticPoles } from './simulation/magnetic-poles';
import { MagneticConnections } from './simulation/magnetic-connections';
import { Instrument } from './configuration/instrument';
import { FlaresBase } from './meshes/flares-base';
import { DebugMeshes } from './debugging/debug-meshes';
import { Configurable } from './configuration/configurable';
import { OpenFlares } from './meshes/open-flares';
import { ClosedFlares } from './meshes/closed-flares';
import { loadGradientTexturesAsync } from './textures/gradient-textures';

export class World implements Configurable {
  private static readonly ROTATION_SPEED = 0.01;

  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly renderer: WebGPURenderer;
  private readonly postProcessing: PostProcessing;
  private readonly bloomPass: BloomNode;
  private readonly magneticConnections: MagneticConnections;
  private readonly debugMeshes?: DebugMeshes;
  private readonly configurables: Configurable[];
  private readonly controllableTime: UniformNode<number>;

  private lastFrame = 0;
  private rotation = true;
  private playbackSpeed = 1;

  public constructor(
    canvas: HTMLCanvasElement,
    private readonly debugMode: boolean,
    private readonly stats?: Stats,
  ) {
    this.renderer = new WebGPURenderer({
      antialias: true,
      canvas,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    this.camera = new PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.001,
      100,
    );
    this.camera.position.set(0, 0, 1.3);

    this.controls = new OrbitControls(this.camera, canvas);

    this.scene = new Scene();

    const magneticPoles = new MagneticPoles();
    this.magneticConnections = new MagneticConnections(magneticPoles);

    this.configurables = [];

    this.controllableTime = new UniformNode(0);

    if (debugMode) {
      this.debugMeshes = new DebugMeshes(
        magneticPoles,
        this.magneticConnections,
      );
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
    const gradientTextures = await loadGradientTexturesAsync();
    const noiseHelper = new NoiseTextureHelper();

    await this.magneticConnections.updateAsync(this.renderer);

    const magneticFieldLines = new MagneticFieldLines(this.magneticConnections);
    await magneticFieldLines.updateAsync(this.renderer);

    const time = float(this.controllableTime);

    let sceneElement: Configurable & Object3D = new Surface(
      noiseHelper.createVoronoiTexture3D(64, 1),
      noiseHelper.createSimplexTexture3D(256, 0.25, 1, 0.01, 3, 2),
      this.magneticConnections.convectionFlowAndSunspotsTexture,
      gradientTextures.intensitygramColored.surface,
      gradientTextures.aia304a.surface,
      time,
    );
    this.scene.add(sceneElement);
    this.configurables.push(sceneElement);

    const flareFragmentNoise = noiseHelper.createSimplexTexture2D(
      128,
      128,
      0.25,
      1,
      1,
      3,
      1,
      FlaresBase.adpatFragmentNoise,
    );
    flareFragmentNoise.generateMipmaps = true;
    flareFragmentNoise.needsUpdate = true;
    const flareVertexNoise = noiseHelper.createSimplexTexture2D(
      128,
      128,
      0.25,
      0.01,
      0.04,
      3,
      4,
    );
    sceneElement = new ClosedFlares(
      magneticFieldLines,
      flareVertexNoise,
      flareFragmentNoise,
      gradientTextures.aia304a.closedFlare,
      time,
    );
    this.scene.add(sceneElement);
    this.configurables.push(sceneElement);
    sceneElement = new OpenFlares(
      magneticFieldLines,
      flareVertexNoise,
      flareFragmentNoise,
      gradientTextures.aia304a.openFlare,
      time,
    );
    this.scene.add(sceneElement);
    this.configurables.push(sceneElement);

    if (this.debugMeshes) {
      this.debugMeshes.addCurves(magneticFieldLines);
    }

    this.renderer.setAnimationLoop(this.onAnimationFrame.bind(this));
  }

  public applySettings(settings: Settings): void {
    if (this.debugMode) {
      this.rotation = settings.rotation;
    }

    this.playbackSpeed = settings.playbackSpeed;
    this.bloomPass.strength.value =
      settings.instrument === Instrument.AIA_304_A
        ? settings.aia304a.bloomStrength
        : 0;
    this.configurables.forEach((configurable) =>
      configurable.applySettings(settings),
    );
  }

  public onResize(
    width: number,
    height: number,
    devicePixelRatio: number,
  ): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(devicePixelRatio);
    this.renderer.setSize(width, height, false);
  }

  private onAnimationFrame(time: DOMHighResTimeStamp): void {
    const delta = time - this.lastFrame;
    const adjustedDelta = delta * 0.001 * this.playbackSpeed; // Past seconds in playback speed since last frame
    this.controllableTime.value += adjustedDelta;
    this.lastFrame = time;

    this.controls.update(delta);
    if (this.rotation) {
      this.scene.rotateY(World.ROTATION_SPEED * adjustedDelta);
    }

    if (this.bloomPass.strength.value > 0) {
      this.postProcessing.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    this.stats?.update();
  }
}
