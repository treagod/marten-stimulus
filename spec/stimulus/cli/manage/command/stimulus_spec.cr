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

    def self.run_generate_controller(name = "hello")
      stdout = IO::Memory.new
      stderr = IO::Memory.new

      command = new(
        options: ["generate", "controller", name],
        stdout: stdout,
        stderr: stderr
      )
      command.handle

      {stdout.rewind.gets_to_end, stderr.rewind.gets_to_end}
    end

    def self.run_generate_controller_with_exit(name = "hello")
      stdout = IO::Memory.new
      stderr = IO::Memory.new

      command = new(
        options: ["generate", "controller", name],
        stdout: stdout,
        stderr: stderr,
        exit_raises: true
      )
      exit_code = command.handle

      {
        exit_code: exit_code,
        stdout:    stdout.rewind.gets_to_end,
        stderr:    stderr.rewind.gets_to_end,
      }
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

        initializer_content = File.read(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        )
        initializer_content.includes?(
          %(pin_all_from "src/assets/controllers", under: "controllers")
        ).should be_true

        stderr.rewind.gets_to_end.should be_empty
      end

      it "does not create a controller when the importmap initializer is missing" do
        MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.prepare_project!(
          manual_initializer_content: nil
        )

        result = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand
          .run_generate_controller_with_exit

        result[:exit_code].should eq 1
        result[:stderr].includes?("does not exist").should be_true
        Dir.exists?(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.controllers_dir
        ).should be_false
      end

      it "does not create a controller when the importmap initializer is malformed" do
        initializer_content = <<-CRYSTAL
          Marten.configure do |config|
            config.importmap.draw do
              pin "application", "application.js"
          CRYSTAL
        MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.prepare_project!(
          manual_initializer_content: initializer_content
        )

        result = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand
          .run_generate_controller_with_exit

        result[:exit_code].should eq 1
        result[:stderr].includes?("Could not locate the draw block end").should be_true
        Dir.exists?(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.controllers_dir
        ).should be_false
        File.read(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        ).should eq initializer_content
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
        initializer_content = <<-CRYSTAL
          Marten.configure do |config|
            config.importmap.draw do
              pin "application", "application.js"
              pin_all_from "src/assets/controllers", under: "controllers"
            end
          end
          CRYSTAL
        MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.prepare_project!(
          manual_initializer_content: initializer_content
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
        File.read(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        ).should eq initializer_content
      end

      it "recognizes a multiline controller pin_all_from directive" do
        initializer_content = <<-CRYSTAL
          Marten.configure do |config|
            config.importmap.draw do
              pin "application", "application.js"
              pin_all_from(
                "src/assets/controllers",
                under: "controllers"
              )
            end
          end
          CRYSTAL
        MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.prepare_project!(
          manual_initializer_content: initializer_content
        )

        _, stderr = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.run_generate_controller

        stderr.should be_empty
        File.read(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        ).should eq initializer_content
      end

      it "recognizes a controller pin_all_from directive with additional arguments" do
        initializer_content = <<-CRYSTAL
          Marten.configure do |config|
            config.importmap.draw do
              pin "application", "application.js"
              pin_all_from(
                "src/assets/controllers",
                under: "controllers",
                preload: false
              )
            end
          end
          CRYSTAL
        MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.prepare_project!(
          manual_initializer_content: initializer_content
        )

        _, stderr = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.run_generate_controller

        stderr.should be_empty
        File.read(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        ).should eq initializer_content
      end

      it "inserts the controller directive when a different directory is pinned" do
        initializer_content = <<-CRYSTAL
          Marten.configure do |config|
            config.importmap.draw do
              pin "application", "application.js"
              pin_all_from "src/assets/components", under: "components"
            end
          end
          CRYSTAL
        MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.prepare_project!(
          manual_initializer_content: initializer_content
        )

        _, stderr = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.run_generate_controller

        stderr.should be_empty
        content = File.read(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        )
        content.includes?(%(pin_all_from "src/assets/components", under: "components")).should be_true
        content.includes?(%(pin_all_from "src/assets/controllers", under: "controllers")).should be_true
      end

      it "inserts the controller directive when the controllers directory uses a different namespace" do
        initializer_content = <<-CRYSTAL
          Marten.configure do |config|
            config.importmap.draw do
              pin "application", "application.js"
              pin_all_from "src/assets/controllers", under: "stimulus"
            end
          end
          CRYSTAL
        MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.prepare_project!(
          manual_initializer_content: initializer_content
        )

        _, stderr = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.run_generate_controller

        stderr.should be_empty
        content = File.read(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        )
        content.includes?(%(pin_all_from "src/assets/controllers", under: "stimulus")).should be_true
        content.includes?(%(pin_all_from "src/assets/controllers", under: "controllers")).should be_true
      end

      it "does not combine arguments from unrelated pin_all_from directives" do
        initializer_content = <<-CRYSTAL
          Marten.configure do |config|
            config.importmap.draw do
              pin "application", "application.js"
              pin_all_from "src/assets/controllers", under: "stimulus"
              pin_all_from "other/controllers", under: "controllers"
              pin_all_from "src/assets/components", under: "components"
            end
          end
          CRYSTAL
        MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.prepare_project!(
          manual_initializer_content: initializer_content
        )

        _, stderr = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.run_generate_controller

        stderr.should be_empty
        content = File.read(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        )
        content.includes?(%(pin_all_from "src/assets/controllers", under: "controllers")).should be_true
        content.scan("pin_all_from").size.should eq 4
      end

      it "is idempotent when generating the same controller twice" do
        _, first_stderr = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand
          .run_generate_controller
        first_stderr.should be_empty

        controller_path = File.join(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.controllers_dir,
          "hello_controller.js"
        )
        initializer_path = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        controller_content = File.read(controller_path)
        initializer_content = File.read(initializer_path)

        second_stdout, second_stderr = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand
          .run_generate_controller

        second_stderr.should be_empty
        second_stdout.scan("SKIPPED").size.should eq 2
        File.read(controller_path).should eq controller_content
        File.read(initializer_path).should eq initializer_content
      end

      it "rejects a controller name that escapes the controllers directory" do
        initializer_path = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.manual_initializer_path
        initializer_content = File.read(initializer_path)
        escaped_path = File.join(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.project_root,
          "escaped_controller.js"
        )

        result = MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand
          .run_generate_controller_with_exit("../../../escaped")

        result[:exit_code].should eq 1
        result[:stderr].includes?("resolves outside src/assets/controllers").should be_true
        Dir.exists?(
          MartenStimulus::CLI::Manage::Command::StimulusSpec::TestStimulusCommand.controllers_dir
        ).should be_false
        File.exists?(escaped_path).should be_false
        File.read(initializer_path).should eq initializer_content
      end
    end
  end
end
