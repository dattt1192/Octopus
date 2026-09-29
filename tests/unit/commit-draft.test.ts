import { describe, expect, it } from "vitest";
import { canResumeAmend, readCommitDraft } from "../../src/lib/state/commit-draft";
import { demoSession } from "../../src/mocks/demoSession";

describe("persisted commit drafts", () => {
  const oid = "a".repeat(40);
  const draft = { subject: "Amended title", body: "Amended body", amendOid: oid,
    newCommitDraft: { subject: "Next commit", body: "Unrelated draft" } };

  it("round-trips both messages and the amend target through JSON", () => {
    const restored = readCommitDraft(JSON.parse(JSON.stringify(draft)));
    expect(restored).toEqual(draft);
    expect(restored.newCommitDraft).toEqual({ subject: "Next commit", body: "Unrelated draft" });
  });

  it("restores legacy drafts in create mode, including an intentionally empty body", () => {
    expect(readCommitDraft({ subject: "Legacy", body: "" })).toEqual({
      subject: "Legacy", body: "", amendOid: null, newCommitDraft: null
    });
  });

  it("requires a live matching normal HEAD, including detached HEAD", () => {
    const live = { ...demoSession, head: { kind: "detached" as const, oid } };
    expect(canResumeAmend(oid, live)).toBe(true);
    expect(canResumeAmend("b".repeat(40), live)).toBe(false);
    expect(canResumeAmend(oid, { ...live, head: { kind: "unborn", name: "main" } })).toBe(false);
    expect(canResumeAmend(oid, { ...live, state: "externalOperation" })).toBe(false);
    expect(canResumeAmend(oid, { ...live, mergeOrigin: "external" })).toBe(false);
  });

  it("keeps both drafts available even when the target has become stale", () => {
    const restored = readCommitDraft(draft);
    expect(canResumeAmend(restored.amendOid!, demoSession)).toBe(false);
    expect(restored.subject).toBe("Amended title");
    expect(restored.newCommitDraft?.subject).toBe("Next commit");
  });

  it("does not turn malformed amend metadata into a normal commit message", () => {
    expect(readCommitDraft({ ...draft, amendOid: "HEAD~1" })).toEqual({
      subject: "Next commit", body: "Unrelated draft", amendOid: null, newCommitDraft: null
    });
    expect(readCommitDraft(null).subject).toBe("");
    expect(readCommitDraft({ subject: 12, body: [] }).body).toBe("");
  });
});
