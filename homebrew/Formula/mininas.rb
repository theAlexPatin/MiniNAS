class Mininas < Formula
  desc "Personal NAS - turn any Mac into a cloud storage server"
  homepage "https://github.com/theAlexPatin/MiniNAS"
  url "https://github.com/theAlexPatin/MiniNAS/archive/refs/tags/v0.1.0.tar.gz"
  sha256 "PLACEHOLDER"
  license "MIT"

  depends_on "node@22"
  depends_on "pnpm"
  depends_on "ffmpeg" => :recommended

  def install
    system "pnpm", "install", "--frozen-lockfile"
    system "pnpm", "build"

    # Install bundled JS + schema
    libexec.install "packages/api/dist/index.js" => "server.js"
    libexec.install "packages/api/dist/cli.js"
    libexec.install "packages/api/dist/schema.sql"

    # Install web static assets
    (libexec/"web").install Dir["packages/web/dist/*"]

    # Install node_modules for native addons (better-sqlite3, sharp)
    cd "packages/api" do
      system "pnpm", "install", "--prod", "--frozen-lockfile"
      libexec.install "node_modules"
    end

    # CLI wrapper script
    (bin/"mininas").write <<~EOS
      #!/bin/bash
      export NODE_PATH="#{libexec}/node_modules"
      export WEB_DIST_DIR="#{libexec}/web"
      export MININAS_VERSION="#{version}"
      exec "#{Formula["node@22"].opt_bin}/node" "#{libexec}/cli.js" "$@"
    EOS
  end

  def post_install
    # Create dirs (idempotent)
    (Pathname.new("#{Dir.home}/.mininas/data")).mkpath
    (Pathname.new("#{Dir.home}/.mininas/logs")).mkpath

    # Generate config with random secrets if none exists
    config_file = Pathname.new("#{Dir.home}/.mininas/config.json")
    unless config_file.exist?
      require "securerandom"
      config = {
        "SESSION_SECRET" => SecureRandom.hex(32),
        "CLI_SECRET" => SecureRandom.hex(32),
        "RP_NAME" => "MiniNAS",
      }
      config_file.write(JSON.generate(config))
    end
  end

  service do
    run [opt_bin/"mininas", "server"]
    keep_alive true
    log_path var/"log/mininas.log"
    error_log_path var/"log/mininas-error.log"
    environment_variables(
      WEB_DIST_DIR: "#{opt_libexec}/web",
      MININAS_VERSION: version.to_s,
      NODE_PATH: "#{opt_libexec}/node_modules"
    )
  end

  def caveats
    <<~EOS
      To get started:
        mininas setup

      To start the server:
        brew services start mininas

      Data is stored in ~/.mininas/
      To completely remove data: mininas uninstall
    EOS
  end
end
