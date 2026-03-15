import { useState } from 'react';
import { useFileStore } from '@/store/fileStore';
import { InitMethodStep } from './InitMethodStep';
import { AiSurveyStep } from './AiSurveyStep';

type WizardStep = 'init-method' | 'ai-survey';

export function OnboardingWizard() {
  const [step, setStep] = useState<WizardStep>('init-method');

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
      {step === 'init-method' && (
        <InitMethodStep
          onBlankCanvas={() => useFileStore.getState().completeOnboarding('blank')}
          onAiAnalyze={() => setStep('ai-survey')}
        />
      )}
      {step === 'ai-survey' && (
        <AiSurveyStep
          onBack={() => setStep('init-method')}
          onStart={(survey) => useFileStore.getState().completeOnboarding('ai', survey)}
        />
      )}
    </div>
  );
}
