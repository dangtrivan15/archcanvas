/**
 * Stack templates barrel export.
 *
 * Pre-built architecture stacks (YAML files) and the loader that
 * parses them into ArchGraph instances.
 */

export type { StackTemplate } from './stackLoader';
export { getAvailableStacks, instantiateStack } from './stackLoader';
