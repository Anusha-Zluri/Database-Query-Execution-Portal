# Script Storage in Database - Implementation Summary

## Problem
Render uses ephemeral disk storage, so uploaded script files disappear after server restarts. This breaks:
- Script preview in submissions page
- Script preview in approvals page  
- Script execution after restarts

## Solution
Store script content in the database (`script_content` TEXT column) so it survives restarts.

---

## Database Changes

### 1. Add Column to `request_scripts` Table

```sql
ALTER TABLE request_scripts 
ADD COLUMN IF NOT EXISTS script_content TEXT;
```

**Run this on your Neon DB console.**

---

## Code Changes Made

### 1. Entity Update
**File:** `src/entities/RequestScript.entity.js`
- Added `script_content: { type: 'text', nullable: true }` property

### 2. Upload Flow
**File:** `src/controllers/requests.controller.js`
- Now passes `scriptContent` to DAL when saving script

**File:** `src/dal/requests.dal.js`
- Updated `insertScriptRequest()` to accept and save `scriptContent` parameter
- Inserts script content into database during upload

### 3. Preview Endpoints (Read from DB first, fallback to file)

**File:** `src/controllers/submissions.controller.js`
- `getSubmissionDetails()` reads from `row.script_content` first
- Falls back to file system if DB content is null
- Shows "[Script file not available on this server]" if both fail

**File:** `src/dal/submissions.dal.js`
- `getSubmissionDetails()` now selects `rs.script_content` in query

**File:** `src/controllers/requests.controller.js`
- `getScriptForApproval()` reads from DB first, fallback to file

**File:** `src/dal/requests.dal.js`
- Added `getScriptForApproval()` that returns both `file_path` and `script_content`

**File:** `src/controllers/approvals.controller.js`
- `getApprovalScriptPreview()` reads from DB first, fallback to file

**File:** `src/dal/approvals.dal.js`
- Added `getScriptForApproval()` that returns both `file_path` and `script_content`

### 4. Execution Flow (Read from DB first, fallback to file)

**File:** `src/controllers/execution.controller.js`
- Updated to call `loadScriptContent()` instead of `loadScriptPath()`
- Reads `script_content` from DB first
- Falls back to file if DB content is missing
- Throws error if neither available

**File:** `src/dal/execution.dal.js`
- Added `loadScriptContent()` function that returns both `file_path` and `script_content`
- Kept `loadScriptPath()` for backward compatibility

---

## File Size Limits

**Current:** 16 MB (kept as is)
- PostgreSQL TEXT type supports up to 1 GB
- 16 MB is reasonable for JavaScript files
- No changes needed to `src/middlewares/uploadScripts.js`

---

## Migration Script

**File:** `scripts/addScriptContentColumn.js`
- Adds the `script_content` column
- Optionally migrates existing file contents to database
- Run with: `node scripts/addScriptContentColumn.js`

---

## Flow After Changes

### Upload Flow
1. User uploads script file
2. Multer saves to `uploads/scripts/` (temporary)
3. Backend reads file content
4. Saves to DB: `file_path` + `script_content`
5. File may disappear after Render restart ✅ No problem!

### Preview Flow (Submissions/Approvals)
1. User clicks eye icon to preview
2. Backend checks DB for `script_content` first
3. If found: return from DB ✅
4. If not found: try reading from file (fallback)
5. If file missing: show error message

### Execution Flow
1. Manager approves request
2. Execution starts
3. Backend checks DB for `script_content` first
4. If found: execute from DB ✅
5. If not found: try reading from file (fallback)
6. If neither available: execution fails with clear error

---

## Testing Checklist

- [ ] Run SQL migration on Neon DB
- [ ] Upload a new script request
- [ ] Verify script preview works in submissions page
- [ ] Verify script preview works in approvals page
- [ ] Approve and execute the script
- [ ] Simulate Render restart (redeploy)
- [ ] Verify preview still works after restart
- [ ] Verify execution still works after restart

---

## Deployment Steps

1. **Run SQL on Neon DB:**
   ```sql
   ALTER TABLE request_scripts ADD COLUMN IF NOT EXISTS script_content TEXT;
   ```

2. **Deploy code changes to Render**

3. **Test with new script upload**

4. **Optional: Migrate old scripts**
   ```bash
   node scripts/addScriptContentColumn.js
   ```

---

## Benefits

✅ Script previews survive Render restarts
✅ Script execution survives Render restarts  
✅ No external storage (S3, etc.) needed
✅ Backward compatible (falls back to file if DB content missing)
✅ 16MB file size limit maintained
✅ PostgreSQL TEXT type supports up to 1GB
