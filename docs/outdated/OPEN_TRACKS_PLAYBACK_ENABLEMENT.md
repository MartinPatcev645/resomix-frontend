# Open-Tracks Playback Enablement — MERGED

> **This spec has been merged into the single source of truth:**
> `resomix-similarity-open/docs/reference/INGESTION_PIPELINE_REDESIGN.md` → **§9 (Playback)**.
>
> Playback now lives alongside the ingestion-gate + 4-jobs redesign because they share the
> `service_mode` gating and the peaks/segments jobs. See that document for:
> - §9.1 provisioning the playback folders by `service_mode` (create on provision / on upgrade;
>   never delete on downgrade),
> - §9.2 enforcing `service_mode` at `generate_playback_token` (the single 403 gate),
> - §9.3 pipeline generation of peaks/segments for new playback partners,
> - §9.4 the one-time open-tracks asset migration (Script 4) + the on-server checks to confirm first.


sftp -i creds/new-developer-key -P 2222 usman@private.electrobuzz.net

python -c "print('Hello World')"