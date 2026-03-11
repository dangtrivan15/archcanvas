/**
 * Prompt Template Type Definitions
 *
 * Defines the PromptTemplate interface and related types for the
 * configurable AI prompt template system.
 */

import type { ProjectProfile } from '../detector';
import type { InferenceResult } from '../inferEngine';

/** A single analysis step within a prompt template */
export interface AnalysisStep {
  /** Human-readable name of this step */
  name: string;
  /** System prompt for this step */
  systemPrompt: string;
  /** User prompt template — {{placeholders}} are substituted at runtime */
  userPrompt: string;
}

/** Post-processing hook applied to the raw inference result */
export type PostProcessor = (result: InferenceResult) => InferenceResult;

/** JSON response schema description for the AI */
export interface ResponseSchema {
  /** JSON schema as a formatted string (included in the prompt to guide AI output) */
  schemaText: string;
}

/**
 * A prompt template defines how the AI analyzes a codebase.
 *
 * Templates externalize the prompt strategy into a composable unit:
 *  - systemPrompt: global context for the AI
 *  - analysisSteps: ordered prompts (single or multi-step)
 *  - responseSchema: expected JSON output format
 *  - postProcessing: optional transform applied to the parsed result
 *  - fewShotExamples: example inputs/outputs that improve AI accuracy
 */
export interface PromptTemplate {
  /** Unique identifier for this template */
  id: string;
  /** Human-readable name */
  name: string;
  /** Brief description of when to use this template */
  description: string;
  /** Tags for categorization / auto-selection matching */
  tags: string[];
  /** Global system prompt shared across all steps */
  systemPrompt: string;
  /** Ordered list of analysis steps (prompts) */
  analysisSteps: AnalysisStep[];
  /** Expected JSON response schema (included in prompts) */
  responseSchema: ResponseSchema;
  /** Optional post-processing function to refine the result */
  postProcessing?: PostProcessor;
  /** Few-shot examples to include in prompts for better accuracy */
  fewShotExamples?: FewShotExample[];
}

/** A few-shot example showing expected input/output for the AI */
export interface FewShotExample {
  /** Description of the example scenario */
  scenario: string;
  /** Example input context */
  input: string;
  /** Expected JSON output */
  output: string;
}

/** Predicate function that checks if a template matches a project profile */
export type TemplateMatcher = (profile: ProjectProfile) => number;

/** Registry entry pairing a template with its auto-selection matcher */
export interface TemplateRegistryEntry {
  template: PromptTemplate;
  /** Returns a score 0-100 indicating how well this template matches the profile.
   *  Higher score = better match. 0 = no match. */
  matcher: TemplateMatcher;
}
