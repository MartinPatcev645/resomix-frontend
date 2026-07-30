"""Username derivation for email+password sign-ups.

The register form only collects an email and a password, so the server builds the username from
the email's local part and de-duplicates it by appending "1" per collision:

    usman.naeem2212 -> usman.naeem22121 -> usman.naeem221211
"""

import pytest

from app.core.security import derive_username_base, validate_username
from app.services.auth_service import AuthService, _MAX_USERNAME_SUFFIX_ATTEMPTS


class TestDeriveUsernameBase:
    @pytest.mark.parametrize(
        "email,expected",
        [
            ("usman.naeem2212@gmail.com", "usman.naeem2212"),  # the agreed example
            ("UPPER.Case@x.com", "upper.case"),                # lowercased
            ("a+tag@x.com", "atag"),                           # +tag stripped
            ("2212usman@x.com", "u2212usman"),                 # must start with a letter
            ("...dots...@x.com", "dots..."),                   # leading punctuation stripped
            ("ab@x.com", "ab0"),                               # padded to the 3-char minimum
        ],
    )
    def test_derives_expected_base(self, email, expected):
        assert derive_username_base(email) == expected

    @pytest.mark.parametrize(
        "email",
        [
            "usman.naeem2212@gmail.com",
            "2212usman@x.com",
            "ab@x.com",
            "...@x.com",
            "ünïcode@x.com",
            f"{'x' * 90}@x.com",
            "a@x.com",
        ],
    )
    def test_derived_base_always_passes_username_validation(self, email):
        """Whatever comes out must be storable — otherwise sign-up 400s on its own derivation."""
        is_valid, error = validate_username(derive_username_base(email))
        assert is_valid, f"{email!r} produced an invalid username: {error}"

    def test_leaves_room_for_a_collision_suffix(self):
        """A very long local part must not fill the 50-char column before suffixes are appended."""
        base = derive_username_base(f"{'x' * 90}@x.com")
        crowded = f"{base}{'1' * _MAX_USERNAME_SUFFIX_ATTEMPTS}"
        assert validate_username(crowded)[0]


class TestResolveDerivedUsername:
    """The collision loop, with the DB lookup stubbed to a fixed set of taken names."""

    @staticmethod
    def _service(taken: set[str]) -> AuthService:
        service = AuthService()

        async def fake_lookup(_db, username):
            return object() if username in taken else None

        service.user_repo.async_get_by_username = fake_lookup
        return service

    @pytest.mark.asyncio
    async def test_uses_the_bare_base_when_free(self):
        service = self._service(set())
        assert await service._resolve_derived_username(None, "usman.naeem2212@gmail.com") == "usman.naeem2212"

    @pytest.mark.asyncio
    async def test_appends_one_per_collision(self):
        service = self._service({"usman.naeem2212"})
        assert await service._resolve_derived_username(None, "usman.naeem2212@gmail.com") == "usman.naeem22121"

    @pytest.mark.asyncio
    async def test_keeps_appending_while_taken(self):
        service = self._service({"usman.naeem2212", "usman.naeem22121"})
        assert await service._resolve_derived_username(None, "usman.naeem2212@x.com") == "usman.naeem221211"

    @pytest.mark.asyncio
    async def test_falls_back_to_a_random_suffix_rather_than_looping_forever(self):
        """Everything taken — must still terminate with something valid and unlike the run."""
        service = self._service({"ada" + "1" * n for n in range(0, _MAX_USERNAME_SUFFIX_ATTEMPTS + 1)})

        resolved = await service._resolve_derived_username(None, "ada@x.com")

        assert resolved.startswith("ada")
        assert resolved not in {"ada" + "1" * n for n in range(0, _MAX_USERNAME_SUFFIX_ATTEMPTS + 1)}
        assert validate_username(resolved)[0]
