# Changelogkyper

A project to maintain a Changelog automatically and never have a merge conflict again. Allows you to fill in the changes with a prompt command, store it in an unreleased folder and compile all the changes during a release.



---
## Requirements

For development, you will only need Node.js and a node global package.

## Install

```
npm install changelogkyper
```

## Usage

```
npx changelogkyper <command> [options]
```

### First time

When you start use Changelogkyper for the first time on your repo, run the following command:
```
npx changelogkyper init
```

### Add entry

Each time a development is completed and before opening a merge request, run the following command to add a change to the Unreleased folder.
A prompt will ask your the type of change, issue number, and title.
```
npx changelogkyper add
```

### Compile non released changes 

Before releasing a new version, compile non released changes into your changelog file with the following.
```
npx changelogkyper <version>
```

### Show changelog section or unreleased changes

If you need to display changes made in a <version> like 1.0.42, or if you want to see how <unrleased> changes will look like in your changelog. 
```
npx changelogkyper <version|unreleased>
```

### Help

```
npx changelogkyper help [command]
```