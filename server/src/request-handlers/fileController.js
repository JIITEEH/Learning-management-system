// Files attached to lessons: uploading, downloading, deleting.
// A file is only ever sent after checking the requester may see the lesson it belongs to.
import * as File from '../database-queries/fileModel.js';
import { discardFiles, discardUploads, pathOnDisk } from '../helpers/files.js';
import { HttpError } from '../helpers/httpError.js';
import { parseId } from '../helpers/validate.js';
import { reachLesson } from '../permission-rules/access.js';
import { fileToJson } from './lessonController.js';

// Runs BEFORE the upload filter (see lessonRoutes.js), which saves files to disk the moment they
// arrive. Checking first means someone who may not edit this lesson never gets a byte onto disk.
export async function allowLessonUpload(req, res, next) {
  req.reached = await reachLesson(req, req.params.id, { manage: true });
  next();
}

// Records the files the upload filter has just saved, as attachments of the lesson
export async function uploadLessonFiles(req, res) {
  const uploads = req.files ?? [];
  if (uploads.length === 0) throw new HttpError(400, 'Choose at least one file to upload');
  const { lesson } = req.reached;

  const ids = [];
  try {
    for (const upload of uploads) {
      ids.push(
        await File.create({
          uploadedBy: req.user.id,
          ownerType: 'lesson',
          ownerId: lesson.id,
          originalName: upload.originalname.slice(0, 255),
          storedName: upload.filename,
          mimeType: upload.mimetype,
          sizeBytes: upload.size,
        }),
      );
    }
  } catch (error) {
    // Saving the details failed part way: remove the rows already written and every uploaded
    // file, so the upload leaves nothing behind either on disk or in the table
    for (const id of ids) await File.remove(id);
    await discardUploads(uploads);
    throw error;
  }

  const files = await File.listForLesson(lesson.id);
  res.status(201).json({ files: files.map(fileToJson) });
}

async function findLessonFile(req, { manage }) {
  const file = await File.findById(parseId(req.params.id, 'File not found'));
  // Only lesson files exist so far; submissions and others arrive with their roadmap steps
  if (!file || file.owner_type !== 'lesson') throw new HttpError(404, 'File not found');
  await reachLesson(req, file.owner_id, { manage });
  return file;
}

// Sends the file as a download ("Content-Disposition: attachment"), never displayed inside our
// site, so an uploaded web page or script can never run as if it were part of LearnHub
export async function downloadFile(req, res, next) {
  const file = await findLessonFile(req, { manage: false });
  res.download(pathOnDisk(file), file.original_name, (error) => {
    // The row exists but the bytes are gone (deleted by hand, a lost disk)
    if (error && !res.headersSent) next(new HttpError(404, 'File not found'));
  });
}

export async function deleteFile(req, res) {
  const file = await findLessonFile(req, { manage: true });
  await discardFiles([file]);
  res.status(204).end();
}
