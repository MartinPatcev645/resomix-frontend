import { useRef, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { usePartners } from '@/hooks/usePartners.ts';

export function PnContactForm() {
  const { t } = useTranslation('common');
  const {
    formData,
    fieldErrors,
    isSubmitting,
    isSuccess,
    errorMessage,
    updateField,
    handleSubmit,
  } = usePartners();

  const formRef = useRef<HTMLFormElement>(null);

  const partnerTypes = t('partners.form.partnerTypes', { returnObjects: true }) as string[];
  const preferredPaths = t('partners.form.preferredPaths', { returnObjects: true }) as string[];

  const fieldIdMap = {
    email: 'pn-f-email',
    name: 'pn-f-name',
    company: 'pn-f-company',
    partnerType: 'pn-f-type',
    preferredPath: 'pn-f-path',
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
    <section id="contact" aria-label="Contact partnerships" className="pn-section">
      <header className="pn-dim-intro">
        <p className="pn-eyebrow uppercase">{t('partners.form.eyebrow')}</p>
        <h2 className="pn-h2b uppercase">{t('partners.form.title')}</h2>
        <p className="pn-lead">{t('partners.form.lead')}</p>
      </header>
      <form
        ref={formRef}
        className={`pn-form${isSuccess ? ' pn-submitted' : ''}`}
        noValidate
        onSubmit={onSubmit}
      >
        <div className="pn-form-head">
          <span className="pn-hudlbl uppercase">{t('partners.form.formLabel')}</span>
        </div>

        {!isSuccess ? (
          <div className="pn-form-body">
            <div className={`pn-field${fieldErrors.email ? ' pn-invalid' : ''}`}>
              <label htmlFor="pn-f-email">
                {t('partners.form.emailLabel')}{' '}
                <span className="pn-req" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="pn-f-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                aria-invalid={fieldErrors.email ? 'true' : 'false'}
                onChange={(e) => updateField('email', e.target.value)}
              />
              <span className="pn-err" role="alert">
                {fieldErrors.email ?? t('partners.form.emailError')}
              </span>
            </div>

            <div className={`pn-field${fieldErrors.name ? ' pn-invalid' : ''}`}>
              <label htmlFor="pn-f-name">
                {t('partners.form.nameLabel')}{' '}
                <span className="pn-req" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="pn-f-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                aria-invalid={fieldErrors.name ? 'true' : 'false'}
                onChange={(e) => updateField('name', e.target.value)}
              />
              <span className="pn-err" role="alert">
                {fieldErrors.name ?? t('partners.form.nameError')}
              </span>
            </div>

            <div className={`pn-field${fieldErrors.company ? ' pn-invalid' : ''}`}>
              <label htmlFor="pn-f-company">
                {t('partners.form.companyLabel')}{' '}
                <span className="pn-req" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="pn-f-company"
                name="company"
                type="text"
                autoComplete="organization"
                required
                value={formData.company}
                aria-invalid={fieldErrors.company ? 'true' : 'false'}
                onChange={(e) => updateField('company', e.target.value)}
              />
              <span className="pn-err" role="alert">
                {fieldErrors.company ?? t('partners.form.companyError')}
              </span>
            </div>

            <div className="pn-field">
              <label htmlFor="pn-f-role">{t('partners.form.roleLabel')}</label>
              <input
                id="pn-f-role"
                name="role"
                type="text"
                autoComplete="organization-title"
                value={formData.role}
                onChange={(e) => updateField('role', e.target.value)}
              />
            </div>

            <div className={`pn-field${fieldErrors.partnerType ? ' pn-invalid' : ''}`}>
              <label htmlFor="pn-f-type">
                {t('partners.form.partnerTypeLabel')}{' '}
                <span className="pn-req" aria-hidden="true">
                  *
                </span>
              </label>
              <select
                id="pn-f-type"
                name="type"
                required
                value={formData.partnerType}
                aria-invalid={fieldErrors.partnerType ? 'true' : 'false'}
                onChange={(e) => updateField('partnerType', e.target.value)}
              >
                <option value="">{t('partners.form.selectPlaceholder')}</option>
                {partnerTypes.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="pn-err" role="alert">
                {fieldErrors.partnerType ?? t('partners.form.partnerTypeError')}
              </span>
            </div>

            <div className={`pn-field${fieldErrors.preferredPath ? ' pn-invalid' : ''}`}>
              <label htmlFor="pn-f-path">
                {t('partners.form.preferredPathLabel')}{' '}
                <span className="pn-req" aria-hidden="true">
                  *
                </span>
              </label>
              <select
                id="pn-f-path"
                name="path"
                required
                value={formData.preferredPath}
                aria-invalid={fieldErrors.preferredPath ? 'true' : 'false'}
                onChange={(e) => updateField('preferredPath', e.target.value)}
              >
                <option value="">{t('partners.form.selectPlaceholder')}</option>
                {preferredPaths.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="pn-err" role="alert">
                {fieldErrors.preferredPath ?? t('partners.form.preferredPathError')}
              </span>
            </div>

            <div className="pn-field pn-field-wide">
              <label htmlFor="pn-f-context">{t('partners.form.contextLabel')}</label>
              <input
                id="pn-f-context"
                name="context"
                type="text"
                placeholder={t('partners.form.contextPlaceholder')}
                value={formData.context}
                onChange={(e) => updateField('context', e.target.value)}
              />
            </div>

            <div className="pn-field pn-field-wide">
              <label htmlFor="pn-f-message">{t('partners.form.messageLabel')}</label>
              <textarea
                id="pn-f-message"
                name="message"
                value={formData.message}
                onChange={(e) => updateField('message', e.target.value)}
              />
            </div>

            {errorMessage ? (
              <p className="pn-form-error pn-field-wide" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <div className="pn-form-foot">
              <button type="submit" className="pn-pill pn-pill-solid uppercase" disabled={isSubmitting}>
                {isSubmitting ? t('partners.form.submitting') : t('partners.form.submit')}
              </button>
            </div>
          </div>
        ) : (
          <div className="pn-form-success" aria-live="polite">
            <span className="pn-hudlbl uppercase">{t('partners.form.successLabel')}</span>
            <p className="pn-lead pn-success-lead">{t('partners.form.successLead')}</p>
          </div>
        )}
      </form>
    </section>
  );
}
