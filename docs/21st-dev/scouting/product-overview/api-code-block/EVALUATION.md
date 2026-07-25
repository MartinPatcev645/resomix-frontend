# Component evaluation — API code block

Status: **No external candidates — research stopped at the reuse audit** (classification 2: extend existing safely). Slots PO-CODE-001…003 unused.

Basis: the mandatory comparison ("every candidate must beat simply extending the existing pattern") is decided by the audit alone — `PartnersPage.tsx` already contains the working mechanic (native `navigator.clipboard`, success-state feedback, copy icons, curl presentation, Fira/dotted styling), verified both in source and live on production `/partners`. An external candidate could only re-supply what exists, while adding foreign styling to strip and a licence record to carry.

If a later need exceeds the pattern (multi-language switching, line highlighting), a new brief may reopen research with classification 4.
