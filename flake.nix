{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
    treefmt-nix.url = "github:numtide/treefmt-nix";
    git-hooks-nix.url = "github:cachix/git-hooks.nix";
  };

  outputs =
    inputs@{ nixpkgs, ... }:
    inputs.flake-parts.lib.mkFlake { inherit inputs; } {
      systems = nixpkgs.lib.systems.flakeExposed;

      flake.description = "Sophisticated static program analysis framework for the R programming language.";

      imports = with inputs; [
        treefmt-nix.flakeModule
        git-hooks-nix.flakeModule
      ];

      perSystem =
        {
          config,
          pkgs,
          ...
        }:
        {
          packages = rec {
            default = flowR;
            flowR = pkgs.buildNpmPackage {
              name = "flowR";
              src = ./.;
              npmBuildScript = "build:bundle-flowr";
              npmDeps = pkgs.importNpmLock {
                npmRoot = ./.;
              };
              npmConfigHook = pkgs.importNpmLock.npmConfigHook;
              installPhase = ''
                mkdir -p $out/{share/flowR,bin}
                mv dist/src $out/share/flowR/src
                mv dist/node_modules $out/share/flowR/node_modules
                echo "#!/usr/bin/env sh" >> $out/bin/flowR
                echo "${pkgs.nodejs}/bin/node $out/share/flowR/src/cli/flowr.min.js" >> $out/bin/flowR
                chmod +x $out/bin/flowR
              '';
            };
          };

          devShells.default = pkgs.mkShell {
            shellHook = ''
              ${config.pre-commit.installationScript}
            '';

            packages = with pkgs; [
              nodejs
              typescript-language-server
              R
            ];
          };

          pre-commit.settings.hooks = {
            treefmt.enable = true;
            eslint.enable = true;
          };

          treefmt = {
            projectRootFile = "flake.nix";
            programs = {
              nixfmt.enable = true;
              just.enable = true;
            };
          };
        };
    };
}
