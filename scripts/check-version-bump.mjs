import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packagePath = 'react-frontend/package.json';
const lockPath = 'react-frontend/package-lock.json';
const versionPattern = /^(\d+)\.(\d+)\.(\d+)$/;

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseVersion(version, source) {
  const match = versionPattern.exec(version ?? '');

  if (!match) {
    throw new Error(`${source} doit contenir une version SemVer au format x.y.z (reçu : ${version ?? 'vide'}).`);
  }

  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }

  return 0;
}

const appPackage = readJson(packagePath);
const packageLock = readJson(lockPath);
const currentVersion = appPackage.version;
const lockVersion = packageLock.version;
const lockRootVersion = packageLock.packages?.['']?.version;

parseVersion(currentVersion, packagePath);

if (lockVersion !== currentVersion || lockRootVersion !== currentVersion) {
  throw new Error(
    `Versions désynchronisées : package=${currentVersion}, lock=${lockVersion}, lock root=${lockRootVersion}.`,
  );
}

const baseSha = process.argv[2];

if (baseSha) {
  const basePackage = JSON.parse(
    execFileSync('git', ['show', `${baseSha}:${packagePath}`], { encoding: 'utf8' }),
  );
  const baseVersion = basePackage.version;

  if (
    compareVersions(
      parseVersion(currentVersion, packagePath),
      parseVersion(baseVersion, `${packagePath} sur ${baseSha}`),
    ) <= 0
  ) {
    throw new Error(
      `La version doit être supérieure à celle de la branche de base (${baseVersion}). Version reçue : ${currentVersion}.`,
    );
  }

  console.log(`Version validée : ${baseVersion} → ${currentVersion}`);
} else {
  console.log(`Version synchronisée : ${currentVersion}`);
}

