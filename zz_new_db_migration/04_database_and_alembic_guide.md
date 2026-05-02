# Phase 4: Database Provisioning & Alembic Migrations

This document provides a comprehensive guide for managing the database lifecycle across both your local development environment and your live production server. It covers database creation, Alembic migration execution, and secure remote connection handling.

---

## 1. The Initial Alembic Migration

An initial Alembic migration file (`alembic/versions/b4d71a1d2df0_initial_schema.py`) has been configured to read directly from `alembic/versions/schema.sql` (a localized copy of your new database).

When you run `alembic upgrade head`, this migration will:
1. Load `schema.sql`.
2. Strip out block comments.
3. Split the SQL file by semicolons (`;`).
4. Execute every single table creation and relationship map in sequence on your target database.

Because Alembic tracks this migration in an `alembic_version` table, your database will now be natively synced with Alembic. **IMPORTANT: The `schema.sql` file is ONLY used for this "ground zero" baseline. You will never edit `schema.sql` again.** All future changes will be driven by your Python code.

---

## 2. Local Environment Workflow (Docker)

For safe local testing, we use a Dockerized MariaDB instance.

### Step 1: Create the Database
If you haven't already spun up your container and created the database, run:
```bash
# Start the MariaDB container
docker run --name resomix-test-db -e MYSQL_ROOT_PASSWORD=test -p 3307:3306 -d mariadb:10.5

# Wait a few seconds for the server to start, then create the database
docker exec -i resomix-test-db mariadb -uroot -ptest -e "CREATE DATABASE IF NOT EXISTS resomix_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### Step 2: Configure Local `.env`
Ensure your local `.env` file points to this Docker container:
```env
MARIA_DB_HOST=127.0.0.1
MARIA_DB_PORT=3307
MARIA_DB_USER=root
MARIA_DB_PASS=test
MARIA_DB_NAME=resomix_db
```

### Step 3: Run the Migration
Execute the Alembic upgrade to apply the `new_database.sql` schema:
```bash
alembic upgrade head
```
*If successful, you will see Alembic applying the `b4d71a1d2df0` revision.*

---

## 3. Live Server Workflow (Production)

The production database requires manual provisioning followed by a secure migration process over an SSH tunnel.

### Step 1: Provision the Live Database
SSH into your live server and launch the MariaDB console as an administrator:
```bash
# SSH into the server
ssh user@your-server-ip

# Open MariaDB as root
sudo mariadb
```

Once inside the MariaDB prompt, create the database and a dedicated user:
```sql
-- Create the database with proper encoding
CREATE DATABASE IF NOT EXISTS resomix_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create the application user (Change 'your_secure_password')
CREATE USER 'resomix'@'127.0.0.1' IDENTIFIED BY 'your_secure_password';

-- Grant full privileges on the resomix database
GRANT ALL PRIVILEGES ON resomix_db.* TO 'resomix'@'127.0.0.1';

-- Flush privileges to apply
FLUSH PRIVILEGES;

-- Exit
EXIT;
```

### Step 2: Establish the SSH Tunnel
To run Alembic against the live database from your local machine, you must establish an SSH tunnel. This securely forwards a local port on your machine to the MariaDB port on the live server.

Open a new terminal window on your local machine and run:
```bash
# Forwards local port 3308 to remote port 3306 via the SSH connection
ssh -N -L 3308:127.0.0.1:3306 user@your-server-ip
```
*(Leave this terminal window running. It will not output anything, but the tunnel is active.)*

### Step 3: Configure Live `.env` Locally
Temporarily change your local `.env` to point to the SSH tunnel (port `3308`) and use the production credentials:
```env
MARIA_DB_HOST=127.0.0.1
MARIA_DB_PORT=3308
MARIA_DB_USER=resomix
MARIA_DB_PASS=your_secure_password
MARIA_DB_NAME=resomix_db
```

### Step 4: Run the Migration on Live
With the tunnel active and the `.env` updated, run the exact same command locally:
```bash
alembic upgrade head
```
Alembic will connect through the SSH tunnel and apply the `new_database.sql` schema directly to your live production database!

### Step 5: Cleanup
1. Kill the SSH tunnel by pressing `Ctrl+C` in its terminal window.
2. Revert your `.env` file back to your local Docker credentials.

---

## 4. Future Migrations Workflow (Python-Driven)

> [!WARNING]
> Do **NOT** edit `schema.sql` for future changes. Alembic does not track `.sql` files. Instead, Alembic detects changes made to your **SQLAlchemy Python files** (e.g., `app/models/user.py`). 

Whenever you need to modify the database (add a column, create a table), follow this strict loop:

### Step 1: Update Python Code
Modify your SQLAlchemy 2.0 `Mapped` classes in `app/models/`.

### Step 2: Validate Schema Gaps (`alembic check`)
Before creating a migration, you can check if your Python models differ from the current local database state without generating anything:
```bash
alembic check
```
*If it says "No changes detected", your DB matches your Python code. If it lists missing columns/tables, proceed to step 3.*

### Step 3: Autogenerate the Migration
Ask Alembic to compare your Python models against the DB and write a migration script for you:
```bash
alembic revision --autogenerate -m "describe_changes"
```

### Step 4: Validate the SQL Before Upgrading
Before applying the changes to any database, review the raw SQL that Alembic *intends* to run. This acts as a dry-run to ensure the schema is flawless:
```bash
# Output the raw SQL to terminal without executing it
alembic upgrade head --sql
```
*You must also manually review the newly generated python file in `alembic/versions/` to verify it didn't accidentally drop a column you wanted to keep.*

### Step 5: Test Local, Then Deploy Live
```bash
# Apply to your Docker DB
alembic upgrade head

# If successful, open SSH tunnel to Live Server, update .env, and repeat:
alembic upgrade head
```
