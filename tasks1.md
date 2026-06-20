# tasks1.md — Export Workflow (First Step)

## 1. Goal

Create a `POST /api/auto-quant/export/{run_id}` endpoint that packages a completed AutoQuant pipeline's optimized strategy, config, and report into a timestamped Freqtrade-ready deployment directory, then returns the bundle as a `.zip` download.

## 2. Existing files to reuse

| File | What it provides |
|------|-----------------|
| `pipeline_modules/stages_assessment.py:_stage_delivery` (lines 554-629) | `state.report` dict with `files` key, `best_params`, thresholds |
| `services/auto_quant/variants.py:copy_to_output()` (line 115) | `shutil.copy2` helper — copies a file to a target dir |
| `services/auto_quant/variants.py:active_strategy_path()` (line 28) | Resolves the run-local strategy `.py` path |
| `services/auto_quant/pipeline_modules/state.py:PipelineState` | `user_data_dir`, `run_id`, `strategy`, `report` fields |
| `settings_store.py:SettingsStore.load()` | Resolves `user_data_directory_path` |
| `api/routers/auto_quant.py:download_file()` (line 905) | Existing single-file download — model export endpoint after it |
| `utils.py:build_run_id()` | Timestamped ID generator for export directory naming |
| `paths.py:build_local_paths()` | Path resolution pattern |

## 3. Files likely to change

| File | Change |
|------|--------|
| `backend/api/routers/auto_quant.py` | Add `POST /export/{run_id}` endpoint (and optionally `GET /export/{run_id}/download`) |
| `frontend/src/components/RunDetailPanel.jsx` | Add "Export for Freqtrade" button in the RunDetail overlay |
| (optionally) `frontend/src/components/RunHistoryDashboard.jsx` | Add export button to `RunCard` if desired |

**No new services. No new models. No changes to existing pipeline logic.**

## 4. Backend task

Add a single endpoint to `backend/api/routers/auto_quant.py`:

```
POST /api/auto-quant/export/{run_id}  →  returns FileResponse (.zip)
```

Logic:
1. Call `_pl.get_state(run_id)` — reject if state is `None` or state.status is not `"completed"`
2. Read `state.report["files"]` to locate: optimized `.py`, `config.json`, `report.json`, params `.json`
3. Create `user_data/exports/{StrategyName}_{YYYYMMDD_HHMMSS}/`
4. Copy the optimized `.py`, `config.json`, `report.json`, params `.json` into it
5. Optionally copy `state_json` (the last versioned state snapshot)
6. Zip the directory in-memory
7. Return `FileResponse` with `media_type="application/zip"` and filename `{StrategyName}_{YYYYMMDD_HHMMSS}.zip`

Validate: run must be completed, files must exist.

## 5. Frontend task

Add a single button to `frontend/src/components/RunDetailPanel.jsx`:

- Text: "Export for Freqtrade"
- Position: next to existing download buttons in the Summary tab header
- On click: `POST /api/auto-quant/export/{runId}` → triggers browser download of the `.zip`
- Disabled when run status is not `"completed"`

## 6. Tests needed

Create a new test file `backend/tests/test_auto_quant_export.py`:

1. **test_export_rejects_non_completed** — POST to `/export/{run_id}` with a `pending` state → 409
2. **test_export_unknown_run** — POST to `/export/fake-id` → 404
3. **test_export_zip_contains_expected_files** — Mock a completed state with known `report["files"]`, verify the returned zip contains `.py` + `config.json` + `report.json`
4. **test_export_zip_filename_format** — Verify filename matches `{StrategyName}_YYYYMMDD_*.zip`

## 7. What not to touch

- Do not modify `pipeline_modules/orchestrator.py` or any stage file
- Do not modify `PipelineState` or `StageState` dataclasses
- Do not modify `variants.py` or `copy_to_output()`
- Do not modify `AutoQuantTab.jsx` (3615 lines — high risk)
- Do not create new services or service classes
- Do not touch `user_data/` directory structure

## 8. First task to implement

**Backend endpoint** (`backend/api/routers/auto_quant.py`):

```
@router.post("/export/{run_id}", status_code=200)
async def export_pipeline(run_id: str) -> FileResponse:
```

Implement the logic in section 4 above. Use `io.BytesIO` + `zipfile.ZipFile` for in-memory zipping. Use `shutil.copy2` (referencing `variants.py:copy_to_output` pattern) for copying files before zipping. Return `FileResponse` with proper `media_type` and `Content-Disposition` header.

Run `pytest backend/tests/test_auto_quant_export.py -xvs` to verify. Then add the frontend button.
_____________________________________________________________________

## التغييرات والنتائج

### التغييرات
- أضفت endpoint جديد:
  - `POST /api/auto-quant/export/{run_id}`
  - يرفض التشغيل غير الموجود بـ `404`
  - يرفض التشغيل غير المكتمل بـ `409`
  - يقرأ ملفات التصدير من `state.report["files"]`
  - ينسخ ملفات الاستراتيجية المحسنة، `config.json`، `report.json`، وملف params عند توفره إلى:
    `user_data/exports/{StrategyName}_{YYYYMMDD_HHMMSS}/`
  - يضيف `state_latest.json` أو `state.json` عند توفره
  - ينشئ zip باستخدام `io.BytesIO` و `zipfile.ZipFile`
  - يرجع `FileResponse` بوسيط `application/zip` واسم ملف بصيغة:
    `{StrategyName}_{YYYYMMDD_HHMMSS}.zip`

- أضفت اختبارات backend في:
  - `backend/tests/test_auto_quant_export.py`
  - تغطي رفض التشغيل غير المكتمل، التشغيل غير الموجود، محتويات zip، وصيغة اسم ملف zip.

- أضفت زر الواجهة:
  - النص: `Export for Freqtrade`
  - المكان: هيدر تبويب Summary بجانب زر Export الحالي
  - ينفذ `POST /api/auto-quant/export/{run_id}`
  - ينزل ملف zip من `blob`
  - معطل إذا لم تكن حالة التشغيل `completed`

### النتائج
- نجح فحص Python syntax:
  - `python -m py_compile backend/api/routers/auto_quant.py backend/tests/test_auto_quant_export.py`
- نجح فحص استيراد الراوتر:
  - `router import ok True`
- لم يعمل أمر pytest لأن البيئة الحالية لا تحتوي pytest:
  - `pytest`: command not found
  - `python -m pytest`: No module named pytest
  - `.venv/bin/pytest`: No such file or directory
- نجح smoke check مباشر للـ endpoint:
  - أنشأ zip
  - `media_type = application/zip`
  - `Content-Disposition = attachment; filename="ManualExport_YYYYMMDD_HHMMSS.zip"`
  - محتويات zip شملت: `.py`، params `.json`، `config.json`، `report.json`، و `state_latest.json`
- فشل `npm run lint` بسبب أخطاء قديمة وغير مرتبطة منتشرة في المشروع.
- نجح ESLint على الملفات التي تم تعديلها فقط:
  - `src/components/RunDetailPanel.jsx`
  - `src/components/RunDetailSummary/index.jsx`
