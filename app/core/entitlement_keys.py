"""
Entitlement Feature Keys
========================

Canonical feature-key constants for the frontend plan/entitlement system. Using these
constants (never string literals) prevents typos drifting across services. Keys MUST match
the seeded ``features.key`` values (see ``app/services/entitlement_seed.py``).
"""


class FeatureKey:
    # Monthly usage window: resets on the subject's billing anchor (subscriber = Stripe cycle,
    # free = signup anniversary, guest = calendar month). See BillingPeriodService.
    SEARCH_PLAYLISTS_PER_MONTH = "search_playlists_per_month"
    MAX_TRACKS_PER_PLAYLIST = "max_tracks_per_playlist"
    DROPDOWN_MAX_TRACKS = "dropdown_max_tracks"
    CAN_EXPORT = "can_export"
    EXPORT_SCOPE = "export_scope"
    EXPORT_TRACK_LIMIT = "export_track_limit"
    EXPORT_TARGETS = "export_targets"
    CAN_RENAME = "can_rename"
    CAN_FAVORITE = "can_favorite"
    CAN_RATE_TRACKS = "can_rate_tracks"
    UPLOADS_PER_MONTH = "uploads_per_month"
    ANALYSIS_FEATURE_COUNT = "analysis_feature_count"
    CAN_SIMILARITY_UPLOAD = "can_similarity_upload"
    DEFAULT_PLAYLIST_VISIBILITY = "default_playlist_visibility"
    SIGNUP_BONUS_PLAYLISTS = "signup_bonus_playlists"


# Plan codes (tiers).
class PlanCode:
    GUEST = "guest"
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    MAX = "max"


# Subscription statuses that grant the subscription's plan (else fall back to free).
ACTIVE_SUBSCRIPTION_STATUSES = ("active", "trialing")
