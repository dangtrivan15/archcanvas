/**
 * Input abstraction layer — platform detection, modifier mapping, display helpers.
 */
export {
  type Platform,
  detectPlatform,
  getCurrentPlatform,
  isCmdPlatform,
  _setPlatformForTesting,
  _resetPlatformDetection,
} from './platformDetector';

export {
  type AbstractModifier,
  type ModifierInfo,
  type PlatformModifierMap,
  getModifierMap,
  getCurrentModifierMap,
  formatKeyForDisplay,
  formatBindingDisplay,
  isPrimaryModifier,
  isSecondaryModifier,
  isTertiaryModifier,
} from './modifierMap';
