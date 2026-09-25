import { useState } from 'react';

// Runs one action for a form or a button, and tracks two things the screen shows:
//   busy   true while the request is in flight (the button shows a spinner and cannot be
//          pressed twice)
//   error  the server's message if it failed, for a <Notice> above the form
//
//   const save = useSubmit(async () => { await api.updateCourse(id, form); toast.success('Saved.'); });
//   <form onSubmit={(event) => { event.preventDefault(); save.run(); }}>
//   <Notice>{save.error}</Notice>
//   <button disabled={save.busy} data-loading={save.busy}>Save</button>
export default function useSubmit(action) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(...args) {
    setBusy(true);
    setError('');
    try {
      return await action(...args);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return { run, busy, error, setError };
}
