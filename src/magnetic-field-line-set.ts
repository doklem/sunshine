import { ShaderNodeObject } from 'three/tsl';
import { StorageBufferNode } from 'three/webgpu';

export interface MagneticFieldLineSet {
  readonly count: number;
  readonly controlPointBuffers: ShaderNodeObject<StorageBufferNode>[];
  readonly speedsBuffer: ShaderNodeObject<StorageBufferNode>;
}