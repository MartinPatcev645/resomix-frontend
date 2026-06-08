export type PartnerTier = "sandbox" | "starter" | "growth" | "enterprise";
export type ServiceMode = "similarity_only" | "similarity_playback";

export interface Partner {
  id: number;
  partner_uuid: string;
  legal_name: string;
  display_name: string;
  contact_email: string;
  tier: PartnerTier;
  is_active: boolean;
  onboarded_at: string;
  country_code?: string;
  vat_number?: string;
  service_mode?: ServiceMode;
}

export interface PartnerApiKey {
  id: number;
  partner_id: number;
  key_prefix: string;
  label: string;
  scopes: string[];
  rate_limit_rps: number;
  rate_limit_monthly: number;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  revoked_at?: string;
  revoked_reason?: string;
  usage_count: number;
}

export interface PartnerCreateRequest {
  legal_name: string;
  display_name: string;
  contact_email: string;
  tier?: PartnerTier;
  country_code?: string;
  vat_number?: string;
  notes?: string;
  service_mode?: ServiceMode;
}

export interface ApiKeyIssueRequest {
  partner_id: number;
  label: string;
  scopes?: string[];
  rate_limit_rps?: number;
  rate_limit_monthly?: number;
  expires_at?: string;
}

export interface ApiKeyIssueResponse {
  key_prefix: string;
  plaintext_key: string;
  label: string;
  scopes: string[];
  expires_at?: string;
}

export interface ApiKeyRevokeRequest {
  api_key_id: number;
  reason: string;
}

export interface ApiKeyRotateRequest {
  api_key_id: number;
  label?: string;
}
