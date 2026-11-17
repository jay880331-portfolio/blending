import assert from "node:assert/strict";
import { test } from "node:test";
import axios, { AxiosError } from "axios";
import { useDailyNoteStore } from "./dailyNoteStore";

test("Daily Note 상세 실패는 해당 상세에만 오류로 기록한다", async () => {
  const adapter = axios.defaults.adapter;
  let rejectRequest!: (reason: unknown) => void;
  axios.defaults.adapter = (config) =>
    new Promise((_, reject) => {
      rejectRequest = () =>
        reject(
          new AxiosError("not found", "ERR_BAD_REQUEST", config, undefined, {
            status: 404,
            statusText: "Not Found",
            headers: {},
            config,
            data: { message: "STORY를 찾을 수 없습니다." },
          }),
        );
    });
  useDailyNoteStore.setState({
    details: {},
    detailStatus: {},
    detailErrors: {},
    error: "피드 오류",
  });

  try {
    const loading = useDailyNoteStore.getState().loadDetail("missing");
    assert.equal(useDailyNoteStore.getState().detailStatus.missing, "loading");
    assert.equal(useDailyNoteStore.getState().detailErrors.missing, undefined);
    rejectRequest(undefined);
    await loading;
    const state = useDailyNoteStore.getState();
    assert.equal(state.detailStatus.missing, "error");
    assert.equal(state.detailErrors.missing, "STORY를 찾을 수 없습니다.");
    assert.equal(state.error, "피드 오류");
  } finally {
    axios.defaults.adapter = adapter;
  }
});

test("Daily Note 다음 페이지 실패는 버튼 재시도 전까지 다시 요청하지 않는다", async () => {
  const adapter = axios.defaults.adapter;
  let calls = 0;
  axios.defaults.adapter = (config) => {
    calls += 1;
    return Promise.reject(
      new AxiosError("request failed", "ERR_NETWORK", config, undefined, {
        status: 500,
        statusText: "Server Error",
        headers: {},
        config,
        data: { message: "다음 페이지를 불러오지 못했습니다." },
      }),
    );
  };
  const feed = [
    {
      id: "daily-note-1",
      imageUrls: ["https://example.com/note.jpg"],
      technicals: {},
      featuredTechnicalKeys: [],
      createdAt: "2026-08-14T00:00:00.000Z",
    },
  ];
  useDailyNoteStore.setState({
    feed,
    nextCursor: "next-page",
    status: "ready",
    loadingMore: false,
    error: undefined,
  });

  try {
    await useDailyNoteStore.getState().loadFeed();
    assert.deepEqual(useDailyNoteStore.getState().feed, feed);
    assert.equal(
      useDailyNoteStore.getState().error,
      "다음 페이지를 불러오지 못했습니다.",
    );

    await useDailyNoteStore.getState().loadFeed();
    assert.equal(calls, 1);

    await useDailyNoteStore.getState().retryFeed();
    assert.equal(calls, 2);
  } finally {
    axios.defaults.adapter = adapter;
  }
});
