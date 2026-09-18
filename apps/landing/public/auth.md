# auth.md for Resomix

This is the auth.md document for https://resomix.com. It is written for software acting on
someone's behalf. It explains what can be done with no account at all, how a person creates and uses
one, and how programmatic access is actually obtained.

Everything below matches the Terms of Service at https://legal.resomix.com/legal/terms/, which is
the document that governs use of the service. Where this page and the Terms differ, the Terms win.

Resomix is a music similarity search and audio analysis platform. The public website is
https://resomix.com and the product is at https://beta.resomix.com.

## Audience

Two different callers read this page, and they get different answers.

- **An assistant acting for one person**, wanting to run a search or read an analysis. Start with
  guest access below. There is no delegated agent credential for a personal account today.
- **A partner integrating Resomix into a product.** Use the partner API. It is the supported route
  for anything automated, and it is described under "Programmatic access".

## No account required

Sonic Discovery can be used as a guest, with three searches a day and the top ten matches visible.
No sign-up, no credentials, nothing to authenticate. Playlists created as a guest are public by
default.

For simply seeing what Resomix returns for a reference track, stop here. This is the whole answer.

## Human sign-up and sign-in

| | |
|---|---|
| Register | https://beta.resomix.com/auth/register |
| Sign in | https://beta.resomix.com/auth/login |
| Methods | Email address and password, or Google sign-in |
| Cost | Free. No card required |

**An agent cannot complete a registration on its own.** Sign-up requires email verification, and the
verification link goes to the person's inbox. Google sign-in requires their own session and their
consent. Where an account has two-step verification enabled, that step needs the person too. All of
this is deliberate.

**Automated or bulk account creation is not permitted.** Neither is sharing or transferring account
credentials. That is a Terms clause, not a preference, so an agent should not ask a person for their
Resomix password and should not store one. If you are acting for someone who wants an account, point
them at the register link and let them sign in themselves.

## Programmatic access, the partner API

This is the supported route for automation.

There is a REST API for partners. It searches that partner's own catalogue by sound, returns similar
recordings from a track ID or an uploaded reference, and returns structured track analysis.

| | |
|---|---|
| Documentation | https://api-docs.resomix.com |
| Machine-readable catalogue | https://resomix.com/.well-known/api-catalog |
| In plain language | https://resomix.com/developers |
| How access is arranged | https://resomix.com/partners/pilot |

**There is no public sandbox and no self-serve API key.** Keys are issued to approved partners after
a scoping conversation. A self-serve trial is planned and does not exist yet, so there is no endpoint
an agent can call to provision itself a credential.

Once issued, a key is an `rmx_` token sent as a bearer token in the `Authorization` header, and
scopes decide what it may call. Each key searches only that partner's own private index. A key can
never reach another partner's catalogue or the consumer product. Rate limits and monthly quotas are
set per agreement, and on an HTTP 429 the correct behaviour is to respect `Retry-After` and back off
exponentially.

Keys must not be embedded in client-side code, shared, or transferred.

## OAuth

Resomix does not use OAuth, so there is deliberately nothing published at
`/.well-known/oauth-protected-resource` or `/.well-known/oauth-authorization-server`. The partner
API authenticates with issued bearer keys as described above, and there is no authorization server
to discover. This section exists so a client stops looking rather than treating the absence as a
fault.

## What Resomix does with what it receives

Uploaded reference audio is processed privately and deleted no later than 24 hours after upload or
analysis. Neither user audio nor partner audio is used to train or fine-tune the PYXIS-1 engine.
Partner catalogues are logically isolated and restricted to authorised access. The full statement is
at https://resomix.com/trust.

Payment, where a person chooses a paid plan, is taken through Stripe in their own session. Card
details are never an agent's to enter.

## Contact

support@resomix.com for the product and accounts. Partnership and API enquiries go through
https://resomix.com/partners.
