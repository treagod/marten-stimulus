require "marten/cli"

module MartenStimulus
  module CLI
    class Manage
      module Command
        class Stimulus < Marten::CLI::Manage::Command::Base
          command_name :stimulus
          help "Manage Stimulus controllers."

          @subcommand : String?
          @type : String?
          @name : String?

          private CONTROLLERS_DIR         = "src/assets/controllers"
          private MANUAL_INITIALIZER_PATH = "config/initializers/importmap.cr"

          def setup
            on_argument(:subcommand, "Subcommand to execute") do |value|
              @subcommand = value
            end

            on_argument(:type, "Type to generate") do |value|
              @type = value
            end

            on_argument(:name, "Name for the generated entity") do |value|
              @name = value
            end
          end

          def run
            if subcommand.nil?
              print_error_and_exit("Please provide a stimulus subcommand")
            end

            case subcommand
            when "generate"
              run_generate
            else
              print_error_and_exit("Unsupported stimulus subcommand '#{subcommand}'")
            end
          end

          protected def project_root : Path
            Marten.root
          end

          protected def manual_initializer_path : String
            project_root.join(MANUAL_INITIALIZER_PATH).to_s
          end

          private def run_generate
            t = type || ""
            case t
            when "controller"
              n = name || ""
              if n.empty?
                print_error_and_exit("Usage: marten stimulus generate controller <name>")
              end
              run_generate_controller(n)
            else
              print_error_and_exit(
                t.empty? ? "Please provide a generate type" \
                         : "Unknown generate type '#{t}'"
              )
            end
          end

          private def run_generate_controller(name : String)
            print(style("Generating Stimulus controller:", fore: :light_blue, mode: :bold), ending: "\n")

            filename = "#{name}_controller.js"
            path = project_root.join(CONTROLLERS_DIR, filename).to_s

            print(%(› Creating #{style(filename, fore: :cyan, mode: :bold)}...), ending: "")
            if File.exists?(path)
              step_skipped
            else
              Dir.mkdir_p(File.dirname(path))
              File.write(path, build_controller_content(name))
              step_done
            end

            ensure_pin_all_from
          end

          private def ensure_pin_all_from
            print(
              %(› Ensuring #{style(%(pin_all_from "src/assets/controllers"), fore: :cyan, mode: :bold)} in #{MANUAL_INITIALIZER_PATH}...),
              ending: ""
            )

            path = manual_initializer_path
            unless File.exists?(path)
              step_error("#{path} does not exist — run `marten importmap init` first")
            end

            content = File.read(path)
            if content.includes?("pin_all_from")
              step_skipped
              return
            end

            if match = content.match(/^(\s+end\s*\n)(end[^\n]*\n?\z)/m)
              indent = match[1][/^\s+/]? || "  "
              insert_pos = match.begin(0).not_nil!
              pin_all_from_line = %(#{indent}  pin_all_from "src/assets/controllers", under: "controllers"\n)
              modified = content[0, insert_pos] + pin_all_from_line + content[insert_pos..]
              File.write(path, modified)
              step_done
            else
              step_error("Could not locate the draw block end in #{path}")
            end
          end

          private def build_controller_content(name : String) : String
            class_name = name.split('_').map(&.capitalize).join
            String.build do |io|
              io.puts %(import { Controller } from "@hotwired/stimulus")
              io.puts
              io.puts "export default class extends Controller {"
              io.puts "  connect() {"
              io.puts %(    console.log("#{class_name}Controller connected", this.element))
              io.puts "  }"
              io.puts "}"
            end
          end

          private def step_done
            print(style(" DONE", fore: :light_green, mode: :bold))
          end

          private def step_skipped
            print(style(" SKIPPED", fore: :yellow, mode: :bold))
          end

          private def step_error(message : String) : NoReturn
            print(style(" ERROR", fore: :red, mode: :bold))
            print_error_and_exit(message)
          end

          private getter subcommand
          private getter type
          private getter name
        end
      end
    end
  end
end
