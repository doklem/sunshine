import Stats from 'stats-gl';
import { PerspectiveCamera, Scene, TextureLoader } from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { PostProcessing, WebGPURenderer } from 'three/webgpu';
import { Surface } from './surface';
import { pass } from 'three/tsl';
import BloomNode from 'three/examples/jsm/tsl/display/BloomNode.js';
import { FireFountains } from './fire-fountains';
import { Settings } from './settings';
import { LowAltitudeChargedParticles } from './low-altitude-charged-particles';
import { MagneticFieldLines } from './magnetic-field-lines';
import { HighAltitudeChargedParticles } from './high-altitude-charged-particles';

export class World {

  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly renderer: WebGPURenderer;
  private readonly postProcessing: PostProcessing;
  private readonly bloomPass: BloomNode;
  private readonly magneticFieldLines: MagneticFieldLines;

  private fireFountains?: FireFountains;
  private lowAltitudeChargedParticles?: LowAltitudeChargedParticles;
  private highAltitudeChargedParticles?: HighAltitudeChargedParticles;
  private surface?: Surface;
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

    this.magneticFieldLines = new MagneticFieldLines(8, 500);

    this.postProcessing = new PostProcessing(this.renderer);
    const scenePass = pass(this.scene, this.camera);
    const scenePassColor = scenePass.getTextureNode('output');
    this.bloomPass = new BloomNode(scenePassColor, 1, 0.1, 0.1);
    this.postProcessing.outputNode = scenePassColor.add(this.bloomPass);
  }

  public async startAsync(): Promise<void> {
    const loader = new TextureLoader();
    const chargedParticleTexture = await loader.loadAsync('charged-particle.png');

    this.lowAltitudeChargedParticles = new LowAltitudeChargedParticles(this.magneticFieldLines, chargedParticleTexture, 6000);
    this.scene.add(this.lowAltitudeChargedParticles);

    this.highAltitudeChargedParticles = new HighAltitudeChargedParticles(this.magneticFieldLines, chargedParticleTexture, 4000);
    this.scene.add(this.highAltitudeChargedParticles);

    this.surface = await Surface.createAsync();
    this.scene.add(this.surface);

    this.fireFountains = FireFountains.create();
    this.scene.add(this.fireFountains);

    this.renderer.setAnimationLoop(this.onAnimationFrame.bind(this));
  }

  public applySettings(settings: Settings): void {
    this.bloomPass.strength.value = settings.bloomStrength;
    this.rotation = settings.rotation;
    this.lowAltitudeChargedParticles?.applySettings(settings);
    this.highAltitudeChargedParticles?.applySettings(settings);
    this.fireFountains?.applySettings(settings);
    this.surface?.applySettings(settings);
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
    this.lowAltitudeChargedParticles?.onAnimationFrame(this.renderer);
    this.highAltitudeChargedParticles?.onAnimationFrame(this.renderer);
    if (this.bloomPass.strength.value > 0) {
      this.postProcessing.render();
    }
    else {
      this.renderer.render(this.scene, this.camera);
    }
    this.stats.update();
  }
}