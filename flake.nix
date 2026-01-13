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
          lib,
          ...
        }:
        {
          packages = rec {
            default = flowR;
            flowR = pkgs.buildNpmPackage {
              name = "flowR";
              src = ./.;
              npmBuildScript = "build";
              npmDeps = pkgs.importNpmLock {
                npmRoot = ./.;
              };
              npmConfigHook = pkgs.importNpmLock.npmConfigHook;
              nativeBuildInputs = with pkgs; [
                makeWrapper
              ];
              installPhase = ''
                mkdir -p $out/{share/flowR,bin}

                mv dist/src $out/share/flowR/src
                ln -s "${
                  pkgs.importNpmLock.buildNodeModules {
                    npmRoot = ./.;
                    inherit (pkgs) nodejs;
                  }
                }/node_modules" $out/share/flowR/node_modules

                echo "#!${lib.getExe pkgs.bashNonInteractive}" >> $out/bin/flowR
                echo "cd $out/share/flowR" >> $out/bin/flowR
                echo "exec ${lib.getExe pkgs.nodejs} $out/share/flowR/src/cli/flowr.js \"\$@\"" >> $out/bin/flowR
                chmod +x $out/bin/flowR
                wrapProgram $out/bin/flowR --set PATH ${lib.makeBinPath (with pkgs; [ R ])}
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
              just
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
