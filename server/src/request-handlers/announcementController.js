// Course announcements: whoever can see a course can read its announcements; its instructor and
// administrators post, edit and delete them.
import * as Announcement from '../database-queries/announcementModel.js';
import * as Notification from '../database-queries/notificationModel.js';
import { HttpError } from '../helpers/httpError.js';
import { optionalText, parseId, requireText } from '../helpers/validate.js';
import { manageCourse, reachCourse } from '../permission-rules/access.js';

function toJson(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    body: row.body ?? '',
    authorName: row.author_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// The announcement named in the URL, after checking the requester manages its course
async function findManagedAnnouncement(req) {
  const announcement = await Announcement.findById(parseId(req.params.id, 'Announcement not found'));
  if (!announcement) throw new HttpError(404, 'Announcement not found');
  await manageCourse(req, announcement.course_id);
  return announcement;
}

export async function listAnnouncements(req, res) {
  const { course } = await reachCourse(req, req.params.id);
  const rows = await Announcement.listForCourse(course.id);
  res.json({ announcements: rows.map(toJson) });
}

export async function createAnnouncement(req, res) {
  const { course } = await manageCourse(req, req.params.id);
  const id = await Announcement.create({
    courseId: course.id,
    authorId: req.user.id,
    title: requireText(req.body?.title, 'Title'),
    body: optionalText(req.body?.body, 'Message', { max: 10000 }),
  });
  const announcement = await Announcement.findById(id);
  // Students cannot open a draft course yet, so there is nobody to tell
  if (course.status !== 'draft') {
    await Notification.notify({
      recipients: await Notification.courseStudentIds(course.id),
      actorId: req.user.id,
      type: 'announcement',
      title: `New announcement in ${course.code}`,
      body: announcement.title,
      link: `/courses/${course.id}?tab=announcements`,
    });
  }
  res.status(201).json({ announcement: toJson(announcement) });
}

export async function updateAnnouncement(req, res) {
  const announcement = await findManagedAnnouncement(req);
  const body = req.body ?? {};
  await Announcement.update({
    id: announcement.id,
    title: body.title === undefined ? announcement.title : requireText(body.title, 'Title'),
    body: body.body === undefined ? announcement.body : optionalText(body.body, 'Message', { max: 10000 }),
  });
  res.json({ announcement: toJson(await Announcement.findById(announcement.id)) });
}

export async function deleteAnnouncement(req, res) {
  const announcement = await findManagedAnnouncement(req);
  await Announcement.remove(announcement.id);
  res.status(204).end();
}
