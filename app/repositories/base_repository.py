"""
Base Repository
===============

This is the base repository class providing common CRUD operations for all model repositories.
It implements generic database operations including create, read, update, delete,
and get-or-create patterns using SQLAlchemy ORM with both sync and async support.

Serves as the foundation for all specific model repositories, ensuring consistent
database interaction patterns and error handling across the application.

Version: 3.0.1
Init Date: June 11, 2025
Author: Muhammad Usman Naeem
Email: usman.naeem2212@gmail.com
"""

from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Type, TypeVar, Generic, Any, Union
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.exc import IntegrityError

from app.models import Base

# Type variable for model classes
ModelType = TypeVar("ModelType", bound=Base)


class BaseRepository(ABC, Generic[ModelType]):
    """Abstract base repository providing common CRUD operations.
    
    This class implements the repository pattern with common database operations
    including the get-or-create pattern used in the migration Cache class.
    """
    
    def __init__(self, model: Type[ModelType]):
        """Initialize repository with the model class.
        
        Args:
            model: SQLAlchemy model class this repository manages
        """
        self.model = model

    # --- Synchronous operations ---

    def get_by_id(self, db: Session, id: int) -> Optional[ModelType]:
        """Get a single record by ID.
        
        Args:
            db: Database session
            id: Primary key value
            
        Returns:
            Model instance or None if not found
        """
        return db.query(self.model).filter(self.model.id == id).first()

    def get_by_field(self, db: Session, field_name: str, value: Any) -> Optional[ModelType]:
        """Get a single record by field value.
        
        Args:
            db: Database session
            field_name: Name of the field to filter by
            value: Value to match
            
        Returns:
            Model instance or None if not found
        """
        field = getattr(self.model, field_name)
        return db.query(self.model).filter(field == value).first()

    def get_all(self, db: Session, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """Get all records with pagination.
        
        Args:
            db: Database session
            skip: Number of records to skip
            limit: Maximum number of records to return
            
        Returns:
            List of model instances
        """
        return db.query(self.model).offset(skip).limit(limit).all()

    def create(self, db: Session, **kwargs) -> ModelType:
        """Create a new record.
        
        Args:
            db: Database session
            **kwargs: Field values for the new record
            
        Returns:
            Created model instance
            
        Raises:
            IntegrityError: If constraints are violated
        """
        db_obj = self.model(**kwargs)
        db.add(db_obj)
        try:
            db.commit()
            db.refresh(db_obj)
            return db_obj
        except IntegrityError:
            db.rollback()
            raise

    def update(self, db: Session, id: int, **kwargs) -> Optional[ModelType]:
        """Update an existing record.
        
        Args:
            db: Database session
            id: Primary key of record to update
            **kwargs: Field values to update
            
        Returns:
            Updated model instance or None if not found
        """
        db_obj = self.get_by_id(db, id)
        if db_obj:
            for field, value in kwargs.items():
                if hasattr(db_obj, field):
                    setattr(db_obj, field, value)
            try:
                db.commit()
                db.refresh(db_obj)
                return db_obj
            except IntegrityError:
                db.rollback()
                raise
        return None

    def delete(self, db: Session, id: int) -> bool:
        """Delete a record by ID.
        
        Args:
            db: Database session
            id: Primary key of record to delete
            
        Returns:
            True if deleted, False if not found
        """
        db_obj = self.get_by_id(db, id)
        if db_obj:
            db.delete(db_obj)
            db.commit()
            return True
        return False

    def get_or_create(self, db: Session, **kwargs) -> tuple[ModelType, bool]:
        """Get existing record or create new one.
        
        This method implements the get-or-create pattern used in the
        migration Cache class, but adapted for general use.
        
        Args:
            db: Database session
            **kwargs: Field values to match or create with
            
        Returns:
            Tuple of (model_instance, was_created)
            
        Raises:
            ValueError: If no unique fields provided for lookup
        """
        # First try to find existing record
        existing = self._find_existing(db, **kwargs)
        if existing:
            return existing, False
            
        # Create new record if not found
        try:
            db_obj = self.model(**kwargs)
            db.add(db_obj)
            db.commit()
            db.refresh(db_obj)
            return db_obj, True
        except IntegrityError:
            # Handle race condition - another transaction may have created it
            db.rollback()
            existing = self._find_existing(db, **kwargs)
            if existing:
                return existing, False
            # If still not found, re-raise the original error
            raise

    @abstractmethod
    def _find_existing(self, db: Session, **kwargs) -> Optional[ModelType]:
        """Find existing record based on provided fields.
        
        This method must be implemented by concrete repositories to define
        how to look up existing records for get_or_create operations.
        
        Args:
            db: Database session
            **kwargs: Field values to search with
            
        Returns:
            Existing model instance or None
        """
        pass

    # --- Async operations ---

    async def async_get_by_id(self, db: AsyncSession, id: int) -> Optional[ModelType]:
        """Async version of get_by_id."""
        stmt = select(self.model).where(self.model.id == id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_get_by_field(self, db: AsyncSession, field_name: str, value: Any) -> Optional[ModelType]:
        """Async version of get_by_field."""
        field = getattr(self.model, field_name)
        stmt = select(self.model).where(field == value)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def async_get_all(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[ModelType]:
        """Async version of get_all."""
        stmt = select(self.model).offset(skip).limit(limit)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def async_create(self, db: AsyncSession, commit: bool = True, **kwargs) -> ModelType:
        """Async version of create."""
        db_obj = self.model(**kwargs)
        db.add(db_obj)
        try:
            if commit:
                await db.commit()
                await db.refresh(db_obj)
            else:
                await db.flush()
            return db_obj
        except IntegrityError:
            if commit:
                await db.rollback()
            raise

    async def async_update(self, db: AsyncSession, id: int, commit: bool = True, **kwargs) -> Optional[ModelType]:
        """Async version of update."""
        db_obj = await self.async_get_by_id(db, id)
        if db_obj:
            for field, value in kwargs.items():
                if hasattr(db_obj, field):
                    setattr(db_obj, field, value)
            try:
                if commit:
                    await db.commit()
                    await db.refresh(db_obj)
                else:
                    await db.flush()
                return db_obj
            except IntegrityError:
                if commit:
                    await db.rollback()
                raise
        return None

    async def async_delete(self, db: AsyncSession, id: int, commit: bool = True) -> bool:
        """Async version of delete."""
        db_obj = await self.async_get_by_id(db, id)
        if db_obj:
            await db.delete(db_obj)
            if commit:
                await db.commit()
            else:
                await db.flush()
            return True
        return False

    async def async_get_or_create(self, db: AsyncSession, commit: bool = True, **kwargs) -> tuple[ModelType, bool]:
        """Async version of get_or_create."""
        # First try to find existing record
        existing = await self._async_find_existing(db, **kwargs)
        if existing:
            return existing, False
            
        # Create new record if not found
        try:
            db_obj = self.model(**kwargs)
            db.add(db_obj)
            if commit:
                await db.commit()
                await db.refresh(db_obj)
            else:
                await db.flush()
            return db_obj, True
        except IntegrityError:
            # Handle race condition
            if commit:
                await db.rollback()
            existing = await self._async_find_existing(db, **kwargs)
            if existing:
                return existing, False
            raise

    @abstractmethod
    async def _async_find_existing(self, db: AsyncSession, **kwargs) -> Optional[ModelType]:
        """Async version of _find_existing.
        
        Must be implemented by concrete repositories.
        """
        pass

    # --- Utility methods inspired by Cache class ---

    def get_or_create_by_name(self, db: Session, name: str) -> tuple[ModelType, bool]:
        """Convenience method for models with 'name' field.
        
        This mirrors the pattern used in Cache._get_or_create for artists,
        labels, and genres.
        
        Args:
            db: Database session
            name: Name value to lookup/create
            
        Returns:
            Tuple of (model_instance, was_created)
        """
        return self.get_or_create(db, name=name)

    async def async_get_or_create_by_name(self, db: AsyncSession, name: str) -> tuple[ModelType, bool]:
        """Async version of get_or_create_by_name."""
        return await self.async_get_or_create(db, name=name)

    def bulk_get_or_create(self, db: Session, items: List[Dict[str, Any]]) -> List[ModelType]:
        """Bulk get-or-create operation for efficiency.
        
        Args:
            db: Database session
            items: List of dictionaries with field values
            
        Returns:
            List of model instances
        """
        results = []
        for item in items:
            obj, _ = self.get_or_create(db, **item)
            results.append(obj)
        return results 