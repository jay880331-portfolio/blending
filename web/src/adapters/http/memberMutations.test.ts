import assert from "node:assert/strict";
import { describe, it } from "node:test";
import axios, { type InternalAxiosRequestConfig } from "axios";
import { deleteMemberAccount, recordHomeLastSeen } from "./memberMutations";

describe("deleteMemberAccount", () => {
  it("sends the withdrawal reason and optional feedback to the account endpoint", async () => {
    const originalAdapter = axios.defaults.adapter;
    let request: InternalAxiosRequestConfig | undefined;
    axios.defaults.adapter = async (config) => {
      request = config;
      return {
        data: { success: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      };
    };

    try {
      await assert.doesNotReject(() =>
        deleteMemberAccount({
          reason: "서비스 사용이 어렵고 불편함",
          feedback: "화면이 복잡합니다.",
        }),
      );
      assert.equal(request?.method, "delete");
      assert.equal(request?.url, "/api/member/account");
      assert.deepEqual(JSON.parse(request?.data ?? "null"), {
        reason: "서비스 사용이 어렵고 불편함",
        feedback: "화면이 복잡합니다.",
      });
    } finally {
      axios.defaults.adapter = originalAdapter;
    }
  });

  it("converts the server withdrawal error message", async () => {
    const originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = async () => {
      throw {
        isAxiosError: true,
        response: { data: { message: "탈퇴 사유를 확인해 주세요." } },
      };
    };

    try {
      await assert.rejects(
        () => deleteMemberAccount({ reason: "다른 계정으로 재가입 희망" }),
        new Error("탈퇴 사유를 확인해 주세요."),
      );
    } finally {
      axios.defaults.adapter = originalAdapter;
    }
  });
});

describe("recordHomeLastSeen", () => {
  it("posts to the last-seen endpoint and swallows errors", async () => {
    const originalAdapter = axios.defaults.adapter;
    let request: InternalAxiosRequestConfig | undefined;
    axios.defaults.adapter = async (config) => {
      request = config;
      throw { isAxiosError: true, response: { status: 500 } };
    };
    try {
      await assert.doesNotReject(() => recordHomeLastSeen());
      assert.equal(request?.method, "post");
      assert.equal(request?.url, "/api/member/last-seen");
    } finally {
      axios.defaults.adapter = originalAdapter;
    }
  });
});
