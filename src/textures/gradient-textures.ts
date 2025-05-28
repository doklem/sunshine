import { ClampToEdgeWrapping, LinearFilter, RGBAFormat, Texture, TextureLoader } from 'three';

export interface GradientTextures {
  intensitygramColored: {
    surface: Texture;
  },
  aia304a: {
    openFlare: Texture;
    closedFlare: Texture;
    surface: Texture;
  };
}

export async function loadGradientTexturesAsync(): Promise<GradientTextures> {
  const loader = new TextureLoader();
  const aia304a: {
    openFlare?: Texture;
    closedFlare?: Texture;
    surface?: Texture;
  } = {};
  const intensitygramColored: {
    surface?: Texture;
  } = {};

  await Promise.all([
    loader.loadAsync('aia-304-a-closed-flare.png').then(texture => aia304a.closedFlare = configure(texture)),
    loader.loadAsync('aia-304-a-open-flare.png').then(texture => aia304a.openFlare = configure(texture)),
    loader.loadAsync('aia-304-a-surface.png').then(texture => aia304a.surface = configure(texture)),
    loader.loadAsync('hmi-intensitygram-colored-surface.png').then(texture => intensitygramColored.surface = configure(texture)),
  ]);

  if (!intensitygramColored.surface) {
    throw new Error('Failed to load the HMI intensitygram colored gradient texture');
  }
  if (!aia304a.closedFlare || !aia304a.openFlare || !aia304a.surface) {
    throw new Error('Failed to load the AIA 304 A gradient textures');
  }

  return { aia304a, intensitygramColored } as GradientTextures;
}

function configure<T extends Texture>(texture: T): T {
  texture.format = RGBAFormat;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}