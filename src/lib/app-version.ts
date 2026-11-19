import packageJson from "../../package.json";

/** Server-only — reads package.json directly rather than relying on
 * `npm_package_version`, which isn't set when the process is started
 * outside `npm run` (Docker's CMD, the Cloudflare Workers build, ...). */
export const APP_VERSION: string = packageJson.version;
