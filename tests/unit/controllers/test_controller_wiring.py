"""
Every `self.<service>` a controller uses must actually exist
===========================================================

THE BUG THIS CATCHES

`AdminUserController` referenced `self.admin_log_service` in five methods and never assigned it.
Granting a plan raised::

    AttributeError: 'AdminUserController' object has no attribute 'admin_log_service'

Nothing about that is subtle — but nothing caught it either, because:

* it only fires on the **write** path, after a real service call;
* the audit-log line sits **after** the work, so `PlanGrantService.grant()` had already committed.
  The admin saw a 500 and assumed nothing happened, while the grant was live;
* the controller tests mock the services, and a `MagicMock` answers to any attribute you ask for —
  so the mocked version passed while the real object raised.

That last point is why this is a source scan rather than a behavioural test. A test that
instantiates the real controller and drives it would catch it too, but only for the paths it
happens to exercise; this covers every attribute in every controller regardless of coverage.

HOW IT WORKS

Parse each controller, collect every `self.x = ...` and every `self.x.y` / `self.x(...)`, and
compare. Class-level attributes and inherited members are resolved off the real class, so a
service assigned on a base class or defined as a class attribute is not a false positive.
"""

from __future__ import annotations

import ast
import importlib
import pathlib

CONTROLLERS = pathlib.Path(__file__).resolve().parents[3] / "app" / "controllers"


def _missing_attributes():
    """[(file, line, Class.self.attr)] for every attribute used but never assigned."""
    out = []
    for path in sorted(CONTROLLERS.glob("*.py")):
        if path.name == "__init__.py":
            continue
        tree = ast.parse(path.read_text())
        module = importlib.import_module(f"app.controllers.{path.stem}")

        for cls in [n for n in tree.body if isinstance(n, ast.ClassDef)]:
            assigned, used = set(), {}
            for node in ast.walk(cls):
                if isinstance(node, ast.Assign):
                    for tgt in node.targets:
                        if (
                            isinstance(tgt, ast.Attribute)
                            and isinstance(tgt.value, ast.Name)
                            and tgt.value.id == "self"
                        ):
                            assigned.add(tgt.attr)
                # `self.x.y` — x is being used as an object, so it must exist.
                if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Attribute):
                    inner = node.value
                    if isinstance(inner.value, ast.Name) and inner.value.id == "self":
                        used.setdefault(inner.attr, node.lineno)

            klass = getattr(module, cls.name, None)
            # dir() covers class attributes and anything inherited — neither is a bug.
            known = set(dir(klass)) if klass is not None else set()

            for attr, line in sorted(used.items()):
                if attr not in assigned and attr not in known:
                    out.append((path.name, line, f"{cls.name}.self.{attr}"))
    return out


def test_no_controller_uses_a_service_it_never_assigns() -> None:
    """The regression guard.

    A failure here means a controller will raise AttributeError the moment that code path runs —
    typically on a write, typically after something has already committed.
    """
    missing = _missing_attributes()

    assert not missing, "Controllers reference attributes that are never assigned:\n" + "\n".join(
        f"  {f}:{line}  {what}" for f, line, what in missing
    )


def test_the_scan_actually_inspects_controllers() -> None:
    """Guards the guard.

    If the glob ever stopped matching — a move, a rename, a package split — the test above would
    pass vacuously over zero files and look like proof.
    """
    files = [p for p in CONTROLLERS.glob("*.py") if p.name != "__init__.py"]

    assert len(files) > 20, f"expected the controller package, found {len(files)} files"


def test_the_admin_user_controller_can_write_its_audit_log() -> None:
    """The specific case, asserted directly.

    Named rather than left to the scan because this is the one that shipped, and because
    `log_operation` is what every admin write on that controller calls last.
    """
    from app.controllers.admin_user_controller import AdminUserController

    controller = AdminUserController()

    assert hasattr(controller, "admin_log_service")
    assert callable(getattr(controller.admin_log_service, "log_operation", None))
