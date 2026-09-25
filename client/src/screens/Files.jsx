// The Files page: every file this account may see, newest first. Lesson files from its courses,
// and submission files: a student's own, or their students' for an instructor.
import { Link } from 'react-router';
import { FileText } from 'lucide-react';
import { api, fileDownloadUrl } from '../api-client/api.js';
import useApi from '../reusable-logic/useApi.js';
import { formatBytes, formatDate } from '../helpers/format.js';
import { EmptyState, Notice } from '../ui-pieces/basics/Feedback.jsx';

function whereItLives(file) {
  const kind = file.kind === 'lesson' ? 'lessons' : 'assignments';
  return `/courses/${file.courseId}/${kind}/${file.attachedTo.id}`;
}

export default function Files() {
  const { data, error } = useApi(() => api.listFiles(), []);
  const files = data?.files ?? [];

  return (
    <main className="stack stack-wide" id="main">
      <section className="card" aria-labelledby="files-title">
        <div className="card-head">
          <h1 id="files-title">Files</h1>
          {data && <span className="tag">{files.length} file{files.length === 1 ? '' : 's'}</span>}
        </div>
        <p className="card-intro">Every file you can open: lesson materials from your courses, and handed-in work you may see.</p>
        <Notice>{error?.message}</Notice>
        {data && files.length === 0 ? (
          <EmptyState icon={FileText}>No files yet. They appear here once lessons or submissions have some.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">File</th>
                  <th scope="col">From</th>
                  <th scope="col">Size</th>
                  <th scope="col">Added</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td className="cell-strong"><a href={fileDownloadUrl(file.id)} download>{file.name}</a></td>
                    <td data-label="From">
                      <Link to={whereItLives(file)}>{file.courseCode} · {file.attachedTo.title}</Link>
                      {file.studentName && <span className="field-hint"> ({file.studentName})</span>}
                    </td>
                    <td data-label="Size">{formatBytes(file.size)}</td>
                    <td data-label="Added">{formatDate(file.uploadedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
