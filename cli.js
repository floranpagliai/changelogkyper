#!/usr/bin/env node
const pkg = require('./package.json');

const fs = require('fs')
const yaml = require('js-yaml')
const {prompt} = require('enquirer');
const sanitize = require("sanitize-filename");
const parseChangelog = require('changelog-parser')

const changelogPath = './.changelogkyper'
const configFile = changelogPath + '/config.json'
const changelogFile = './CHANGELOG.md'
// const changelogTypes = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']
const changelogTypes = ['_']

let config = {};

const Commander = require('commander');
const program = new Commander.Command();

program
    .version(pkg.version)
    .usage("command [options]")
    .option('-d, --debug', 'Activate debug mode')

program
    .command('init')
    .description('Initialize working directory and config file.')
    .action(async function () {
        fs.mkdir(changelogPath, {recursive: true}, (err) => {
            if (err) throw err;
        });

        const questions = [
            {
                type: 'input',
                name: 'repo_issues_url',
                message: 'What is your repo url pointing to issues (e.g. https://github.com/floranpagliai/changelogkyper/issues/',
                result: function (value) {
                    return value.trim()
                }
            },
        ];
        let answers = await prompt(questions);
        const jsonString = JSON.stringify(answers)
        if (program.debug) {
            console.log(jsonString);
        }
        fs.writeFileSync(configFile, jsonString)
    });

program
    .command('add')
    .description('Add a changelog entry to non released changes.')
    .action(async function () {
        readConfig()
        let questions = [
            {
                type: 'numeral',
                name: 'id',
                message: 'What is your issue id? (e.g. 42, leave empty if not)'
            },
            {
                type: 'input',
                name: 'title',
                message: 'Issue title or describe your changes',
                validate: function (value, state, item, index) {
                    return value !== '';

                }
            }
        ];
        if (changelogTypes.length > 1) {
            questions.unshift(
                {
                    type: 'select',
                    name: 'type',
                    message: 'What type of change have you done?',
                    hoices: changelogTypes
                },
            )
        }
        let answers = await prompt(questions);

        let title = answers['title']
        if (answers['id'] !== 0) {
            title = '[#' + answers['id'] + '](' + config['repo_issues_url'] + answers['id'] + ') ' + answers['title']
        }
        let data = {
            title: title,
            type: typeof answers['type'] !== 'undefined' ? answers['type'] : '_';
        };
        let yamlStr = yaml.safeDump(data);
        fs.writeFileSync(changelogPath + '/' + sanitize(answers['title']).replace(/\s/g, '-') + '.yml', yamlStr, 'utf8');
    });

program
    .command('release <version>')
    .description('Compile non released changes into changelog.')
    .action(async function (version) {
        readConfig()
        const now = new Date()
        const dateString = now.getFullYear() + '-' + ("0" + (now.getMonth() + 1)).slice(-2)  + '-' + ("0" + (now.getDate())).slice(-2)
        let changelog = await getChangelog()

        changelog.versions.forEach(function (versionParsed) {
            if (version === versionParsed.version) {
                console.log('This version already exist in changelog.')
                process.exit(1);
            }
        })

        let release = {
            version: version,
            title: '['+version+'] - ' + dateString,
            date: dateString,
            parsed: {}
        };
        changelogTypes.forEach(function (type) {
            release.parsed[type] = [];
        })
        fs.readdir(changelogPath, function (err, files) {
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }
            if (files.length === 1) {
                console.error('No changelogs to release')
                process.exit(1)
            }

            release.parsed = getUnreleasedChangelogs(files)

            changelog.versions.unshift(release)
            writeChangelog(changelog)

            files.forEach(function (file) {
                if (file !== 'config.json') {
                    fs.unlinkSync(changelogPath + '/' + file)
                }
            });
        });
    });

program
    .command('show <version|unreleased>')
    .description('Show changelog section for version or unreleased changes.')
    .action(async function (version) {
        readConfig()
        if (version === 'unreleased') {
            fs.readdir(changelogPath, function (err, files) {
                let changelog = {
                    versions: [{
                        title: '[Unreleased]',
                        parsed: getUnreleasedChangelogs(files)
                    }]

                }
                console.log(format(changelog))
            })
        } else {
            const changelogVersion = await getChangelogVersion(version)
            if (changelogVersion === null) {
                console.log('No matching version found.')
                process.exit(1);
            }
            console.log(changelogVersion.title)
            console.log(changelogVersion.body)
        }
    });

program.parse(process.argv)

if (program.debug) {
    console.log(program.opts());
}

function readConfig() {
    try {
        const jsonString = fs.readFileSync(configFile);
        config = JSON.parse(jsonString);
    } catch (e) {
        console.error('changelogkyper need to be initialized.')
        process.exit(1)
    }
}

async function getChangelog() {
    let data = null;
    await parseChangelog({filePath: changelogFile, removeMarkdown: false}, function (err, result) {
        if (err) throw err
        data = result
    })

    return data
}

async function getChangelogVersion(version) {
    let data = null;
    const changelog = await getChangelog()
    changelog.versions.forEach(function (versionParsed) {
        if (version === versionParsed.version) {
            data = versionParsed
        }
    })

    return data
}

function format(changelog) {
    let content = '';
    if (typeof changelog.title !== 'undefined') {
        content = '# ' + changelog.title + '\n\n';
    }
    if (typeof changelog.description !== 'undefined') {
        content = '# ' + changelog.description + '\n\n';
    }
    changelog.versions.forEach(function (version) {
        content += '## ' + version.title + '\n'
        if (version.body !== undefined) {
            content += version.body + '\n\n'
        } else {
            Object.entries(version.parsed).forEach(entry => {
                const [type, logs] = entry;
                if (logs.length > 0 && type !== '_') {
                    content += '### ' + type + '\n'
                    logs.forEach(function (log) {
                        content += '- ' + log + '\n'
                    })
                    content += '\n'
                }
            });
        }
    })

    return content.slice(0, -1); // Remove the last `\n`
}

function writeChangelog(changelog) {
    fs.writeFileSync(changelogFile, format(changelog));
}

function getUnreleasedChangelogs(files) {
    let release = {};
    changelogTypes.forEach(function (type) {
        release[type] = [];
    })
    files.forEach(function (file) {
        if (file !== 'config.json') {
            let fileContents = fs.readFileSync(changelogPath + '/' + file, 'utf8');
            let data = yaml.safeLoad(fileContents);
            release[data['type']].push(data['title'])
        }
    });

    return release;
}
