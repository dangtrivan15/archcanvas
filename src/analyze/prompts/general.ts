/**
 * General Prompt Template
 *
 * Language-agnostic default template suitable for any project type.
 * Used as the fallback when no domain-specific template matches.
 */

import type { PromptTemplate } from './types';
import { NODE_TYPE_REGISTRY_TEXT, STANDARD_RESPONSE_SCHEMA, WEB_APP_FEW_SHOT } from './shared';

export const generalTemplate: PromptTemplate = {
  id: 'general',
  name: 'General Architecture Analysis',
  description:
    'Language-agnostic analysis suitable for any project. Identifies components, relationships, and maps to ArchCanvas node types.',
  tags: ['general', 'default', 'language-agnostic'],

  systemPrompt: `You are an expert software architect analyzing a codebase to infer its system architecture.
You will be given a project profile (detected languages, frameworks, infra signals) and key file contents.
Your job is to identify the architectural components (services, databases, queues, etc.) and their relationships.

Guidelines:
- Focus on identifying distinct deployable units and data stores.
- Identify both synchronous (HTTP, gRPC) and asynchronous (message queues, events) communication patterns.
- Map each component to the most specific ArchCanvas node type available.
- Use kebab-case for node IDs (e.g., "user-service", "order-db").
- Include code references linking nodes to the source files that implement them.
- Respond ONLY with valid JSON matching the specified schema. No markdown, no explanations outside the JSON.`,

  analysisSteps: [
    {
      name: 'Full Architecture Analysis',
      systemPrompt: '',
      userPrompt: `Analyze this codebase and infer its system architecture.

## Project Profile
{{projectProfile}}

${NODE_TYPE_REGISTRY_TEXT}

## Key Files
{{fileContents}}

## Few-Shot Example
Here is an example of the expected output format:

**Scenario:** ${WEB_APP_FEW_SHOT.scenario}
**Input:** ${WEB_APP_FEW_SHOT.input}
**Expected Output:**
${WEB_APP_FEW_SHOT.output}

## Instructions
Identify all major architectural components and their relationships in the provided codebase.
Use the node types listed above. Respond with a JSON object matching this schema:
${STANDARD_RESPONSE_SCHEMA.schemaText}

Respond ONLY with the JSON object. No markdown code fences, no explanations.`,
    },
  ],

  responseSchema: STANDARD_RESPONSE_SCHEMA,

  fewShotExamples: [WEB_APP_FEW_SHOT],
};
