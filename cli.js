#!/usr/bin/env node

const meow = require('meow')
const path = require('path');
const fs = require('fs')
const yaml = require('js-yaml')
const {prompt} = require('enquirer');
const sanitize = require("sanitize-filename");

const changelogPath = './.changelogkyper'
const configFile = changelogPath + '/config.json'
const changelogFile = './CHANGELOG.md'
const changelogTypes = ['Added', 'Changed', 'Deprecated','Removed','Fixed','Security']

let config = {};

(async function() {
    const cli = meow(`
  Usage
    $ changelogkyper <init|add|release>
`)

    if (cli.input.length === 0) {
        cli.showHelp(1)
    }

    if (cli.input[0] === 'init') {
        fs.mkdir(changelogPath, { recursive: true }, (err) => {
            if (err) throw err;
        });

        const questions = [
            {
                type: 'input',
                name: 'repo_issues_url',
                message: 'What is your repo url pointing to issues (e.g. https://github.com/floranpagliai/changelogkyper/issues/',
                validate: function (value, state, item, index) {
                    return value !== '';

                }
            }
        ];
        let answers = await prompt(questions);
        const jsonString = JSON.stringify(answers)
        console.log(jsonString);
        fs.writeFileSync(configFile, jsonString)
    }

    try {
        const jsonString = fs.readFileSync(configFile);
        config = JSON.parse(jsonString);
    } catch (e) {
        console.error('changelogkyper need to be initialized.')
        cli.showHelp(1)
    }

    if (cli.input[0] === 'add') {
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
            title = '[#'+answers['id']+']('+config['repo_issues_url'] + answers['id'] +') ' + answers['title']
        }
        let data = {
            title: title,
            type: answers['type']
        };
        let yamlStr = yaml.safeDump(data);
        fs.writeFileSync(changelogPath+'/'+sanitize(answers['title']).replace(/\s/g, '-')+'.yml', yamlStr, 'utf8');
    }

    if (cli.input[0] === 'release') {
        if (typeof cli.input[1] === 'undefined') {
            console.error('No version provided.')
            cli.showHelp(1)
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
            let content = '## [Release ' + cli.input[1] + '] - ' + now.getFullYear() + '-' + now.getMonth() + '-' + now.getDate() + '\n'
            changelogTypes.forEach(function (type) {
                if (changelogs[type].length > 0) {
                    content += '### ' + type + '\n'
                    changelogs[type].forEach(function (changelog){
                        content += '- ' + changelog + '\n'
                    })
                }

            })
            content += '\n'
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

    }
}());
