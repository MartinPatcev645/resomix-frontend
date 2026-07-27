"""
Admin account management
========================

Create / update / rename / revoke admin users using the app's OWN password hashing (bcrypt, via
``app.core.security.hash_password``) and the RBAC ``admin`` role. Safe, idempotent, transactional.

Run from the repo root with the venv python (on whatever box owns the DB):

    .venv/bin/python scripts/manage_admin.py list
    .venv/bin/python scripts/manage_admin.py set    <email> [--name "Full Name"]   # create-or-update + grant admin
    .venv/bin/python scripts/manage_admin.py passwd <email>                          # reset password only
    .venv/bin/python scripts/manage_admin.py rename <old-email> <new-email>          # change email (keeps id/roles/history)
    .venv/bin/python scripts/manage_admin.py revoke <email>                          # remove admin role + deactivate (safe 'delete')

Passwords are read via a hidden getpass prompt (never shell history) or the ``ADMIN_PW`` env var.
Admin login is always two-factor (an email code), so the email MUST be a real, reachable inbox.
"""

import os
import sys
import uuid
import getpass
import argparse

# Ensure repo root is importable (mirrors scripts/seed_data.py).
sys.path.append(os.getcwd())

from sqlalchemy import text
from database.connection import engine
from app.core.security import hash_password


def _read_password() -> str:
    pw = os.getenv("ADMIN_PW")
    if pw:
        return pw
    pw = getpass.getpass("New password: ")
    if pw != getpass.getpass("Confirm password: "):
        sys.exit("Passwords do not match — aborted.")
    if len(pw) < 8:
        sys.exit("Password too short (min 8) — aborted.")
    return pw


def _admin_role_id(conn) -> int:
    rid = conn.execute(text("SELECT id FROM roles WHERE name = 'admin'")).scalar()
    if not rid:
        sys.exit("No 'admin' role found — run scripts/seed_rbac.py first.")
    return rid


def _user_id(conn, email: str):
    return conn.execute(text("SELECT id FROM users WHERE email = :e"), {"e": email}).scalar()


def cmd_list(conn) -> None:
    rows = conn.execute(text(
        """
        SELECT u.id, u.email, u.username, u.is_active, GROUP_CONCAT(r.name) AS roles
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        LEFT JOIN roles r ON r.id = ur.role_id
        GROUP BY u.id, u.email, u.username, u.is_active
        HAVING roles LIKE '%admin%'
        ORDER BY u.id
        """
    )).fetchall()
    if not rows:
        print("No admin users found.")
        return
    print(f"{'id':>4}  {'active':>6}  {'email':<34} {'username':<18} roles")
    for r in rows:
        print(f"{r.id:>4}  {str(bool(r.is_active)):>6}  {r.email:<34} {r.username:<18} {r.roles}")


def cmd_set(conn, email: str, name) -> None:
    email = email.strip().lower()
    pw_hash = hash_password(_read_password())
    role_id = _admin_role_id(conn)
    uid = _user_id(conn, email)
    if uid:
        conn.execute(
            text("UPDATE users SET password_hash = :p, is_active = 1, is_email_verified = 1 WHERE id = :id"),
            {"p": pw_hash, "id": uid},
        )
        print(f"Updated existing user id={uid} ({email}): password reset, activated.")
    else:
        # Derive a unique username from the name/local-part.
        base = (name or email.split("@")[0]).strip().lower().replace(" ", "_")[:46] or "admin"
        username, n = base, 1
        while conn.execute(text("SELECT 1 FROM users WHERE username = :u"), {"u": username}).scalar():
            n += 1
            username = f"{base}_{n}"
        conn.execute(
            text(
                """
                INSERT INTO users (uuid, username, email, password_hash, name, is_email_verified, is_active, partner_id)
                VALUES (:uuid, :username, :email, :pw, :name, 1, 1, 1)
                """
            ),
            {"uuid": str(uuid.uuid4()), "username": username, "email": email,
             "pw": pw_hash, "name": name or email.split("@")[0]},
        )
        uid = _user_id(conn, email)
        print(f"Created user id={uid} ({email}, username='{username}').")
    conn.execute(
        text("INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (:u, :r)"),
        {"u": uid, "r": role_id},
    )
    print(f"Granted 'admin' role to id={uid}.")


def cmd_passwd(conn, email: str) -> None:
    email = email.strip().lower()
    uid = _user_id(conn, email)
    if not uid:
        sys.exit(f"No user with email {email}.")
    conn.execute(
        text("UPDATE users SET password_hash = :p WHERE id = :id"),
        {"p": hash_password(_read_password()), "id": uid},
    )
    print(f"Password reset for id={uid} ({email}).")


def cmd_rename(conn, old: str, new: str) -> None:
    old, new = old.strip().lower(), new.strip().lower()
    uid = _user_id(conn, old)
    if not uid:
        sys.exit(f"No user with email {old}.")
    if _user_id(conn, new):
        sys.exit(f"Email {new} is already in use — pick another or revoke it first.")
    conn.execute(text("UPDATE users SET email = :new WHERE id = :id"), {"new": new, "id": uid})
    print(f"Renamed id={uid}: {old} -> {new} (roles, history and id preserved).")


def cmd_revoke(conn, email: str) -> None:
    email = email.strip().lower()
    uid = _user_id(conn, email)
    if not uid:
        sys.exit(f"No user with email {email}.")
    role_id = _admin_role_id(conn)
    conn.execute(text("DELETE FROM user_roles WHERE user_id = :u AND role_id = :r"), {"u": uid, "r": role_id})
    conn.execute(text("UPDATE users SET is_active = 0 WHERE id = :id"), {"id": uid})
    print(f"Revoked 'admin' from id={uid} ({email}) and deactivated the account "
          f"(row kept so audit-log / playlist references stay intact).")


def main() -> None:
    ap = argparse.ArgumentParser(description="Manage Resomix admin accounts.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    p = sub.add_parser("set"); p.add_argument("email"); p.add_argument("--name", default=None)
    p = sub.add_parser("passwd"); p.add_argument("email")
    p = sub.add_parser("rename"); p.add_argument("old"); p.add_argument("new")
    p = sub.add_parser("revoke"); p.add_argument("email")
    args = ap.parse_args()

    with engine.begin() as conn:  # one transaction; rolls back on any error
        if args.cmd == "list":
            cmd_list(conn)
        elif args.cmd == "set":
            cmd_set(conn, args.email, args.name)
        elif args.cmd == "passwd":
            cmd_passwd(conn, args.email)
        elif args.cmd == "rename":
            cmd_rename(conn, args.old, args.new)
        elif args.cmd == "revoke":
            cmd_revoke(conn, args.email)


if __name__ == "__main__":
    main()
