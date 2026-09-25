// The files attached to a lesson. Everyone who can see the lesson can download them; its
// instructor and administrators can also upload and delete.
import { useRef } from 'react';
import { FileText } from 'lucide-react';
import { api, fileDownloadUrl } from '../../api-client/api.js';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useSubmit from '../../reusable-logic/useSubmit.js';
import { formatBytes } from '../../helpers/format.js';
import { Notice } from '../basics/Feedback.jsx';

// The types the server accepts (request-filters/upload.js), so the file picker offers only those
const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv';

export default function LessonFiles({ lessonId, files, canManage, onChanged }) {
  const toast = useToast();
  const picker = useRef(null);

  const upload = useSubmit(async () => {
    const chosen = picker.current.files;
    if (chosen.length === 0) throw new Error('Choose one or more files first.');
    await api.uploadLessonFiles(lessonId, chosen);
    picker.current.value = '';
    toast.success(chosen.length === 1 ? 'File uploaded.' : 'Files uploaded.');
    onChanged();
  });

  async function remove(file) {
    if (!window.confirm(`Delete ${file.name}? Students will no longer be able to download it.`)) return;
    try {
      await api.deleteFile(file.id);
      toast.success(`${file.name} deleted.`);
      onChanged();
    } catch (failure) {
      toast.error(failure.message);
    }
  }

  return (
    <>
      <h2>Files</h2>
      {files.length === 0 ? (
        <p className="field-hint">No files attached.</p>
      ) : (
        <ul className="file-list">
          {files.map((file) => (
            <li key={file.id} className="outline-row">
              <FileText aria-hidden="true" />
              <a href={fileDownloadUrl(file.id)} download>{file.name}</a>
              <span className="field-hint">{formatBytes(file.size)}</span>
              {canManage && (
                <button className="btn btn-sm btn-danger" type="button" onClick={() => remove(file)}>
                  Delete<span className="visually-hidden"> {file.name}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <>
          <Notice>{upload.error}</Notice>
          <form className="form join-form" noValidate onSubmit={(event) => { event.preventDefault(); upload.run(); }}>
            <div className="field">
              <label htmlFor="lesson-files">Add files</label>
              <input className="input" id="lesson-files" type="file" multiple accept={ACCEPTED} ref={picker}
                aria-describedby="lesson-files-hint" />
              <p className="field-hint" id="lesson-files-hint">Up to 10 at a time, 25 MB each: documents, slides, spreadsheets, images, zip.</p>
            </div>
            <button className="btn" type="submit" disabled={upload.busy} data-loading={upload.busy}>Upload</button>
          </form>
        </>
      )}
    </>
  );
}
