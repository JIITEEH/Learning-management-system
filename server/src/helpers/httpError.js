// Throw from any controller; errorHandler turns it into a JSON response with this status.
//   throw new HttpError(404, 'Course not found');
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
