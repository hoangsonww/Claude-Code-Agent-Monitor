/**
 * @file Self-hosted ReDoc API reference. ReDoc renders the OpenAPI spec as a
 * clean, three-panel reference document — a read-optimized complement to
 * Swagger UI's interactive "try it out" console (both are served from the same
 * `/api/openapi.json` spec). The ReDoc bundle ships with the `redoc`
 * dependency and is served straight from `node_modules` rather than a CDN, so
 * the docs render fully offline / air-gapped, consistent with the project's
 * no-external-assets policy.
 * @author Son Nguyen <hoangson091104@gmail.com>
 */

/**
 * Absolute path to the prebuilt ReDoc standalone bundle inside the installed
 * `redoc` package. Resolved through Node's module resolution so it works
 * regardless of hoisting / install layout. Throws if `redoc` is not installed.
 * @returns {string}
 */
function redocBundlePath() {
  return require.resolve("redoc/bundles/redoc.standalone.js");
}

/**
 * Minimal HTML shell that boots ReDoc against a spec URL using the
 * locally-served bundle. Makes no external network requests.
 *
 * @param {string} specUrl    URL the browser fetches the OpenAPI JSON from.
 * @param {string} bundleUrl  URL the page loads the ReDoc bundle from.
 * @param {string} title      Document <title> and browser-tab label.
 * @returns {string} A complete HTML document.
 */
function renderRedocHtml(specUrl, bundleUrl, title) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <redoc spec-url="${specUrl}"></redoc>
    <script src="${bundleUrl}"></script>
  </body>
</html>
`;
}

module.exports = { redocBundlePath, renderRedocHtml };
