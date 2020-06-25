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
const packageManager = process.env.npm_config_user_agent.startsWith('yarn') ? 'YARN' : 'NPM';

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

        switch (packageManager) {
            case "YARN":
                optDependencyVersion = packageJson.localDependencies && packageJson.localDependencies[dependency.name];
                break;
            case "NPM":
            default:
                optDependencyVersion = packageJson.optionalDependencies && packageJson.optionalDependencies[dependency.name];
                break;
        }


        if (!optDependencyVersion) {
            continue;
        }

        // check "file:" deps
        if (optDependencyVersion.startsWith('file:')) {
            continue;
        }

        // check "link:" deps
        if (packageManager === 'YARN' && optDependencyVersion.startsWith('link:')) {
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

    if (packageManager !== 'YARN') {
        missingDependencies.push(dependency);
    }
}

if (missingDependencies.length > 0) {
    switch (packageManager) {
        case "YARN":
            for (const dependenciesStr of missingDependencies) {
                const parsedToPath = dependenciesStr.toPath.split('/');
                const fromPath = dependenciesStr.fromPath;
                const toPath = dependenciesStr.toPath;
                const currentDirectory = process.cwd();
                const fullPath = `${currentDirectory}/${fromPath}`;

                if (fs.existsSync(fullPath)) {
                    const cmds = [];

                    if (parsedToPath.length > 1) {
                        cmds.push(`mkdir -p ${parsedToPath[0]}`);
                    }

                    cmds.push(`rm -rf node_modules/${toPath}`);
                    cmds.push(`ln -s ${fullPath} node_modules/${toPath}`);

                    print(`installing ${parsedToPath}...`);
                    childProcess.execSync(cmds.join('; '));
                }
            }
            break;
        case "NPM":
        default:
            const dependenciesStr = missingDependencies.map(d => `${d.name}@${d.version}`).join(' ');
            print(`npm installing ${dependenciesStr}...`);
            childProcess.execSync(`npm install --no-save ${dependenciesStr}`);
            break;
    }
    print('done !');
}
