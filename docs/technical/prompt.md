The resomix is a service that provides music similarity for djs. it provides two options, first one is similarity by search, where user searches and selects a track from our own catalog (of open tracks or licensed tracks) and gets a similarity playlists (10,20,50, or 100 tracks) from our own catalog. Second is similarity by upload, where user uploads a track themselves, it can be any electronic track in the world even unreleased one, and we find the similarity tracks from our own catalog and return the playlist.

Now technically speaking, we have one frontend, written in react js, hosted on cloudflare with cf managed domain. The backend comprises of two servers, both vps having ubuntu. We use a fast api server in them both. In terms of coding practices we've used best practices and created appropriate schemas, services, controllers, repositories, api, utils etc. Means a proper architecture. We also have some scripts which we run separate from the server for our own track processing pipeline to add new tracks into our system. In front we have nginx with certbot, and in our fast api we also have cors with a setup like this in env file:

RESOMIX_ALLOWED_ORIGINS_PRODUCTION=https://resomix.com,https://beta.resomix.com,

First server is called alwyzon, it's used as the main entry point from frontend, it has a mariadb database, elasticsearch, metatags extraction logic and so on. So when a new track is uploaded it comes here, and the server does the initial virus check using ClamAV as a service, we also check for empty files, finally we use ffmpeg to check whether the file is actual audio or not. Then we move on to the processing and extract the meta tags, create an entry in our database, and send to the hetzner server for similarity. This database is also responsible for user auth, as well as all other things.

Second server's name is hetzner, it is our storage and compute server. It's not accessed directly by frontend other than just three endpoints, audio segments for playback, cover images for visuals, audio peaks for waveform display in frontend. All access to other files etc. is strictly restricted. Once we get the track here from alwyzon server, we first convert the original file to all the required ways we want, first we convert the original file to 128kbps mp3 so our further operations go smoothly and this converted file is used from here on out, then we create small segments for our hls playback, peaks json file, cover art file, profile json file (which we create of every track and later is used for similarity calculation). We store the uploaded track separate from our own catalog. The profile json is created by rbeatnet engine, Ill tell about it more at the end. Once the profile is done, we use our engine to create a similarity playlist, and return the list of similarity tracks back. The alwyzon server then populates the results with all the information from our database and returns back to frontend.

This entire process takes about 1-2 second for similarity by search (as there is no meta extraction, alwyzon just passes the request to hetzner, which computes similarity from existing profiles and returns, and alwyzon populates and returns). And takes 5-7 seconds for similarity by upload (but also depends on the curren load).
One more thing of note, when we create entry in database initially, we also assign that track a 36 character uuid, so in hetzner all the files related to this track has that uuid as the filename. Like the peaks will be stored as <uuid>.json so later on while fetching it makes it very easy to find tracks while serving or using elsewhere.

We have fail2ban also set up like Fail2Ban jails to block attackers (40 4xx/5xx = 2hr ban, 25 404s = 3hr ban).

1. R-BeatNet Engine:

- Resomix uses R-BeatNet engine for both music initial pre-processing, and music similarity.
- This engine is not a model, it is our proprietary algorithm.
- We extract various music features from audio files, and also convert them into various formats and split into sections (i.e. Intro -> Drop -> Outro) for better results.
- We use tools like: Librosa, Essentia, Madmom, FFmpeg etc. to extract over 70 different features.
- The music features include timbral, rhythmic, harmonic, and other attributes to capture the multifaceted nature of music.
- More specifically (included but not limited to):
  1. Spectral Profile: Centroid (brightness), Bandwidth, Contrast, Flatness (noisiness), and Rolloff.
  2. Energy & Rhythm: RMSE (intensity), Zero Crossing Rate (percussiveness), Tempo (BPM), and Beat Frames.
  3. Timbre: 13 MFCC Coefficients (the "textural fingerprint" of the audio).
  4. Harmony: Chroma Mean (pitch distribution) and Tonnetz Mean (harmonic Relationships).
  5. MFCCs and Tonnetz
- Our proprietary algorithm is a custom python wrapper that does specific pre-processing and extract features from the audio files. It then uses them to create unique profile for each audio file.
- The engine uses these profiles to calculate similarity between audio files.

2. Music Similarity:

- Resomix provides two methods for music similarity:
  1. Internal Similarity
  2. Custom File Upload
     Internal Similarity:
- Used when the audio file already exists in our database (pre-processed and profiled).
- The response rate faster.
  Custom File Upload:
- Used when user uploads an audio file.
- The response rate slower as we first pre-process and profile the audio file
  Others:
- We tested our engine with tracks CC BY 4.0 licensed Non-commercial, and improved it over the span of 1 year to get the best results.

Here following is some summary which will help you better understand the setup as well:

Alwyzon Server (bserver.resomix.com):

- This is our primary backend and API gateway.
- It receives all user requests from the frontend.
- It runs MariaDB for storing track metadata, user accounts, and playlists.
- It handles authentication using JWT tokens for logged-in users and API Keys for service calls.
- When a user requests similarity, Alwyzon forwards the request to the Hetzner server.
- It uses a 4-layer architecture: Router → Controller → Service → Repository.
- Tech stack: Python 3.12, FastAPI 0.109, MariaDB 11.3+, SQLAlchemy 2.0.

  Hetzner Server (media.resomix.com):

- This is our media storage and compute server.
- It holds 22TB of audio files, covers, peaks, and HLS segments.
- It runs the FAISS vector indexes for similarity search (MAEST + Discogs).
- It processes audio using FFmpeg (previews, HLS segments) and audiowaveform (peaks).
- It serves audio files securely using HMAC signed URLs. (It's right now not checking for expiry or signed urls)
- When it needs embeddings for new tracks, it calls the external GPU server.
- Tech stack: Python 3.8+, FastAPI, FAISS, FFmpeg, Mutagen.

MariaDB (on Alwyzon):

- Stores 2.3M+ track records with metadata (title, artist, album, genre, BPM, key, etc).
- Stores user accounts, authentication data, and session information.
- Stores playlists, favorites, and user preferences.
- This is the relational source of truth for all track information.

All media files live on Hetzner under /mnt/data/OPEN_TRACKS/:

- RAW/ - Original uploaded audio files in their native format.
- PREVIEWS/ - Generated 128kbps MP3 previews for streaming.
- SEGS/ - HLS segments (6-second AAC chunks) for adaptive streaming.
- AUDIO_PEAKS/ - JSON waveform data for audio visualization.
- COVERS/ - Extracted album artwork (JPEG/PNG).
- UPLOADS/ - Preview audio for user-uploaded tracks.
- UPLOADS_RAW/ - Raw audio for user-uploaded tracks.
- SEG_UPLOADS/ - HLS segments for user-uploaded tracks.

5. Track Types

- label: Premium catalog tracks from the pipeline. (None yet)
- upload: Tracks uploaded by users through the frontend.
- open: Open-source tracks processed via local extraction scripts.

8. Request Flow (Similarity)

- Frontend sends a request to Alwyzon (POST /get_similarity/).
- Alwyzon validates the user (API Key or JWT).
- Alwyzon forwards the request to Hetzner (POST /similarity/query-by-uuid/).
- Hetzner loads the embedding for the query track.
- Hetzner runs our engine.
- Hetzner returns ranked UUIDs with similarity scores.
- Alwyzon takes those UUIDs and queries MariaDB for full track metadata.
- Alwyzon returns the complete response to the frontend.

Notes:

- Everything is built on FastAPI for both servers.
- FFmpeg and FFprobe are used for all audio processing.
- Mutagen library handles metadata extraction from audio files.
- audiowaveform tool generates waveform peaks.
- All heavy computation happens on Hetzner, keeping Alwyzon lightweight.

My purpose to give you this summary is so you understand our current system very well.
Now what you must do is based on our system, I want you to tell me what to add more, or basically what we can do here as industry standard. We are going to approach labels and distributors with our service that they should provide their tracks so we have licensed tracks and provide users similarity on those, they can also purchase the tracks and download etc. the standard shop stuff. But right now what we want is basically to understand what we can do before approaching them and Existing arcitecture and technical overview documentation of our system and servers to provide to rightholders.

Like label ask how can I trust your platform?

- What security principles we use
- What technology for streaming? HLS? Is it best implemented best practices?
- How we store files? What steps are we taking to protect files?
  How much protected is your platform?
- We do this, do this, do this?
- Do you have and keep backups?
- What technology used in server.
  Are we Follow industry standards.

And similar questions, you can think yourself. We need to have an answer to all of them, and should have a clear understanding of our system. Also we should know the current state of our system and what are the requirements of such distributors or labels. Like what things beatport is offering to labels in terms of security and other perspectives. Ofcourse first you need to find out industry standards and then see whether resomix upholds them or not. And if something which is not mentioned in above summary, but we need it or it's good to have, mention it and ask me directly so I can look into that aspect as well.

We will be launching our service in europe, so keep that in mind.
