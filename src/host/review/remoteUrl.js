// Git remote URL → the hosted repository that pull requests live in.
//
// Remotes come in three shapes: https URLs, ssh:// URLs, and the scp-like
// `user@host:path` form. Whatever the shape, the web API is reached over
// https on the remote's host, so only the host and the repository path are
// kept. Credentials embedded in an https remote are dropped so they never
// travel further than the git config they came from.

const KNOWN_HOSTS = {
  "github.com": "github",
  "gitlab.com": "gitlab",
};

const SCP_LIKE = /^(?:[^@/\s]+@)?([^:/\s]+):(?!\/\/)(.+)$/;

/**
 * @typedef {object} RemoteRepository
 * @property {"github" | "gitlab"} provider
 * @property {string} host Lower-case host name without a port.
 * @property {string} webOrigin `https://host[:port]`, where the web API lives.
 * @property {string} repositoryPath `owner/repo` on GitHub, `group/.../project` on GitLab.
 */

/**
 * @param {string | undefined} url A remote's fetch or push URL.
 * @param {{ gitlabHosts?: string[] }} [options] Self-hosted GitLab hosts.
 * @returns {RemoteRepository | null} null when the remote is not a supported host.
 */
function parseRemoteUrl(url, { gitlabHosts = [] } = {}) {
  const location = readLocation(String(url || "").trim());
  if (!location) return null;

  const host = location.host.toLowerCase();
  const provider =
    KNOWN_HOSTS[host] ||
    (gitlabHosts.some((candidate) => String(candidate).toLowerCase() === host)
      ? "gitlab"
      : null);
  if (!provider) return null;

  const repositoryPath = location.path.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "");
  const segments = repositoryPath.split("/");
  if (segments.some((segment) => !segment)) return null;
  if (provider === "github" ? segments.length !== 2 : segments.length < 2) {
    return null;
  }

  return {
    provider,
    host,
    webOrigin: `https://${host}${location.webPort ? `:${location.webPort}` : ""}`,
    repositoryPath,
  };
}

/**
 * @param {string} url
 * @returns {{ host: string, webPort: string, path: string } | null}
 */
function readLocation(url) {
  if (!url) return null;

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      return null;
    }
    if (parsed.protocol === "https:") {
      return { host: parsed.hostname, webPort: parsed.port, path: parsed.pathname };
    }
    if (parsed.protocol === "ssh:") {
      // The ssh port is where git listens, not the web API.
      return { host: parsed.hostname, webPort: "", path: parsed.pathname };
    }
    return null;
  }

  // A Windows drive path such as C:\repo looks like host "C" to the pattern.
  if (/^[a-z]:[\\/]/i.test(url)) return null;
  const scpLike = url.match(SCP_LIKE);
  if (!scpLike) return null;
  return { host: scpLike[1], webPort: "", path: scpLike[2] };
}

module.exports = { parseRemoteUrl };
