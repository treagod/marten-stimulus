require "../../../../spec_helper"
require "file_utils"

module MartenStimulus::CLI::Manage::Command::StimulusSpec
  class TestStimulusCommand < MartenStimulus::CLI::Manage::Command::Stimulus
    DEFAULT_MANUAL_INITIALIZER_CONTENT = <<-CRYSTAL
      Marten.configure do |config|
        config.importmap.draw do
          pin "application", "application.js"
        end
      end
      CRYSTAL

    @@project_root = File.join(Dir.tempdir, "marten_stimulus_spec_project")

    def self.project_root
      @@project_root
    end

    def self.manual_initializer_path
      File.join(@@project_root, "config/initializers/importmap.cr")
    end

    def self.controllers_dir
      File.join(@@project_root, "src/assets/controllers")
    end

    def self.reset!
      prepare_project!
    end

    def self.prepare_project!(
      manual_initializer_content : String? = DEFAULT_MANUAL_INITIALIZER_CONTENT,
    )
      FileUtils.rm_rf(@@project_root)

      if manual_initializer_content
        path = manual_initializer_path
        Dir.mkdir_p(File.dirname(path))
        File.write(path, manual_initializer_content)
      end
    end

    protected def project_root : Path
      Path.new(@@project_root)
    end

    protected def manual_initializer_path : String
      self.class.manual_initializer_path
    end
  end
end

describe MartenStimulus::CLI::Manage::Command::Stimulus do
  around_each do |test|
    MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.reset!
    test.run
  end

  describe "::command_name" do
    it "is exposed as the stimulus command" do
      MartenStimulus::CLI::Manage::Command::Stimulus.command_name.should eq "stimulus"
    end
  end

  describe "#run" do
    context "generate controller" do
      it "creates a controller file with the correct content" do
        stdout = IO::Memory.new
        stderr = IO::Memory.new

        command = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.new(
          options: ["generate", "controller", "hello"],
          stdout: stdout,
          stderr: stderr
        )
        command.handle

        output = stdout.rewind.gets_to_end
        output.includes?("Generating Stimulus controller:").should be_true
        output.includes?("DONE").should be_true

        controller_path = File.join(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.controllers_dir,
          "hello_controller.js"
        )
        File.exists?(controller_path).should be_true

        content = File.read(controller_path)
        content.includes?(%(import { Controller } from "@hotwired/stimulus")).should be_true
        content.includes?("export default class extends Controller").should be_true
        content.includes?("HelloController connected").should be_true

        stderr.rewind.gets_to_end.should be_empty
      end

      it "capitalises multi-word names correctly" do
        stdout = IO::Memory.new
        stderr = IO::Memory.new

        command = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.new(
          options: ["generate", "controller", "my_form"],
          stdout: stdout,
          stderr: stderr
        )
        command.handle

        controller_path = File.join(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.controllers_dir,
          "my_form_controller.js"
        )
        content = File.read(controller_path)
        content.includes?("MyFormController connected").should be_true
      end

      it "skips creating a controller file that already exists" do
        # Pre-create the file
        controllers_dir = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.controllers_dir
        Dir.mkdir_p(controllers_dir)
        existing_path = File.join(controllers_dir, "hello_controller.js")
        File.write(existing_path, "// existing")

        stdout = IO::Memory.new
        stderr = IO::Memory.new

        command = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.new(
          options: ["generate", "controller", "hello"],
          stdout: stdout,
          stderr: stderr
        )
        command.handle

        output = stdout.rewind.gets_to_end
        output.includes?("SKIPPED").should be_true
        File.read(existing_path).should eq "// existing"
      end

      it "inserts pin_all_from into importmap.cr when missing" do
        stdout = IO::Memory.new
        stderr = IO::Memory.new

        command = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.new(
          options: ["generate", "controller", "hello"],
          stdout: stdout,
          stderr: stderr
        )
        command.handle

        content = File.read(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        )
        content.includes?(%(pin_all_from "src/assets/controllers", under: "controllers")).should be_true
      end

      it "skips pin_all_from insertion when already present" do
        MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.prepare_project!(
          manual_initializer_content: <<-CRYSTAL
            Marten.configure do |config|
              config.importmap.draw do
                pin "application", "application.js"
                pin_all_from "src/assets/controllers", under: "controllers"
              end
            end
            CRYSTAL
        )

        stdout = IO::Memory.new
        stderr = IO::Memory.new

        command = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.new(
          options: ["generate", "controller", "hello"],
          stdout: stdout,
          stderr: stderr
        )
        command.handle

        output = stdout.rewind.gets_to_end
        # pin_all_from step should be skipped
        output.scan("SKIPPED").size.should be >= 1
      end
    end
  end
end
