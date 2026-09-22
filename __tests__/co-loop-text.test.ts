import { describe, expect, it } from "vitest"
import {
  CoEditSession,
  applyOps,
  caretAfterOps,
  diffToOps,
  isTextOpList,
  transformAgainst,
  type TextOp,
} from "@/lib/co-loop-text"

describe("diffToOps / applyOps", () => {
  it("returns no ops for identical text", () => {
    expect(diffToOps("hello", "hello")).toEqual([])
  })

  it("produces a single insert when typing one character", () => {
    expect(diffToOps("helo", "hello")).toEqual([{ o: "i", p: 3, t: "l" }])
  })

  it("produces a single delete when removing one character", () => {
    expect(diffToOps("hello", "helo")).toEqual([{ o: "d", p: 3, n: 1 }])
  })

  it("produces a delete + insert for a replacement in the middle", () => {
    const ops = diffToOps("the cat sat", "the dog sat")
    expect(applyOps("the cat sat", ops)).toBe("the dog sat")
  })

  it("round-trips arbitrary edits", () => {
    const cases: [string, string][] = [
      ["", "hello"],
      ["hello", ""],
      ["abc", "abcdef"],
      ["abcdef", "abc"],
      ["a\nb\nc", "a\nb\nc\nd"],
      ["multi word line with spaces", "multi word line, with spaces!"],
    ]
    for (const [base, next] of cases) {
      expect(applyOps(base, diffToOps(base, next))).toBe(next)
    }
  })

  it("never emits more than two ops", () => {
    expect(diffToOps("completely different", "something else entirely").length).toBeLessThanOrEqual(2)
  })

  it("keeps op list results in bounds for adversarial input", () => {
    const ops = diffToOps("", "")
    expect(applyOps("", ops)).toBe("")
  })
})

describe("transformAgainst", () => {
  it("shifts later ops past an earlier concurrent insertion", () => {
    const incoming: TextOp[] = [{ o: "i", p: 5, t: "Y" }]
    const applied: TextOp[] = [{ o: "i", p: 2, t: "XX" }]
    expect(transformAgainst(incoming, applied, false)).toEqual([{ o: "i", p: 7, t: "Y" }])
  })

  it("does not shift when the applied edit comes after", () => {
    const incoming: TextOp[] = [{ o: "i", p: 2, t: "Y" }]
    const applied: TextOp[] = [{ o: "i", p: 9, t: "XX" }]
    expect(transformAgainst(incoming, applied, false)).toEqual([{ o: "i", p: 2, t: "Y" }])
  })

  it("shrinks a delete that overlaps an applied delete", () => {
    const incoming: TextOp[] = [{ o: "d", p: 2, n: 5 }]
    const applied: TextOp[] = [{ o: "d", p: 0, n: 4 }]
    expect(transformAgainst(incoming, applied, false)).toEqual([{ o: "d", p: 0, n: 3 }])
  })

  it("drops a delete fully covered by an applied delete", () => {
    const incoming: TextOp[] = [{ o: "d", p: 3, n: 2 }]
    const applied: TextOp[] = [{ o: "d", p: 0, n: 10 }]
    expect(transformAgainst(incoming, applied, false)).toEqual([])
  })
})

describe("CoEditSession — remote edits", () => {
  it("applies a peer edit in place and reports the applied ops", () => {
    const session = new CoEditSession("me")
    session.reset("content", "hello world")

    const result = session.receive({
      field: "content",
      ops: [{ o: "i", p: 5, t: " there" }],
      from: "peer",
      rev: 1,
      seen: {},
    })

    expect(result?.text).toBe("hello there world")
    // `appliedOps` is the normalised diff of what actually changed locally,
    // which is what the caret is translated against.
    expect(applyOps("hello world", result!.appliedOps)).toBe("hello there world")
    expect(session.getText("content")).toBe("hello there world")
  })

  it("ignores its own messages", () => {
    const session = new CoEditSession("me")
    session.reset("content", "abc")
    expect(
      session.receive({ field: "content", ops: [{ o: "i", p: 0, t: "x" }], from: "me", rev: 1 })
    ).toBeNull()
  })

  it("ignores replays of an already-applied revision", () => {
    const session = new CoEditSession("me")
    session.reset("content", "abc")
    session.receive({ field: "content", ops: [{ o: "i", p: 0, t: "x" }], from: "peer", rev: 4 })
    expect(
      session.receive({ field: "content", ops: [{ o: "i", p: 0, t: "y" }], from: "peer", rev: 4 })
    ).toBeNull()
  })

  it("rejects malformed op payloads", () => {
    const session = new CoEditSession("me")
    session.reset("content", "abc")
    expect(session.receive({ field: "content", ops: [] as any, from: "peer", rev: 1 })).toBeNull()
    expect(
      session.receive({ field: "content", ops: [{ o: "i", p: -3, t: "x" } as any], from: "peer", rev: 2 })
    ).toBeNull()
    expect(
      session.receive({ field: "content", ops: [{ o: "d", p: 0, n: 0 } as any], from: "peer", rev: 3 })
    ).toBeNull()
  })
})

describe("CoEditSession — convergence", () => {
  it("converges when two peers type at the same offset concurrently", () => {
    const a = new CoEditSession("a")
    const b = new CoEditSession("b")
    a.reset("content", "hello world")
    b.reset("content", "hello world")

    // Both publish without having seen the other.
    const fromA = a.localEdit("content", "helloX world")!
    const fromB = b.localEdit("content", "helloY world")!
    expect(fromA.ops).toEqual([{ o: "i", p: 5, t: "X" }])
    expect(fromB.ops).toEqual([{ o: "i", p: 5, t: "Y" }])

    a.receive(fromB)
    b.receive(fromA)

    expect(a.getText("content")).toBe(b.getText("content"))
    expect(a.getText("content")).toBe("helloXY world")
  })

  it("converges when a peer edits a field the other is mid-typing in", () => {
    const a = new CoEditSession("a")
    const b = new CoEditSession("b")
    a.reset("content", "title: draft")
    b.reset("content", "title: draft")

    // A publishes, B sees it, then both keep editing from that shared point.
    const fromA = a.localEdit("content", "title: draft!")!
    b.receive(fromA)

    const fromB = b.localEdit("content", "title: draft!\nbody")!
    a.receive(fromB)

    expect(a.getText("content")).toBe("title: draft!\nbody")
    expect(b.getText("content")).toBe("title: draft!\nbody")
  })

  it("keeps unsent local edits when a peer edit arrives", () => {
    const a = new CoEditSession("a")
    a.reset("content", "hello world")
    a.localEdit("content", "hello brave world") // pending, not yet flushed

    a.receive({ field: "content", ops: [{ o: "i", p: 0, t: ">>" }], from: "b", rev: 1, seen: {} })

    expect(a.getText("content")).toContain("hello brave world")
    expect(a.getText("content").startsWith(">>")).toBe(true)
  })

  it("rebases a peer edit that predates our own publish", () => {
    const a = new CoEditSession("a")
    const b = new CoEditSession("b")
    a.reset("content", "abcd")
    b.reset("content", "abcd")

    // A publishes and B never sees it (seen says 0).
    a.localEdit("content", "aXXbcd")
    const result = a.receive({
      field: "content",
      ops: [{ o: "i", p: 0, t: "Z" }],
      from: "b",
      rev: 1,
      seen: { a: 0 },
    })

    expect(result?.text).toBe("ZaXXbcd")
  })
})

describe("CoEditSession — authoritative snapshots", () => {
  it("adopts a snapshot when this participant is idle", () => {
    const session = new CoEditSession("a")
    session.reset("content", "local")
    expect(session.applyAuthoritative("content", "leader")).toBe(true)
    expect(session.getText("content")).toBe("leader")
  })

  it("protects live typing and re-bases it onto the snapshot instead", () => {
    const session = new CoEditSession("a")
    session.reset("content", "base")
    session.localEdit("content", "base + local") // simulates typing just now

    expect(session.applyAuthoritative("content", "leader version")).toBe(false)
    expect(session.getText("content")).toBe("base + local")

    // The next publish is expressed against the leader snapshot, so applying
    // it to the snapshot reproduces this participant's text (the local edit is
    // re-merged rather than lost).
    const broadcast = session.localEdit("content", "base + local + more")!
    expect(broadcast).not.toBeNull()
    expect(applyOps("leader version", broadcast.ops)).toBe("base + local + more")
  })
})

describe("caretAfterOps", () => {
  it("moves the caret by the length of insertions before it", () => {
    expect(caretAfterOps(8, [{ o: "i", p: 2, t: "XX" }], 12)).toBe(10)
  })

  it("pulls the caret back when text before it is deleted", () => {
    expect(caretAfterOps(8, [{ o: "d", p: 0, n: 3 }], 8)).toBe(5)
  })

  it("leaves the caret alone for edits after it", () => {
    expect(caretAfterOps(2, [{ o: "i", p: 9, t: "XX" }], 12)).toBe(2)
  })

  it("clamps to the resulting length", () => {
    expect(caretAfterOps(50, [{ o: "d", p: 0, n: 45 }], 5)).toBe(5)
  })
})

describe("isTextOpList", () => {
  it("accepts a valid op list", () => {
    expect(isTextOpList([{ o: "i", p: 0, t: "hi" }])).toBe(true)
    expect(isTextOpList([{ o: "d", p: 2, n: 1 }])).toBe(true)
  })

  it("rejects empty, oversized, and malformed lists", () => {
    expect(isTextOpList([])).toBe(false)
    expect(isTextOpList(null)).toBe(false)
    expect(isTextOpList("nope")).toBe(false)
    expect(isTextOpList(new Array(20).fill({ o: "i", p: 0, t: "x" }))).toBe(false)
    expect(isTextOpList([{ o: "x", p: 0 }])).toBe(false)
    expect(isTextOpList([{ o: "i", p: 0, t: "" }])).toBe(false)
    expect(isTextOpList([{ o: "i", p: NaN, t: "x" }])).toBe(false)
  })
})
