"""
Seed RBAC Script
================

Idempotent script to seed roles and permissions into the database.
Also supports bootstrapping an initial admin user.

Usage:
  python scripts/seed_rbac.py [--admin-email user@example.com]
"""

import asyncio
import argparse
import sys
import os

# Add project root to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.api.dependencies.database import get_database_session
from app.models.user import Role, Permission, RolePermission, User, UserRole
from app.core.config import settings

from app.core.rbac import ROLES, PERMISSIONS, ROLE_PERMISSIONS


async def seed_rbac(admin_email: str = None):
    """
    Main seeding logic.
    """
    print("--- Starting RBAC Seeding ---")
    
    # Get DB session
    async for db in get_database_session():
        # 1. Seed Permissions
        permission_map = {}
        for perm_name, perm_desc in PERMISSIONS.items():
            result = await db.execute(select(Permission).where(Permission.name == perm_name))
            permission = result.scalar_one_or_none()
            
            if not permission:
                print(f"Creating permission: {perm_name}")
                permission = Permission(name=perm_name, description=perm_desc)
                db.add(permission)
                await db.flush()
            permission_map[perm_name] = permission

        # 2. Seed Roles
        role_map = {}
        for role_name, role_desc in ROLES.items():
            result = await db.execute(select(Role).where(Role.name == role_name))
            role = result.scalar_one_or_none()
            
            if not role:
                print(f"Creating role: {role_name}")
                role = Role(name=role_name, description=role_desc)
                db.add(role)
                await db.flush()
            role_map[role_name] = role

        # 3. Associate Permissions with Roles
        for role_name, perms in ROLE_PERMISSIONS.items():
            role = role_map[role_name]
            for perm_name in perms:
                perm = permission_map[perm_name]
                # Check if already associated
                result = await db.execute(
                    select(RolePermission).where(
                        RolePermission.role_id == role.id,
                        RolePermission.permission_id == perm.id
                    )
                )
                if not result.scalar_one_or_none():
                    print(f"Assigning {perm_name} to role {role_name}")
                    rp = RolePermission(role_id=role.id, permission_id=perm.id)
                    db.add(rp)

        # 4. Bootstrap Admin User (Optional)
        if admin_email:
            result = await db.execute(select(User).where(User.email == admin_email))
            user = result.scalar_one_or_none()
            
            if user:
                admin_role = role_map["admin"]
                # Check if already has admin role
                result = await db.execute(
                    select(UserRole).where(
                        UserRole.user_id == user.id,
                        UserRole.role_id == admin_role.id
                    )
                )
                if not result.scalar_one_or_none():
                    print(f"Bootstrapping admin role for: {admin_email}")
                    ur = UserRole(user_id=user.id, role_id=admin_role.id)
                    db.add(ur)
                
                # Ensure user is active
                if hasattr(user, 'is_active') and not user.is_active:
                    print(f"Activating user: {admin_email}")
                    user.is_active = True
            else:
                print(f"WARNING: User with email {admin_email} not found. Cannot bootstrap admin role.")

        await db.commit()
        print("--- RBAC Seeding Completed Successfully ---")
        break  # Exit generator after one session


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed RBAC roles and permissions.")
    parser.add_argument("--admin-email", help="Email of the user to grant admin role.")
    args = parser.parse_args()

    asyncio.run(seed_rbac(args.admin_email))
