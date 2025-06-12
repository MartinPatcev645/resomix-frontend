"""
Metadata Extraction Service
===========================

This service provides unified functionality for audio metadata extraction using Mutagen.
It combines both limited and comprehensive metadata extraction approaches.

Combined from: src/metadata_extraction.py + src/complete_meta_backup.py
Version: 1.0.0
Date: May 6, 2025
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, BinaryIO, Union, Optional

from mutagen import File as MutagenFile, MutagenError
from mutagen.id3 import ID3


class MetadataService:
    """
    Service for audio metadata extraction with multiple extraction modes.
    """
    
    # Limited extraction mapping (for focused extraction)
    _LIMITED_ID3_MAP: Dict[str, str] = {
        "TIT2": "Title",
        "TALB": "Album",
        "TPE1": "Artist",
        "TCON": "Genre",
        "TDRC": "Year",  # v2.4 Recording time
        "TYER": "Year",  # v2.3 Year
        "TPUB": "Label",  # Publisher → Label
    }

    _LIMITED_VORBIS_MAP: Dict[str, str] = {
        "TITLE": "Title",
        "ALBUM": "Album",
        "ARTIST": "Artist",
        "GENRE": "Genre",
        "YEAR": "Year",
        "DATE": "Year",      # Some FLACs use DATE for year
        "LABEL": "Label",
        "PUBLISHER": "Label",
    }

    # Comprehensive extraction mapping
    _COMPREHENSIVE_ID3_MAP: Dict[str, str] = {
        "TIT2": "Title",
        "TPE1": "Artist",
        "TPE2": "Album Artist",
        "TALB": "Album",
        "TCON": "Genre",
        "TDRC": "Year",
        "TYER": "Year",
        "TDRL": "Release Date",
        "TRCK": "Track Number",
        "TPOS": "Disc Number",
        "TBPM": "BPM",
        "TSRC": "ISRC",
        "TPUB": "Publisher",
        "TCOM": "Composer",
    }

    _COMPREHENSIVE_VORBIS_MAP: Dict[str, str] = {
        "TITLE": "Title",
        "ARTIST": "Artist",
        "ALBUM": "Album",
        "ALBUMARTIST": "Album Artist",
        "GENRE": "Genre",
        "TRACKNUMBER": "Track Number",
        "TRACKTOTAL": "Track Total",
        "TOTALTRACKS": "Track Total",
        "DISCNUMBER": "Disc Number",
        "DISCTOTAL": "Disc Total",
        "TOTALDISCS": "Disc Total",
        "DATE": "Release Date",
        "YEAR": "Year",
        "BPM": "BPM",
        "ISRC": "ISRC",
        "CATALOGNUMBER": "Catalog Number",
        "LABEL": "Publisher",
        "PUBLISHER": "Publisher",
        "COMPOSER": "Composer",
        "COMMENT": "Comment",
        "COMMENTS": "Comment",
    }

    # Common constants
    _IMAGE_FRAME_IDS = {"APIC", "PIC"}
    _IMAGE_VORBIS_KEYS = {"METADATA_BLOCK_PICTURE", "COVERART", "COVERARTMIME"}
    _COMMENT_IDS = {"COMM"}
    _YEAR_FROM_DATE = re.compile(r"^(\d{4})")
    _TRACK_SPLIT = re.compile(r"^(?P<num>\d+)(?:/?(?P<tot>\d+))?$")

    @staticmethod
    def extract_metadata(file_obj: BinaryIO, filename: str = "", mode: str = "comprehensive") -> Dict[str, Any]:
        """
        Extract metadata from audio file with different extraction modes.
        
        Args:
            file_obj: Binary file object to extract metadata from
            filename: Original filename (for logging)
            mode: Extraction mode - "limited" for basic tags only, "comprehensive" for all metadata
            
        Returns:
            Dict containing extracted metadata or error information
        """
        if mode == "limited":
            return MetadataService._extract_limited_metadata(file_obj, filename)
        else:
            return MetadataService._extract_comprehensive_metadata(file_obj, filename)

    @staticmethod
    def _extract_limited_metadata(file_obj: BinaryIO, filename: str = "") -> Dict[str, str]:
        """Extract only basic metadata fields (Title, Album, Artist, Genre, Year, Label)."""
        wanted: Dict[str, str] = {}
        file_obj.seek(0)
        
        try:
            audio = MutagenFile(file_obj, easy=False)
        except MutagenError as e:
            return {"error": str(e)}

        if audio is None or audio.tags is None:
            return wanted  # empty dict – nothing found / unsupported format

        if isinstance(audio.tags, ID3):
            MetadataService._gather_limited_id3(audio.tags, wanted)
        else:
            MetadataService._gather_limited_vorbis(dict(audio.tags), wanted)

        return wanted

    @staticmethod
    def _extract_comprehensive_metadata(file_obj: BinaryIO, filename: str = "") -> Dict[str, Any]:
        """Extract comprehensive metadata including technical details."""
        print(f"[extract_metadata] ▶ processing '{filename or '<in‑memory>'}'")
        meta: Dict[str, Any] = {}

        file_obj.seek(0)
        try:
            audio = MutagenFile(file_obj, easy=False)
        except MutagenError as e:
            print("[extract_metadata] MutagenError:", e)
            return {"error": str(e)}

        if audio is None or audio.tags is None:
            return {"info": "No tags found or unsupported format."}

        # Technical details
        if hasattr(audio, "info"):
            info = audio.info
            meta.update({
                "Duration (s)": round(getattr(info, "length", 0), 3),
                "Bitrate": getattr(info, "bitrate", None),
                "Sample Rate": getattr(info, "sample_rate", None),
                "Channels": getattr(info, "channels", None),
            })

        # Dispatch by tag container type
        if isinstance(audio.tags, ID3):
            MetadataService._parse_comprehensive_id3(audio.tags, meta)
        else:
            # FLAC / OGG / OPUS => Vorbis comments dict‑like
            MetadataService._parse_comprehensive_vorbis(dict(audio.tags), meta)

        print(f"[extract_metadata] ✔ collected {len(meta)} fields from '{filename}'")
        return meta

    # Limited extraction helpers
    @staticmethod
    def _to_str(val: Any) -> str:
        """Convert value to string for limited extraction."""
        if val is None:
            return ""
        if isinstance(val, (bytes, bytearray)):
            try:
                return val.decode("utf-8", errors="replace").strip()
            except Exception:
                return ""
        return str(val).strip()

    @staticmethod
    def _first(lst: List[str]) -> str:
        """Get first element from list or empty string."""
        return lst[0] if lst else ""

    @staticmethod
    def _gather_limited_id3(tags: ID3, out: Dict[str, str]):
        """Gather limited ID3 tags."""
        for frame in tags.values():
            fid = frame.FrameID
            if fid in MetadataService._IMAGE_FRAME_IDS or fid in MetadataService._COMMENT_IDS:
                continue
            key = MetadataService._LIMITED_ID3_MAP.get(fid)
            if not key:
                continue  # skip unneeded tags
            if hasattr(frame, "text"):
                txt = MetadataService._to_str(MetadataService._first(frame.text or []))
                if not txt:
                    continue
                if key == "Year":
                    m = MetadataService._YEAR_FROM_DATE.match(txt)
                    txt = m.group(1) if m else txt
                out.setdefault(key, txt)

    @staticmethod
    def _gather_limited_vorbis(vc: Dict[str, List[str]], out: Dict[str, str]):
        """Gather limited Vorbis tags."""
        for k, vals in vc.items():
            up = k.upper()
            if up in MetadataService._IMAGE_VORBIS_KEYS:
                continue
            key = MetadataService._LIMITED_VORBIS_MAP.get(up)
            if not key:
                continue
            value_str = MetadataService._to_str(MetadataService._first(vals if isinstance(vals, list) else [vals]))
            if not value_str:
                continue
            if key == "Year":
                m = MetadataService._YEAR_FROM_DATE.match(value_str)
                value_str = m.group(1) if m else value_str
            out.setdefault(key, value_str)

    # Comprehensive extraction helpers
    @staticmethod
    def _to_text(value: Any) -> str:
        """Convert value to text for comprehensive extraction."""
        if value is None:
            return ""
        if isinstance(value, (bytes, bytearray)):
            try:
                return value.decode("utf‑8", errors="replace").strip()
            except Exception:
                return ""
        return str(value).strip()

    @staticmethod
    def _clean_numeric(s: str) -> Union[int, str]:
        """Clean numeric values."""
        return int(s) if s.isdigit() else s

    @staticmethod
    def _flatten(val: Union[str, List[str]]):
        """Flatten single-item lists."""
        return val[0] if isinstance(val, list) and len(val) == 1 else val

    @staticmethod
    def _handle_track_disc(text: str) -> str:
        """Handle track/disc number formatting."""
        m = MetadataService._TRACK_SPLIT.match(text.strip())
        if not m:
            return text.strip()
        num, tot = m.group("num"), m.group("tot")
        return f"{num}/{tot}" if tot else num

    @staticmethod
    def _parse_comprehensive_id3(tags: ID3, meta: Dict[str, Any]):
        """Parse comprehensive ID3 tags."""
        for frame in tags.values():
            fid = frame.FrameID
            if fid in MetadataService._IMAGE_FRAME_IDS:
                continue  # skip artwork frames
            if fid in MetadataService._COMMENT_IDS:
                txt_raw = (frame.text or [""])[0]
                txt = MetadataService._to_text(txt_raw)
                if not txt:
                    continue
                desc = MetadataService._to_text(frame.desc or "Comment")
                key = "Comment" if desc.lower() == "comment" else f"Comment ({desc})"
                meta[key] = txt
                continue
            if hasattr(frame, "text"):
                raw_vals = frame.text or []
                vals = [MetadataService._to_text(v) for v in raw_vals if MetadataService._to_text(v)]
                if not vals:
                    continue
                key = MetadataService._COMPREHENSIVE_ID3_MAP.get(fid, fid)
                if fid == "TXXX":
                    key = MetadataService._COMPREHENSIVE_VORBIS_MAP.get(frame.desc.upper(), frame.desc)
                if fid in ("TRCK", "TPOS"):
                    value = MetadataService._handle_track_disc(vals[0])
                elif fid == "TBPM":
                    value = MetadataService._clean_numeric(vals[0])
                else:
                    value = MetadataService._flatten(vals)
                meta[key] = value
            else:
                # fallback — store string repr
                s = MetadataService._to_text(frame)
                if s:
                    meta[fid] = s

    @staticmethod
    def _parse_comprehensive_vorbis(vc: Dict[str, List[str]], meta: Dict[str, Any]):
        """Parse comprehensive Vorbis tags."""
        tn = tt = dn = dt = None  # track/disc helpers
        for k, raw in vc.items():
            up = k.upper()
            if up in MetadataService._IMAGE_VORBIS_KEYS:
                continue
            vals = raw if isinstance(raw, list) else [raw]
            vals = [MetadataService._to_text(v) for v in vals if MetadataService._to_text(v)]
            if not vals:
                continue
            if up in ("TRACKNUMBER", "TRACKTOTAL", "TOTALTRACKS"):
                if up == "TRACKNUMBER":
                    tn = vals[0]
                else:
                    tt = vals[0]
                continue
            if up in ("DISCNUMBER", "DISCTOTAL", "TOTALDISCS"):
                if up == "DISCNUMBER":
                    dn = vals[0]
                else:
                    dt = vals[0]
                continue
            key = MetadataService._COMPREHENSIVE_VORBIS_MAP.get(up, k.title())
            if up == "BPM":
                meta[key] = MetadataService._clean_numeric(vals[0])
            else:
                meta[key] = MetadataService._flatten(vals)
        
        # Handle track/disc numbers
        if tn:
            meta["Track Number"] = f"{tn}/{tt}" if tt else tn
        if dn:
            meta["Disc Number"] = f"{dn}/{dt}" if dt else dn

    # Additional utility methods
    @staticmethod
    def get_basic_metadata(file_obj: BinaryIO, filename: str = "") -> Dict[str, str]:
        """Get only the most essential metadata fields."""
        return MetadataService.extract_metadata(file_obj, filename, mode="limited")

    @staticmethod
    def get_full_metadata(file_obj: BinaryIO, filename: str = "") -> Dict[str, Any]:
        """Get comprehensive metadata including technical information."""
        return MetadataService.extract_metadata(file_obj, filename, mode="comprehensive")

    @staticmethod
    def get_metadata_summary(file_obj: BinaryIO, filename: str = "") -> Dict[str, str]:
        """Get a summary of the most important metadata fields."""
        metadata = MetadataService.extract_metadata(file_obj, filename, mode="limited")
        if "error" in metadata:
            return metadata
        
        # Create a summary with standardized fields
        summary = {}
        field_mapping = {
            "Title": "title",
            "Artist": "artist", 
            "Album": "album",
            "Genre": "genre",
            "Year": "year",
            "Label": "label"
        }
        
        for original_key, summary_key in field_mapping.items():
            if original_key in metadata and metadata[original_key]:
                summary[summary_key] = metadata[original_key]
        
        return summary
