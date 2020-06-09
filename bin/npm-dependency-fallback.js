#! /usr/bin/env node

const path = require('path');
const fs = require('fs');
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
        let optDependencyVersion;
        if (isYarn) {
            optDependencyVersion = packageJson.localDependencies && packageJson.localDependencies[dependency.name];
        }
        else {
            optDependencyVersion = packageJson.optionalDependencies && packageJson.optionalDependencies[dependency.name];
        }

        if (!optDependencyVersion) {
            continue;
        }

        // check "file:" deps
        if (optDependencyVersion.startsWith('file:')) {
            continue;
        }

        // check "link:" deps
        if (isYarn && optDependencyVersion.startsWith('link:')) {
            missingDependencies.push({
                fromPath: optDependencyVersion.replace('link:', ''),
                toPath: dependency.name,
            });
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

    if (!isYarn) {
        missingDependencies.push(dependency);
    }
}

if (missingDependencies.length > 0) {
    if (isYarn) {
        for (dependenciesStr of missingDependencies) {
            const parsedToPath = dependenciesStr.toPath.split('/');
            const fromPath = dependenciesStr.fromPath;
            const toPath = dependenciesStr.toPath;
            const currentDirectory = process.cwd();
            const fullPath = `${currentDirectory}/${fromPath}`;

            if (fs.existsSync(fullPath)) {
                if (parsedToPath.length > 1) {
                    childProcess.execSync(`mkdir -p ${parsedToPath[0]}`);
                }

                print(`installing ${parsedToPath}...`);
                childProcess.execSync(`rm -rf node_modules/${toPath}`);
                childProcess.execSync(`ln -s ${fullPath} node_modules/${toPath}`);
            }
        }
    } else {
        const dependenciesStr = missingDependencies.map(d => `${d.name}@${d.version}`).join(' ');
        print(`npm installing ${dependenciesStr}...`);
        childProcess.execSync(`npm install --no-save ${dependenciesStr}`);
    }
    print('done !');
}
