# Thank You, for Every Contribution

Before you commit, please enable the project-specific git-hooks by running:

```shell
git config --local core.hooksPath .githooks/
```

If you have any questions, refer to the [wiki](https://github.com/Code-Inspect/flowr/wiki) or just send me a mail at: <florian.sihler@uni-ulm.de>.


## Commit Messages

We structure our commit messages (enforced by our git-hooks) using the format `<type(s)>: <description>`.
Currently, the following types are at your disposal (more may have been or are still available, but please restrict yourself to the following):


| name           | description                                                                                        |
|:---------------|----------------------------------------------------------------------------------------------------|
| `feat`         | Introduced a new feature.                                                                          |
| `test`/`tests` | Introduced new or modified existing tests.                                                         | 
| `refactor`     | Represents a refactoring of existing code.                                                         |
| `ci`           | Updated the ci pipeline of *flowR*.                                                                |
| `git`          | Performed something git-specific (like updating the git-hooks).                                    |
| `lint`         | Adapted or updated linter-issues.                                                                  |
| `doc`          | Updated the documentation of *flowR*.                                                              |
| `typo`         | Dealt with a small typo/a grammatical mistake.                                                     |
| `log`          | Improved or updated the logging of *flowR*.                                                        |
| `ts`           | Performed something typescript-specific (e.g., reconfigured the `tsconfig.json`).                  |
| `wip`          | *Use this only in combination with another type*. It marks the commit to be unfinished.            |
| `special`      | *Use this only if none of the other categories apply*. Explain the details in your commit message. |


You can suffix each type with either 

* `-fix` to denote that you fixed the respective type (this is potentially redundant when used in combination with a type like `typo` and can be omitted there)  
* `-fail` to denote an expected failure of the corresponding addition (usually combined with `wip` because the corresponding feature or test ist not completed yet)

Furthermore, types can be combined with a comma followed by an optional space.
Although you can give the same type repeatedly - if you think you should, please consider splitting the commit into multiple smaller commits.


With this, the artificial message

> `feat, test-fix: Support for branching in dataflow, fixed branching-test`
 
represents the addition of a new feature and the fix of a corresponding test.  

