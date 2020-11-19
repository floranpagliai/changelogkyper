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
const changelogTypes = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']

let config = {};

const Commander = require('commander');
const program = new Commander.Command();

program
    .version(pkg.version)
    .usage("$ changelogkyper command [options]")
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
                validate: function (value, state, item, index) {
                    return value !== '';
                },
                result: function (value) {
                    return value.trim()
                }
            }
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
        const questions = [
            {
                type: 'select',
                name: 'type',
                message: 'What type of change have you done?',
                choices: changelogTypes
            },
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
        let answers = await prompt(questions);

        let title = answers['title']
        if (answers['id'] !== 0) {
            title = '[#' + answers['id'] + '](' + config['repo_issues_url'] + answers['id'] + ') ' + answers['title']
        }
        let data = {
            title: title,
            type: answers['type']
        };
        let yamlStr = yaml.safeDump(data);
        fs.writeFileSync(changelogPath + '/' + sanitize(answers['title']).replace(/\s/g, '-') + '.yml', yamlStr, 'utf8');
    });

program
    .command('release <version>')
    .description('Compile non released changes into changelog.')
    .action(async function (version) {
        readConfig()
        const changelogVersion = await getChangelogVersion(version)
        if (changelogVersion !== null) {
            console.log('This version already exist in changelog.')
            process.exit(1);
        }
        let changelogs = [];
        changelogTypes.forEach(function (type) {
            changelogs[type] = [];
        })
        fs.readdir(changelogPath, function (err, files) {
            if (err) {
                return console.log('Unable to scan directory: ' + err);
            }
            if (files.length === 1) {
                console.error('No changelogs to release')
                process.exit(1)
            }
            files.forEach(function (file) {
                if (file !== 'config.json') {
                    let fileContents = fs.readFileSync(changelogPath + '/' + file, 'utf8');
                    let data = yaml.safeLoad(fileContents);
                    changelogs[data['type']].push(data['title'])
                }
            });
            const now = new Date()
            let content = '## [' + version + '] - ' + now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate() + '\n'
            changelogTypes.forEach(function (type) {
                if (changelogs[type].length > 0) {
                    content += '### ' + type + '\n'
                    changelogs[type].forEach(function (changelog){
                        content += '- ' + changelog + '\n'
                    })
                    content += '\n'
                }

            })
            try {
                content += fs.readFileSync(changelogFile)
            } catch (e) {}
            fs.writeFileSync(changelogFile, content);

            files.forEach(function (file) {
                if (file !== 'config.json') {
                    fs.unlinkSync(changelogPath + '/' + file)
                }
            });
        });
    });

program
    .command('show <version>')
    .description('Show changelog section for version.')
    .action(async function (version) {
        readConfig()
        const changelogVersion = await getChangelogVersion(version)
        if (changelogVersion === null) {
            console.log('No matching version found.')
            process.exit(1);
        }
        console.log(changelogVersion.title)
        console.log(changelogVersion.body)
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

async function getChangelogVersion(version) {
    let data = null;
    await parseChangelog(changelogFile, function (err, result) {
        if (err) throw err

        result.versions.forEach(function (versionParsed) {
            if (version === versionParsed.version) {
                data = versionParsed
            }
        })
    })

    return data
}