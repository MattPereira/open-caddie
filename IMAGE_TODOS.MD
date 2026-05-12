# Image Upload — TODOs

## Add a crop step before upload (`react-easy-crop`)

### Why
Detailed source images get center-cropped by `object-cover` at display time, often slicing off the subject's face. Letting the user frame the crop fixes this and reuses for course images (different aspect ratio).

### Steps

1. **Install**
   - `pnpm add react-easy-crop`

2. **Extend `ImageUploadField` props**
   - File: `components/image-upload-field.tsx`
   - Add: `aspectRatio?: number` (default `1`)
   - Add internal state: `pendingFile: File | null`, `cropperOpen: boolean`

3. **Insert crop step between file pick and compression**
   - On file select → set `pendingFile`, open cropper dialog (don't compress yet)
   - On "Done" in cropper → render cropped region to canvas → export Blob → run existing `imageCompression` → `upload()` pipeline
   - On "Cancel" → discard `pendingFile`, close dialog

4. **Build `<ImageCropperDialog>`**
   - New file: `components/image-cropper-dialog.tsx`
   - Wraps shadcn `Dialog` containing `<Cropper>` from `react-easy-crop`
   - Props: `file`, `aspectRatio`, `open`, `onOpenChange`, `onCropped(blob: Blob)`
   - State: `crop`, `zoom`, `croppedAreaPixels`
   - Mobile: full-screen dialog; touch zoom + drag work out of the box
   - "Done" button → use `croppedAreaPixels` to draw onto offscreen canvas → `canvas.toBlob()`

5. **Helper: `lib/crop-image.ts`**
   - `getCroppedBlob(file: File, area: { x, y, width, height }): Promise<Blob>`
   - Loads file as Image, draws cropped region to canvas, exports Blob (PNG to preserve quality before compression step)

6. **Tune compression now that crop is fixed-size**
   - Drop `maxWidthOrHeight: 1024` (canvas already outputs target size, e.g. 512×512)
   - Keep `fileType: "image/webp"`, `initialQuality: 0.85`

7. **Verify**
   - Pick a wide cartoon → cropper opens → drag/zoom to frame face → Done → check upload log shows clean dimensions → avatar shows correct framing on profile page

### Future re-use
- Course images: pass `aspectRatio={16/9}` to same `ImageUploadField`
- Scorecards: probably skip crop (need full image) but reuse upload pipeline

---

## Wire up course image uploads

### Why
Courses already have an `imgUrl` text field in the DB and a URL `<Input>` in the admin form. Same pattern as avatars — swap in `ImageUploadField`, with admin-only authorization and a wider aspect ratio.

### Steps

1. **Extend `/api/upload` authorization branch**
   - File: `app/api/upload/route.ts`
   - Refactor `parseTargetUserId` → `parseUploadTarget(pathname)` returning `{ kind: "user" | "course" | "round", id }`
   - Authorization switch:
     - `users/<userId>/...` → self or admin (existing)
     - `courses/<courseId>/...` → admin only
   - Keep same `allowedContentTypes` and `maximumSizeInBytes`

2. **Adjust `ImageUploadField` for content images**
   - Already needs `aspectRatio` prop from the crop TODO above
   - Pass `aspectRatio={16/9}` for course images
   - Consider bumping `maxSizeMB` to `1.5` and `maxWidthOrHeight` to `1600` since course photos benefit from more detail than avatars

3. **Swap the course form field**
   - File: `app/(app)/admin/_components/course-sheet.tsx` (or wherever `imgUrl` Input lives)
   - Replace `<Input type="url" name="imgUrl">` with `<ImageUploadField value={...} onChange={...} pathPrefix={`courses/${course.id}`} aspectRatio={16/9} />`
   - In create mode: show the same "available after creation" note, OR upload to `courses/_pending/<uuid>` and accept the orphan risk
   - Track `isUploading` and disable submit

4. **Clean up old blob in `updateCourse` / `deleteCourse`**
   - File: `app/(app)/admin/actions.ts`
   - In `updateCourse`: fetch current `imgUrl`, after update call `safeDeleteBlob(current.imgUrl)` if it changed
   - In `deleteCourse`: call `safeDeleteBlob(current.imgUrl)` after the row is deleted

5. **Use `next/image` wherever course images render**
   - Likely course cards / course detail page — `fill` + `sizes` matching the rendered box, same pattern as the player profile hero
   - `next.config.ts` already allows `*.public.blob.vercel-storage.com`, no change needed

6. **Verify**
   - As admin: edit a course → upload landscape photo → crop to 16:9 → save → course card shows new image
   - As non-admin: hit `/api/upload` with `courses/...` prefix → 403
   - Replace image, confirm old blob disappears in Vercel dashboard
   - Delete course, confirm blob is cleaned up

