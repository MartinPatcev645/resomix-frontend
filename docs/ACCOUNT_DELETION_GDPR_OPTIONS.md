# Account deletion: hard delete vs. anonymise — and what GDPR actually requires

**For:** George (decision needed)
**From:** engineering
**Date:** 2026-08-08

> **Not legal advice.** This is an accurate summary of the regulation and of what our system holds,
> written so a non-lawyer can make an informed call. Anything with money or liability attached
> (retention periods, the Greek tax position) should be confirmed by the company's accountant or
> counsel.

---

## The question

When a user deletes their Resomix account, should we **physically delete** their rows, or **keep the
row and strip the personal data out of it**?

## Short answer

**Anonymising is allowed, and it is the better engineering choice.** GDPR does not require you to
run `DELETE`. It requires that the person is no longer identifiable from what you hold.

The catch is that the bar for "no longer identifiable" is higher than it sounds, and a
half-anonymised record is *worse* than a hard delete — because it looks compliant while still
identifying someone.

---

## 1. What the regulation actually says

**Article 17 — right to erasure.** A person can ask you to erase their personal data, and you
generally must, without undue delay.

**Recital 26 — the escape hatch, and the reason this question has a good answer.** GDPR applies to
*personal data*. It explicitly does **not** apply to anonymous information — data that cannot be
linked to an identifiable person. So if you transform the data such that nobody is identifiable, it
stops being in scope, and there is nothing left to erase.

The UK ICO states this directly: if you delete **or anonymise** personal data so that it is no
longer personal data, you have effectively erased it. EU regulators take the same position.

**Article 17(3) — erasure is not absolute.** You may refuse to erase where you need the data to
comply with a **legal obligation** (tax and accounting records) or to establish or defend **legal
claims**. This is what lets us keep invoices.

**Article 4(5) — the trap.** *Pseudonymised* data is still personal data. If you can reverse it, or
join it back to a person using anything you or anyone else holds, it is not anonymous and GDPR
still applies in full.

**Article 12(3) — the clock.** You must respond within one month, extendable by two for complex
cases. Our 30-day grace period sits comfortably inside that.

---

## 2. Where the line sits — the part that decides everything

These do **not** count as anonymised:

| What people do | Why it fails |
|---|---|
| Hash the email | Reversible by guessing — the input space of email addresses is small. Still personal data. |
| Replace the email, keep a mapping table | Directly re-identifiable. This is the textbook definition of pseudonymisation. |
| Blank the name, keep the IP address | An IP address is personal data in its own right (settled in EU case law). |
| Blank the profile, keep their uploaded files and playlist names | Free text and filenames routinely contain names. |
| Blank our copy, forget the third parties | Stripe still holds their name, email and card details. |

Anonymisation has to be **irreversible**, and it has to cover **everything**, including free-text
fields nobody thinks about.

---

## 3. What Resomix actually holds about a person

I went through the schema rather than guessing. Personal data lives in more places than the
`users` table:

**Direct identifiers**
- `users` — email, username, display name, profile picture, Stripe customer id, password hash
- `user_auth_providers` — the Google account id (a direct, permanent identifier)
- `user_sessions` — IP addresses and user agents

**Personal data hiding in content**
- `contacts` — name, email, phone, and a **free-text message** that can contain anything
- `feedbacks` — free-text message
- `playlists` — user-chosen names
- `tracks` — uploaded filenames, and the audio itself
- `consumption_events` — IP address on every playback row

**Held by third parties, outside our database**
- **Stripe** — name, email, card details, billing address, full payment history
- **Email provider** — every message we have sent them

That last group matters: anonymising our database does **not** erase Stripe's copy. A complete
erasure request has to include redacting the Stripe customer. Stripe supports this, but it is a
separate action and it is irreversible on their side too.

---

## 4. Three options

### Option A — Hard delete *(what is currently built)*

Physically remove the user row and their content. Financial and audit records survive, repointed to
a "deleted user" placeholder so the accounting stays intact.

- ✅ Unambiguous. Nothing to argue about.
- ❌ Irreversible the moment it runs — a mistake cannot be undone.
- ❌ Needs the placeholder-user machinery, because six tables have `NOT NULL` owner columns.
- ❌ **The genuinely dangerous part:** three billing tables are set to cascade-delete with the user.
  Deleting the user row would silently destroy every invoice unless they are moved first. That is
  handled, and tested — but it is a permanent sharp edge in the design.

### Option B — Keep the row, anonymise it, delete the content ⭐ *recommended*

The account row stays. Email, name, username, picture and Stripe id are replaced with
non-identifying values. IPs are cleared. Their **content** — playlists, uploads, analyses, contact
messages, feedback — is deleted, because that is where the unpredictable personal data lives.
Invoices and usage aggregates remain, now attached to an anonymous account.

- ✅ **Compliant** — nothing identifying survives, so it is no longer personal data.
- ✅ No foreign key ever breaks. No placeholder user needed. Considerably simpler than Option A.
- ✅ Analytics stay coherent: "one user did 400 searches" is still true and still countable.
- ✅ Reversible **only** during the 30-day grace window, when we have not scrubbed anything yet.
- ⚠️ Requires discipline: every new table holding personal data must be added to the scrub list.
  This is the real ongoing cost, and it is the thing that decays if nobody maintains it.

### Option C — Soft delete only, keep everything

Flag the account inactive and change nothing else.

- ✅ Trivial.
- ❌ **Not compliant.** All the personal data is still there and still identifies them. This is not
  erasure by any reading of Article 17.

---

## 5. Recommendation

**Option B.**

Not primarily for legal reasons — both A and B are defensible — but because it is **safer and
simpler code**. It removes the placeholder-user machinery, removes the cascade-delete hazard around
invoices entirely, and makes "did we handle this table?" a question with a visible answer in one
list rather than an implicit one spread across 37 foreign keys.

The 30-day grace period should stay either way. It is our protection against acting on a request
someone regrets, and it is well inside the one-month response window.

Two things to be honest about with Option B:

1. **Content still has to be deleted**, not anonymised. There is no safe way to keep a free-text
   support message or an uploaded file and claim it is anonymous.
2. **Someone must maintain the scrub list.** A new table with an email column and no entry in that
   list is a quiet compliance gap. Worth a note in the PR checklist.

---

## 6. What we need decided

| # | Question | Engineering recommendation |
|---|---|---|
| 1 | Hard delete or anonymise-in-place? | **Anonymise (Option B)** |
| 2 | Keep the 30-day grace period? | **Yes** — inside the legal window, and our only undo |
| 3 | Should deletion also redact the **Stripe** customer? | **Yes** for a true erasure request. Needs confirming that it does not break invoice retention on Stripe's side |
| 4 | How long do we keep invoices and financial records? | Legal obligation, not our choice — typically **5–10 years** in the EU depending on member state. **Confirm the Greek figure with the accountant.** |
| 5 | Keep usage analytics after anonymisation? | **Yes** — no longer personal data once the account is anonymous |
| 6 | Do we need a written retention policy? | **Yes eventually.** Article 5(2) requires being able to *demonstrate* compliance. A one-page document is enough, and this file is most of it |

---

## 7. Effort

The work already done is not wasted — the hard part was mapping which of the 37 foreign keys does
what, and which tables hold personal data. That map is the same for both options.

- Switching to Option B: roughly **half a day**, and it *deletes* more code than it adds.
- Staying with Option A: already built and tested, nothing further needed.

Either way the user-facing behaviour is identical: account deactivated immediately, data gone after
30 days, confirmation emails at both ends.
