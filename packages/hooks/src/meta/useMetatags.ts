import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js';

interface CoverArtOptions {
  debug?: boolean;
}

interface MetadataOptions {
  includeCoverArt?: boolean;
  debug?: boolean;
}

interface AudioMetadata {
  filename: string;
  size: number;
  type: string;
  title: string;
  artist: string | null;
  album: string | null;
  year: string | null;
  genre: string | null;
  label: string | null;
  bpm: string | null;
  key: string | null;
  duration: number;
  coverUrl: string | null;
}

/**
 * Extract cover art from an audio file
 * @param file - The audio file to extract cover art from
 * @param options - Optional configuration
 * @returns Promise<string|null> - Base64 data URL of cover art or null if not found
 */
export const extractCoverArt = async (file: File, options: CoverArtOptions = {}): Promise<string | null> => {
  const { debug = false } = options;

  try {
    return new Promise<string | null>((resolve) => {
      jsmediatags.read(file, {
        onSuccess: (tag: any) => {
          if (tag.tags && tag.tags.picture) {
            try {
              const { data, format } = tag.tags.picture;
              let base64String = "";
              for (let i = 0; i < data.length; i++) {
                base64String += String.fromCharCode(data[i]);
              }
              const coverUrl = `data:${format};base64,${window.btoa(base64String)}`;
              
              if (debug) {
                console.log('Cover art extracted successfully:', {
                  format,
                  size: data.length,
                  coverUrl: coverUrl.substring(0, 50) + '...'
                });
              }
              
              resolve(coverUrl);
            } catch (error) {
              if (debug) {
                console.warn('Could not extract cover art:', error);
              }
              resolve(null);
            }
          } else {
            if (debug) {
              console.log('No cover art found in audio file');
            }
            resolve(null);
          }
        },
        onError: (error: any) => {
          if (debug) {
            console.log('Could not read ID3 tags for cover art:', error);
          }
          resolve(null);
        }
      });
    });
  } catch (error) {
    if (debug) {
      console.error('Error extracting cover art:', error);
    }
    return null;
  }
};

/**
 * Extract comprehensive metadata from an audio file
 * Supports all ID3 tag versions and handles various field name formats
 * @param file - The audio file to extract metadata from
 * @param options - Optional configuration
 * @returns Promise<AudioMetadata> - Extracted metadata object
 */
export const extractAudioMetadata = async (file: File, options: MetadataOptions = {}): Promise<AudioMetadata> => {
  const { includeCoverArt = false, debug = false } = options;

  try {
    // Create audio element to get duration and other basic properties
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    
    // Get basic file properties
    const basicMetadata: AudioMetadata = {
      filename: file.name,
      size: file.size,
      type: file.type,
      title: file.name.replace(/\.[^/.]+$/, ""), // Default to filename without extension
      artist: null,
      album: null,
      year: null,
      genre: null,
      label: null,
      bpm: null,
      key: null,
      duration: 0,
      coverUrl: null
    };

    // Get duration from audio element
    const getDuration = new Promise<void>((resolve) => {
      audio.addEventListener('loadedmetadata', () => {
        basicMetadata.duration = audio.duration;
        URL.revokeObjectURL(objectUrl);
        resolve();
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(objectUrl);
        resolve(); // Continue even if we can't get duration
      });
      
      audio.src = objectUrl;
    });

    // Extract ID3 tags using jsmediatags (compatible with all ID3 versions)
    const extractTags = new Promise<void>((resolve) => {
      jsmediatags.read(file, {
        onSuccess: (tag: any) => {
          if (tag.tags) {
            const tags = tag.tags;
            
            if (debug) {
              console.log('Available ID3 tags:', Object.keys(tags));
              console.log('Full tags object:', tags);
              
              // Special debug for label-related tags
              console.log('Label-related tags found:');
              const labelKeys = Object.keys(tags).filter(key => 
                key.toLowerCase().includes('label') || 
                key.toLowerCase().includes('publisher') || 
                key.toLowerCase().includes('record') ||
                key === 'TPUB' || key === 'TPB'
              );
              labelKeys.forEach(key => {
                console.log(`  ${key}:`, tags[key]);
              });
              
              // Check TXXX tags specifically
              if (tags.TXXX) {
                console.log('TXXX (User-defined text) tags:');
                const txxxTags = Array.isArray(tags.TXXX) ? tags.TXXX : [tags.TXXX];
                txxxTags.forEach((txxx: any, index: number) => {
                  if (txxx && typeof txxx === 'object') {
                    console.log(`  TXXX[${index}] - Description: "${txxx.description}", Data: "${txxx.data || txxx.value || txxx.text}"`);
                  }
                });
              }
            }
            
            // Extract title (check multiple possible field names and handle objects)
            let title = tags.title || tags.TIT2 || tags.TT2;
            if (title) {
              if (typeof title === 'object') {
                title = title.value || title.data || title.text || title.toString();
              }
              if (title && title.toString().trim() !== '') {
                basicMetadata.title = title.toString().trim();
              }
            }
            
            // Extract artist (check multiple possible field names and handle objects)
            let artist = tags.artist || tags.TPE1 || tags.TP1;
            if (artist) {
              if (typeof artist === 'object') {
                artist = artist.value || artist.data || artist.text || artist.toString();
              }
              if (artist && artist.toString().trim() !== '') {
                basicMetadata.artist = artist.toString().trim();
              }
            }
            
            // Extract album (check multiple possible field names and handle objects)
            let album = tags.album || tags.TALB || tags.TAL;
            if (album) {
              if (typeof album === 'object') {
                album = album.value || album.data || album.text || album.toString();
              }
              if (album && album.toString().trim() !== '') {
                basicMetadata.album = album.toString().trim();
              }
            }
            
            // Extract year (check multiple possible field names and handle objects)
            let year = tags.year || tags.TYER || tags.TYE || tags.TDRC || tags.TDAT;
            if (year) {
              if (typeof year === 'object') {
                year = year.value || year.data || year.text || year.toString();
              }
              if (year && year.toString().trim() !== '') {
                basicMetadata.year = year.toString().trim();
              }
            }
            
            // Extract genre (check multiple possible field names and handle objects)
            let genre = tags.genre || tags.TCON || tags.TCO;
            if (genre) {
              if (typeof genre === 'object') {
                genre = genre.value || genre.data || genre.text || genre.toString();
              }
              if (genre && genre.toString().trim() !== '') {
                basicMetadata.genre = genre.toString().trim();
              }
            }
            
            // Extract label/publisher (check multiple possible field names and handle objects)
            // Support for all ID3 versions and case variations:
            // ID3v2.4: TPUB (Publisher)
            // ID3v2.3: TPUB (Publisher) 
            // ID3v1: Not standardized, but often stored as LABEL or PUBLISHER
            // Custom tags: LABEL, PUBLISHER, Label, Publisher, etc.
            let label = tags.label || tags.publisher || tags.TPUB || tags.TPB || 
                       tags.LABEL || tags.PUBLISHER || tags.Label || tags.Publisher ||
                       tags['RECORD LABEL'] || tags['Record Label'] || tags['record-label'] ||
                       tags.RECORDLABEL || tags.RecordLabel || tags.recordlabel ||
                       tags.TXXX?.LABEL || tags.TXXX?.PUBLISHER || tags.TXXX?.label || tags.TXXX?.publisher ||
                       // Additional variations
                       tags.ORGANIZATION || tags.organization || tags.Organization ||
                       tags.LABEL_NAME || tags.label_name || tags.LabelName ||
                       tags.RECORD_COMPANY || tags.record_company || tags.RecordCompany ||
                       tags.IMPRINT || tags.imprint || tags.Imprint;
            
            // Also check for user-defined text frames (TXXX) which might contain label info
            if (!label && tags.TXXX) {
              // TXXX can be an array or single object
              const txxxTags = Array.isArray(tags.TXXX) ? tags.TXXX : [tags.TXXX];
              for (const txxx of txxxTags) {
                if (txxx && typeof txxx === 'object') {
                  const description = (txxx.description || '').toLowerCase();
                  if (description.includes('label') || description.includes('publisher') || 
                      description.includes('record') || description.includes('imprint')) {
                    label = txxx.data || txxx.value || txxx.text;
                    break;
                  }
                }
              }
            }
            
            if (label) {
              if (typeof label === 'object') {
                label = label.value || label.data || label.text || label.toString();
              }
              if (label && label.toString().trim() !== '') {
                basicMetadata.label = label.toString().trim();
              }
            }
            
            // Extract BPM (check multiple possible field names and handle objects)
            let bpm = tags.bpm || tags.TBPM || tags.TBP || tags['beats-per-minute'] || tags['BEATS-PER-MINUTE'] || tags['BeatsPerMinute'];
            
            // Handle case where BPM might be an object
            if (bpm) {
              if (typeof bpm === 'object') {
                // If it's an object, try to get the value property or data property
                bpm = bpm.value || bpm.data || bpm.text || bpm.toString();
              }
              if (bpm && bpm.toString().trim() !== '') {
                basicMetadata.bpm = bpm.toString().trim();
              }
            }
            
            // Extract key (check multiple possible field names and handle objects)
            let key = tags.key || tags.TKEY || tags.TKE || tags.initialkey || tags.INITIAL_KEY || tags['initial-key'] || tags['musical-key'];
            
            // Handle case where key might be an object
            if (key) {
              if (typeof key === 'object') {
                // If it's an object, try to get the value property or data property
                key = key.value || key.data || key.text || key.toString();
              }
              if (key && key.toString().trim() !== '') {
                basicMetadata.key = key.toString().trim();
              }
            }
            
            // Extract cover art if requested
            if (includeCoverArt && tags.picture) {
              try {
                const { data, format } = tags.picture;
                let base64String = "";
                for (let i = 0; i < data.length; i++) {
                  base64String += String.fromCharCode(data[i]);
                }
                basicMetadata.coverUrl = `data:${format};base64,${window.btoa(base64String)}`;
              } catch (error) {
                console.warn('Could not extract cover art:', error);
              }
            }
            
            if (debug) {
              console.log('Extracted metadata:', {
                title: basicMetadata.title,
                artist: basicMetadata.artist,
                album: basicMetadata.album,
                year: basicMetadata.year,
                genre: basicMetadata.genre,
                bpm: basicMetadata.bpm,
                key: basicMetadata.key,
                duration: basicMetadata.duration,
                coverUrl: basicMetadata.coverUrl ? 'Present' : 'Not found'
              });
            }
          }
          resolve();
        },
        onError: (error: any) => {
          if (debug) {
            console.log('Could not extract ID3 tags:', error);
          }
          resolve(); // Continue even if we can't read tags
        }
      });
    });

    // Wait for both duration and tags extraction
    await Promise.all([getDuration, extractTags]);
    
    return basicMetadata;
    
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {
      filename: file.name,
      size: file.size,
      type: file.type,
      duration: 0,
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: null,
      album: null,
      year: null,
      genre: null,
      label: null,
      bpm: null,
      key: null,
      coverUrl: null
    };
  }
};
