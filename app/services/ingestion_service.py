"""
B2B CSV Ingestion Service
=========================

Service for processing batch CSV/manifest uploads from partners via SFTP.
Validates metadata, handles insertion of Tracks and Deals, and logs row-level errors.
"""

import csv
import logging
import uuid
import os
from datetime import datetime
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.models.b2b import IngestLog, IngestionError, Deal
from app.models.track import Track
from app.core.context import set_current_partner_id
from database.connection import AsyncSessionLocal

logger = logging.getLogger(__name__)

async def process_ingestion_batch(partner_id: int, batch_path: str):
    """
    Background task to process a partner's uploaded CSV manifest.
    
    Args:
        partner_id: The tenant ID.
        batch_path: The absolute path to the partner's incoming SFTP directory.
    """
    logger.info(f"[IngestionService] Starting batch process for partner {partner_id} at {batch_path}")
    
    # Establish partner context for the background task to satisfy the multi-tenancy failsafe
    set_current_partner_id(partner_id)
    
    # We create a new DB session since this runs in the background
    async with AsyncSessionLocal() as db:
        # Find a valid Party ID for the partner
        from app.models.party import Party
        party_stmt = select(Party).where(Party.partner_id == partner_id).limit(1)
        party_res = await db.execute(party_stmt)
        party = party_res.scalar_one_or_none()
        party_id = party.party_id if party else f"PARTNER-{partner_id}"

        # Create an initial IngestLog entry
        log_entry = IngestLog(
            partner_id=partner_id,
            party_id=party_id,
            package_folder=batch_path,
            status="PROCESSING",
            started_at=datetime.utcnow()
        )
        db.add(log_entry)
        await db.commit()
        await db.refresh(log_entry)

        try:
            # 1. Locate the manifest CSV file
            folder = Path(batch_path)
            csv_files = list(folder.glob("*.csv"))
            
            if not csv_files:
                raise FileNotFoundError("No CSV manifest found in the incoming directory.")
            
            manifest_path = csv_files[0]
            logger.info(f"[IngestionService] Found manifest: {manifest_path}")
            
            # Update log with filename
            log_entry.batch_filename = manifest_path.name
            await db.commit()
            
            # 2. Parse and Validate CSV
            success_count = 0
            error_count = 0
            
            with open(manifest_path, mode='r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                row_num = 1 # Header is row 1
                
                for row in reader:
                    row_num += 1
                    try:
                        # Required fields validation
                        isrc = row.get("isrc")
                        title = row.get("title")
                        
                        if not isrc:
                            raise ValueError(f"Row {row_num}: Missing required field 'isrc'")
                        if not title:
                            raise ValueError(f"Row {row_num}: Missing required field 'title'")
                            
                        # Create Track Model
                        # In a real environment, we'd also link `audio_files`
                        new_track = Track(
                            uuid=str(uuid.uuid4()),
                            isrc=isrc,
                            title=title,
                            partner_id=partner_id,
                            ingestion_source="csv",
                            track_type="electrobuzz"
                        )
                        
                        db.add(new_track)
                        await db.commit()
                        success_count += 1
                        
                    except Exception as e:
                        await db.rollback()
                        error_count += 1
                        logger.warning(f"[IngestionService] Error on row {row_num}: {e}")
                        
                        # Log the specific error
                        err = IngestionError(
                            ingest_log_id=log_entry.id,
                            partner_id=partner_id,
                            error_code="ROW_VALIDATION_FAILED",
                            error_message=str(e),
                            error_severity="warning",
                            reference_node=f"Row {row_num}"
                        )
                        db.add(err)
                        await db.commit()

            # 3. Finalize IngestLog
            log_entry.status = "COMPLETED" if error_count == 0 else "FAILED"
            log_entry.track_count = success_count
            log_entry.completed_at = datetime.utcnow()
            
            if error_count > 0:
                log_entry.error_message = f"Completed with {error_count} errors. See ingestion_errors for details."
                
            await db.commit()
            
            # 4. Move files to processed (Optional cleanup step)
            # processed_dir = folder.parent / "processed"
            # processed_dir.mkdir(exist_ok=True)
            # os.rename(folder, processed_dir / folder.name)
            
            logger.info(f"[IngestionService] Batch complete. Success: {success_count}, Errors: {error_count}")

        except Exception as e:
            logger.error(f"[IngestionService] Critical failure: {e}")
            await db.rollback()
            log_entry.status = "FAILED"
            log_entry.error_message = str(e)
            log_entry.completed_at = datetime.utcnow()
            await db.commit()
