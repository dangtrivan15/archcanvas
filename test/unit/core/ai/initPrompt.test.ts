import { describe, it, expect } from 'vitest';
import { assembleInitPrompt } from '@/core/ai/initPrompt';
import type { SurveyData } from '@/store/fileStore';

function makeSurvey(overrides: Partial<SurveyData> = {}): SurveyData {
  return {
    description: 'A web application for managing tasks',
    techStack: ['TypeScript', 'React'],
    explorationDepth: 'full',
    focusDirs: '',
    ...overrides,
  };
}

describe('assembleInitPrompt', () => {
  it('includes all populated fields in the prompt', () => {
    const survey = makeSurvey({
      description: 'Task management SaaS',
      techStack: ['TypeScript', 'React', 'PostgreSQL'],
      explorationDepth: 'full',
      focusDirs: 'src/, services/',
    });

    const prompt = assembleInitPrompt('MyProject', survey);

    expect(prompt).toContain('Project: MyProject');
    expect(prompt).toContain('Description: Task management SaaS');
    expect(prompt).toContain('Tech stack: TypeScript, React, PostgreSQL');
    expect(prompt).toContain('Explore the entire project recursively');
    expect(prompt).toContain('Focus your exploration on: src/, services/');
  });

  it('shows "not specified" when tech stack is empty', () => {
    const survey = makeSurvey({ techStack: [] });
    const prompt = assembleInitPrompt('MyProject', survey);
    expect(prompt).toContain('Tech stack: not specified');
  });

  it('shows full depth text for explorationDepth "full"', () => {
    const survey = makeSurvey({ explorationDepth: 'full' });
    const prompt = assembleInitPrompt('MyProject', survey);
    expect(prompt).toContain('Explore the entire project recursively');
  });

  it('shows top-level depth text for explorationDepth "top-level"', () => {
    const survey = makeSurvey({ explorationDepth: 'top-level' });
    const prompt = assembleInitPrompt('MyProject', survey);
    expect(prompt).toContain("Focus on the top-level structure, don't dive into implementation details");
  });

  it('shows custom depth text with the correct level', () => {
    const survey = makeSurvey({ explorationDepth: 'custom', customDepth: 5 });
    const prompt = assembleInitPrompt('MyProject', survey);
    expect(prompt).toContain('Explore up to 5 levels deep');
  });

  it('shows focus text when focusDirs is provided', () => {
    const survey = makeSurvey({ focusDirs: 'src/, services/' });
    const prompt = assembleInitPrompt('MyProject', survey);
    expect(prompt).toContain('Focus your exploration on: src/, services/');
  });

  it('shows "Explore the entire project directory" when focusDirs is empty', () => {
    const survey = makeSurvey({ focusDirs: '' });
    const prompt = assembleInitPrompt('MyProject', survey);
    expect(prompt).toContain('Explore the entire project directory');
  });
});
