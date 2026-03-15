import type { SurveyData } from '@/store/fileStore';

export function assembleInitPrompt(projectName: string, survey: SurveyData): string {
  const depthText =
    survey.explorationDepth === 'full'
      ? 'Explore the entire project recursively'
      : survey.explorationDepth === 'top-level'
        ? "Focus on the top-level structure, don't dive into implementation details"
        : `Explore up to ${survey.customDepth} levels deep`;

  const focusText = survey.focusDirs
    ? `Focus your exploration on: ${survey.focusDirs}`
    : 'Explore the entire project directory';

  const techStackText = survey.techStack.length > 0
    ? survey.techStack.join(', ')
    : 'not specified';

  return `I'd like you to analyze this codebase and create an architecture diagram using ArchCanvas.

Project: ${projectName}
Description: ${survey.description}
Tech stack: ${techStackText}
Project path: ${survey.projectPath}

IMPORTANT: The project to analyze is located at "${survey.projectPath}".
Explore THAT directory, not the ArchCanvas tool's own source code.

Exploration instructions:
- Depth: ${depthText}
- Focus: ${focusText}

Please:
1. Explore the project structure and key configuration files
2. Identify major services, components, and infrastructure
3. Create nodes for each component using \`archcanvas add-node\`
4. Create edges showing how components communicate using \`archcanvas add-edge\`
5. Use subsystems (nested canvases) for complex components
6. Define entities for data flowing between components
7. Add meaningful edge labels and protocols (HTTP, gRPC, SQL, etc.)
8. Add notes for architectural decisions you observe

Use the built-in node types (compute/service, data/database, messaging/message-queue, etc.). Run \`archcanvas catalog --json\` to see all available types.`;
}
