There are two main ways to use *flowR*.
You can download and build it from source, or download the accompanying docker image.

<!-- TOC -->
- [🐳️ Using the Docker Image](#️-using-the-docker-image)
- [⚒️ Building From Scratch](#️-building-from-scratch)
- [📜 Developing for *flowR*](#-developing-for-flowr)
<!-- TOC -->

## 🐳️ Using the Docker Image

You can get the image from [docker hub](https://hub.docker.com/r/eagleoutice/flowr) by running:

```shell
docker pull eagleoutice/flowr
```

Afterward, you can test if the installation was successful by running the following (currently, there is no helper script for that):

```shell
docker run -it --rm flowr
```

This should drop you into *flowR*'s read-evaluate-print loop.
Enter `:help` to receive more information and `:quit` to leave.
Please remember, that you have to link external directories to make them available within the running container:


## ⚒️ Building From Scratch

To use *flowR*, you need [*R*](https://www.r-project.org/) installed and on your path.
Although there are several ways to do so, there is nothing wrong with installing&nbsp;R with the help of your favorite package manager or directly from the [website](https://cloud.r-project.org/).<a href="#note1" id="note1ref"><sup>&lt;1&gt;</sup></a>

Furthermore, you need the [node package manager](https://www.npmjs.com/) (for Linux, we recommend using [nvm](https://github.com/nvm-sh/nvm)).

After cloning the repository, you can install the dependencies with:

```shell
npm i
```

After that, you should be fine! You may test *flowR* by running:

```shell
npm run slicer -- --criterion "12@product" test/testfiles/example.R
```

The output should look similar to this:

```R
product <- 1
N <- 10
for(i in 1:(N-1)) product <- product * i
cat("Product:", product, "\n")
```


At the time of writing this, there is currently no page for frequently encountered errors. So just [message me](mailto:florian.sihler@uni-ulm.de) in case of problems.

## 📜 Developing for *flowR*

If you want to develop for *flowR*, see the [core](https://github.com/Code-Inspect/flowr/wiki/Core) wiki page.
For details on *how* to contribute, please refer to the [CONTRIBUTING.md](https://github.com/Code-Inspect/flowr/blob/main/CONTRIBUTING.md) in the repository.

-----
<a id="note1" href="#note1ref">&lt;1&gt;</a>: Currently, *flowR* is only tested with R version  `4.3.1 (2023-06-16) -- "Beagle Scouts"`
