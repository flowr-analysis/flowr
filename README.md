[![flowR logo](https://raw.githubusercontent.com/wiki/flowr-analysis/flowr/img/flowR.png)](https://github.com/flowr-analysis/flowr/wiki)\
[![QA (and potentially deploy)](https://github.com/flowr-analysis/flowr/actions/workflows/qa.yaml/badge.svg)](https://github.com/flowr-analysis/flowr/actions/workflows/qa.yaml)
[![codecov](https://codecov.io/gh/flowr-analysis/flowr/graph/badge.svg)](https://codecov.io/gh/flowr-analysis/flowr)
[![Docker Image Version (latest semver)](https://img.shields.io/docker/v/eagleoutice/flowr?logo=docker&logoColor=white&label=dockerhub)](https://hub.docker.com/r/eagleoutice/flowr)
[![latest tag](https://badgen.net/github/tag/flowr-analysis/flowr?label=latest&color=purple)](https://github.com/flowr-analysis/flowr/releases/latest)
[![Marketplace](https://badgen.net/vs-marketplace/v/code-inspect.vscode-flowr)](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr)
[![DOI](https://zenodo.org/badge/624819038.svg)](https://zenodo.org/doi/10.5281/zenodo.13319290)

_flowR_ is a static [dataflow analyzer](https://en.wikipedia.org/wiki/Data-flow_analysis) for the [_R_](https://www.r-project.org/) programming language (tested for versions `4.x` and `3.6.x`)
It offers a wide variety of features, ranging from [program slicing](https://github.com/flowr-analysis/flowr/wiki/Terminology#program-slice) to [dependency analysis](https://github.com/flowr-analysis/flowr/wiki/Query-API#dependencies-query).

You can get and use _flowR_ as a [Visual Studio Code extension](https://marketplace.visualstudio.com/items?itemName=code-inspect.vscode-flowr), 
[RStudio Addin](https://github.com/flowr-analysis/rstudio-addin-flowr), 
[R package](https://github.com/flowr-analysis/flowr-r-adapter), and as a 
[Docker image](https://hub.docker.com/r/eagleoutice/flowr).

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

For more details on how to use _flowR_ please refer to the [wiki pages](https://github.com/flowr-analysis/flowr/wiki),
as well as the deployed [code documentation](https://flowr-analysis.github.io/flowr/doc/).

## 🚀 Contributing

We welcome every contribution! Please check out the [contributing guidelines](https://github.com/flowr-analysis/flowr/tree/main/.github/CONTRIBUTING.md) for more information.

### Contributors

<a href="https://github.com/flowr-analysis/flowr/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=flowr-analysis/flowr"  alt="flowR Contributors"/>
</a>

----

*flowr* is actively developed by *Florian Sihler* (contact at: <florian.sihler@uni-ulm.de>) under the
[GPLv3 License](LICENSE).

----
