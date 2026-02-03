#!/usr/bin/env node
/**
 * Generate build info file with commit hash and build timestamp
 * This runs during the build process to embed version information
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

function getBuildInfo() {
  let commitHash = 'unknown';
  let buildTime = new Date().toISOString();

  try {
    // Get short commit hash
    commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch (error) {
    console.warn('Warning: Could not get git commit hash:', error.message);
  }

  return {
    commitHash,
    buildTime,
    version: `${commitHash}-${buildTime.split('T')[0]}`
  };
}

function main() {
  const buildInfo = getBuildInfo();

  console.log('Build Info:');
  console.log(`  Commit: ${buildInfo.commitHash}`);
  console.log(`  Time: ${buildInfo.buildTime}`);
  console.log(`  Version: ${buildInfo.version}`);

  // Write as JS module
  const content = `// Auto-generated build info - DO NOT EDIT
export const BUILD_INFO = ${JSON.stringify(buildInfo, null, 2)};
`;

  const outputPath = join('src', 'build-info.js');
  writeFileSync(outputPath, content);
  console.log(`\nGenerated: ${outputPath}`);
}

main();
