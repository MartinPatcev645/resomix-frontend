import { ButtonSleek } from "@resomix/ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWaitlist } from "@resomix/hooks";

interface WaitListContentProps {
  baseUrl?: string;
}

export default function WaitListContent({ baseUrl = "https://resomix.com" }: WaitListContentProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [showStatus, setShowStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  const { 
    isLoading, 
    error, 
    success, 
    joinWaitlist: joinWaitlistAPI,
    clearError,
    clearSuccess
  } = useWaitlist();

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      setStatusMessage(t('waitlist.email_required'));
      setShowStatus(true);
      return;
    }

    if (!validateEmail(email)) {
      setStatusMessage(t('waitlist.invalid_email'));
      setShowStatus(true);
      return;
    }

    // Clear previous states
    clearError();
    clearSuccess();
    setShowStatus(true);

    try {
      const result = await joinWaitlistAPI(email.trim());
      
      if (result.success) {
        setStatusMessage(t('waitlist.success_message'));
        setEmail('');
      } else {
        setStatusMessage(result.error || t('waitlist.error_message'));
      }
    } catch (error) {
      setStatusMessage(t('waitlist.error_message'));
    }
  };

  const getStatusType = (): 'loading' | 'success' | 'error' => {
    if (isLoading) return 'loading';
    if (success) return 'success';
    if (error || statusMessage.includes('required') || statusMessage.includes('invalid')) return 'error';
    return 'loading';
  };

  const getDisplayMessage = (): string => {
    if (isLoading) return t('waitlist.submitting');
    if (error) return error;
    return statusMessage;
  };

  return (
    <section className="pt-[var(--px-120)] px-[var(--px-20)] md:px-0 tracking-[var(--px-1)]">
      <div className="w-full flex flex-col items-center text-[var(--color-primary)]">
        <header className="mb-[var(--px-28)] text-center">
          <h1 className="text-[length:var(--px-52)] leading-[var(--px-60)] font-medium font-helvetica uppercase">
            {t('waitlist.title')}
          </h1>
          <p className="mt-[var(--px-8)] text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica">
            {t('waitlist.subheading')}
          </p>
        </header>

        <div className="max-w-[var(--px-550)] border-2 border-[#222222] rounded-[var(--px-10)] p-[var(--px-20)]">
          <div className="mb-[var(--px-24)]">
            <a href={baseUrl} aria-label="Resomix home" className="text-[length:var(--px-14)] lg:text-[length:var(--px-11)] font-light font-helvetica hover:text-[var(--color-primary-hover)] transition-colors">
              ← {t('general.back_to_home')}
            </a>
          </div>

          <div className="text-center mb-[var(--px-20)]">
            <p className="text-[length:var(--px-14)] lg:text-[length:var(--px-10)] font-extralight lg:opacity-80 font-helvetica leading-[var(--px-20)]">
              {t('waitlist.description')}
            </p>
          </div>

          <div className="flex flex-col w-full gap-[var(--px-10)]">
            <div className="flex flex-col items-start gap-[var(--px-10)]">
              <div className="text-[length:var(--px-11)] font-extralight leading-[var(--px-16)] font-helvetica">
                {t('waitlist.email_label')}
              </div>
              <input 
                name="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                type="email" 
                className="w-full border border-slate-200 border-dotted p-[var(--px-8)] text-[length:var(--px-16)] lg:text-[length:var(--px-10)] font-light font-helvetica" 
                placeholder={t('waitlist.email_placeholder')}
                disabled={isLoading}
              />
            </div>
            
            <div className="mt-[var(--px-20)]">
              <ButtonSleek 
                text={isLoading ? t('waitlist.submitting') : t('waitlist.join_button')} 
                onClick={handleSubmit}
                disabled={isLoading}
              />
            </div>
            
            {showStatus && (
              <div className={`mt-[var(--px-10)] p-[var(--px-10)] rounded-[var(--px-5)] text-[length:var(--px-12)] font-light font-helvetica ${
                getStatusType() === 'success' ? 'bg-green-100 text-green-800 border border-green-200' :
                getStatusType() === 'error' ? 'bg-red-100 text-red-800 border border-red-200' :
                'bg-blue-100 text-blue-800 border border-blue-200'
              }`}>
                {getDisplayMessage()}
              </div>
            )}
          </div>

          <div className="mt-[var(--px-20)] text-center">
            <p className="text-[length:var(--px-12)] font-extralight font-helvetica opacity-70">
              {t('waitlist.footer_note')}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
