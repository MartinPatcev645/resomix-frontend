"""sync permissions and grant every one of them to the admin role

THE PROBLEM THIS SOLVES

Permissions live in the DATABASE (`permissions` + `role_permissions`). Adding one to the
`PERMISSIONS` registry in `app/core/rbac.py` changes what the code *checks for*, but grants nobody
anything — so the endpoint immediately answers **"Insufficient permissions. Required: user:message"**
to an admin who is, by every other definition, an administrator.

`ROLE_PERMISSIONS["admin"]` is already `list(PERMISSIONS.keys())` — "admin has everything" is the
intent in code. This makes the database agree.

`scripts/seed_rbac.py` also fixes it and is idempotent, but it is a manual step, and a manual step
that must be remembered on every future permission is a manual step that will be forgotten. This
runs on deploy.

HOW THE GRANT IS WRITTEN

The second statement does not name a single permission:

    INSERT ... SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'admin'

Every permission that exists, granted to admin, skipping any already there. So it repairs whatever
drift is present rather than only the ones this migration happens to know about.

The permission list IS spelled out, because a migration is a snapshot: importing `PERMISSIONS`
would make re-running this migration do something different next year, which is precisely what a
migration must never do.

Revision ID: e4a8d2f6b9c3
Revises: c1a4e8b3f6d2
Create Date: 2026-08-08
"""

from alembic import op
from sqlalchemy import text

revision = "e4a8d2f6b9c3"
down_revision = "c1a4e8b3f6d2"
branch_labels = None
depends_on = None

# Snapshot of app/core/rbac.py PERMISSIONS at this revision. Deliberately literal — see above.
PERMISSIONS = [
    ("track:read", "View tracks and their metadata"),
    ("playlist:read", "View playlists"),
    ("playlist:create", "Create a playlist"),
    ("playlist:update", "Edit a playlist"),
    ("playlist:delete", "Delete a playlist"),
    ("playlist:fork", "Fork a playlist"),
    ("similarity:search", "Run a similarity search"),
    ("similarity:upload", "Run similarity by upload"),
    ("spotify:transfer", "Transfer a playlist to Spotify"),
    ("profile:read", "View own profile"),
    ("profile:update", "Edit own profile"),
    ("admin:access", "Can log in to and use the admin interface"),
    ("user:read", "List and view user details"),
    ("user:create", "Register a new user manually"),
    ("user:update", "Edit any user's profile or status"),
    ("user:delete", "Deactivate or delete a user"),
    ("user:message", "Email a user directly, or reply to their contact/feedback"),
    ("user:role:assign", "Assign or revoke roles on any user"),
    ("partner:read", "View partner records"),
    ("partner:create", "Create a new partner tenant"),
    ("partner:update", "Update partner details"),
    ("partner:delete", "Delete a partner"),
    ("partner:api_key:manage", "Issue, revoke, or rotate API keys for partners"),
    ("role:read", "View roles and permissions"),
    ("role:manage", "Create or edit roles and their permissions"),
    ("operation_limit:manage", "Manage per-user operation limits"),
    ("plans:manage", "Manage plans, prices and entitlements"),
    ("waitlist:manage", "Manage the waitlist"),
    ("feedback:manage", "Manage submitted feedback"),
    ("contact:manage", "Manage contact submissions"),
    ("content:takedown", "Issue a manual takedown"),
    ("reports:view", "View and export reports"),
    ("partners:manage", "Manage partners"),
    ("playlist:manage", "Administer any playlist"),
    ("promo:manage", "Manage promo codes"),
    ("similarity:manage", "Administer similarity settings"),
    ("spotify_apps:manage", "Manage Spotify applications"),
]


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Any permission the code checks for but the database has never heard of.
    for name, description in PERMISSIONS:
        conn.execute(
            text(
                "INSERT INTO permissions (name, description) "
                "SELECT :name, :description FROM DUAL "
                "WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = :name)"
            ),
            {"name": name, "description": description},
        )

    # 2. Grant admin EVERY permission that exists — including any added by other means. Named
    #    nowhere, so this repairs whatever drift is present rather than a fixed list.
    result = conn.execute(
        text(
            """
            INSERT INTO role_permissions (role_id, permission_id)
            SELECT r.id, p.id
            FROM roles r
            CROSS JOIN permissions p
            WHERE r.name = 'admin'
              AND NOT EXISTS (
                  SELECT 1 FROM role_permissions rp
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id
              )
            """
        )
    )
    print(f"Granted {result.rowcount} additional permission(s) to the admin role.")


def downgrade() -> None:
    # Deliberately not reversed. Revoking an admin's permissions to roll back a schema change would
    # lock people out of the admin panel, and nothing here is a schema change to begin with.
    pass
