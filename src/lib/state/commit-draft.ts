import type { RepoSnapshot } from "../ipc/types";

export interface CommitMessageDraft {
  subject: string;
  body: string;
}

export interface CommitDraft extends CommitMessageDraft {
  amendOid: string | null;
  newCommitDraft: CommitMessageDraft | null;
}

function message(value: unknown): CommitMessageDraft {
  const entry = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    subject: typeof entry.subject === "string" ? entry.subject : "",
    body: typeof entry.body === "string" ? entry.body : ""
  };
}

/** Accept old subject/body entries without changing the storage namespace. */
export function readCommitDraft(value: unknown): CommitDraft {
  const entry = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const amendOid = typeof entry.amendOid === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(entry.amendOid)
    ? entry.amendOid : null;
  const backup = entry.newCommitDraft ? message(entry.newCommitDraft) : null;
  return {
    ...message(entry.amendOid && !amendOid ? backup : entry),
    amendOid,
    newCommitDraft: amendOid ? backup ?? message(null) : null
  };
}

/** Persisted OIDs identify a draft, never prove that it is safe to submit. */
export function canResumeAmend(oid: string, snapshot: RepoSnapshot): boolean {
  return snapshot.head.kind !== "unborn" && snapshot.head.oid === oid &&
    snapshot.state === "normal" && snapshot.mergeOrigin === null;
}
