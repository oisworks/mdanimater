import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { parseRemoteUrl } = require("../src/host/review/remoteUrl.js");

describe("parseRemoteUrl", () => {
  it("reads a GitHub https remote", () => {
    expect(parseRemoteUrl("https://github.com/octo/repo.git")).toEqual({
      provider: "github",
      host: "github.com",
      webOrigin: "https://github.com",
      repositoryPath: "octo/repo",
    });
  });

  it("reads a GitHub scp-like ssh remote", () => {
    expect(parseRemoteUrl("git@github.com:octo/repo.git")).toEqual({
      provider: "github",
      host: "github.com",
      webOrigin: "https://github.com",
      repositoryPath: "octo/repo",
    });
  });

  it("reads a GitHub ssh:// remote", () => {
    expect(parseRemoteUrl("ssh://git@github.com/octo/repo")).toMatchObject({
      provider: "github",
      repositoryPath: "octo/repo",
    });
  });

  it("ignores a trailing slash and the .git suffix", () => {
    expect(parseRemoteUrl("https://github.com/octo/repo/")?.repositoryPath).toBe("octo/repo");
    expect(parseRemoteUrl("https://github.com/octo/repo.git/")?.repositoryPath).toBe("octo/repo");
  });

  it("drops credentials embedded in an https remote", () => {
    const remote = parseRemoteUrl("https://user:secret@github.com/octo/repo.git");
    expect(remote).toEqual({
      provider: "github",
      host: "github.com",
      webOrigin: "https://github.com",
      repositoryPath: "octo/repo",
    });
    expect(JSON.stringify(remote)).not.toContain("secret");
  });

  it("treats the host case-insensitively", () => {
    expect(parseRemoteUrl("https://GitHub.com/octo/repo")?.provider).toBe("github");
  });

  it("rejects GitHub paths that are not owner/repo", () => {
    expect(parseRemoteUrl("https://github.com/octo")).toBeNull();
    expect(parseRemoteUrl("https://github.com/octo/repo/extra")).toBeNull();
  });

  it("reads gitlab.com remotes with nested groups", () => {
    expect(parseRemoteUrl("git@gitlab.com:group/sub/proj.git")).toEqual({
      provider: "gitlab",
      host: "gitlab.com",
      webOrigin: "https://gitlab.com",
      repositoryPath: "group/sub/proj",
    });
  });

  it("reads a self-hosted GitLab only when its host is listed", () => {
    const url = "ssh://git@gitlab.example.com:2222/group/sub/proj.git";
    expect(parseRemoteUrl(url)).toBeNull();
    expect(parseRemoteUrl(url, { gitlabHosts: ["GitLab.example.com"] })).toEqual({
      provider: "gitlab",
      host: "gitlab.example.com",
      // The ssh port is not where the web API listens.
      webOrigin: "https://gitlab.example.com",
      repositoryPath: "group/sub/proj",
    });
  });

  it("keeps the port of an https remote for the web origin", () => {
    expect(
      parseRemoteUrl("https://gitlab.example.com:8443/group/proj.git", {
        gitlabHosts: ["gitlab.example.com"],
      }),
    ).toEqual({
      provider: "gitlab",
      host: "gitlab.example.com",
      webOrigin: "https://gitlab.example.com:8443",
      repositoryPath: "group/proj",
    });
  });

  it("rejects remotes that are not reachable over https", () => {
    expect(parseRemoteUrl("http://github.com/octo/repo.git")).toBeNull();
    expect(parseRemoteUrl("git://github.com/octo/repo.git")).toBeNull();
    expect(parseRemoteUrl("file:///c/repos/repo.git")).toBeNull();
    expect(parseRemoteUrl("C:\\repos\\repo")).toBeNull();
    expect(parseRemoteUrl("../repo")).toBeNull();
  });

  it("rejects unknown hosts and empty input", () => {
    expect(parseRemoteUrl("https://bitbucket.org/octo/repo.git")).toBeNull();
    expect(parseRemoteUrl("")).toBeNull();
    expect(parseRemoteUrl(undefined)).toBeNull();
    expect(parseRemoteUrl("https://github.com/")).toBeNull();
    expect(parseRemoteUrl("https://github.com:99999/octo/repo")).toBeNull();
  });
});
