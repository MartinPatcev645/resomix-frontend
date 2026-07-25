import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { usePilotInquiry } from '@/hooks/usePilotInquiry.ts';

export function PpApplyForm() {
  const { t } = useTranslation('common');
  const {
    formData,
    fieldErrors,
    isSubmitting,
    isSuccess,
    errorMessage,
    updateField,
    handleSubmit,
  } = usePilotInquiry();

  const [techOpen, setTechOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const partnerTypes = t('partnersPilot.form.partnerTypes', {
    returnObjects: true,
  }) as string[];

  const catalogSizes = t('partnersPilot.form.catalogSizes', {
    returnObjects: true,
  }) as string[];

  const sampleOptions = t('partnersPilot.form.sampleOptions', {
    returnObjects: true,
  }) as string[];

  const integrationOptions = t('partnersPilot.form.integrationOptions', {
    returnObjects: true,
  }) as string[];

  const nextSteps = t('partnersPilot.form.nextSteps', {
    returnObjects: true,
  }) as string[];

  const fieldIdMap = {
    email: 'pp-f-email',
    name: 'pp-f-name',
    company: 'pp-f-company',
    partnerType: 'pp-f-type',
    primaryQuestion: 'pp-f-question',
    rights: 'pp-f-rights',
  } as const;

  const onSubmit = async (ev: FormEvent) => {
    ev.preventDefault();
    const result = await handleSubmit();
    if (result.firstInvalid && formRef.current) {
      const id = fieldIdMap[result.firstInvalid as keyof typeof fieldIdMap];
      const el = formRef.current.querySelector<HTMLElement>(`#${id}`);
      el?.focus();
    }
  };

  return (
    <section id="apply" aria-label="Apply for a pilot" className="pp-section">
      <header className="pp-dim-intro">
        <p className="pp-eyebrow uppercase">{t('partnersPilot.form.eyebrow')}</p>
        <h2 className="pp-h2b uppercase">{t('partnersPilot.form.title')}</h2>
        <p className="pp-lead">{t('partnersPilot.form.lead')}</p>
      </header>
      <form
        ref={formRef}
        className={`pp-form${isSuccess ? ' pp-submitted' : ''}`}
        noValidate
        onSubmit={onSubmit}
      >
        <div className="pp-form-head">
          <span className="pp-hudlbl uppercase">{t('partnersPilot.form.formLabel')}</span>
        </div>

        {!isSuccess ? (
          <div className="pp-form-body">
            <div className={`pp-field${fieldErrors.email ? ' pp-invalid' : ''}`}>
              <label htmlFor="pp-f-email">
                {t('partnersPilot.form.emailLabel')}{' '}
                <span className="pp-req" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="pp-f-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                aria-invalid={fieldErrors.email ? 'true' : 'false'}
                aria-describedby={fieldErrors.email ? 'pp-f-email-err' : undefined}
                onChange={(e) => updateField('email', e.target.value)}
              />
              <span className="pp-err" id="pp-f-email-err" role="alert">
                {fieldErrors.email ?? t('partnersPilot.form.emailError')}
              </span>
            </div>

            <div className={`pp-field${fieldErrors.name ? ' pp-invalid' : ''}`}>
              <label htmlFor="pp-f-name">
                {t('partnersPilot.form.nameLabel')}{' '}
                <span className="pp-req" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="pp-f-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                aria-invalid={fieldErrors.name ? 'true' : 'false'}
                onChange={(e) => updateField('name', e.target.value)}
              />
              <span className="pp-err" role="alert">
                {fieldErrors.name ?? t('partnersPilot.form.nameError')}
              </span>
            </div>

            <div className={`pp-field${fieldErrors.company ? ' pp-invalid' : ''}`}>
              <label htmlFor="pp-f-company">
                {t('partnersPilot.form.companyLabel')}{' '}
                <span className="pp-req" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="pp-f-company"
                name="company"
                type="text"
                autoComplete="organization"
                required
                value={formData.company}
                aria-invalid={fieldErrors.company ? 'true' : 'false'}
                onChange={(e) => updateField('company', e.target.value)}
              />
              <span className="pp-err" role="alert">
                {fieldErrors.company ?? t('partnersPilot.form.companyError')}
              </span>
            </div>

            <div className="pp-field">
              <label htmlFor="pp-f-role">{t('partnersPilot.form.roleLabel')}</label>
              <input
                id="pp-f-role"
                name="role"
                type="text"
                autoComplete="organization-title"
                value={formData.role}
                onChange={(e) => updateField('role', e.target.value)}
              />
            </div>

            <div className={`pp-field${fieldErrors.partnerType ? ' pp-invalid' : ''}`}>
              <label htmlFor="pp-f-type">
                {t('partnersPilot.form.partnerTypeLabel')}{' '}
                <span className="pp-req" aria-hidden="true">
                  *
                </span>
              </label>
              <select
                id="pp-f-type"
                name="type"
                required
                value={formData.partnerType}
                aria-invalid={fieldErrors.partnerType ? 'true' : 'false'}
                onChange={(e) => updateField('partnerType', e.target.value)}
              >
                <option value="">{t('partnersPilot.form.selectPlaceholder')}</option>
                {partnerTypes.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="pp-err" role="alert">
                {fieldErrors.partnerType ?? t('partnersPilot.form.partnerTypeError')}
              </span>
            </div>

            <div className="pp-field">
              <label htmlFor="pp-f-size">{t('partnersPilot.form.catalogSizeLabel')}</label>
              <select
                id="pp-f-size"
                name="size"
                value={formData.catalogSize}
                onChange={(e) => updateField('catalogSize', e.target.value)}
              >
                <option value="">{t('partnersPilot.form.selectPlaceholder')}</option>
                {catalogSizes.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="pp-field">
              <label htmlFor="pp-f-sample">{t('partnersPilot.form.sampleLabel')}</label>
              <select
                id="pp-f-sample"
                name="sample"
                value={formData.sampleAvailability}
                onChange={(e) => updateField('sampleAvailability', e.target.value)}
              >
                <option value="">{t('partnersPilot.form.selectPlaceholder')}</option>
                {sampleOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className={`pp-field pp-field-wide${fieldErrors.primaryQuestion ? ' pp-invalid' : ''}`}>
              <label htmlFor="pp-f-question">
                {t('partnersPilot.form.questionLabel')}{' '}
                <span className="pp-req" aria-hidden="true">
                  *
                </span>
              </label>
              <textarea
                id="pp-f-question"
                name="question"
                required
                placeholder={t('partnersPilot.form.questionPlaceholder')}
                value={formData.primaryQuestion}
                aria-invalid={fieldErrors.primaryQuestion ? 'true' : 'false'}
                onChange={(e) => updateField('primaryQuestion', e.target.value)}
              />
              <span className="pp-err" role="alert">
                {fieldErrors.primaryQuestion ?? t('partnersPilot.form.questionError')}
              </span>
            </div>

            <div className="pp-field pp-field-wide">
              <button
                type="button"
                className="pp-ghostbtn uppercase"
                aria-expanded={techOpen}
                aria-controls="pp-techfields"
                onClick={() => setTechOpen((o) => !o)}
              >
                {techOpen
                  ? t('partnersPilot.form.techBtnOpen')
                  : t('partnersPilot.form.techBtnClosed')}
              </button>
            </div>

            {techOpen ? (
              <div className="pp-field pp-field-wide pp-techfields" id="pp-techfields">
                <div className="pp-form-body pp-tech-inner">
                  <div className="pp-field">
                    <label htmlFor="pp-f-workflow">{t('partnersPilot.form.workflowLabel')}</label>
                    <input
                      id="pp-f-workflow"
                      name="workflow"
                      type="text"
                      placeholder={t('partnersPilot.form.workflowPlaceholder')}
                      value={formData.workflow}
                      onChange={(e) => updateField('workflow', e.target.value)}
                    />
                  </div>
                  <div className="pp-field">
                    <label htmlFor="pp-f-integration">
                      {t('partnersPilot.form.integrationLabel')}
                    </label>
                    <select
                      id="pp-f-integration"
                      name="integration"
                      value={formData.integrationInterest}
                      onChange={(e) => updateField('integrationInterest', e.target.value)}
                    >
                      <option value="">{t('partnersPilot.form.selectPlaceholder')}</option>
                      {integrationOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="pp-field pp-field-wide">
                    <label htmlFor="pp-f-message">{t('partnersPilot.form.messageLabel')}</label>
                    <textarea
                      id="pp-f-message"
                      name="message"
                      value={formData.message}
                      onChange={(e) => updateField('message', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            <label
              className={`pp-consent${fieldErrors.rights ? ' pp-invalid' : ''}`}
            >
              <input
                id="pp-f-rights"
                name="rights"
                type="checkbox"
                required
                checked={formData.rightsConfirmed}
                aria-invalid={fieldErrors.rights ? 'true' : 'false'}
                onChange={(e) => updateField('rightsConfirmed', e.target.checked)}
              />
              <span>
                {t('partnersPilot.form.rightsLabel')}{' '}
                <span className="pp-req" aria-hidden="true">
                  *
                </span>
                <span className="pp-err pp-consent-err" role="alert">
                  {fieldErrors.rights ?? t('partnersPilot.form.rightsError')}
                </span>
              </span>
            </label>

            {errorMessage ? (
              <p className="pp-form-error pp-field-wide" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <div className="pp-form-foot">
              <button type="submit" className="pp-pill pp-pill-solid" disabled={isSubmitting}>
                {isSubmitting
                  ? t('partnersPilot.form.submitting')
                  : t('partnersPilot.form.submit')}
              </button>
              <span className="pp-lbl-dim uppercase">{t('partnersPilot.form.submitNote')}</span>
            </div>
          </div>
        ) : (
          <div className="pp-form-success" aria-live="polite">
            <span className="pp-hudlbl uppercase">{t('partnersPilot.form.successLabel')}</span>
            <p className="pp-lead pp-success-lead">{t('partnersPilot.form.successLead')}</p>
            <ol className="pp-nextsteps">
              {nextSteps.map((step) => (
                <li key={step}>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </form>
    </section>
  );
}
