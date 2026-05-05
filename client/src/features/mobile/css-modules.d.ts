/**
 * @file css-modules.d.ts
 * @description Ambient module declaration so TypeScript can resolve
 *   `*.module.css` imports inside this feature directory. Vite handles the
 *   actual CSS-Modules transform at build time; this file only teaches `tsc`
 *   the resulting shape (a string-indexed map of class names).
 *
 *   Scoped to this directory to avoid affecting the rest of the codebase. If
 *   the project later adds a project-wide `vite-env.d.ts`, this file can be
 *   removed.
 */

declare module "*.module.css" {
  const classes: { readonly [className: string]: string };
  export default classes;
}
