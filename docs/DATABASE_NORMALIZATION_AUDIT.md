# Database normalization & integrity audit

**Date:** 2026-08-14
**Database inspected:** local dev (`resomix_db`, docker `resomix-test-db`, port 3307), at Alembic
revision `e4a9b2c7d135`
**Method:** read-only. Every figure below came from a query against the live schema, not from
reading models. The queries are included so each claim can be re-run.

> **Scope limit, stated up front.** This is the **dev** database. Its *schema* is the same one
> production runs, because both are built by the same Alembic chain — so every structural finding
> transfers. Its *data* does not: dev has been through hundreds of test runs, and the integrity
> findings in §3 are very likely local damage. The one that needs checking on production is called
> out explicitly.

---

## Verdict

**The schema is sound — essentially 3NF, with a handful of deliberate denormalizations and one
genuine 1NF violation.** The design is not the problem. The problems are in the data, and they are
mostly self-inflicted by the test-cleanup fixture.

---

## 1. Baseline — what is already right

| Check | Result |
|---|---|
| Tables | 84 |
| Tables **without** a primary key | **0** |
| Storage engine | InnoDB, all 84 |
| Collation | `utf8mb4_unicode_ci`, all 84 |
| Foreign keys declared | 167 |
| FK columns **without** a usable index | **0** |
| 2NF violations on composite-key tables | **none found** |

Seven tables use composite primary keys — `playlist_tracks`, `role_permissions`, `user_roles`,
`user_track_engagements`, `user_playlist_engagements`, `user_operation_limits`,
`user_auth_providers`. Composite keys are where partial-dependency (2NF) violations live, so each
was checked: every non-key attribute depends on the **whole** key, not part of it.
`user_roles.granted_at` describes the grant, not the user or the role alone; the engagement tables'
`is_favorite` / `followed_at` describe the pair. Clean.

```sql
-- tables with no PK
SELECT t.TABLE_NAME FROM information_schema.TABLES t
LEFT JOIN information_schema.TABLE_CONSTRAINTS c
  ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME AND c.CONSTRAINT_TYPE='PRIMARY KEY'
WHERE t.TABLE_SCHEMA='resomix_db' AND c.CONSTRAINT_NAME IS NULL;

-- FK columns lacking a leading-column index
SELECT CONCAT(k.TABLE_NAME,'.',k.COLUMN_NAME) FROM information_schema.KEY_COLUMN_USAGE k
LEFT JOIN information_schema.STATISTICS s
  ON s.TABLE_SCHEMA=k.TABLE_SCHEMA AND s.TABLE_NAME=k.TABLE_NAME
  AND s.COLUMN_NAME=k.COLUMN_NAME AND s.SEQ_IN_INDEX=1
WHERE k.TABLE_SCHEMA='resomix_db' AND k.REFERENCED_TABLE_NAME IS NOT NULL AND s.INDEX_NAME IS NULL;
```

---

## 2. Schema findings

### 2.1 — `apple_music_tracks.genres` is a delimited list (1NF violation) — **the one worth fixing**

```python
# app/models/apple_music.py:54
genres: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
# pipe string, e.g. "House | Music | Dance"
```

A repeating group in a single column. It cannot be filtered, joined, indexed or counted without
string matching.

**Why this one matters more than the rest of the list:** the table holds ~1.98M rows in production.
Any genre facet, genre filter or "how much House do we have" question is a full-table scan with a
`LIKE '%…%'`, which no index can serve. Every other item in this document is a tidiness concern;
this one closes off a product capability.

**Shape of the fix** (not done — noted only): a `track_genres` join table, or reuse the existing
`genres` table with an `apple_track_genres` link. Backfillable from the existing strings in one
pass. Not urgent, but it gets more expensive with every catalogue import.

### 2.2 — Artist has two mutually exclusive representations

```
tracks total                                 325
  with `tracks.display_artist` (a string)    234
  with `track_contributors` rows              91
  with BOTH                                    0
  with NEITHER                                 0
```

A clean partition by ingestion path — nothing is ambiguous or missing. But one fact has two homes,
so every reader has to know both, which is why `async_get_track_display_meta_map` exists at all.

Strictly this is not a normal-form violation (there is no functional dependency being broken); it
is a modelling split. Worth knowing about rather than worth fixing: unifying it means rewriting the
partner ingestion path, and the current arrangement is correct, just double.

```sql
SELECT 'has display_artist' k, COUNT(*) v FROM tracks WHERE display_artist IS NOT NULL
UNION ALL SELECT 'has contributor row', COUNT(DISTINCT track_id) FROM track_contributors
UNION ALL SELECT 'has BOTH', COUNT(*) FROM tracks t
  WHERE t.display_artist IS NOT NULL AND EXISTS(SELECT 1 FROM track_contributors c WHERE c.track_id=t.id);
```

### 2.3 — Three columns that should be foreign keys and are not

* `billing_consents.user_id`
* `playlist_embed_tokens.playlist_id`
* `manual_takedowns.admin_user_id`

Each names a real row in a real table and carries no constraint, so nothing stops them dangling.

**The other 39 constraint-less `*_id` columns are correct as they are** — they are external
identifiers (`stripe_customer_id`, `apple_song_id`, `spotify_id`, `stripe_price_id`, …) or opaque
tokens (`correlation_id`, `session_id`). A foreign key would be wrong for all of them. Listing them
as "missing FKs" is the usual false positive from this kind of audit, so they are excluded here
deliberately.

### 2.4 — Polymorphic type+id pairs

* `entitlement_overrides.subject_type` / `subject_id`
* `usage_period_history.subject_type` / `subject_id`
* `admin_operation_logs.target_type` / `target_id`

A polymorphic reference cannot carry a foreign key, so these three have **no referential
integrity and no cascade** — a deleted subject leaves the row pointing at nothing, silently.

This is a deliberate and widespread pattern, not a mistake. It is recorded because it explains why
these particular tables can orphan when nothing else does, and because anything that reads them
must tolerate a missing subject rather than assume one.

### 2.5 — Cached counters (denormalization, by choice)

`playlists.num_tracks` · `playlists.fork_count` · `ingest_logs.track_count` ·
`ingest_logs.file_count` · `promo_codes.uses_count` · `partner_processing_jobs.total_tracks` ·
`usage_period_history.used_count` · `user_operation_limits.usage_count` ·
`generated_reports.total_valid_streams` · `spotify_apps.user_count` · `orders.total_cents` ·
`sftp_users.total_data_transfer` · `playlists.play_time`

Storing a derived value beside its source is a 3NF violation by definition. As denormalization it
is a reasonable read-speed trade; the exposure is drift, and drift is invisible until someone
compares.

Checked against source on dev:

| Counter | Disagreeing | Checked |
|---|---|---|
| `playlists.num_tracks` | 2 | 46 |
| `playlists.fork_count` | 0 | 46 |
| `ingest_logs.track_count` | 2 | 8 |

Both disagreeing playlists are named *"Lib Playlist"* — test fixtures whose `playlist_tracks` rows
were deleted by the cleanup fixture (§3), leaving the cached 10 against an actual 0. Not drift in
the wild.

### 2.6 — Structure stored in TEXT

* `partner_notifications.details` (longtext)
* `webhook_delivery_logs.payload` (longtext)
* `tracks.deal_terms` (longtext)

The first two are log/payload bodies — correct as opaque text. `tracks.deal_terms` is the
questionable one: `deals`, `deal_territories`, `deal_use_types` and `royalty_rates` all exist as
proper tables, so terms living as text on the track is either a legacy path or a bypass of them.
Worth a look when deals next come up; not load-bearing today.

---

## 3. Integrity findings — ~13,000 orphaned rows

Across **18 foreign-key relationships**, rows point at parents that no longer exist — while
`foreign_key_checks = 1` and every one of those FKs is declared.

| Relationship | Orphans | Total rows |
|---|---:|---:|
| `user_roles.user_id → users` | **4,073** | 4,101 |
| `playlist_tracks.playlist_id → playlists` | **3,560** | 4,420 |
| `partner_processing_jobs.partner_id → partners` | **2,265** | 2,269 |
| `partner_processing_jobs.ingest_log_id → ingest_logs` | 1,880 | 2,269 |
| `admin_operation_logs.admin_user_id → users` | 703 | — |
| `user_sessions.user_id → users` | 655 | — |
| `user_tokens.user_id → users` | 580 | — |
| `track_analysis_results.track_id → tracks` | 400 | 410 |
| `track_analysis_results.user_id → users` | 400 | 410 |
| `track_contributors.track_id → tracks` | 235 | 338 |
| `user_subscriptions.user_id → users` | 110 | — |
| `parties.partner_id → partners` | 109 | — |
| `carts.user_id → users` | 85 | — |
| `track_contributors.person_id → contributors` | 57 | — |
| `user_playlist_engagements.user_id → users` | 53 | — |
| `user_playlist_engagements.playlist_id → playlists` | 53 | — |
| `system_logs.playlist_id → playlists` | 1 | — |
| `plans.updated_by → users` | 1 | — |

### Cause

```python
# tests/conftest.py:212
await db.execute(text("SET FOREIGN_KEY_CHECKS = 0"))
```

The autouse cleanup fixture disables constraint checking so it can delete rows in any order, then
re-enables it. Parents go; children stay. **The schema is doing its job — the cleanup routine goes
around it.** This is the same fixture behind the known "backend tests wipe dev-DB rows" behaviour,
and it is why `RESOMIX_SKIP_TEST_CLEANUP=1` exists.

Corroborating: 4,073 **distinct** user ids are referenced by `user_roles` and missing from `users`,
spanning ids 3–13,320, while only 146 users survive (max id 13,435). That is the shape of thousands
of created-then-deleted test accounts, not of application behaviour.

### ⚠️ The one thing to check on production

The same pattern appears in two scripts that are **not** test-only:

* `scripts/cleanup_test_partners.py:112`
* `scripts/seed_data.py:50`

If either has ever been run against production, production carries the same orphans. Worth running
the sweep there once to confirm it has not.

### Reproducing the sweep

Generates one orphan check per declared FK, then runs them:

```sql
SELECT CONCAT('SELECT "', TABLE_NAME, '.', COLUMN_NAME, ' -> ', REFERENCED_TABLE_NAME,
 '" AS fk, COUNT(*) AS orphans FROM `', TABLE_NAME, '` c WHERE c.`', COLUMN_NAME,
 '` IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `', REFERENCED_TABLE_NAME, '` p WHERE p.`',
 REFERENCED_COLUMN_NAME, '` = c.`', COLUMN_NAME, '`) HAVING orphans > 0;')
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL;
```

> Note on row counts: `information_schema.TABLES.TABLE_ROWS` is an **estimate** for InnoDB and was
> wrong by up to 20% here — it reported 3,552 `user_roles` rows against an actual 4,101, which made
> the orphan counts look impossible at first. Every figure in this document uses exact `COUNT(*)`.

---

## 4. Checked and cleared — two things that look wrong and are not

### 4.1 — `users.plan_id` disagreeing with `user_subscriptions.plan_id`

Three users have an active Pro (plan 4) subscription while `users.plan_id` says Free (plan 2) or
NULL. This looks like classic duplicated-state drift. It is not.

The effective plan resolves **subscription → grant → `users.plan_id` → default**
([`app/services/entitlement_service.py:88-149`](../app/services/entitlement_service.py)), and
`users.plan_id` exists specifically to record the *default* plan. All three cases are
Free-under-Pro, so the subscription correctly wins. The code even warns loudly if that column ever
holds a **paid** plan, precisely because that would grant access no cancellation could revoke.

Working as designed. No action.

### 4.2 — `partner_id` on 32 of 84 tables

Heavy tenancy denormalization, and the obvious question is whether it drifts from the parent row.
It does not:

| Child vs parent | Mismatches |
|---|---|
| `playlists` vs its user | 0 |
| `audio_files` vs its track | 0 |
| `track_analysis_results` vs its track | 0 |
| `track_artifact_status` vs its track | 0 |

It is the multi-tenancy failsafe's index, and it is holding. No action.

---

## 5. Housekeeping spotted in passing

* `plans` contains a leftover `tmp_4cbc28a1e9` / *"Temp Plan"* (id 201) — test residue, same family
  as the `test_role_*` rows already known about and deliberately left.
* `system_logs` is the largest table by data size (15 MB, 5,315 rows). `scripts/prune_system_logs.py`
  already exists for it.

---

## 6. Summary — what would actually be worth doing

Ordered by consequence, not by effort.

| # | Item | Why | Urgency |
|---|---|---|---|
| 1 | **Purge the stress-test accounts**, then sweep production | Prerequisite, not a separate job — see below | **Do this once, soon** |
| 2 | Normalise `apple_music_tracks.genres` **together with the artist work** | 1NF; blocks any genre facet across ~1.98M rows | 📌 **TODO — deferred by decision (2026-08-14).** Bundled with §2.2: artists are text today and will be populated into a proper table with per-track associations via Apple Music. Genres get the same treatment in the same pass, since both are "a list in a string" and both need a join table. Doing genres alone would mean touching the same rows twice |
| 3 | Add the three missing FKs (§2.3) | Cheap; closes three silent-dangle paths | Low |
| 4 | Reconcile the two artist representations (§2.2) | One fact, two homes; every reader needs both | 📌 See item 2 — same pass |
| 5 | `tracks.deal_terms` vs the `deals` tables (§2.6) | Structure in text where proper tables exist | Revisit with deals |

## 7. The stress-account purge — why it comes first

Running the orphan sweep on production before removing the stress-test accounts would measure a
mess that is about to change. `scripts/purge_stress_accounts.py` removes them properly; the sweep
is then a check on what remains.

**Deleting the users is not enough, and the schema is why.** Of the 39 foreign keys pointing at
`users`:

| Delete rule | Count | Consequence |
|---|---:|---|
| `CASCADE` | 17 | Handled by the database. No work needed |
| `SET NULL` | **20** | **The rows SURVIVE** — including `playlists.user_id` and `tracks.user_id` |
| `RESTRICT` | 3 | **Blocks the delete** until dealt with |

So `DELETE FROM users` either fails outright (the three RESTRICT rows) or succeeds and leaves the
accounts' playlists and uploaded tracks in the live catalogue as **ownerless rows** — worse than
before, because nothing now identifies them as test data.

The script therefore removes blocking rows, then polymorphic references (no FK, so nothing would
ever complain), then owned content, then the accounts — and **never disables foreign key checks**.
That is what created the ~13,000 orphans in §3 in the first place; a cleanup that leaves orphans is
not a cleanup. A refused delete is treated as information, not an obstacle.

```bash
python scripts/purge_stress_accounts.py            # dry run — inventory only
python scripts/purge_stress_accounts.py --apply    # delete, then self-verify
python scripts/purge_stress_accounts.py --verify   # orphan check, deletes nothing
```

Exercised end to end against dev with seeded accounts carrying a playlist, an upload, a
`playlist_tracks` row, artifact status, a session, a rating and a blocking admin-log row. All
removed, cascades included, and the orphan count was **unchanged at 3,560** — the pre-existing
test-fixture damage — confirming the purge introduced none of its own.

Nothing here blocks the Library/discovery work in
[`LIBRARY_AND_DISCOVERY_PLAN.md`](LIBRARY_AND_DISCOVERY_PLAN.md).
