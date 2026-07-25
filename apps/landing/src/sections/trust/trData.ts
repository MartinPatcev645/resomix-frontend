/**
 * Legally approved wording — verbatim from the approved preview and CLAIMS_REGISTER.md.
 * Never edit copy here without owner/legal sign-off.
 */

export const LEGAL_LIBRARY_URL = 'https://support.resomix.com/hc/categories/1/3/legal';
export const PRIVACY_EMAIL = 'privacy@resomix.com';
export const LEGAL_EMAIL = 'legal@resomix.com';
export const PARTNERS_CONTACT_HASH = '/partners#contact';

export type TrustStatusKey =
  | 'current'
  | 'agreementBound'
  | 'betaControl'
  | 'roadmap'
  | 'notClaimed'
  | 'currentQualified'
  | 'currentLegalDisclosure';

export type LifecycleColumnId = 'temp' | 'library' | 'partner';

export type LifecycleRowId =
  | 'purpose'
  | 'access'
  | 'publicVisibility'
  | 'retention'
  | 'deletionTrigger'
  | 'trainingUse';

export interface LedgerRowDef {
  id: string;
  controlKey: string;
  descriptionKey: string;
  status: TrustStatusKey;
  legalDisclosureKey?: string;
}

export interface LedgerGroupDef {
  groupKey: string;
  rows: LedgerRowDef[];
}

export interface LifecycleColumnDef {
  id: LifecycleColumnId;
  titleKey: string;
  status: TrustStatusKey;
}

export interface LifecycleRowDef {
  id: LifecycleRowId;
  labelKey: string;
  hasBoldTemp?: boolean;
}

export interface ProviderRowDef {
  id: string;
  nameKey: string;
  purposeKey: string;
  locationKey: string;
}

export interface QaItemDef {
  id: string;
  questionKey: string;
  answerKey?: string;
  answerBeforeKey?: string;
  answerAfterKey?: string;
  status?: TrustStatusKey;
}

export interface LegalDocumentDef {
  id: string;
  labelKey: string;
  ariaLabelKey: string;
}

export const GLANCE_LEDGER: LedgerGroupDef[] = [
  {
    groupKey: 'trust.glance.groups.current',
    rows: [
      {
        id: 'tempUpload',
        controlKey: 'trust.glance.rows.tempUpload.control',
        descriptionKey: 'trust.glance.rows.tempUpload.description',
        status: 'current',
      },
      {
        id: 'partnerIsolation',
        controlKey: 'trust.glance.rows.partnerIsolation.control',
        descriptionKey: 'trust.glance.rows.partnerIsolation.description',
        status: 'current',
      },
      {
        id: 'noTraining',
        controlKey: 'trust.glance.rows.noTraining.control',
        descriptionKey: 'trust.glance.rows.noTraining.description',
        status: 'current',
      },
      {
        id: 'publicTls',
        controlKey: 'trust.glance.rows.publicTls.control',
        descriptionKey: 'trust.glance.rows.publicTls.description',
        status: 'current',
      },
    ],
  },
  {
    groupKey: 'trust.glance.groups.agreementBound',
    rows: [
      {
        id: 'partnerTerms',
        controlKey: 'trust.glance.rows.partnerTerms.control',
        descriptionKey: 'trust.glance.rows.partnerTerms.description',
        status: 'agreementBound',
      },
      {
        id: 'privateLibraryRetention',
        controlKey: 'trust.glance.rows.privateLibraryRetention.control',
        descriptionKey: 'trust.glance.rows.privateLibraryRetention.description',
        status: 'agreementBound',
      },
    ],
  },
  {
    groupKey: 'trust.glance.groups.betaControl',
    rows: [
      {
        id: 'serviceStage',
        controlKey: 'trust.glance.rows.serviceStage.control',
        descriptionKey: 'trust.glance.rows.serviceStage.description',
        status: 'betaControl',
      },
      {
        id: 'controlledMedia',
        controlKey: 'trust.glance.rows.controlledMedia.control',
        descriptionKey: 'trust.glance.rows.controlledMedia.description',
        status: 'betaControl',
      },
      {
        id: 'backupControls',
        controlKey: 'trust.glance.rows.backupControls.control',
        descriptionKey: 'trust.glance.rows.backupControls.description',
        status: 'betaControl',
      },
    ],
  },
  {
    groupKey: 'trust.glance.groups.roadmapNotClaimed',
    rows: [
      {
        id: 'ddex',
        controlKey: 'trust.glance.rows.ddex.control',
        descriptionKey: 'trust.glance.rows.ddex.description',
        status: 'roadmap',
      },
      {
        id: 'securityCerts',
        controlKey: 'trust.glance.rows.securityCerts.control',
        descriptionKey: 'trust.glance.rows.securityCerts.description',
        status: 'notClaimed',
      },
      {
        id: 'uptimeSla',
        controlKey: 'trust.glance.rows.uptimeSla.control',
        descriptionKey: 'trust.glance.rows.uptimeSla.description',
        status: 'notClaimed',
      },
    ],
  },
];

export const LIFECYCLE_COLUMNS: LifecycleColumnDef[] = [
  {
    id: 'temp',
    titleKey: 'trust.lifecycles.columns.temp.title',
    status: 'current',
  },
  {
    id: 'library',
    titleKey: 'trust.lifecycles.columns.library.title',
    status: 'agreementBound',
  },
  {
    id: 'partner',
    titleKey: 'trust.lifecycles.columns.partner.title',
    status: 'agreementBound',
  },
];

export const LIFECYCLE_ROWS: LifecycleRowDef[] = [
  { id: 'purpose', labelKey: 'trust.lifecycles.rows.purpose.label' },
  { id: 'access', labelKey: 'trust.lifecycles.rows.access.label' },
  { id: 'publicVisibility', labelKey: 'trust.lifecycles.rows.publicVisibility.label' },
  { id: 'retention', labelKey: 'trust.lifecycles.rows.retention.label', hasBoldTemp: true },
  { id: 'deletionTrigger', labelKey: 'trust.lifecycles.rows.deletionTrigger.label' },
  { id: 'trainingUse', labelKey: 'trust.lifecycles.rows.trainingUse.label' },
];

export const LIFECYCLE_TAB_ORDER: LifecycleColumnId[] = ['temp', 'library', 'partner'];

export const RIGHTS_QA: QaItemDef[] = [
  {
    id: 'submit',
    questionKey: 'trust.rights.qa.0.question',
    answerKey: 'trust.rights.qa.0.answer',
  },
  {
    id: 'isolation',
    questionKey: 'trust.rights.qa.1.question',
    answerKey: 'trust.rights.qa.1.answer',
    status: 'current',
  },
  {
    id: 'access',
    questionKey: 'trust.rights.qa.2.question',
    answerKey: 'trust.rights.qa.2.answer',
    status: 'agreementBound',
  },
  {
    id: 'training',
    questionKey: 'trust.rights.qa.3.question',
    answerKey: 'trust.rights.qa.3.answer',
    status: 'current',
  },
  {
    id: 'analysis',
    questionKey: 'trust.rights.qa.4.question',
    answerKey: 'trust.rights.qa.4.answer',
  },
  {
    id: 'grant',
    questionKey: 'trust.rights.qa.5.question',
    answerKey: 'trust.rights.qa.5.answer',
    status: 'agreementBound',
  },
  {
    id: 'concern',
    questionKey: 'trust.rights.qa.6.question',
    answerBeforeKey: 'trust.rights.qa.6.answerBefore',
    answerAfterKey: 'trust.rights.qa.6.answerAfter',
  },
];

export const SECURITY_LEDGER: LedgerRowDef[] = [
  {
    id: 'publicTls',
    controlKey: 'trust.security.rows.publicTls.control',
    descriptionKey: 'trust.security.rows.publicTls.description',
    status: 'current',
  },
  {
    id: 'accountSession',
    controlKey: 'trust.security.rows.accountSession.control',
    descriptionKey: 'trust.security.rows.accountSession.description',
    status: 'current',
  },
  {
    id: 'twoFactor',
    controlKey: 'trust.security.rows.twoFactor.control',
    descriptionKey: 'trust.security.rows.twoFactor.description',
    status: 'current',
  },
  {
    id: 'abuseControls',
    controlKey: 'trust.security.rows.abuseControls.control',
    descriptionKey: 'trust.security.rows.abuseControls.description',
    status: 'current',
  },
  {
    id: 'apiAccess',
    controlKey: 'trust.security.rows.apiAccess.control',
    descriptionKey: 'trust.security.rows.apiAccess.description',
    status: 'current',
  },
  {
    id: 'partnerIsolation',
    controlKey: 'trust.security.rows.partnerIsolation.control',
    descriptionKey: 'trust.security.rows.partnerIsolation.description',
    status: 'current',
  },
  {
    id: 'controlledMedia',
    controlKey: 'trust.security.rows.controlledMedia.control',
    descriptionKey: 'trust.security.rows.controlledMedia.description',
    status: 'betaControl',
  },
  {
    id: 'incidentProcedures',
    controlKey: 'trust.security.rows.incidentProcedures.control',
    descriptionKey: 'trust.security.rows.incidentProcedures.description',
    status: 'current',
    legalDisclosureKey: 'trust.security.rows.incidentProcedures.legalDisclosure',
  },
  {
    id: 'backupControls',
    controlKey: 'trust.security.rows.backupControls.control',
    descriptionKey: 'trust.security.rows.backupControls.description',
    status: 'betaControl',
  },
];

export const PROVIDER_ROWS: ProviderRowDef[] = [
  {
    id: 'alwyzon',
    nameKey: 'trust.providers.rows.alwyzon.name',
    purposeKey: 'trust.providers.rows.alwyzon.purpose',
    locationKey: 'trust.providers.rows.alwyzon.location',
  },
  {
    id: 'hetzner',
    nameKey: 'trust.providers.rows.hetzner.name',
    purposeKey: 'trust.providers.rows.hetzner.purpose',
    locationKey: 'trust.providers.rows.hetzner.location',
  },
  {
    id: 'cloudflare',
    nameKey: 'trust.providers.rows.cloudflare.name',
    purposeKey: 'trust.providers.rows.cloudflare.purpose',
    locationKey: 'trust.providers.rows.cloudflare.location',
  },
  {
    id: 'googleWorkspace',
    nameKey: 'trust.providers.rows.googleWorkspace.name',
    purposeKey: 'trust.providers.rows.googleWorkspace.purpose',
    locationKey: 'trust.providers.rows.googleWorkspace.location',
  },
  {
    id: 'stripe',
    nameKey: 'trust.providers.rows.stripe.name',
    purposeKey: 'trust.providers.rows.stripe.purpose',
    locationKey: 'trust.providers.rows.stripe.location',
  },
  {
    id: 'posthog',
    nameKey: 'trust.providers.rows.posthog.name',
    purposeKey: 'trust.providers.rows.posthog.purpose',
    locationKey: 'trust.providers.rows.posthog.location',
  },
  {
    id: 'ghost',
    nameKey: 'trust.providers.rows.ghost.name',
    purposeKey: 'trust.providers.rows.ghost.purpose',
    locationKey: 'trust.providers.rows.ghost.location',
  },
];

export const RETENTION_LEDGER: LedgerRowDef[] = [
  {
    id: 'tempUpload',
    controlKey: 'trust.retention.rows.tempUpload.control',
    descriptionKey: 'trust.retention.rows.tempUpload.description',
    status: 'current',
  },
  {
    id: 'previews',
    controlKey: 'trust.retention.rows.previews.control',
    descriptionKey: 'trust.retention.rows.previews.description',
    status: 'currentQualified',
  },
  {
    id: 'privateLibrary',
    controlKey: 'trust.retention.rows.privateLibrary.control',
    descriptionKey: 'trust.retention.rows.privateLibrary.description',
    status: 'agreementBound',
  },
  {
    id: 'partnerCatalogue',
    controlKey: 'trust.retention.rows.partnerCatalogue.control',
    descriptionKey: 'trust.retention.rows.partnerCatalogue.description',
    status: 'agreementBound',
  },
  {
    id: 'savedAnalysis',
    controlKey: 'trust.retention.rows.savedAnalysis.control',
    descriptionKey: 'trust.retention.rows.savedAnalysis.description',
    status: 'currentLegalDisclosure',
  },
  {
    id: 'accountData',
    controlKey: 'trust.retention.rows.accountData.control',
    descriptionKey: 'trust.retention.rows.accountData.description',
    status: 'currentLegalDisclosure',
  },
  {
    id: 'usageData',
    controlKey: 'trust.retention.rows.usageData.control',
    descriptionKey: 'trust.retention.rows.usageData.description',
    status: 'currentLegalDisclosure',
  },
  {
    id: 'communicationRecords',
    controlKey: 'trust.retention.rows.communicationRecords.control',
    descriptionKey: 'trust.retention.rows.communicationRecords.description',
    status: 'currentLegalDisclosure',
  },
  {
    id: 'processingLogs',
    controlKey: 'trust.retention.rows.processingLogs.control',
    descriptionKey: 'trust.retention.rows.processingLogs.description',
    status: 'currentLegalDisclosure',
  },
];

export const RETENTION_LIMITS: LedgerRowDef[] = [
  {
    id: 'uptimeSla',
    controlKey: 'trust.retention.limits.uptimeSla.control',
    descriptionKey: 'trust.retention.limits.uptimeSla.description',
    status: 'notClaimed',
  },
  {
    id: 'backupsDr',
    controlKey: 'trust.retention.limits.backupsDr.control',
    descriptionKey: 'trust.retention.limits.backupsDr.description',
    status: 'betaControl',
  },
  {
    id: 'ddex',
    controlKey: 'trust.retention.limits.ddex.control',
    descriptionKey: 'trust.retention.limits.ddex.description',
    status: 'roadmap',
  },
  {
    id: 'securityCerts',
    controlKey: 'trust.retention.limits.securityCerts.control',
    descriptionKey: 'trust.retention.limits.securityCerts.description',
    status: 'notClaimed',
  },
  {
    id: 'regionalControls',
    controlKey: 'trust.retention.limits.regionalControls.control',
    descriptionKey: 'trust.retention.limits.regionalControls.description',
    status: 'notClaimed',
  },
  {
    id: 'mediaProtection',
    controlKey: 'trust.retention.limits.mediaProtection.control',
    descriptionKey: 'trust.retention.limits.mediaProtection.description',
    status: 'notClaimed',
  },
  {
    id: 'statusPage',
    controlKey: 'trust.retention.limits.statusPage.control',
    descriptionKey: 'trust.retention.limits.statusPage.description',
    status: 'roadmap',
  },
];

export const LEGAL_DOCUMENTS: LegalDocumentDef[] = [
  {
    id: 'privacy',
    labelKey: 'trust.legal.documents.0.label',
    ariaLabelKey: 'trust.legal.documents.0.ariaLabel',
  },
  {
    id: 'terms',
    labelKey: 'trust.legal.documents.1.label',
    ariaLabelKey: 'trust.legal.documents.1.ariaLabel',
  },
  {
    id: 'cookie',
    labelKey: 'trust.legal.documents.2.label',
    ariaLabelKey: 'trust.legal.documents.2.ariaLabel',
  },
  {
    id: 'aup',
    labelKey: 'trust.legal.documents.3.label',
    ariaLabelKey: 'trust.legal.documents.3.ariaLabel',
  },
  {
    id: 'dmca',
    labelKey: 'trust.legal.documents.4.label',
    ariaLabelKey: 'trust.legal.documents.4.ariaLabel',
  },
  {
    id: 'gdpr',
    labelKey: 'trust.legal.documents.5.label',
    ariaLabelKey: 'trust.legal.documents.5.ariaLabel',
  },
  {
    id: 'refund',
    labelKey: 'trust.legal.documents.6.label',
    ariaLabelKey: 'trust.legal.documents.6.ariaLabel',
  },
  {
    id: 'disclaimer',
    labelKey: 'trust.legal.documents.7.label',
    ariaLabelKey: 'trust.legal.documents.7.ariaLabel',
  },
  {
    id: 'oss',
    labelKey: 'trust.legal.documents.8.label',
    ariaLabelKey: 'trust.legal.documents.8.ariaLabel',
  },
];
