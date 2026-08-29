"""
RBAC Constants and Definitions
==============================

Defines all permissions and roles used in the system.
"""

# Define all available permissions in the system
PERMISSIONS = {
    # User-Facing
    "track:read": "View and search tracks",
    "playlist:read": "View playlists",
    "playlist:create": "Create a new playlist",
    "playlist:update": "Edit own playlists",
    "playlist:delete": "Delete own playlists",
    "playlist:fork": "Fork a public playlist",
    "similarity:search": "Run a similarity search by track ID",
    "similarity:upload": "Upload audio for similarity search",
    "spotify:transfer": "Transfer a playlist to Spotify",
    "profile:read": "Read own profile",
    "profile:update": "Update own profile",
    
    # Admin-Only
    "admin:access": "Can log in to and use the admin interface",
    "user:read": "List and view user details",
    "user:create": "Register a new user manually",
    "user:update": "Edit any user's profile or status",
    "user:delete": "Deactivate or delete a user",
    "user:message": "Email a user directly, or reply to their contact or feedback",
    "user:role:assign": "Assign or revoke roles on any user",
    "user:message": "Email a user directly, or reply to their contact/feedback",
    "partner:read": "View partner records",
    "partner:create": "Create a new partner tenant",
    "partner:update": "Update partner details",
    "partner:delete": "Delete a partner",
    "partner:api_key:manage": "Issue, revoke, or rotate API keys for partners",
    "role:read": "View roles and their permissions",
    "role:manage": "Create, update, or delete roles and their permission assignments",
    "operation_limit:manage": "Set or adjust per-user operation limits",
    "plans:manage": "View and edit frontend plans, features, and entitlement values",
    "waitlist:manage": "Approve, reject, or delete waitlist entries",
    "feedback:manage": "View and resolve feedback entries",
    "contact:manage": "View and resolve contact inquiries",
    "content:takedown": "Issue a manual content takedown",
    "reports:view": "View generated reports and analytics",
    # Admin management umbrellas (referenced by admin routers; formerly reachable only via the
    # static super-key, which bypassed the permission check. Registered so the admin role — and
    # any future scoped operator role — can actually be granted them via RBAC.)
    "partners:manage": "Full administrative management of partner tenants and their API keys",
    "playlist:manage": "Administrative management of any playlist (moderation, reparenting)",
    "promo:manage": "Create, update, or delete promo codes and campaigns",
    "similarity:manage": "Administrative management of similarity indexes and results",
    "spotify_apps:manage": "Manage Spotify application credentials used for playlist transfers",
    # Backups. Split into read and manage because "see whether last night worked"
    # and "start a run / delete snapshots" are different levels of trust: the
    # first is something any operator on call should have, the second touches
    # the only copy of the data we would ever recover from.
    "backup:read": "View backup run history, status, and snapshot inventory",
    "backup:manage": "Trigger backup runs and verification, and manage retention",
}

# Define roles and their descriptions
ROLES = {
    "admin": "Super administrator with full access to all resources and management functions.",
    "partner_admin": "Administrative user for a specific partner tenant. Can manage partner's own keys and users.",
    "user": "Standard consumer user. Restricted to their own data and public resources.",
}

# Role to Permission mapping
ROLE_PERMISSIONS = {
    "admin": list(PERMISSIONS.keys()),
    "partner_admin": ["partner:read", "partner:api_key:manage", "user:read"],
    "user": [
        "track:read", "playlist:read", "playlist:create", "playlist:update",
        "playlist:delete", "playlist:fork", "similarity:search", "similarity:upload",
        "spotify:transfer", "profile:read", "profile:update"
    ],
}
