Technical Overview (Public):

- This is source of truth for all documents.
- From here on "engine" or "algorithm" means PYXIS-1 engine.

1. PYXIS-1 Engine

- Resomix uses PYXIS-1 engine for both music initial pre-processing, and music similarity.
- This engine is not a model, it is our proprietary algorithm.
- We extract various music features from audio files, and also convert them into various formats and split into sections (i.e. Intro -> Drop -> Outro) for better results.
- We use tools like: Librosa, Essentia, Madmom, FFmpeg etc. to extract over 70 different features.
- The music features include timbral, rhythmic, harmonic, and other attributes to capture the multifaceted nature of music.
- More specifically (included but not limited to):
  1. Spectral Profile: Centroid (brightness), Bandwidth, Contrast, Flatness (noisiness), and Rolloff.
  2. Energy & Rhythm: RMSE (intensity), Zero Crossing Rate (percussiveness), Tempo (BPM), and Beat Frames.
  3. Timbre: 13 MFCC Coefficients (the "textural fingerprint" of the audio).
  4. Harmony: Chroma Mean (pitch distribution) and Tonnetz Mean (harmonic Relationships).
  5. MFCCs and Tonnetz.
- Our proprietary algorithm is a custom python wrapper that does specific pre-processing and extract features from the audio files. It then uses them to create unique profile for each audio file.
- The engine uses these profiles to calculate similarity between audio files.

2. Music Similarity

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
- Don't mention "model", "deep learning" or "training" as we're not doing that.








3. Secure File Downloads

- Resomix can provide secure download functionality for audio files using signed URLs.
- This approach ensures that only authorized users can download files, and links expire after a set time.
- Our current architecture already supports this as we use HMAC + Fernet encryption for audio streaming.
- Implementation involves creating a download endpoint that validates signed tokens before serving files.
- Files are served with proper Content-Disposition headers to trigger browser downloads.

  In-House Approach:
- We generate a signed token containing the file UUID and expiry timestamp.
- The token is encrypted with Fernet and signed with HMAC for tamper protection.
- When a user requests a download, we validate the signature and expiry before serving.
- This gives us full control and integrates seamlessly with our existing security layer.

  Pre-Built Alternatives:
- AWS S3 Pre-Signed URLs: Generate temporary download links with built-in expiry. Good for large-scale deployments.
- Cloudflare R2 Signed URLs: Similar to S3 but with zero egress fees. Works well with existing Cloudflare setup.
- Backblaze B2 + Cloudflare: Cost-effective for high bandwidth usage with signed URL support.
- Firebase Storage: Offers signed URLs with Firebase Auth integration if we move to that ecosystem.
- MinIO (Self-Hosted): S3-compatible storage we can host ourselves with full signed URL support.




