# Privacy policy — deletion and retention section

**For:** George → the lawyer
**From:** engineering
**Date:** 2026-08-10
**Status:** ⚠️ **Draft. Needs legal sign-off before publishing.**

---

## What this is

Drop-in copy for two things we are currently missing:

1. a **"Deleting your account"** section describing what actually happens;
2. a **retention schedule** — required by Art. 13(2)(a) regardless of any of this work, and very
   likely absent from the current policy.

Every claim below matches what the code does as of migration `d3f7a1c5e982`. It was written from
the implementation, not the other way round, so it can be checked against
[`ACCOUNT_DELETION_GDPR_OPTIONS.md`](ACCOUNT_DELETION_GDPR_OPTIONS.md) §4 line by line.

**Two blanks need filling before this ships:**

| Blank | Who answers | Notes |
|---|---|---|
| `[X]` years for financial records | the accountant | 5–10 across the EU; the code reads it from `INVOICE_RETENTION_YEARS` |
| The uploaded-audio sentence | George | see §4.6 of the options doc — recommendation is to delete source files, keep the derived analysis |

---

## Draft copy

### Deleting your account

You can delete your account at any time from Settings. When you do:

- You are signed out everywhere immediately and can no longer sign in.
- We complete the removal of your personal details **within 4 weeks**.
- **Changed your mind?** Contact us before we've completed it and we'll restore your account
  exactly as you left it. There's no deadline — just reach out.
- When we complete it, we remove your name, username, email address, password and profile picture,
  and disconnect any Google, Apple Music or Spotify account you had linked. Any IP addresses we
  hold for you are cleared. We'll email you to confirm.
- Records of what you did on Resomix — playlists, ratings, listening and search activity, support
  messages and feedback — are kept **without your personal details**, linked only to an internal
  reference number. We use them for statistics and to improve the service.
- **Payment records are kept in full, including your name**, because tax and accounting law
  requires it.
- `[Uploaded audio files are deleted. — pending George]`

### How long we keep things

| What | How long | Why |
|---|---|---|
| Your account and profile | until you delete it | to provide the service |
| Invoices and payment records | `[X]` years | required by tax and accounting law |
| Usage records after account deletion | indefinitely, without your personal details | statistics and service improvement |
| Support messages and feedback | indefinitely, without your personal details once your account is deleted | to keep a record of our correspondence |
| Server logs, including IP addresses | 90 days | security and abuse prevention |
| Login sessions | 90 days after expiry | security |

### A note on wording

We do not describe this as anonymisation. Because we keep an internal reference number, and because
payment records must keep your name, it remains possible to link the retained records back to you.
Under the GDPR that is **pseudonymisation**, not anonymisation — the retained data is still personal
data, and all of your rights still apply to it, including the right to object and the right to
complain to your data protection authority.

---

## Notes for the lawyer

**1. We are deliberately not claiming anonymisation.** The account keeps its internal id, and Stripe
retains the customer identity for tax purposes, so the retained data is pseudonymised and stays in
scope. The final paragraph above volunteers this rather than glossing it. That is a considered
choice: it costs nothing and it is the clearest evidence that the obligation was understood rather
than papered over. Please keep it unless there is a reason not to.

**2. The lawful bases we are relying on.**

| Category | Basis |
|---|---|
| Invoices, orders, subscription events, consents | Art. 17(3)(b) — legal obligation (tax/accounting) |
| Server logs, session IPs | legitimate interest — security and abuse prevention, time-bounded |
| Usage records tied to an internal id | legitimate interest / statistical purposes (Recital 162) |

The third is the weakest of the three and we know it. "We want it for analysis" is not an Art. 17
exemption. The position we are taking is that the retained records carry no identifying attributes —
no name, email, IP or filename — only an opaque integer. Worth your view on whether that is stated
strongly enough.

**3. What we deliberately did NOT do.** An earlier proposal was to add a clause to the Terms under
which the user consents at signup to indefinite retention. We dropped it: consent bundled into
terms-of-service acceptance is not freely given (Art. 7(4), Recital 43), and Art. 17 is a statutory
right that cannot be contracted away. The EDPB has decided close to this exact point. If a clause
like that is still wanted, we would want your view first.

**4. Terms of service.** One sentence only:

> Account deletion, and how long we keep data afterwards, are described in our Privacy Policy.

**5. Our response times.** A request deactivates the account immediately; the removal itself is
carried out manually by an administrator. We commit to 4 weeks publicly, inside Art. 12(3)'s one
month. Where a request runs past a month, we send an extension notice with the actual reason, as
12(3) requires — that is implemented and its wording is in §6.7 of the options doc.

**6. What we can also do on request.** Because the retained rows are kept rather than destroyed,
we can go further than the above for an individual who insists — deleting their playlists, uploads
and support history entirely. Only the financial records are genuinely immovable. Worth knowing
when answering a determined data subject.
