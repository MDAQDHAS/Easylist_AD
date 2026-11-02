import React from 'react';
import { Check } from 'lucide-react';
import { OrderWorkflowStep } from '../../types/order';

interface StepperProps {
  currentStep?: OrderWorkflowStep;
  onStepChange?: (step: OrderWorkflowStep) => void;
  canNavigateToReview?: boolean;
  canNavigateToExport?: boolean;
}

export const Stepper: React.FC<StepperProps> = ({
  currentStep = 'upload',
  onStepChange,
  canNavigateToReview = false,
  canNavigateToExport = false,
}) => {
  const steps: {
    key: OrderWorkflowStep;
    number: number;
    title: string;
    subtitle: string;
    enabled: boolean;
  }[] = [
    {
      key: 'upload',
      number: 1,
      title: 'Upload',
      subtitle: 'Add Images',
      enabled: true,
    },
    {
      key: 'review',
      number: 2,
      title: 'Extract & Review',
      subtitle: 'Check Details',
      enabled: canNavigateToReview || currentStep === 'review' || currentStep === 'export',
    },
    {
      key: 'export',
      number: 3,
      title: 'Export',
      subtitle: 'Download Order',
      enabled: canNavigateToExport || currentStep === 'export',
    },
  ];

  const getStepStatus = (stepKey: OrderWorkflowStep) => {
    if (stepKey === currentStep) return 'active';
    if (currentStep === 'export' && (stepKey === 'upload' || stepKey === 'review')) return 'completed';
    if (currentStep === 'review' && stepKey === 'upload') return 'completed';
    return 'inactive';
  };

  return (
    <div className="w-full max-w-[970px] mx-auto mb-[18px] px-4 sm:px-0">
      <div className="bg-white rounded-[18px] border border-[#DCE5F2] shadow-xs min-h-[56px] sm:h-[60px] px-4 sm:px-8 py-2.5 sm:py-0 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-6">
        {steps.map((step, index) => {
          const status = getStepStatus(step.key);

          return (
            <React.Fragment key={step.key}>
              <div
                onClick={() => step.enabled && onStepChange && onStepChange(step.key)}
                className={`flex items-center gap-3 w-full sm:w-auto ${
                  step.enabled ? 'cursor-pointer hover:opacity-90' : 'cursor-default'
                } transition-opacity select-none`}
              >
                {/* Step Circle */}
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shrink-0 transition-colors ${
                    status === 'active'
                      ? 'bg-[#5046F2] text-white shadow-xs'
                      : status === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#F1F5F9] text-slate-500'
                  }`}
                >
                  {status === 'completed' ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    step.number
                  )}
                </div>

                {/* Step Labels */}
                <div>
                  <div
                    className={`text-xs sm:text-sm font-bold leading-tight ${
                      status === 'active'
                        ? 'text-[#111827]'
                        : status === 'completed'
                        ? 'text-emerald-700'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-[11px] sm:text-xs text-[#94A3B8] font-normal leading-tight mt-0.5">
                    {step.subtitle}
                  </div>
                </div>
              </div>

              {/* Connecting Divider Line */}
              {index < steps.length - 1 && (
                <div className="hidden sm:block flex-1 h-[1px] bg-slate-200/80 mx-2 sm:mx-4 min-w-[20px]" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default Stepper;
