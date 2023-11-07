# Thank You, for Every Contribution

Before you commit, please enable the project-specific git-hooks by running:

```shell
git config --local core.hooksPath .githooks/
```

Experience showed that this should be done, even when an app like [Github Desktop](https://desktop.github.com/) installs the hooks for you.
<details>
<summary> Test if the installation was successful </summary>

After running the command, try the fulling dry run of a push to see if the hooks are working:

```shell
git push --dry-run
```

The output should be either an error that `npm` could not be found (if you have not setup that yet), or something like this (it can be that there is an initial copy stage if the working tree is deemd to be unclean):

```text
Linting project (local mode)...

> flowr@1.3.1 lint-local
> npm run lint -- --rule "no-warning-comments: off"

...
```

</details>

If you have any questions, refer to the [wiki](https://github.com/Code-Inspect/flowr/wiki) or just email me at: <florian.sihler@uni-ulm.de>.

## Commit Messages

We structure our commit messages (enforced by our git-hooks) using the format `<type(s)>: <description>`.
Currently, the following types are at your disposal (more may have been or are still available, but please restrict yourself to the following):


| name                                            | description                                                                                        |
|:------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `feat`                                          | Introduced a new feature.                                                                          |
| `test`/`tests`                                  | Introduced new or modified existing tests.                                                         |
| `refactor`                                      | Represents a refactoring of existing code.                                                         |
| `ci`                                            | Updated the ci pipeline of *flowR*.                                                                |
| `docker`                                        | Regards the docker version of *flowR*.                                                             |
| `dep`                                           | Regards the explicit update of dependencies (or the addition of new dependencies.                  |
| `git`                                           | Performed something git-specific (like updating the git-hooks).                                    |
| `lint`                                          | Adapted or updated linter-issues.                                                                  |
| `doc`                                           | Updated the documentation of *flowR*.                                                              |
| `typo`                                          | Dealt with a small typo/a grammatical mistake.                                                     |
| `log`                                           | Improved or updated the logging of *flowR*.                                                        |
| `ts`                                            | Performed something typescript-specific (e.g., reconfigured the `tsconfig.json`).                  |
| `wip`                                           | *Use this only in combination with another type*. It marks the commit to be unfinished.            |
| `special`                                       | *Use this only if none of the other categories apply*. Explain the details in your commit message. |

You can suffix each type with either

* `-fix` to denote that you fixed the respective type (this is potentially redundant when used in combination with a type like `typo` and can be omitted there)
* `-fail` to denote an expected failure of the corresponding addition (usually combined with `wip` because the corresponding feature or test ist not completed yet)

Furthermore, types can be combined with a comma followed by an optional space.
Although you can give the same type repeatedly - if you think you should, please consider splitting the commit into multiple smaller commits.


With this, the artificial message

> `feat, test-fix: Support for branching in dataflow, fixed branching-test`

represents the addition of a new feature and the fix of a corresponding test.

To skip the `ci`, you can prefix the commit message with `[skip ci]`.


## Coding Style and ToDo Comments

All the basic style conventions are defined inside the `package.json` (with the help of the `eslint` package). Please make sure to adhere to them.

As indicated by [#238](https://github.com/Code-Inspect/flowr/issues/238) I decided to forbid `TODO`, `FIXME`, and `XXX` comments in code in favor of explicit *issues* directly on GitHub. Please do not try to get around that rule.

## Releases

Releases are to be scheduled by the administrators of the repository. Please do not try to create a release yourself.

