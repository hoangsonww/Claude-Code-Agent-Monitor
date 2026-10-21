/**
 * @file Checks whether local history may update an existing provider session.
 * Remote origin marks remain authoritative after a source is deleted without purge.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
function isLocalHistoryOwner(row, provider = null) {
  if (!row) return true;
  if ((row.source || "local") !== "local" || (provider && (row.provider || "claude") !== provider))
    return false;
  try {
    const metadata = JSON.parse(row.metadata || "{}");
    return (
      !!metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      !metadata.origin_host
    );
  } catch {
    // An unreadable origin cannot authorize reassignment to local history.
    return false;
  }
}
module.exports = { isLocalHistoryOwner };
