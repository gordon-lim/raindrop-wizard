import type { PackageJson } from './package-json-types.js';

/**
 * @deprecated Use PackageJson from package-json-types.ts instead
 */
export type PackageDotJson = PackageJson;

type NpmPackage = {
  name: string;
  version: string;
};

/**
 * Checks if @param packageJson has any of the @param packageNamesList package names
 * listed as a dependency or devDependency.
 * If so, it returns the first package name that is found, including the
 * version (range) specified in the package.json.
 */
export function findInstalledPackageFromList(
  packageNamesList: string[],
  packageJson: PackageJson,
): NpmPackage | undefined {
  return packageNamesList
    .map((packageName) => ({
      name: packageName,
      version: getPackageVersion(packageName, packageJson),
    }))
    .find((sdkPackage): sdkPackage is NpmPackage => !!sdkPackage.version);
}

export function hasPackageInstalled(
  packageName: string,
  packageJson: PackageJson,
): boolean {
  return getPackageVersion(packageName, packageJson) !== undefined;
}

export function getPackageVersion(
  packageName: string,
  packageJson: PackageJson,
): string | undefined {
  return (
    packageJson?.dependencies?.[packageName] ||
    packageJson?.devDependencies?.[packageName]
  );
}
