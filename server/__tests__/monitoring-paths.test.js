/**
 * @file Unit tests for cross-platform monitoring binary URL/path resolution.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  prometheusUrl,
  grafanaUrl,
  prometheusArchiveExt,
  grafanaArchiveExt,
  prometheusPlatform,
  prometheusArchiveName,
  grafanaArchiveName,
  toGrafanaPath,
} = require("../../monitoring/scripts/paths");

describe("monitoring paths", () => {
  it("builds official download URLs for the current platform", () => {
    const plat = prometheusPlatform();
    const promExt = prometheusArchiveExt();
    const grafExt = grafanaArchiveExt();

    assert.match(
      prometheusUrl(),
      new RegExp(`${prometheusArchiveName()}\\.${promExt.replace(".", "\\.")}$`)
    );
    assert.match(
      grafanaUrl(),
      new RegExp(`grafana-[0-9.]+\\.${plat}\\.${grafExt.replace(".", "\\.")}$`)
    );

    if (process.platform === "win32") {
      assert.equal(promExt, "zip");
      assert.equal(grafExt, "zip");
    } else {
      assert.equal(promExt, "tar.gz");
      assert.equal(grafExt, "tar.gz");
    }
  });

  it("normalizes Windows paths for Grafana YAML", () => {
    assert.equal(
      toGrafanaPath("C:\\ccam\\monitoring\\grafana\\dashboards"),
      "C:/ccam/monitoring/grafana/dashboards"
    );
  });

  it("uses consistent archive naming", () => {
    assert.match(prometheusArchiveName(), /^prometheus-[0-9.]+\./);
    assert.match(grafanaArchiveName(), /^grafana-[0-9.]+\./);
  });
});
