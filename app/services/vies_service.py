"""
EU VIES VAT ID Validation Service
=================================

Provides validation of European Union VAT registration numbers via the official 
European Commission VIES REST API.
"""

import httpx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class ViesService:
    """Service to validate EU VAT numbers using the official VIES REST API."""

    @staticmethod
    async def validate_vat(vat_number: str, country_code: str) -> Dict[str, Any]:
        """
        Validate an EU VAT registration number.

        Args:
            vat_number: The raw VAT number (e.g., "EL123456789", "998877665").
            country_code: The ISO 3166-1 alpha-2 country code (e.g., "GR", "DE", "FR").

        Returns:
            A dictionary with validation details:
            {
                "valid": bool,
                "name": Optional[str],
                "address": Optional[str],
                "error": Optional[str]
            }
        """
        country = country_code.strip().upper()
        # Greece uses ISO code GR but EU VAT registers it under EL
        if country == "GR":
            country = "EL"

        vat = vat_number.strip().upper()
        # Try stripping both original country_code and mapped country prefixes from the start
        for prefix in [country_code.strip().upper(), country]:
            if vat.startswith(prefix):
                vat = vat[len(prefix):]
                break

        url = f"https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{country}/vat/{vat}"

        logger.info(f"[ViesService] Requesting VIES validation for '{country}' VAT ID: '{vat}'")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                if response.status_code == 200:
                    data = response.json()
                    is_valid = data.get("isValid", False)
                    logger.info(f"[ViesService] VIES Response for '{country}-{vat}': isValid={is_valid}")
                    return {
                        "valid": is_valid,
                        "name": data.get("name"),
                        "address": data.get("address"),
                        "error": None
                    }
                else:
                    logger.error(f"[ViesService] VIES API returned HTTP {response.status_code}: {response.text}")
                    return {
                        "valid": False,
                        "name": None,
                        "address": None,
                        "error": f"VIES API returned HTTP {response.status_code}"
                    }
        except httpx.RequestError as exc:
            logger.error(f"[ViesService] Network request failed to VIES: {exc}")
            return {
                "valid": False,
                "name": None,
                "address": None,
                "error": f"Network error connecting to VIES: {str(exc)}"
            }
        except Exception as exc:
            logger.error(f"[ViesService] Unexpected validation error: {exc}")
            return {
                "valid": False,
                "name": None,
                "address": None,
                "error": f"Unexpected error: {str(exc)}"
            }
