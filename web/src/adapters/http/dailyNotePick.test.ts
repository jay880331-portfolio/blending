import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import { likeDailyNote, fetchPickedDailyNotes } from "./dailyNoteApi";

test("PICK 조회는 하트 저장 중에도 저장 대기 없이 바로 조회한다", async () => {
  const post = axios.post;
  const get = axios.get;
  let complete!: (value: unknown) => void;
  let fetched = false;
  axios.post = (() =>
    new Promise<unknown>((resolve) => {
      complete = resolve;
    })) as typeof axios.post;
  axios.get = (async () => {
    fetched = true;
    return { data: { items: [{ id: "story" }] } };
  }) as typeof axios.get;
  try {
    const like = likeDailyNote("story", true);
    const pick = fetchPickedDailyNotes();
    await Promise.resolve();
    assert.equal(fetched, true);
    assert.deepEqual(
      (await pick).items.map((item) => item.id),
      ["story"],
    );
    complete({ data: { liked: true, likeCount: 1 } });
    await like;
  } finally {
    axios.post = post;
    axios.get = get;
  }
});
