/**
 * @file electron-builder afterSign hook for Apple notarization.
 *
 * This is opt-in: it only does anything when all three Apple credentials
 * are present as environment variables. In every other case (local builds,
 * fork CI without secrets) the hook is a no-op. That keeps the default
 * `npm run dmg` working for contributors without an Apple Developer
 * account while letting the project maintainer flip a switch later.
 */

exports.default = async function notarizeIfConfigured(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== "darwin") return;

  const { APPLE_ID, APPLE_TEAM_ID, APPLE_APP_SPECIFIC_PASSWORD } = process.env;
  if (!APPLE_ID || !APPLE_TEAM_ID || !APPLE_APP_SPECIFIC_PASSWORD) {
    console.log("[notarize] Apple credentials not set — skipping notarization (ad-hoc only).");
    return;
  }

  // Lazy-require: @electron/notarize is only needed when we actually notarize,
  // so contributors without Apple credentials don't have to install it.
  let notarize;
  try {
    ({ notarize } = require("@electron/notarize"));
  } catch {
    console.log(
      "[notarize] Apple credentials present but @electron/notarize is not installed. Run `npm install --save-dev @electron/notarize` in desktop/."
    );
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;
  console.log(`[notarize] notarizing ${appPath}`);

  await notarize({
    tool: "notarytool",
    appBundleId: packager.appInfo.id,
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });

  console.log("[notarize] done");
};
