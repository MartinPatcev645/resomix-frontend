Technical Architecture & Industry Alignment

This document outlines the core technical pillars of Resomix, comparing our current implementation with industry standards to ensure we are ready to partner with major labels and distributors.

1. Digital Supply Chain (DDEX Integration)

- What it is: Think of this as the "universal language" for the music industry. Instead of manually uploading files and typing in artist names, labels use a standardized XML format (called DDEX ERN) to automatically send thousands of tracks, credits, and rights information directly to our system.
- Industry Standard: The current gold standard is DDEX ERN 4.3. It’s faster, supports high-res audio (like Dolby Atmos), and is what major distributors like DistroKid or TuneCore expect to use when connecting to a platform.
- What we are doing right now: We currently use a custom track processing pipeline with scripts to add new tracks and extract metadata using tools like Mutagen and FFmpeg. We also allow manual user uploads.

2. Automated Content Recognition (ACR)

- What it is: This is like a "digital fingerprint" scanner for music. When a user uploads a track, the system checks it against a massive global database of copyrighted songs to see if it’s a "leak" or an unauthorized upload. This protects us and the labels from copyright issues.
- Industry Standard: Platforms like SoundCloud and Twitch use services like Audible Magic or ACRCloud. These services provide a "stay-down" guarantee, ensuring that once a label flags a track, it can't be re-uploaded anywhere on the platform.
- What we are doing right now: We currently perform a virus check using ClamAV and verify that the file is actually an audio file using FFmpeg.

3. Secure Media Delivery (HLS & Protection)

- What it is: Instead of letting users download a whole MP3 file (which they could then share illegally), break the music into tiny 6-second "segments" (HLS). The player fetches these segments one by one. If add encryption, it becomes nearly impossible for someone to "rip" or steal the music.
- Industry Standard: HLS with AES-128 encryption. Every segment is locked with a key that is only given to a logged-in user with an active session. Also use "Signed URLs" that expire after a few minutes so links can't be shared on forums.
- What we are doing right now: We are already using HLS segments (6-second chunks) for playback. We have a system for HMAC signed URLs, though we aren't currently enforcing the expiration or signature checks.

4. Infrastructure Resilience (High Availability)

- What it is: This is about "keeping the lights on." If one of our servers crashes, does the whole site go down? A "High Availability" setup uses multiple servers so that if one fails, another one instantly takes over without the user ever noticing.
- Industry Standard: Using Load Balancers and Floating IPs. The domain points to a "balancer" that splits traffic between multiple API servers. For the database, use clusters (like MariaDB Galera) so your data is saved on multiple machines simultaneously.
- What we are doing right now: We have a two-server setup (Alwyzon and Hetzner). Alwyzon handles the API and database, while Hetzner handles storage and heavy computation.

5. Data Backup & Recovery

- What it is: If our entire data center disappeared tomorrow, how quickly could we get back online? This involves having a "3-2-1" plan: 3 copies of data, on 2 different types of storage, with 1 copy in a completely different physical location (offsite).
- Industry Standard: Using incremental, deduplicated backups (tools like Restic or Borg) stored on an "immutable" cloud provider like Backblaze B2. For 22TB of data, also look for providers that can ship us a physical hard drive (like Backblaze Fireball) in an emergency to avoid weeks of downloading.
- What we are doing right now: We have RAID but that does not resolve this.

6. Platform Identity (DPID)

- What it is: Every legitimate player in the music world (labels, Spotify, Apple Music) has a "membership ID" called a DPID. It’s a digital certificate that proves you are a vetted, professional organization authorized to handle music metadata.
- Industry Standard: Having a registered DPID through the DDEX consortium. It moves the conversation with labels from "Who are you?" to "Here is our official ID, let's connect."
- What we are doing right now: We do not have a DPID.

7. Security & Access Control

- What it is: This is the digital "wall" around our system. It ensures that only authorized people can access the sensitive parts of our servers and that bots can't spam or attack us.
- Industry Standard: Private Networking (VPC). Database and storage servers should never be "on the internet" directly; they should only talk to the API server over a private, internal cable. also use tools like Fail2Ban to lock out anyone trying to guess passwords.
- What we are doing right now: We use Fail2Ban to block attackers based on failed requests. Communication to the Hetzner server is restricted to specific endpoints, and we use a 4-layer architecture in our code to keep things organized and secure. We also use JWT tokens and API Keys for authentication.
