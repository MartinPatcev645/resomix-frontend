# Account deletion — decision record and implementation plan

**For:** George
**From:** engineering
**Date:** 2026-08-10 (v2 — supersedes the 2026-08-08 options paper)
**Status:** Decided. Ready to build.

> **Not legal advice.** This is an accurate summary of the regulation and of what our system
> actually holds, written so a non-lawyer can make an informed call. It is specific enough to hand
> to counsel, and it should be — anything with money or liability attached (retention periods, the
> tax position in our jurisdiction) needs sign-off from the company's accountant or lawyer.

---

## 0. What changed since v1

v1 asked George to choose between hard delete, anonymise-in-place, and soft delete. **George chose
anonymise-in-place, and asked to keep the correlated data** — playlists, uploads, contact and
feedback submissions, billing history — so the account stays usable for analysis under an opaque
id. That decision stands and this document is built around it.

Three things changed on top of it:

1. **Two supporting arguments were tested against the regulation and both failed** (§2), so the
   design rests on different ground than originally proposed. Nothing about what we *keep* changed
   materially; what changed is the legal mechanism and the handful of places we have to scrub to
   make that mechanism hold.
2. **The scrub is now manual and admin-triggered** (§1.2). A user's request deactivates the account
   and nothing more. There is no automatic purge timer.
3. **The user is no longer given a deletion date or a grace-period cut-off** (§1.3, §1.4). They are
   told "within 4 weeks"; the one-month legal clock is surfaced in the admin queue instead.

---

## 1. The decision

### 1.1 What deletion does to the data

On deletion we **keep the `users` row and every correlated record**, and strip the identifying
attributes out of them. The account keeps its `id` and `uuid`, so playlists, uploads, ratings,
engagements, consumption events, support history and invoices all stay joined and analysable. What
goes is the person: name, username, email, password, profile picture, linked Google/Apple/Spotify
accounts, IP addresses, and every duplicate copy of those living outside the `users` table.
Financial records are kept **in full, identity included**, under the tax-law exemption.

### 1.2 The lifecycle — two steps, and the second one is manual

| Step | Trigger | What happens |
|---|---|---|
| **1. Request** | the user, from Settings | Account set inactive. Sessions killed. Sign-in blocked. **Nothing is scrubbed.** Fully reversible. |
| **2. Scrub** | **an admin, manually** | The §4 scrub runs. Irreversible. |

There is **no automatic timer**. Step 2 never fires on its own — an admin reviews the queue and
runs it. This is deliberate: the operation is irreversible, and an irreversible operation that
executes unattended on a clock is one bad `purge_due_at` away from destroying an account nobody
meant to touch.

`users.purge_due_at` stays, but its meaning changes from *"delete at this time"* to **"this is when
it should have been done by"** — it drives the admin queue's ageing, not an execution trigger.

### 1.3 No deadline on changing their mind

The user is not given a cut-off. Any time before an admin runs step 2, they contact us and we
restore the account exactly as it was — flip `is_active` back, clear the request timestamps, done.

This is a real improvement on a fixed grace window. Someone who deleted in anger and remembers six
weeks later is far more likely to still have an account than under a hard 30-day cliff.

### 1.4 The 30-day clock is an ADMIN deadline, not a user promise

Art. 12(3) requires action within **one month**. So the deadline is real, but it belongs in the
admin UI, not in the user's inbox:

- The user is told **"within 4 weeks"** — inside the window, no specific date to miss.
- The admin queue shows the **age of every pending request**, flagging anything nearing 30 days.
- If one does slip, Art. 12(3) allows an extension to three months **provided the person is told
  within the first month, with reasons.** That is one email, and §6.7 has it written.

> **Alternative considered — "1 to 8 weeks".**
> Rejected. Eight weeks routinely exceeds the one-month default, so it would need an extension
> notice on essentially every request, which converts a legal safety valve into standing practice.
> "Failed to respond in time / no proper process" is the exact category behind the €20,000 Greek
> fine in §7. Four weeks buys the same operational slack and needs no notice.

### 1.5 How the user knows anything happened

They can't see into the system once sign-in is blocked, so **the completion email is the only
signal — and it is legally required.** Art. 12(3) obliges us to inform them of the action taken.
Three emails cover the whole lifecycle:

1. **Request received** (§6.4) — account off, what will happen, how to come back.
2. **Completed** (§6.6) — what was removed, what was kept, and why.
3. **Restored** (§6.5) — only if they change their mind.

Plus §6.7, the extension notice, if we exceed the month.

### 1.6 Restoring someone who comes back later

Because the scrub keeps every row and only clears the identifying columns, a returning user's
history is still sitting there under the old `user_id`. An admin can repoint it to their new
account: `UPDATE <table> SET user_id = :new WHERE user_id = :old` across the §4.4 tables.

Two honest caveats:

- **We cannot verify it is the same person.** After the scrub there is no email, no name and no
  password left to match on. For a user who ever paid, Stripe still holds the identity and can
  corroborate. For a free user there is nothing — restoration is a manual, trust-based judgement
  call by an admin, and it should be recorded in `admin_operation_logs` as exactly that.
- **Being able to do this at all proves the data is not anonymous.** It is direct evidence for the
  pseudonymisation label in §3, and a reason the privacy policy must not claim otherwise.

Out of scope for the phases below — noted so the scrub design does not foreclose it. It doesn't:
keeping the rows is precisely what leaves the door open.

---

## 2. Two mechanisms we cannot use

These were both proposed in good faith and both would have made the design weaker, so they are
recorded here with the reasoning.

### 2.1 "It is data the user submitted, so we are not obliged to delete it"

**This does not hold.** GDPR defines personal data by *who it relates to*, not by who typed it in
(Art. 4(1)). A contact form carrying someone's name and email is personal data about them whether
they wrote it or we did. Regulator guidance lists user-generated content explicitly — photos,
tracked activities, statistics, comments, messages — as subject to erasure requests. There is no
"they volunteered it" exemption anywhere in Article 17.

The instinct underneath it is sound, though, and it is what the whole design rests on: **the value
is in what they did, not in their name.** Every analysis we care about runs on `user_id`, not on
the email. Scrubbing the identifiers costs us nothing analytically. That is why this works.

### 2.2 "We will put it in the terms, so they agree at signup"

**This actively backfires.**

- Consent bundled into terms-of-service acceptance is not valid consent. Art. 7(4) and Recital 43
  require consent to be freely given and unbundled; accepting terms in order to use a product is
  not a free choice about data.
- More fundamentally, **Article 17 is a statutory right and cannot be contracted away.** The
  exceptions are the ones the GDPR itself lists in 17(3). A private agreement cannot add new ones.
- The EDPB has already decided close to this exact case: a controller refused erasure because the
  complainant had previously accepted its general terms. The authority noted that the terms *"do
  not elaborate on data subjects' rights but only refer in a general manner to the GDPR"*, and the
  refusal did not stand.

If a regulator ever reads such a clause, it reads as evidence we understood the obligation and
tried to route around it. That is worse than having no clause at all.

**However — writing it down is still right, as transparency rather than as a waiver.** Art. 13(2)(a)
already *requires* us to state retention periods per category in the privacy policy, and we are
almost certainly not doing that today. The schedule in section 4 is that document. The framing
changes from *"you agreed we can keep this"* to *"here is what we keep, why, and for how long"* —
same text, and the second version is the one that actually protects us.

---

## 3. What the regulation does allow

**Art. 17(3)(b) — legal obligation.** Where another law requires retention, it overrides both
consent withdrawal and erasure requests. This is what keeps our invoices, and it is solid ground.
Across EU member states tax and accounting records must be kept for roughly **5–10 years**
(7 is common; Germany distinguishes 10 years for accounting records from 6 for business
correspondence). **The exact figure for our jurisdiction needs confirming with the accountant.**

The important limit: that obligation covers **the invoice**, not everything attached to the
customer. It does not authorise keeping their IP address or browsing history for ten years on the
same grounds.

**Art. 17(3)(e) — legal claims.** Retention needed to establish, exercise or defend legal claims.

**Field-level retention is explicitly accepted.** Different columns in the same row may have
different lifetimes — an order can keep amount and date for seven years under tax law while the
name is anonymised much earlier. This is the mechanism the whole schedule below is built on.

**Art. 5(1)(e) — storage limitation.** Anything kept on legitimate-interest grounds must be
*time-bounded*. "Forever" is only defensible for data that is genuinely no longer personal.

**Art. 12(3) — one month to respond**, extendable by two for complex cases. Our 30-day grace
period sits comfortably inside that and should stay.

### The honest label

What we are building is **pseudonymisation, not anonymisation.** Keeping `id`/`uuid` as the
correlation key is exactly what the EDPB's Guidelines 01/2025 describe: the data remains personal
data and remains in GDPR scope. Deleting the identifying attributes does not by itself make the
rest anonymous — anonymisation has to be irreversible, and ours is not, by design.

That is a fine place to be. It is what most companies do. But two things follow, and they are not
optional:

1. **We must not call it anonymisation** in the privacy policy, the confirmation email, or the
   admin UI. A misleading statement about erasure is its own violation. The wording to use is:
   *"We have removed your personal details and disconnected your linked accounts. De-identified
   usage records and legally required financial records are retained — see our retention
   schedule."*
2. **"We want it for analysis" is not an Art. 17 exemption.** Financial records are covered;
   behavioural data kept for analytics is not. The defensible position is that it has been reduced
   to an opaque integer with no identifying attributes attached — which is only true once
   section 4 is fully implemented. A strict regulator could still push back. That residual risk is
   real, bounded, and worth accepting knowingly.

---

## 4. Exactly what happens on account deletion

This table is the specification. It is also, near enough, the retention section the privacy policy
needs.

### 4.1 Deleted outright

| Table | Why |
|---|---|
| `user_service_connections` | Apple Music / Spotify OAuth tokens and `external_account_id` — a stable identifier **at the provider**. Must be destroyed, not merely unlinked. |
| `user_auth_providers` | The Google `sub`. Same reasoning. |
| `user_tokens` | Password reset / verification tokens. No retention interest. |
| `user_sessions` | Killed so the account cannot be logged back into. Also carries `ip_address` + `user_agent`. |

### 4.2 The `users` row — scrubbed in place

| Column | Becomes |
|---|---|
| `name` | `NULL` |
| `username` | `deleted_user_<id>` |
| `email` | `deleted+<id>@resomix.invalid` — `.invalid` is RFC 2606-reserved and can never resolve, so no message can ever accidentally reach a real mailbox. Both columns are `UNIQUE`, which is what the id suffix is for. |
| `password_hash` | `NULL` |
| `profile_picture` | `NULL` (and the stored file removed) |
| `is_active` | `false` |
| `is_email_verified` | `false` |
| `anonymized_at` | set — the state becomes a recorded fact rather than something inferred from the email format |
| `id`, `uuid` | **unchanged** — this is the correlation key the whole design exists to preserve |

### 4.3 Kept in full, identity included

| Table | Basis | Period |
|---|---|---|
| `billing_invoices`, `orders`, `subscription_events`, `purchases`, `billing_consents` | Art. 17(3)(b) — tax and accounting law | 5–10 yrs, **confirm locally** |
| Stripe customer and invoices | same | same |
| `admin_operation_logs` (the *admin's* identity) | audit integrity | indefinite |

**On Stripe:** leave it alone. An issued invoice must legally carry the customer's name, already-issued
invoice PDFs are immutable snapshots regardless of what we overwrite, and the retention is covered by
17(3)(b). Trying to scrub it would achieve nothing and risks breaking the accounting trail. It gets
disclosed in the privacy policy instead.

### 4.4 Kept, keyed to `user_id`, identifiers scrubbed

This is the bulk of what George wants to keep, and all of it survives.

| Table | Kept | Scrubbed |
|---|---|---|
| `playlists`, `playlist_tracks`, `playlist_ratings`, `track_ratings` | everything, incl. `user_id` | forced private if `is_public` — a public playlist under a real display name outlives the anonymisation otherwise |
| `user_playlist_engagements`, `user_track_engagements`, `consumption_events`, `usage_period_history` | everything, incl. `user_id` | `consumption_events.client_ip` |
| `track_analysis_results` | everything | — |
| `contacts` | `message`, `subject`, `contact_type`, timestamps, `user_id`, all B2B fields | `name`, `email`, `phone`, `client_ip`, `user_agent` |
| `feedbacks` | `message`, `category`, `satisfaction`, `recommendation`, `user_id` | `client_ip`, `user_agent` |
| `user_messages` | `subject`, `body`, `status`, `user_id`, `admin_user_id` | `recipient_email` |
| `user_plan_grants`, `user_subscriptions`, `user_operation_limits` | everything | — |

The support history keeps all of its value: the text and the link to the user. What it loses is an
address we would never query on.

### 4.5 Bounded retention (not tied to deletion — applies to everyone)

| Table | Basis | Period |
|---|---|---|
| `system_logs` | security / abuse prevention, legitimate interest | **90 days** (see §5) |
| `user_sessions.ip_address`, `user_agent` | security | 90 days |
| `admin_operation_logs.ip_address` | security | 12 months |

90 days is the common figure; **12 months is the ceiling most DPAs accept without a specific
argument.** Anything longer needs a documented justification.

### 4.6 Needs George's decision — uploaded audio

`audio_files.original_filename` and `tracks.source_file_path` are routinely of the form
`Artist - Track (Someone's edit).wav`. The audio itself is the user's content.

**Engineering recommendation — the middle path:** delete the source files, `original_filename` and
`source_file_path`; **keep** the derived embeddings, `track_analysis_results` and `user_id`.

We lose nothing analytically — the vectors are the asset, not the WAV — and we stop holding content
whose filenames identify people. Keeping the audio is defensible but weakens the whole position,
because free-text filenames are exactly the "unpredictable personal data" a regulator looks for.

### 4.7 Separate table, no foreign key — `waitlists`

`waitlists.email` has no `user_id` and survives everything above. It must be matched by email and
scrubbed at deletion time, or it hands the identity straight back.

---

## 5. The `system_logs` problem — urgent, and independent of all of the above

This is our single largest exposure and it has nothing to do with George's design.

**At least 22 call sites write the user's raw email into the log message or metadata** — 15 in
[`auth_controller.py`](../app/controllers/auth_controller.py) (lines 138, 258, 338, 521, 590 and
others), 2 in `user_controller.py`, 4 in `email_service.py`, 1 in `billing_email_service.py`.

Compounding it:

- `system_logs` has **no `user_id` column**, so those rows are unreachable by any foreign key,
  cascade, or scrub keyed on the user.
- There is **no retention or purge job**. They live forever.

The consequence: after a perfectly executed anonymisation, a single
`SELECT * FROM system_logs WHERE message LIKE '%their@email%'` reconstructs the identity in full.
Every other control in this document is undermined by it.

**Two fixes, both cheap and both worth doing regardless of what George decides:**

1. Log `user_uuid` instead of the email at those 22 call sites. The uuid is just as useful for
   debugging and is already the correlation key everywhere else.
2. Add a retention job that deletes `system_logs` rows older than 90 days.

---

## 6. Copy — every word the user, the admin and the policy sees

All of it is drop-in. Placeholders in `[brackets]` need George's or the accountant's answer.

### 6.0 The terminology rule

**What we are doing is pseudonymisation, not anonymisation.** Three registers, and mixing them is
the mistake:

| Where | Say | Never say |
|---|---|---|
| To users | "account deleted", "we removed your personal details" | "anonymised", "all your data has been deleted" |
| In the policy / to a regulator | "pseudonymised; retained under Art. 17(3)(b)" | "anonymised" — that would be a false claim |
| In our code | `scrub`, `deidentify` | `anonymise` — a class name should not assert something untrue |

> ⚠️ **The two existing email templates are now wrong.**
> [`account_deletion_scheduled.html`](../app/templates/emails/account_deletion_scheduled.html)
> promises *"Everything will be permanently deleted… your playlists, uploaded tracks, analyses and
> profile"*, and [`account_deleted.html`](../app/templates/emails/account_deleted.html) says of the
> retained payment record *"Nothing in it identifies you"* — which will be false, because invoices
> keep the name under 17(3)(b). Both must be replaced with §6.4 and §6.6 before this ships. A
> false statement about erasure is itself a violation, so this is not a copy-polish task.

### 6.1 Privacy policy — new "Deleting your account" section

> **Deleting your account**
>
> You can delete your account at any time from Settings. When you do:
>
> - You are signed out everywhere immediately and can no longer sign in.
> - We complete the removal of your personal details **within 4 weeks**.
> - **Changed your mind?** Contact us before we've completed it and we'll restore your account
>   exactly as you left it. There's no deadline — just reach out.
> - When we complete it, we remove your name, username, email address, password and profile
>   picture, and disconnect any Google, Apple Music or Spotify account you had linked. Any IP
>   addresses we hold for you are cleared. We'll email you to confirm.
> - Records of what you did on Resomix — playlists, ratings, listening and search activity, support
>   messages and feedback — are kept **without your personal details**, linked only to an internal
>   reference number. We use them for statistics and to improve the service.
> - **Payment records are kept in full, including your name**, because tax and accounting law
>   requires it.
> - `[Uploaded audio files are deleted. — pending George's decision, §4.6]`

> **How long we keep things**
>
> | What | How long | Why |
> |---|---|---|
> | Your account and profile | until you delete it | to provide the service |
> | Invoices and payment records | `[X]` years | required by tax and accounting law |
> | Usage records after account deletion | indefinitely, without your personal details | statistics and service improvement |
> | Support messages and feedback | indefinitely, without your personal details once your account is deleted | to keep a record of our correspondence |
> | Server logs, including IP addresses | 90 days | security and abuse prevention |
> | Login sessions | 90 days after expiry | security |

> **A note on wording**
>
> We do not describe this as anonymisation. Because we keep an internal reference number, and
> because payment records must keep your name, it remains possible to link the retained records
> back to you. Under the GDPR that is **pseudonymisation**, not anonymisation — the retained data
> is still personal data, and all of your rights still apply to it, including the right to object
> and the right to complain to your data protection authority.

That last paragraph is deliberate. Volunteering the distinction costs nothing and is the single
clearest signal to a regulator that we understood the obligation rather than papered over it.

### 6.2 Terms of service

**Add one sentence, as a pointer:**

> Account deletion, and how long we keep data afterwards, are described in our Privacy Policy.

**Add nothing else.** Specifically, do **not** add a clause purporting that the user consents to
indefinite retention — per §2.2 it would be void, and it reads as evidence against us.

### 6.3 In-product copy

**Settings → Delete account (confirmation dialog)**

> **Delete your account?**
>
> You'll be signed out everywhere and won't be able to sign in.
>
> We'll complete the removal of your personal details within 4 weeks. Your playlists and activity
> are kept without your personal details, and payment records are kept as tax law requires.
> `[Uploaded files are deleted.]`
>
> **Changed your mind later?** Contact us any time before we've completed it and we'll restore
> everything.
>
> [Cancel] [Delete my account]

**Blocked sign-in message (the only in-product surface they have left)**

> This account has been closed at your request. If you'd like it back, email
> [support@resomix.com](mailto:support@resomix.com) — if we haven't completed the removal yet, we
> can restore it exactly as it was.

Worth getting right: once sign-in is blocked this screen is the **only** thing a returning user
sees. A generic "invalid credentials" would strand someone who wants their account back.

**Admin — pending deletions queue**

Each row shows **how long the request has been waiting**, because the one-month clock in §1.4 is an
admin-side obligation and nothing else surfaces it:

> | User | Requested | Waiting | |
> |---|---|---|---|
> | jane@… | 12 Aug | 6 days | [Review] |
> | bob@… | 24 Jul | **25 days ⚠️** | [Review] |
> | sam@… | 2 Jul | **47 days 🔴 overdue** | [Review] |

Amber from 21 days, red past 30. Overdue rows also need the §6.7 extension email sent.

**Admin — delete confirmation**

> **Delete this account?**
>
> This removes {{ email }}'s personal details and disconnects their linked accounts. It does **not**
> delete their playlists, activity, support history or invoices — those are kept against an
> anonymous user id.
>
> **This cannot be undone.** Until you confirm, the account can still be restored in full.
>
> *Review what will change:*
> `[dry-run manifest table — rows deleted / columns scrubbed / rows kept, per §4]`
>
> [Cancel] [Delete account]

The manifest is not decoration. The admin confirms against what the operation will actually do,
not against a description of it that might have drifted.

### 6.4 Email 1 — deletion requested *(replaces `account_deletion_scheduled.html`)*

**Subject:** Your Resomix account has been closed

> Hi {{ name }},
>
> We've received your request to delete your Resomix account. You've been signed out everywhere and
> can no longer sign in.
>
> **We'll finish removing your personal details within 4 weeks.**
> That means your name, email address, password and profile picture, and disconnecting any Google,
> Apple Music or Spotify account you've linked. `[Your uploaded files will be deleted.]` We'll email
> you when it's done.
>
> **Changed your mind? Just reply to this email.**
> Nothing has been removed yet — your account is switched off, not erased. If you reach out before
> we've finished, we'll restore it exactly as you left it. There's no deadline: if it's still here,
> you can have it back.
>
> {% if had_subscription %}Your subscription has been cancelled, so you won't be charged again. Any
> period you've already paid for isn't refunded — closing the account ends access immediately.
> {% endif %}
>
> Your playlists and activity are kept without your personal details, and we're required to keep
> payment records. Our [Privacy Policy]({{ app_url }}/privacy) explains exactly what stays and for
> how long.
>
> If you didn't request this, reply straight away — someone may have access to your account.

No date is shown, per §1.4. The recovery route stays in the first third: someone who deleted in
anger needs it before they need the detail.

### 6.5 Email 2 — account restored *(new — `account_deletion_cancelled.html`)*

Currently a user who changes their mind hears nothing back. Same gap we already closed once for
subscription reactivation.

**Subject:** Your Resomix account is back

> Hi {{ name }},
>
> Good news — your account is no longer scheduled for deletion, and nothing was removed. Everything
> is exactly as you left it: your playlists, your uploads and your settings.
>
> You can [sign in]({{ app_url }}/login) as normal.
>
> If you didn't ask for this, reply to this email straight away.

### 6.6 Email 3 — deletion completed *(replaces `account_deleted.html`)*

**This email is not optional.** Art. 12(3) requires informing the person of the action taken, and
per §1.5 it is the only signal they get.

**Subject:** Your Resomix account has been deleted

> Hi {{ name }},
>
> As you asked, your Resomix account has been deleted. This completes the request you made on
> {{ requested_date }}.
>
> **What we removed:** your name, username, email address, password and profile picture, along with
> any Google, Apple Music or Spotify accounts you'd linked. `[Your uploaded files have been
> deleted.]` This can't be undone.
>
> **What we kept:** your playlists and activity, and your support messages, all with your personal
> details removed and linked only to an internal reference number. We use them for statistics. We
> also keep your payment records in full, including your name, because tax law requires it.
>
> Our [Privacy Policy]({{ app_url }}/privacy) sets out exactly what we keep and for how long. If
> you'd like anything explained, reply to this email.
>
> Thanks for giving Resomix a try. You're welcome back any time — you'd just be starting fresh.
>
> If you didn't ask for this, reply and we'll look into it.

Sent to the address captured **before** the scrub, since the row no longer carries it afterwards.

Note what this email does *not* say. It doesn't claim everything was deleted, it doesn't say
"anonymised", and it doesn't repeat the old line *"nothing in it identifies you"* about the payment
record — because the invoice keeps their name, and saying otherwise would be a false statement
about erasure.

### 6.7 Email 4 — we need longer *(new — `account_deletion_extended.html`)*

Only when a request passes 30 days. Art. 12(3) permits extending to three months **provided the
person is told within the first month, with reasons.** Sending this is what keeps a slipped request
from becoming a procedural violation; the amber flag in the admin queue is what makes it happen.

**Subject:** An update on your Resomix deletion request

> Hi {{ name }},
>
> You asked us to delete your Resomix account on {{ requested_date }}. Your account is closed and
> you can't sign in, but we haven't finished removing your personal details yet and we wanted to
> tell you rather than leave you wondering.
>
> {{ reason }}
>
> We'll complete it and email you to confirm. If you'd rather have your account back instead, reply
> to this email and we'll restore it.

`{{ reason }}` is written by the admin, not templated — Art. 12(3) asks for the actual reason, and
a canned sentence is not one.

---

## 7. Risk, stated plainly

Not the €20M headline. This is complaint-driven and the observed numbers for companies our size are
small: the Netherlands fined a company **€6,000** for ignoring nine deletion requests; Greece fined
a sports company **€20,000** for failing to respond and having no request mechanism at all.

The trigger is almost always one annoyed user filing with a DPA. What turns a complaint into a fine
is having **no process** — which is precisely what this work removes.

---

## 8. Open questions for George

| # | Question | Recommendation |
|---|---|---|
| 1 | Uploaded audio — keep, delete, or the middle path? | **Middle path (§4.6):** delete source files and filenames, keep embeddings + analysis |
| 2 | Public playlists — force private on anonymisation? | **Yes.** A public playlist under a real name defeats the scrub |
| 3 | Retention period for invoices in our jurisdiction? | **Accountant's call.** 5–10 yrs across the EU; the code takes it from config, so the number can change without a migration |
| 4 | `system_logs` retention — 90 days or 12 months? | **90 days.** 12 is the ceiling, not the target |
| 5 | Who signs off the privacy policy wording? | Needs a lawyer. §4 is the input they will ask for |
| 6 | User-facing window — 4 weeks? | **Yes.** Inside Art. 12(3)'s one month, no date shown, no deadline on changing their mind (§1.4) |
| 7 | Who may run the scrub? | **Admins only, manually, from the queue.** No automatic timer (§1.2) |

Items 1, 2 and 4 block nothing: the implementation reads them from config, so building can start
before they are answered.

---

## 9. Implementation phases

Ordered so that each phase is independently shippable and independently useful. Phase 1 has
standalone value even if the rest slipped.

### Phase 1 — `system_logs` containment *(no dependencies, do first)*

Independent of the deletion feature and the highest-value work in this document.

- Replace the email with `user_uuid` at the 22 call sites in `auth_controller.py`,
  `user_controller.py`, `email_service.py`, `billing_email_service.py`.
- Add `scripts/prune_system_logs.py` — deletes rows older than `SYSTEM_LOG_RETENTION_DAYS`
  (default 90), batched, dry-run flag, safe to run repeatedly.
- systemd timer, daily, alongside the existing timers documented in `RUNBOOK.md`.

**Tests**
- A regression test asserting no logging call site passes an `email` key in metadata — a grep-style
  test over the source, so a new one added next year fails here rather than in production.
- Pruning deletes only rows past the cutoff; a run with nothing due writes nothing.
- Batching: a 10,000-row backlog with batch size 500 terminates and deletes all of them.
- Dry run writes nothing and reports an accurate count.

### Phase 2 — schema

- Migration: `users.anonymized_at` (nullable `DATETIME`, indexed).
- Config: `SYSTEM_LOG_RETENTION_DAYS`, `SESSION_IP_RETENTION_DAYS`, `INVOICE_RETENTION_YEARS`.

**Tests**
- `alembic upgrade head` then `downgrade` round-trips cleanly.
- `alembic heads` returns exactly one head (we have had a collision before — this check stays).

### Phase 3 — `AccountScrubService`

New service alongside the existing `AccountPurgeService`, which stays for the hard-delete path.
Same shape as the purge service, which has already proven itself: a declarative table manifest and
a **dry run that writes nothing**.

**Named `scrub`, not `anonymise`** — per §6.0, the class name must not assert something that isn't
true. `anonymise()` sitting in the codebase would be read as a guarantee by the next person to
touch it.

- `DELETE_TABLES` — §4.1
- `SCRUB_COLUMNS` — §4.2, §4.4, §4.7, as `(table, column, replacement)` triples
- `KEEP` — §4.3, declared explicitly so the manifest states what survives rather than staying silent
- `scrub(user, dry_run=True)` returns a manifest of exactly what would change, per table

Declarative on purpose: adding a table with an email column means adding one line, and the manifest
makes "did we handle this table?" a question with a visible answer.

**Tests**
- Dry run writes nothing and returns a count for every table in the manifest.
- After a live run: `users.email` matches `deleted+<id>@resomix.invalid`, `username` is
  `deleted_user_<id>`, `name`/`password_hash`/`profile_picture` are `NULL`, `is_active` is false,
  `anonymized_at` is set.
- **`id` and `uuid` are unchanged.** This is the property the entire design rests on — the test
  exists to make breaking it loud.
- `contacts` keeps `message` and `user_id`; `name`, `email`, `phone`, `client_ip`, `user_agent` are
  all `NULL`.
- `feedbacks` keeps `message` and scores; `client_ip`/`user_agent` are `NULL`.
- `user_messages` keeps `body`, loses `recipient_email`.
- `billing_invoices`, `orders`, `subscription_events`, `billing_consents` are **untouched** —
  including their row count, which is the guard against a stray cascade.
- `user_service_connections`, `user_auth_providers`, `user_tokens`, `user_sessions` are gone.
- Public playlists become private; playlist rows and `user_id` survive.
- `waitlists` rows matching the old email are scrubbed.
- Idempotence: running twice produces the same end state and does not error.
- Edge case — a user with **no** contacts, feedback, playlists, subscription or Stripe id
  anonymises cleanly. (A freshly registered account that never did anything is the most likely
  first real deletion.)
- Edge case — a user who is also an **admin**: `admin_operation_logs.admin_user_id` must survive,
  since the audit trail records what an admin did, not who they were.
- Failure case — the whole thing runs in one transaction; an error partway leaves nothing changed.

### Phase 4 — wiring and the admin queue

- The deletion request sets `is_active = false`, kills sessions, and stamps `deletion_requested_at`
  / `purge_due_at`. **Nothing scrubs on a timer** (§1.2) — `purge_due_at` becomes the ageing marker
  for the queue, not an execution trigger.
- Admin pending-deletions queue per §6.3, with the waiting-time column and its amber/red thresholds.
  This is the only surface where the one-month obligation is visible, so it is not optional.
- Admin delete action: dry-run manifest first, confirm second. Replaces the hardcoded
  "not available" on the existing button.
- Restore action: clears `deletion_requested_at`/`purge_due_at`, sets `is_active = true`, sends
  §6.5. Available right up until the scrub runs.
- Blocked sign-in returns the §6.3 message, not a generic credentials error — it is the only route
  back for a returning user.

**Tests**
- Requesting deletion deactivates and stamps the timestamps but **changes no other table** — the
  row counts across every §4 table are identical before and after. This is the guard that the two
  steps really are separate.
- Nothing scrubs without an explicit admin call: no scheduled path reaches `AccountScrubService`.
- The queue orders oldest-first and computes waiting days correctly, including a request made today
  (0 days, not 1) and one 47 days old.
- Restore after a request returns the account to fully working: `is_active` true, timestamps clear,
  sign-in succeeds.
- Restore is refused once `anonymized_at` is set — past that point there is nothing to restore, and
  the failure must be explicit rather than a silent no-op.
- The admin endpoint returns the manifest without mutating anything.
- Confirming performs the scrub and writes an `admin_operation_logs` entry.
- Permission-gated: a non-admin gets 403.
- Blocked sign-in for a pending-deletion account returns the recovery message and the
  `ACCOUNT_DEACTIVATED` code, distinguishable from a wrong password.

### Phase 5 — copy, templates and policy

All wording comes from §6. This phase is legal accuracy, not polish.

- **Replace** `account_deletion_scheduled.html` with §6.4 and `account_deleted.html` with §6.6.
  Both currently make claims that become false under this design — see the warning in §6.0.
- **Add** `account_deletion_cancelled.html` (§6.5), sent on restore. Today a user who changes their
  mind hears nothing back; the same gap we already closed once for subscription reactivation.
- **Add** `account_deletion_extended.html` (§6.7), sent when a request passes 30 days. This is what
  keeps a slipped request from becoming a procedural violation, and it pairs with the red flag in
  the admin queue.
- In-product copy from §6.3: the Settings confirmation dialog, the pending-deletion banner, and the
  admin confirm dialog with its dry-run manifest.
- Privacy policy section from §6.1 and the one-line Terms pointer from §6.2. **Needs the lawyer's
  sign-off before it ships**, and the `[X]`-year figure from the accountant.

**Tests**
- Each of the four templates renders with a representative context and no Jinja error.
- **A copy-accuracy assertion over the rendered output of all four:** none of `anonymis`,
  `all your data`, `everything will be`, `permanently deleted`, or `nothing in it identifies you`
  may appear. This is a legal-accuracy requirement rather than a stylistic one, which is why it is
  asserted rather than left to review.
- No template renders a hard deletion **date** — per §1.4 we commit to a window, not a day.
- The completion email renders for a user whose `name` is already `NULL` — it is sent *after* the
  scrub, so the greeting must fall back rather than print "Hi None".
- The cancellation email is sent on cancel, and is *not* sent when the cancellation fails.
- The recipient address is captured **before** the scrub runs: a test asserts the send target is the
  original address, not `deleted+<id>@resomix.invalid`.

---

## Sources

- [Art. 17 GDPR — Right to erasure](https://gdpr-info.eu/art-17-gdpr/)
- [EDPB Art. 60 decision — erasure refused on the basis of accepted general terms](https://edpb.europa.eu/sites/edpb/files/article-60-final-decisions/summary/publishable_cy_2019-06_righttoerasure_summarypublic.pdf)
- [EDPB Guidelines 01/2025 on Pseudonymisation](https://www.edpb.europa.eu/system/files/2025-01/edpb_guidelines_202501_pseudonymisation_en.pdf)
- [GDPR data retention — compliance guidelines](https://usercentrics.com/knowledge-hub/gdpr-data-retention/)
- [EU data retention rules and storage limitation](https://secureprivacy.ai/blog/eu-data-retention-rules-gdpr)
- [Legal document retention periods in the EU](https://www.sealdoc.eu/blog/eu-document-retention-periods)
- [GDPR enforcement and fines 2026](https://www.uniconsent.com/blog/gdpr-enforcement-fines-2026)
- [The right to erasure — Irish Data Protection Commission](https://www.dataprotection.ie/en/individuals/know-your-rights/right-erasure-articles-17-19-gdpr)
