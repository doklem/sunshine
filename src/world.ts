import Stats from 'stats-gl';
import { PerspectiveCamera, Scene } from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { PostProcessing, WebGPURenderer } from 'three/webgpu';
import { Surface } from './surface';
import { pass } from 'three/tsl';
import BloomNode from 'three/examples/jsm/tsl/display/BloomNode.js';

export class World {

  private readonly scene: Scene;
  private readonly camera: PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly renderer: WebGPURenderer;
  private readonly postProcessing: PostProcessing;

  private surface?: Surface;
  private lastFrame: number = 0;

  public constructor(canvas: HTMLCanvasElement, private readonly stats: Stats) {
    this.renderer = new WebGPURenderer({
      antialias: true,
      canvas
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);

    this.camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.001, 100);
    this.camera.position.set(0, 0, 1.1);

    this.controls = new OrbitControls(this.camera, canvas);

    this.scene = new Scene();

    this.postProcessing = new PostProcessing(this.renderer);
    const scenePass = pass(this.scene, this.camera);
    const scenePassColor = scenePass.getTextureNode('output');
    const bloomPass = new BloomNode(scenePassColor, 1, 0.1, 0.1);
    this.postProcessing.outputNode = scenePassColor.add(bloomPass);
  }

  public async startAsync(): Promise<void> {
    this.surface = await Surface.createAsync();
    this.scene.add(this.surface);
    this.renderer.setAnimationLoop(this.onAnimationFrame.bind(this));
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
    this.scene.rotateY(delta * -0.00002);
    this.postProcessing.render();
    //this.renderer.render(this.scene, this.camera);
    this.stats.update();
  }
}