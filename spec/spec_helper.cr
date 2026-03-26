ENV["MARTEN_ENV"] = "test"

require "spec"

require "marten"
require "marten/spec"
require "sqlite3"

require "../src/marten_stimulus"
require "../src/marten_stimulus/cli"
require "./support/import_map"

module Marten
  @@assets = Asset::Engine.new(
    Core::Storage::FileSystem.new(Dir.tempdir, "/assets")
  )
end

Spec.before_each do
  reset_import_map
end
