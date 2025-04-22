import Stats from 'stats-gl';
import { PerspectiveCamera, Scene, TextureLoader } from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { PostProcessing, WebGPURenderer } from 'three/webgpu';
import { Surface } from './surface';
import { pass } from 'three/tsl';
import BloomNode from 'three/examples/jsm/tsl/display/BloomNode.js';
import { Settings } from './settings';
import { NoiseTextureHelper } from './noise-texture-helper';
import { MagneticFieldLines } from './magnetic-field-lines';
import { SurfaceFlares } from './surface-flares';

export class World {

  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly renderer: WebGPURenderer;
  private readonly postProcessing: PostProcessing;
  private readonly bloomPass: BloomNode;
  private readonly noiseHelper: NoiseTextureHelper;

  private surface?: Surface;
  private magneticFieldLines?: MagneticFieldLines;
  private surfaceFlares?: SurfaceFlares;
  private lastFrame = 0;
  private rotation = true;

  public constructor(canvas: HTMLCanvasElement, private readonly stats: Stats) {
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

    this.postProcessing = new PostProcessing(this.renderer);
    const scenePass = pass(this.scene, this.camera);
    const scenePassColor = scenePass.getTextureNode('output');
    this.bloomPass = new BloomNode(scenePassColor, 1, 0.1, 0.1);
    this.postProcessing.outputNode = scenePassColor.add(this.bloomPass);
  }

  public async startAsync(): Promise<void> {
    const loader = new TextureLoader();

    this.surface = new Surface(
      this.noiseHelper.createVoronoiTexture3D(64, 1),
      this.noiseHelper.createWhiteNoiseTexture3D(32),
      this.noiseHelper.createSimplexTexture3D(32, 0.25, 1 / 32, 1, 10, 1),
      await loader.loadAsync('hmi-intensitygram-colored.png')
    );
    this.scene.add(this.surface);

    this.magneticFieldLines = new MagneticFieldLines(this.noiseHelper.createSimplexTexture2D(128, 1, 0.25, 1, 1, 3, 1, SurfaceFlares.adpatFragmentNoise));
    await this.magneticFieldLines.updateAsync(this.renderer);

    const flareFragmentNoise = this.noiseHelper.createSimplexTexture2D(128, 128, 0.25, 1, 1, 3, 1, SurfaceFlares.adpatFragmentNoise);
    flareFragmentNoise.generateMipmaps = true;
    flareFragmentNoise.needsUpdate = true;
    this.surfaceFlares = new SurfaceFlares(this.magneticFieldLines, flareFragmentNoise);
    this.scene.add(this.surfaceFlares);

    this.renderer.setAnimationLoop(this.onAnimationFrame.bind(this));
  }

  public applySettings(settings: Settings): void {
    this.bloomPass.strength.value = settings.bloomStrength;
    this.rotation = settings.rotation;
    this.surface?.applySettings(settings);
    this.surfaceFlares?.applySettings(settings);
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
    if (this.surface) {
      this.surface.time.value = time;
    }

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

    this.stats.update();
  }
}