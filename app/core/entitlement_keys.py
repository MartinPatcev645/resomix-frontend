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

    # --- pricing v2.1 -------------------------------------------------------------------------
    # Counted features use -1 for "unlimited" (EntitlementGate.UNLIMITED); 0 denies.
    LIBRARY_PLAYLISTS_MAX = "library_playlists_max"    # how many are LISTED in the Library
    EXPORTS_PER_DAY = "exports_per_day"                # window: daily
    CAN_VIEW_FULL_ANALYSIS = "can_view_full_analysis"  # the full Track Intelligence page
    CAN_EXPORT_ANALYSIS_PDF = "can_export_analysis_pdf"  # download Track Intelligence as a PDF
    SEARCH_RESULTS_MAX = "search_results_max"          # rows returned by /search


class PriceKind:
    """Which offer a ``plan_prices`` row belongs to.

    ``FOUNDING`` is sold only while the beta window is open (``settings.beta_end_date``).
    ``LIST`` is the standing price, and is what a founding subscription's schedule rolls onto —
    so it must exist in Stripe *before* the first founding sale, even though nobody is charged it
    yet. Both can exist for the same plan / interval / currency; that is why the unique key on
    ``plan_prices`` includes this column.
    """
    FOUNDING = "founding"
    LIST = "list"


# How many billing cycles a founding subscription keeps its rate before rolling onto the list
# price. From §5.3: 22 monthly cycles, or 2 yearly ones ("your first two years at the founding
# rate"). Phase 1 of the Stripe Subscription Schedule runs for exactly this many iterations.
FOUNDING_LOCK_ITERATIONS = {"month": 22, "year": 2}


# Plan codes (tiers).
class PlanCode:
    GUEST = "guest"
    FREE = "free"
    BASIC = "basic"
    PRO = "pro"
    MAX = "max"


# Subscription statuses that grant the subscription's plan (else fall back to free).
ACTIVE_SUBSCRIPTION_STATUSES = ("active", "trialing")
