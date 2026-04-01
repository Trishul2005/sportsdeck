import axios from "axios";
import {
  createTestUser,
  generateUniqueId,
  authHeaders,
  BASE_URL,
} from "./helpers/testUtils";

describe("PATCH /api/user/profile", () => {
  it("updates username and avatar", async () => {
    const { token } = await createTestUser();
    const newUsername = `updated${generateUniqueId()}`;

    const response = await axios.patch(
      `${BASE_URL}/user/profile`,
      {
        username: newUsername,
        avatar: "https://example.com/avatar.png",
      },
      authHeaders(token),
    );

    expect(response.status).toBe(200);
    expect(response.data.username).toBe(newUsername);
    expect(response.data.avatar).toBe("https://example.com/avatar.png");
  });

  it("updates only username", async () => {
    const { token } = await createTestUser();
    const newUsername = `updated${generateUniqueId()}`;

    const response = await axios.patch(
      `${BASE_URL}/user/profile`,
      { username: newUsername },
      authHeaders(token),
    );

    expect(response.status).toBe(200);
    expect(response.data.username).toBe(newUsername);
  });

  it("updates only avatar", async () => {
    const { token } = await createTestUser();

    const response = await axios.patch(
      `${BASE_URL}/user/profile`,
      { avatar: "https://example.com/new-avatar.png" },
      authHeaders(token),
    );

    expect(response.status).toBe(200);
    expect(response.data.avatar).toBe("https://example.com/new-avatar.png");
  });

  it("fails without token", async () => {
    try {
      await axios.patch(`${BASE_URL}/user/profile`, {
        username: "newuser",
      });
      fail("Should have thrown an error");
    } catch (error) {
      expect(error.response.status).toBe(401);
      expect(error.response.data.error).toBe("Unauthorized");
    }
  });

  it("fails with invalid token", async () => {
    try {
      await axios.patch(
        `${BASE_URL}/user/profile`,
        { username: "newuser" },
        { headers: { Authorization: "Bearer invalidtoken" } },
      );
      fail("Should have thrown an error");
    } catch (error) {
      expect(error.response.status).toBe(401);
    }
  });
});

describe("GET /api/users/[id]/profile", () => {
  it("retrieves user profile", async () => {
    const { token, user } = await createTestUser();
    const response = await axios.get(
      `${BASE_URL}/user/${user.id}/profile`,
      authHeaders(token),
    );
    expect(response.status).toBe(200);
    expect(response.data.user.username).toBe(user.username);
    expect(response.data.user.avatar).toBe(user.avatar);
  });

  it("fails with invalid user ID", async () => {
    const { token } = await createTestUser();
    try {
      await axios.get(
        `${BASE_URL}/user/invalid-id/profile`,
        authHeaders(token),
      );
      fail("Should have thrown an error given invalid user Id");
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe("Invalid user ID");
    }
  });

  it("fails with non-existent user ID", async () => {
    const { token } = await createTestUser();
    try {
      await axios.get(`${BASE_URL}/user/999999/profile`, authHeaders(token));
      fail("Should have thrown an error given non-existent user Id");
    } catch (error) {
      expect(error.response.status).toBe(404);
      expect(error.response.data.error).toBe("User not found");
    }
  });
});
