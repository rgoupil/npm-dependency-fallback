#! /usr/bin/env node

const path = require('path');
const childProcess = require('child_process');
const semver = require('semver');
const packageJson = require('./package.json');

const missingDependencies = [];

for (const dependencyName of Object.keys(packageJson.dependencies)) {
    const dependency = {
        name: dependencyName,
        version: packageJson.dependencies[dependencyName],
    };

    // check if the package exists
    let depPackageJson;
    try {
        depPackageJson = require(path.join(dependency.name, 'package.json'));
    } catch (e) {}

    if (depPackageJson) {
        // check file: deps
        const optDependency = packageJson.optionalDependencies && packageJson.optionalDependencies[dependency.name];
        if (optDependency.version.startsWith('file:')) {
            continue;
        }

        // check URL and git:
        if (['http://', 'https://', 'git://', 'git+ssh://', 'git+http://', 'git+https://'].some(prefix => optDependency.version.startsWith(prefix))) {
            continue;
        }

        // check other deps
        if (semver.satisfies(depPackageJson.version, dependency.version)) {
            continue;
        }
    }

    missingDependencies.push(dependency);
}

const cmd = `npm install --no-save ${missingDependencies.map(d => `${d.name}@${d.version}`).join(' ')}`;
console.info('executing:', cmd);
childProcess.execSync(cmd);
