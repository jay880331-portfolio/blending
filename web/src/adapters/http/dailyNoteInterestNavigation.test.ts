import assert from "node:assert/strict";
import { test } from "node:test";
import axios from "axios";
import { likeDailyNote } from "./dailyNoteApi";
import { fetchMemberSnapshot } from "./memberApi";

test("하트 직후 내 관심 글을 열면 저장 완료 후 회원 목록을 읽는다", async () => {
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
    return { data: { interests: [{ id: "story" }] } };
  }) as typeof axios.get;
  try {
    const like = likeDailyNote("story", true);
    const snapshot = fetchMemberSnapshot();
    await Promise.resolve();
    assert.equal(fetched, false);
    complete({ data: { liked: true, likeCount: 1 } });
    await like;
    assert.deepEqual(
      (await snapshot).interests.map((item) => item.id),
      ["story"],
    );
  } finally {
    axios.post = post;
    axios.get = get;
  }
});
