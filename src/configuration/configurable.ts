import { Settings } from './settings';

export interface Configurable {
  applySettings(settings: Settings): void;
}