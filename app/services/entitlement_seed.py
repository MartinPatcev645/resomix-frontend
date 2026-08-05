"""
Entitlement Seed
================

Idempotent baseline seed for the frontend plan/entitlement system: the ``features`` catalog
and the ``guest`` / ``free`` / ``basic`` / ``pro`` / ``max`` plans with their entitlement values.

**Create-if-missing semantics:** re-running never clobbers admin edits — it only inserts rows
that don't yet exist. This makes it safe to run on every deploy and in tests. Numbers here are
the launch defaults from the design doc; the admin can (and will) tune them live afterward.

Run via ``python -m scripts.seed_entitlements`` (see that runner) or call ``seed_entitlements``.

Version: 1.0.0
Init Date: July 4, 2026
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from typing import Any, Dict, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.plan import Feature, Plan, PlanEntitlement

# key, name, value_type, window, default_value, description
FEATURE_CATALOG = [
    # Key kept on purpose (referenced by the gate, the seed and FEATURE_KEYS) — only the WINDOW moved.
    ("search_playlists_per_month",  "Search playlists per day",             "int",  "daily", "0",       "Max SEARCH playlists (catalogue similarity, not upload) per UTC day. -1 = unlimited."),
    ("max_tracks_per_playlist",     "Usable tracks per playlist (unlock)",  "int",  "none",  "10",      "How many of the generated tracks are unlocked/usable."),
    ("dropdown_max_tracks",         "Max selectable track count",           "int",  "none",  "20",      "Highest track-count dropdown option; rest are greyed."),
    ("can_export",                  "Can export playlist",                  "bool", "none",  "false",   "Whether export is allowed at all."),
    ("export_scope",                "Export scope",                         "enum", "none",  "none",    "none | first_n | full"),
    ("export_track_limit",          "Export track limit",                   "int",  "none",  "0",       "Max tracks in an export. Also bounded by what the plan unlocks (max_tracks_per_playlist), so the file never exceeds what the user can see. 0 or -1 = no export-specific cap."),
    ("export_targets",              "Allowed export targets",               "csv",  "none",  "",        "Allowed export destinations (CSV): txt, apple, embed, tidal, serato, rekordbox. 'apple_music' is accepted as an alias of 'apple'."),
    ("can_rename",                  "Can rename own playlist",              "bool", "none",  "false",   "Logged-in owners only."),
    ("can_favorite",               "Can favorite playlists",               "bool", "none",  "false",   "Logged-in only."),
    ("can_rate_tracks",            "Can rate tracks",                      "bool", "none",  "false",   "Logged-in only."),
    ("uploads_per_month",          "Uploads per month",                   "int",  "monthly", "0",     "Monthly upload allowance — one upload = analysis + similarity (resets on the subject's billing anchor)."),
    ("analysis_feature_count",     "Analysis features shown (of 20)",     "int",  "none",  "0",       "How many analysis features are revealed."),
    ("can_similarity_upload",      "Can run similarity by upload",        "bool", "none",  "false",   "Upload a track to find similars."),
    ("default_playlist_visibility","Default playlist visibility",         "enum", "none",  "public",  "public | private"),
    ("signup_bonus_playlists",     "Signup bonus playlists",              "int",  "none",  "0",       "Extra one-time playlist allowance granted on signup."),
    # --- pricing v2.1 -------------------------------------------------------------------------
    # -1 = unlimited (see EntitlementGate.UNLIMITED). 0 = denied. Never reuse 0 for "no ceiling".
    ("library_playlists_max",      "Playlists visible in Library",        "int",  "none",  "0",       "How many playlists are LISTED in the Library. Does not cap creation — beyond this they are created hidden and stay reachable by link. -1 = unlimited."),
    ("exports_per_day",            "Exports per day",                     "int",  "daily", "0",       "Playlist exports per UTC day (txt / apple_music / embed all count). -1 = unlimited."),
    ("can_view_full_analysis",     "Can open full Track Intelligence",    "bool", "none",  "false",   "The analysis SUMMARY card is available to anyone who can upload; this gates the full Track Intelligence page."),
]

# code, name, price_cents, billing_interval, is_active, is_default, is_assignable, sort_order
PLAN_CATALOG = [
    ("guest", "Guest",  0,    "none",  True,  False, False, 0),
    ("free",  "Free",   0,    "none",  True,  True,  True,  1),
    ("basic", "Basic",  500,  "month", False, False, True,  2),   # draft (inactive) until paid launch
    ("pro",   "Pro",    1000, "month", False, False, True,  3),
    ("max",   "Max",    2000, "month", False, False, True,  4),
]

# plan_code -> {feature_key: value}
PLAN_ENTITLEMENTS: Dict[str, Dict[str, Any]] = {
    "guest": {
        "search_playlists_per_month": 3, "max_tracks_per_playlist": 10, "dropdown_max_tracks": 20,
        "can_export": False, "export_scope": "none", "export_track_limit": 0, "export_targets": "",
        "can_rename": False, "can_favorite": False, "can_rate_tracks": False,
        "uploads_per_month": 0, "analysis_feature_count": 0, "can_similarity_upload": False,
        "default_playlist_visibility": "public", "signup_bonus_playlists": 0,
        "library_playlists_max": 0, "exports_per_day": 0, "can_view_full_analysis": False,
    },
    "free": {
        "search_playlists_per_month": 3, "max_tracks_per_playlist": 20, "dropdown_max_tracks": 50,
        "can_export": True, "export_scope": "full", "export_track_limit": 20, "export_targets": "txt,apple",
        "can_rename": True, "can_favorite": True, "can_rate_tracks": True,
        "uploads_per_month": 5, "analysis_feature_count": 5, "can_similarity_upload": True,
        "default_playlist_visibility": "private", "signup_bonus_playlists": 2,
        "library_playlists_max": 5, "exports_per_day": 1, "can_view_full_analysis": False,
    },
    "basic": {
        "search_playlists_per_month": 30, "max_tracks_per_playlist": 50, "dropdown_max_tracks": 100,
        "can_export": True, "export_scope": "full", "export_track_limit": 0, "export_targets": "txt,apple",
        "can_rename": True, "can_favorite": True, "can_rate_tracks": True,
        "uploads_per_month": 30, "analysis_feature_count": 10, "can_similarity_upload": True,
        "default_playlist_visibility": "private", "signup_bonus_playlists": 2,
        "library_playlists_max": 25, "exports_per_day": 5, "can_view_full_analysis": True,
    },
    "pro": {
        "search_playlists_per_month": -1, "max_tracks_per_playlist": 100, "dropdown_max_tracks": 100,
        "can_export": True, "export_scope": "full", "export_track_limit": 100, "export_targets": "txt,apple,embed",
        "can_rename": True, "can_favorite": True, "can_rate_tracks": True,
        "uploads_per_month": 50, "analysis_feature_count": 20, "can_similarity_upload": True,
        "default_playlist_visibility": "private", "signup_bonus_playlists": 2,
        "library_playlists_max": -1, "exports_per_day": -1, "can_view_full_analysis": True,
    },
    "max": {
        "search_playlists_per_month": -1, "max_tracks_per_playlist": 100, "dropdown_max_tracks": 100,
        "can_export": True, "export_scope": "full", "export_track_limit": 0,
        "export_targets": "txt,apple,embed,tidal,serato,rekordbox",
        "can_rename": True, "can_favorite": True, "can_rate_tracks": True,
        "uploads_per_month": 300, "analysis_feature_count": 20, "can_similarity_upload": True,
        "default_playlist_visibility": "private", "signup_bonus_playlists": 2,
        "library_playlists_max": -1, "exports_per_day": -1, "can_view_full_analysis": True,
    },
}


def _assign_typed_value(ent: PlanEntitlement, value_type: str, value: Any) -> None:
    """Write ``value`` into the correct typed column per the feature's value_type."""
    if value_type == "int":
        ent.int_value = int(value)
    elif value_type == "bool":
        ent.bool_value = bool(value)
    else:  # enum | csv
        ent.string_value = "" if value is None else str(value)


async def seed_entitlements(db: AsyncSession, updated_by: Optional[int] = None) -> Dict[str, int]:
    """Create-if-missing seed of features, plans and their entitlements. Returns counts of
    rows *created* this run (0s on a re-run). Caller commits."""
    created = {"features": 0, "plans": 0, "entitlements": 0}

    # 1. Features (by key)
    features_by_key: Dict[str, Feature] = {
        f.key: f for f in (await db.execute(select(Feature))).scalars().all()
    }
    for key, name, vtype, window, default_value, desc in FEATURE_CATALOG:
        if key not in features_by_key:
            f = Feature(key=key, name=name, value_type=vtype, window=window,
                        default_value=default_value, description=desc)
            db.add(f)
            features_by_key[key] = f
            created["features"] += 1
    await db.flush()  # ensure feature ids

    # 2. Plans (by code)
    plans_by_code: Dict[str, Plan] = {
        p.code: p for p in (await db.execute(select(Plan))).scalars().all()
    }
    for code, name, price, interval, active, default, assignable, order in PLAN_CATALOG:
        if code not in plans_by_code:
            p = Plan(code=code, name=name, price_cents=price, currency="EUR",
                     billing_interval=interval, is_active=active, is_default=default,
                     is_assignable=assignable, sort_order=order, updated_by=updated_by)
            db.add(p)
            plans_by_code[code] = p
            created["plans"] += 1
    await db.flush()  # ensure plan ids

    # 3. Entitlements (by plan_id + feature_id) — create-if-missing
    existing = {
        (e.plan_id, e.feature_id)
        for e in (await db.execute(select(PlanEntitlement))).scalars().all()
    }
    for plan_code, feature_values in PLAN_ENTITLEMENTS.items():
        plan = plans_by_code[plan_code]
        for feature_key, value in feature_values.items():
            feature = features_by_key[feature_key]
            if (plan.id, feature.id) in existing:
                continue
            ent = PlanEntitlement(plan_id=plan.id, feature_id=feature.id, updated_by=updated_by)
            _assign_typed_value(ent, feature.value_type, value)
            db.add(ent)
            existing.add((plan.id, feature.id))
            created["entitlements"] += 1

    await db.flush()
    return created
