import { archcanvas } from './archcanvas';
import { rosePine } from './rosePine';
import { catppuccin } from './catppuccin';
import type { ThemePalette } from '../types';

export const palettes: ThemePalette[] = [archcanvas, rosePine, catppuccin];

export function findPalette(id: string): ThemePalette {
  return palettes.find((p) => p.id === id) ?? rosePine;
}
