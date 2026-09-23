// Wording shared by the courses list and the single-course page. The stored
// values are codes; these turn them into what a person reads.

const STATUS = {
  draft: { label: "Draft", tone: "tag-info" },
  published: { label: "Open", tone: "tag-ok" },
  archived: { label: "Archived", tone: "" },
};

const RELATION = {
  teaching: "You teach this",
  enrolled: "Enrolled",
  overseeing: "Administrator view",
};

export const courseStatus = (status) => STATUS[status] ?? { label: status, tone: "" };
export const relationLabel = (relation) => RELATION[relation] ?? relation;

/** ABCDEFGH is shown as ABCD-EFGH, which is easier to read out to a class. */
export const formatJoinCode = (code) => (code ? `${code.slice(0, 4)}-${code.slice(4)}` : "");
