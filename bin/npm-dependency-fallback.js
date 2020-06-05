#! /usr/bin/env node

const path = require('path');
const childProcess = require('child_process');
const semver = require('semver');
const packageJson = require(`${process.env.INIT_CWD}/package.json`);

function print(...str) {
    console.info('[npm-dependency-fallback]:', ...str);
}

const missingDependencies = [];
const isYarn = process.env.npm_config_user_agent.startsWith('yarn');

for (const dependencyName of Object.keys(packageJson.dependencies)) {
    const dependency = {
        name: dependencyName,
        version: packageJson.dependencies[dependencyName],
    };

    // check if the package exists
    let depPackageJson;
    try {
        depPackageJson = require(path.join(process.env.INIT_CWD, 'node_modules', dependency.name, 'package.json'));
    } catch (e) {}

    if (depPackageJson) {
        const optDependencyVersion = packageJson.optionalDependencies && packageJson.optionalDependencies[dependency.name];
        if (!optDependencyVersion) {
            continue;
        }

        // check "file:" deps
        if (optDependencyVersion.startsWith('file:')) {
            continue;
        }

        // check "URL" and "git:"
        if (['http://', 'https://', 'git://', 'git+ssh://', 'git+http://', 'git+https://'].some(prefix => optDependencyVersion.startsWith(prefix))) {
            continue;
        }

        // check other deps
        if (semver.satisfies(depPackageJson.version, dependency.version)) {
            continue;
        }
    }

    missingDependencies.push(dependency);
}

if (missingDependencies.length > 0) {
    const dependenciesStr = missingDependencies.map(d => `${d.name}@${d.version}`).join(' ');
    print(`installing ${dependenciesStr}...`);
    const packageManager = isYarn ? 'yarn add' : 'npm install --no-save'
    childProcess.execSync(`${packageManager} ${dependenciesStr}`);
    print('done !');
}
