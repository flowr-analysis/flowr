[![flowR logo](https://raw.githubusercontent.com/wiki/flowr-analysis/flowr/img/flowR.png)](https://github.com/flowr-analysis/flowr/wiki)\
[![QA (and potentially deploy)](https://github.com/flowr-analysis/flowr/actions/workflows/qa.yaml/badge.svg)](https://github.com/flowr-analysis/flowr/actions/workflows/qa.yaml) [![codecov](https://codecov.io/gh/flowr-analysis/flowr/graph/badge.svg)](https://codecov.io/gh/flowr-analysis/flowr) [![Docker Image Version (latest semver)](https://img.shields.io/docker/v/eagleoutice/flowr?logo=docker&logoColor=white&label=dockerhub)](https://hub.docker.com/r/eagleoutice/flowr) [![latest tag](https://badgen.net/github/tag/flowr-analysis/flowr?label=latest&color=purple)](https://github.com/flowr-analysis/flowr/releases/latest) [![Marketplace](https://badgen.net/vs-marketplace/v/code-inspect.vscode-flowr)](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr) [![All Contributors](https://img.shields.io/github/all-contributors/flowr-analysis/flowr)](#contributors)
[![DOI](https://zenodo.org/badge/624819038.svg)](https://zenodo.org/doi/10.5281/zenodo.13319290)

_flowR_ is a static [dataflow analyzer](https://en.wikipedia.org/wiki/Data-flow_analysis) and [program slicer](https://github.com/flowr-analysis/flowr/wiki/Terminology#program-slice) for the [_R_](https://www.r-project.org/) programming language (currently tested for versions `4.x` and `3.6.x`). You can get and use _flowR_ as a [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr), [RStudio Addin](https://github.com/flowr-analysis/rstudio-addin-flowr), [R package](https://github.com/flowr-analysis/flowr-r-adapter), and as a [Docker image](https://hub.docker.com/r/eagleoutice/flowr).

## ⭐ Getting Started

To get started with _flowR_ and its features, please check out the [Overview](https://github.com/flowr-analysis/flowr/wiki/Overview) page. The [Setup](https://github.com/flowr-analysis/flowr/wiki/Setup) wiki page explains how you can download and setup _flowR_ on your system. With docker&nbsp;🐳️, the following line should be enough (and drop you directly into the read-eval-print loop):

```shell
docker run -it --rm eagleoutice/flowr
```

You can enter `:help` to gain more information on its capabilities.

<details>

<summary>Example REPL session</summary>

![Example of a simple REPL session](wiki/gif/repl-demo.gif)

</details>

## 📜 More Information

For more details on how to use _flowR_ please refer to the the [wiki pages](https://github.com/flowr-analysis/flowr/wiki), as well as the deployed [code documentation](https://flowr-analysis.github.io/flowr/doc/).

## 🚀 Contributing

We welcome every contribution! Please check out the [contributing guidelines](https://github.com/flowr-analysis/flowr/tree/main/.github/CONTRIBUTING.md) for more information.

### Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!--suppress ALL -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/EagleoutIce"><img src="https://avatars.githubusercontent.com/u/9303573?v=4?s=100" width="100px;" alt="Florian Sihler"/><br /><sub><b>Florian Sihler</b></sub></a><br /><a href="https://github.com/flowr-analysis/flowr/commits?author=EagleoutIce" title="Code">💻</a> <a href="#ideas-EagleoutIce" title="Ideas, Planning, & Feedback">🤔</a> <a href="#maintenance-EagleoutIce" title="Maintenance">🚧</a> <a href="#projectManagement-EagleoutIce" title="Project Management">📆</a> <a href="#research-EagleoutIce" title="Research">🔬</a> <a href="https://github.com/flowr-analysis/flowr/commits?author=EagleoutIce" title="Tests">⚠️</a> <a href="#talk-EagleoutIce" title="Talks">📢</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://ellpeck.de/"><img src="https://avatars.githubusercontent.com/u/5741138?v=4?s=100" width="100px;" alt="Ell"/><br /><sub><b>Ell</b></sub></a><br /><a href="https://github.com/flowr-analysis/flowr/commits?author=Ellpeck" title="Code">💻</a> <a href="#maintenance-Ellpeck" title="Maintenance">🚧</a> <a href="https://github.com/flowr-analysis/flowr/commits?author=Ellpeck" title="Tests">⚠️</a> <a href="#plugin-Ellpeck" title="Plugin/utility libraries">🔌</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://lukas.pietzschmann.org/"><img src="https://avatars.githubusercontent.com/u/49213919?v=4?s=100" width="100px;" alt="Lukas Pietzschmann"/><br /><sub><b>Lukas Pietzschmann</b></sub></a><br /><a href="https://github.com/flowr-analysis/flowr/commits?author=LukasPietzschmann" title="Code">💻</a> <a href="https://github.com/flowr-analysis/flowr/commits?author=LukasPietzschmann" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/bjthehun"><img src="https://avatars.githubusercontent.com/u/38729215?v=4?s=100" width="100px;" alt="Benedikt Jutz"/><br /><sub><b>Benedikt Jutz</b></sub></a><br /><a href="https://github.com/flowr-analysis/flowr/commits?author=bjthehun" title="Code">💻</a> <a href="https://github.com/flowr-analysis/flowr/commits?author=bjthehun" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Core5563"><img src="https://avatars.githubusercontent.com/u/140061253?v=4?s=100" width="100px;" alt="Core5563"/><br /><sub><b>Core5563</b></sub></a><br /><a href="https://github.com/flowr-analysis/flowr/commits?author=Core5563" title="Code">💻</a> <a href="https://github.com/flowr-analysis/flowr/commits?author=Core5563" title="Tests">⚠️</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Ehcsan"><img src="https://avatars.githubusercontent.com/u/68707578?v=4?s=100" width="100px;" alt="Ehcsan"/><br /><sub><b>Ehcsan</b></sub></a><br /><a href="https://github.com/flowr-analysis/flowr/commits?author=Ehcsan" title="Code">💻</a> <a href="https://github.com/flowr-analysis/flowr/commits?author=Ehcsan" title="Tests">⚠️</a></td>
    </tr>
  </tbody>
  <tfoot>
    <tr>
      <td align="center" size="13px" colspan="7">
        <img src="https://raw.githubusercontent.com/all-contributors/all-contributors-cli/1b8533af435da9854653492b1327a23a4dbd0a10/assets/logo-small.svg">
          <a href="https://all-contributors.js.org/docs/en/bot/usage">Add your contributions</a>
        </img>
      </td>
    </tr>
  </tfoot>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

----

*flowr* is actively developed by *Florian Sihler* (contact at: <florian.sihler@uni-ulm.de>) under the
[GPLv3 License](LICENSE).

----
