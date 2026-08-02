# Backend API Reference (for Frontend)

All routes require authentication via Google OAuth session cookie. Unauthenticated requests return `401 Unauthorized`.

---

## Apollo Integration

### `GET /api/apollo`
List available Apollo prospect lists.

**Response:**
```json
[
  { "id": "6a6e4daf...", "name": "test", "count": 3 },
  { "id": "69f4b6a7...", "name": "Community donors", "count": 0 }
]
```

### `POST /api/apollo/pull`
Pull contacts from an Apollo list into the app. Runs dedup + segment assignment automatically.

**Request:**
```json
{ "labelId": "6a6e4dafd3f99a00181ee7e2" }
```

**Response (201):**
```json
{ "imported": 3, "alreadyContacted": 0, "total": 3 }
```

---

## CSV Import

### `POST /api/prospects/import`
Upload a CSV file to import prospects. Supports both `multipart/form-data` (file upload) and raw `text/csv` body.

**Required CSV columns:** `first_name`, `last_name`

**Optional columns:** `email`, `organization` (or `company_name`), `title`, `linkedin_url` (or `person_linkedin_url`), `location`

Apollo's CSV export format is supported natively (header mapping is automatic).

**File upload example:**
```js
const formData = new FormData();
formData.append('file', csvFile);
const res = await fetch('/api/prospects/import', { method: 'POST', body: formData });
```

**Response (201):**
```json
{ "imported": 3, "alreadyContacted": 0, "total": 3 }
```

---

## Prospects

### `GET /api/prospects`
List all prospects. Optionally filter by status.

**Query params:**
- `status` (optional): `imported`, `already-contacted`, `needs-review`, `draft-ready`, `approved`, `pushed`, `send-confirmed`, `logged`

**Example:** `GET /api/prospects?status=imported`

**Response:**
```json
[
  {
    "id": "uuid",
    "firstName": "Cherr",
    "lastName": "Batac",
    "email": "cherr.batac@gmail.com",
    "organization": "Test Nonprofit",
    "title": "Development Associate",
    "linkedinUrl": null,
    "location": null,
    "source": "apollo",
    "segment": "community-donors",
    "segmentConfidence": 0.65,
    "status": "imported",
    "priorContactDate": null,
    "priorTalkTrack": null,
    "createdAt": "2026-08-01T...",
    "updatedAt": "2026-08-01T..."
  }
]
```

### `GET /api/prospects/:id`
Get a single prospect by ID.

### `PATCH /api/prospects/:id`
Update a prospect. Used for manual segment assignment or status changes.

**Allowed fields:** `segment`, `segmentConfidence`, `status`, `priorTalkTrack`

**Example — manually assign segment:**
```json
{ "segment": "board-prospects", "segmentConfidence": 1.0 }
```

**Example — move already-contacted prospect back to review (override):**
```json
{ "status": "imported" }
```

### `POST /api/prospects/recheck`
Re-runs Klaviyo dedup on all "already-contacted" prospects. Any that are no longer found in Klaviyo get moved back to `imported` with a fresh segment assignment.

**Response:**
```json
{ "checked": 3, "cleared": 1, "stillContacted": 2 }
```

---

## Drafts

### `POST /api/drafts`
Generate an AI-drafted email for a prospect. The prospect must have a segment assigned (not `unassigned`).

**Request:**
```json
{ "prospectId": "uuid" }
```

**Response (201):**
```json
{
  "id": "uuid",
  "prospectId": "uuid",
  "segment": "financial-cra",
  "subject": "FundaMental Health + California Bank & Trust: CRA Partnership Opportunity",
  "body": "Hi Eric, ...",
  "researchSummary": "Eric Ellingsen is President & CEO of ...",
  "researchConfidence": 0.65,
  "approved": false,
  "createdAt": "2026-08-01T...",
  "updatedAt": "2026-08-01T..."
}
```

### `GET /api/drafts/:id`
Get a single draft by ID.

### `PATCH /api/drafts/:id`
Edit a draft or approve it. **Approving is the human-in-the-loop gate — nothing reaches Klaviyo without this.**

**Edit subject/body:**
```json
{ "subject": "New subject", "body": "Edited email body..." }
```

**Approve:**
```json
{ "approved": true }
```

---

## Review Queue

### `GET /api/review-queue`
Get all unapproved drafts joined with their prospect data.

**Response:**
```json
[
  {
    "draft": { "id": "uuid", "subject": "...", "body": "...", "approved": false, ... },
    "prospect": { "id": "uuid", "firstName": "Cherr", "lastName": "Batac", ... }
  }
]
```

---

## Klaviyo Push

### `POST /api/prospects/:id/push`
Push an approved prospect to Klaviyo. Creates/updates their Klaviyo profile and adds them to the talk-track-specific list.

**Preconditions (enforced by backend):**
- Prospect status must be `approved`
- An approved draft must exist for this prospect
- Segment must not be `unassigned`

**Response — send confirmed:**
```json
{ "status": "send-confirmed", "profileId": "01KYZ...", "listId": "VukyLD" }
```

**Response — send unconfirmed (timeout):**
```json
{ "status": "pushed", "message": "Pushed, send unconfirmed — check Klaviyo", "profileId": "01KYZ...", "listId": "VukyLD" }
```

---

## Pipeline Flow (for UI)

```
1. Import prospects (CSV upload or Apollo list pull)
        ↓
2. Prospects land as:
   - "imported" → review queue (with auto-assigned segment + confidence)
   - "already-contacted" → already-contacted bucket (visible, overridable)
        ↓
3. For "unassigned" prospects → UI lets intern pick a segment (PATCH /api/prospects/:id)
        ↓
4. Generate draft (POST /api/drafts) → prospect moves to "draft-ready"
        ↓
5. Intern reviews/edits draft in review queue (GET /api/review-queue)
        ↓
6. Approve draft (PATCH /api/drafts/:id with approved:true) → prospect moves to "approved"
        ↓
7. Push to Klaviyo (POST /api/prospects/:id/push) → prospect moves to "pushed" or "send-confirmed"
```

## Segment Values

| Value | Label |
|-------|-------|
| `community-donors` | Community Donors (Mental Health Affinity) |
| `nonprofit-marketing` | Nonprofit / Marketing Professionals |
| `board-prospects` | Board Prospects |
| `financial-cra` | Financial Institutions / CRA |
| `daf-giving-circles` | DAF Advisors & Giving Circles |
| `unassigned` | Unassigned — needs manual tag |

## Status Values

| Value | Meaning |
|-------|---------|
| `imported` | Just ingested, ready for drafting |
| `already-contacted` | Matched in Klaviyo/Monday.com dedup check |
| `needs-review` | (reserved for future use) |
| `draft-ready` | AI draft generated, in review queue |
| `approved` | Intern approved the draft |
| `pushed` | Pushed to Klaviyo, send unconfirmed |
| `send-confirmed` | Klaviyo confirmed the send |
| `logged` | Tracked in Monday.com |
