import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useFileStore } from '@/store/fileStore';
import { InitMethodStep } from './InitMethodStep';
import { AiSurveyStep } from './AiSurveyStep';
import { TemplatePickerStep } from './TemplatePickerStep';
import type { ArchTemplate } from '@/core/templates/schema';

type WizardStep = 'init-method' | 'ai-survey' | 'template-picker';

export function OnboardingWizard() {
  const [step, setStep] = useState<WizardStep>('init-method');
  const [direction, setDirection] = useState(1);
  const prefersReduced = useReducedMotion();

  function goForward(target: WizardStep) {
    setDirection(1);
    setStep(target);
  }

  function goBack() {
    setDirection(-1);
    setStep('init-method');
  }

  function handleTemplateSelect(template: ArchTemplate) {
    useFileStore.getState().completeOnboarding('template', undefined, template);
  }

  const xOffset = prefersReduced ? 0 : 50 * direction;

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground">
      <AnimatePresence custom={direction}>
        <motion.div
          key={step}
          initial={prefersReduced ? false : { x: xOffset, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={prefersReduced ? undefined : { x: -xOffset, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 'init-method' && (
            <InitMethodStep
              onBlankCanvas={() => useFileStore.getState().completeOnboarding('blank')}
              onAiAnalyze={() => goForward('ai-survey')}
              onTemplate={() => goForward('template-picker')}
            />
          )}
          {step === 'ai-survey' && (
            <AiSurveyStep
              onBack={goBack}
              onStart={(survey) => useFileStore.getState().completeOnboarding('ai', survey)}
            />
          )}
          {step === 'template-picker' && (
            <TemplatePickerStep
              onBack={goBack}
              onSelect={handleTemplateSelect}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
