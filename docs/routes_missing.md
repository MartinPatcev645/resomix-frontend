# Admin UI — API Coverage Audit

Cross-referencing all 13 pages in `apps/admin/src/pages/` against the full admin API surface.

---

## 🟢 Fully Wired Pages (API calls working)

| Page | API Functions Used | Notes |
|---|---|---|
| **FeedbackPage** | `getFeedbackList`, `deleteFeedback`, `batchDeleteFeedback`, `updateFeedback`, `exportFeedback` | Via `useFeedback` hook |
| **ContactPage** | `getContactList`, `deleteContact`, `batchDeleteContact`, `markContactStatus`, `exportContact` | Via `useContact` hook |
| **WaitlistPage** | `getWaitlistList`, `deleteWaitlist`, `batchDeleteWaitlist`, `updateWaitlistStatus`, `exportWaitlist` | Via `useWaitlist` hook |
| **PlaylistsPage** | `getPlaylistList`, `deletePlaylist`, `batchDeletePlaylist`, `exportPlaylist`, `adminChangePlaylistVisibility`, `adminBatchChangePlaylistVisibility` | Via `usePlaylist` hook |
| **PlaylistDetailsPage** | `getPlaylistDetails` | Direct call — works |
| **SpotifyAppsPage** | `getSpotifyApps`, `getSpotifyApp`, `createSpotifyApp`, `updateSpotifyApp`, `deleteSpotifyApp` | Via `useSpotifyApps` hook |
| ↳ Users tab | `getSpotifyAppUsers`, `upsertSpotifyAppUser`, `deleteSpotifyAppUser`, `listAdminUsers` | Via `useSpotifyAppUsers` hook |
| **PartnersPage** | `listPartners`, `createPartner`, `updatePartner`, `deletePartner`, `listApiKeys`, `issueApiKey`, `revokeApiKey`, `rotateApiKey` | Via `usePartners` hook |
| **OperationsPage** | `getOperationTypes`, `getUserOperationLimits`, `getUserOperationLimit`, `upsertUserOperationLimit`, `deleteUserOperationLimit` | Via `useOperationTypes` + `useUserOperationLimits` hooks |

---

## 🟡 Partially Wired Pages (Page exists, actions stubbed or incomplete)

### UsersPage (`/users`)
The page renders a user list and has modals for Create and Role Management, but several critical actions are only `message.info()` placeholders:

| Action | Status | Missing |
|---|---|---|
| List users | ✅ Wired (`listAdminUsers` via `useAdminUsers` hook) | — |
| Create user | ✅ Wired (`createAdminUser`) | — |
| Assign role | ✅ Wired (`assignRole`) | — |
| **Toggle user active/inactive** | 🟡 **Stubbed** — `message.info('logic will be implemented')` | Should call `toggleUserStatus(uuid)` |
| **Remove role from user** | 🟡 **Stubbed** — `message.info('Role removal logic will be implemented')` | Should call `removeRole(uuid, roleName)` |
| **View user detail** | ❌ **Missing** — no detail drawer/modal | Should call `getAdminUser(uuid)` |
| **Update user** | ❌ **Missing** — no edit modal | Should call `updateAdminUser(uuid, data)` |
| **Delete user** | 🟡 **Stubbed** — menu item exists, no `onOk` handler | No API function assigned |
| **Roles column** | 🟡 **Hardcoded** — always shows "Customer" tag | Should show actual roles from user record |
| **Role permissions preview** | 🟡 **Placeholder text** | Should call `listSystemPermissions()` |
| **Role details (for filtering)** | ❌ **Missing** | `getRoleDetails()` and `updateRolePermissions()` are never called |

### PartnersPage (`/partners`)
Partners are very well covered. One gap:

| Action | Status | Missing |
|---|---|---|
| **Get partner detail** | ❌ **Missing** — no detail/preview panel | Should call `getPartnerDetail(id)` |
| **SFTP provisioning** | ❌ **Missing** — no UI at all | Should call `provisionSftpPartner()`, `getSftpStatus()`, `retrySftpProvisioning()` |

---

## 🔴 Complete Stub Pages (No API integration at all)

| Page | Route | Required API | Priority |
|---|---|---|---|
| **PipelinePage** | `/pipeline` | `ingestMonthlyTrack`, `ingestMonthlyEmbeddings`, `ingestOpenTrack`, `ingestOpenEmbeddings` | High |
| **AnalyticsPage** | `/analytics` | No admin API defined yet (future) | Low |
| **TracksPage** | `/tracks` | No admin tracks API currently in routes.md | Low |
| **LogsPage** | `/logs` | No admin logs API currently in routes.md | Low |

> `PipelinePage` is the most critical stub — all 4 ingest pipeline functions exist in the API client but nothing in the UI calls them.

---

## ❌ API Functions With Zero UI Coverage

These functions were added to the API client but have **no corresponding UI in any admin page**:

| API Function | File | Needed On |
|---|---|---|
| `getFeedbackById` | `admin/feedback.ts` | Feedback detail modal (click-to-expand) |
| `getFeedbackStats` | `admin/feedback.ts` | FeedbackPage summary cards / header KPIs |
| `markFeedbackStatus` | `admin/feedback.ts` | Feedback row inline status toggle |
| `getContactById` | `admin/contact.ts` | Contact detail modal |
| `getAdminUser` | `admin/users.ts` | User detail drawer |
| `updateAdminUser` | `admin/users.ts` | User edit modal |
| `toggleUserStatus` | `admin/users.ts` | Users table row action (stubbed) |
| `removeRole` | `admin/users.ts` | Role management modal (stubbed) |
| `getRoleDetails` | `admin/users.ts` | Role management panel |
| `updateRolePermissions` | `admin/users.ts` | Role permissions editor |
| `getPartnerDetail` | `admin/partners.ts` | Partner detail panel |
| `provisionSftpPartner` | `admin/partners.ts` | Partners SFTP tab |
| `getSftpStatus` | `admin/partners.ts` | Partners SFTP tab |
| `retrySftpProvisioning` | `admin/partners.ts` | Partners SFTP tab |
| `ingestMonthlyTrack` | `ingest.ts` | PipelinePage |
| `ingestMonthlyEmbeddings` | `ingest.ts` | PipelinePage |
| `ingestOpenTrack` | `ingest.ts` | PipelinePage |
| `ingestOpenEmbeddings` | `ingest.ts` | PipelinePage |
| `rebuildSimilarityIndex` | `admin/similarity.ts` | No page exists yet |
| `createPromoCode` | `admin/promo.ts` | No page exists yet |
| `adminLogin` | `admin/auth.ts` | No login page (all pages are unprotected) |

---

## 📋 Summary

| Category | Count |
|---|---|
| 🟢 Fully wired pages | 8 |
| 🟡 Partially wired (actions stubbed) | 2 (Users, Partners) |
| 🔴 Complete stubs (no API calls) | 4 (Pipeline, Analytics, Tracks, Logs) |
| ❌ API functions with zero UI | 21 |

---

## Recommended Priority Order

### P1 — Wire up existing stubs (no new pages needed)
1. **UsersPage**: Wire `toggleUserStatus`, `removeRole`, delete confirmation `onOk`
2. **FeedbackPage**: Add stats header cards calling `getFeedbackStats`; add detail expand using `getFeedbackById`
3. **ContactPage**: Add detail expand modal using `getContactById`
4. **PipelinePage**: Implement the 4 ingest trigger buttons

### P2 — New UI sections for existing pages
5. **PartnersPage**: Add SFTP provisioning tab/section
6. **UsersPage**: Add user detail drawer + edit modal

### P3 — New pages required
7. **Promo Codes page** (no page exists for `createPromoCode`)
8. **Similarity page** (no page exists for `rebuildSimilarityIndex`)
9. **Login page** (`adminLogin` exists in client but admin app has no auth gate)
