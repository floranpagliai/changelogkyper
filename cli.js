#!/usr/bin/env node

const meow = require('meow')
const fs = require('fs')
const yaml = require('js-yaml')
const {prompt} = require('enquirer');

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
        fs.mkdir('.changelogs', { recursive: true }, (err) => {
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
        fs.writeFileSync('.changelogs/config.json', jsonString)
    }

    try {
        const jsonString = fs.readFileSync('.changelogs/config.json');
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
                choices: ['Added', 'Changed', 'Deprecated','Removed','Fixed','Security']
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
        fs.writeFileSync('.changelogs/'+answers['title']+'.yml', yamlStr, 'utf8');
    }
}());
