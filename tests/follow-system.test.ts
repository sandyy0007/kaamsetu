import { beforeEach, describe, expect, it } from "vitest";
import { call } from "./helpers";
import { db, resetDb } from "@/server/db";
import { buildDemoDb } from "@/server/seed";
import { resetRateLimits } from "@/server/api/router";

beforeEach(() => {
  resetRateLimits();
  resetDb(buildDemoDb());
});

describe("Follow System & Persistence", () => {
  it("allows a user to follow and unfollow another user", async () => {
    // Ramesh follows Sunita
    const resFollow = await call<{ following: boolean; followers: number }>("POST", "/follow/u_sunita", {
      as: "u_ramesh",
    });
    expect(resFollow.status).toBe(200);
    expect(resFollow.data.following).toBe(true);
    expect(resFollow.data.followers).toBeGreaterThanOrEqual(1);

    // Verify Sunita's network shows Ramesh in followers
    const networkRes = await call<{ items: { user: { id: string }; isFollowing: boolean }[] }>(
      "GET",
      "/users/u_sunita/network?type=followers",
      { as: "u_ramesh" }
    );
    expect(networkRes.status).toBe(200);
    const followerIds = networkRes.data.items.map((i) => i.user.id);
    expect(followerIds).toContain("u_ramesh");

    // Unfollow
    const resUnfollow = await call<{ following: boolean; followers: number }>("DELETE", "/follow/u_sunita", {
      as: "u_ramesh",
    });
    expect(resUnfollow.status).toBe(200);
    expect(resUnfollow.data.following).toBe(false);

    // Verify removed
    const networkAfter = await call<{ items: { user: { id: string } }[] }>(
      "GET",
      "/users/u_sunita/network?type=followers",
      { as: "u_ramesh" }
    );
    expect(networkAfter.data.items.map((i) => i.user.id)).not.toContain("u_ramesh");
  });

  it("rejects self-follow attempts", async () => {
    const res = await call("POST", "/follow/u_ramesh", {
      as: "u_ramesh",
    });
    expect(res.status).toBe(400);
    expect(res.error?.message).toMatch(/cannot follow yourself/i);
  });

  it("is idempotent when following multiple times", async () => {
    const res1 = await call<{ following: boolean; followers: number }>("POST", "/follow/u_sunita", {
      as: "u_ramesh",
    });
    expect(res1.status).toBe(200);
    const count1 = res1.data.followers;

    const res2 = await call<{ following: boolean; followers: number }>("POST", "/follow/u_sunita", {
      as: "u_ramesh",
    });
    expect(res2.status).toBe(200);
    expect(res2.data.following).toBe(true);
    expect(res2.data.followers).toBe(count1);

    // In-memory db should only have 1 entry
    const database = db();
    const matches = database.follows.filter((f) => f.followerId === "u_ramesh" && f.followingId === "u_sunita");
    expect(matches.length).toBe(1);
  });

  it("allows following by user handle as well as user id", async () => {
    // Get target user handle
    const database = db();
    const targetUser = database.users.find((u) => u.id === "u_sunita");
    expect(targetUser?.handle).toBeTruthy();

    const res = await call<{ following: boolean; followers: number }>("POST", `/follow/${targetUser!.handle}`, {
      as: "u_ramesh",
    });
    expect(res.status).toBe(200);
    expect(res.data.following).toBe(true);

    const check = database.follows.some((f) => f.followerId === "u_ramesh" && f.followingId === "u_sunita");
    expect(check).toBe(true);
  });
});
