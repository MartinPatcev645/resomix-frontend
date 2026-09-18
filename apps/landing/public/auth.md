# Signing in to Resomix

This page is for software acting on someone's behalf. It explains what can be done without an
account, how a person creates one, and how programmatic access is arranged. Everything here matches
the Terms of Service at https://legal.resomix.com/legal/terms/, which is the document that governs
use of the service.

Resomix is a music similarity search and audio analysis platform. The public website is
https://resomix.com and the product is at https://beta.resomix.com.

## Without an account

Sonic Discovery can be used as a guest, with three searches a day and the top ten matches visible.
No sign-up, no credentials, nothing to authenticate. Playlists created as a guest are public by
default.

This is the right route for trying the product. If all you need is to see what Resomix returns for a
reference track, stop here.

## Creating an account

Accounts are created by a person at https://beta.resomix.com, either with an email address and a
password or with Google sign-in.

**An agent cannot complete this on its own.** Sign-up requires email verification, and the
verification link goes to the person's inbox. Google sign-in requires their Google session and their
consent. Both steps are deliberately the person's to take.

Automated or bulk account creation is not permitted, and neither is sharing or transferring account
credentials. If you are acting for someone, ask them to create the account and sign in themselves.

An account is free. No card is required.

## Paid plans

Pro is a paid plan for deeper use. As of late 2026 it is 7.99 EUR per month plus applicable VAT,
with a saving on annual billing. Prices change, so the figures shown at
https://resomix.com/pricing and confirmed at checkout are the ones that apply.

Payment is taken through Stripe, by the person, in their own session. Do not attempt to enter card
details on someone's behalf.

## Programmatic access, the partner API

There is a REST API for partners. It searches that partner's own catalogue by sound, returns similar
recordings from a track ID or an uploaded reference, and returns structured track analysis.

Its documentation is at https://api-docs.resomix.com and the machine-readable catalogue of it is at
https://resomix.com/.well-known/api-catalog.

**There is no public sandbox and no self-serve API key.** Keys are issued to approved partners after
a scoping conversation, described at https://resomix.com/partners/pilot. A self-serve trial is
planned but does not exist yet.

Once issued, a key is an `rmx_` token sent as a bearer token, and scopes decide what it may call.
Each key searches only that partner's own private index. A key can never reach another partner's
catalogue or the consumer product. Rate limits and monthly quotas are set per agreement, and on an
HTTP 429 the correct behaviour is to respect `Retry-After` and back off.

Keys must not be embedded in client-side code, shared, or transferred.

## What Resomix does with what it receives

Uploaded reference audio is processed privately and deleted no later than 24 hours after upload or
analysis. Neither user audio nor partner audio is used to train or fine-tune the PYXIS-1 engine.
Partner catalogues are logically isolated. The full statement is at https://resomix.com/trust.

## Contact

support@resomix.com for the product and accounts. Partnership and API enquiries go through
https://resomix.com/partners.
