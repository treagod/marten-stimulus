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
          private CONTROLLER_PIN_ALL_FROM_PATTERN = /
            pin_all_from
            (?:
              [\t ]+"src\/assets\/controllers"[\t ]*,[^\n]*\bunder:[\t ]*"controllers"
              |
              \s*\(
                \s*"src\/assets\/controllers"\s*,
                [^)]*\bunder:\s*"controllers"
                [^)]*
              \)
            )
          /x

          private record ControllerGenerationPlan,
            filename : String,
            controller_path : String,
            controller_content : String,
            initializer_path : String,
            initializer_content : String?

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
            plan = preflight_controller_generation(name)

            print(style("Generating Stimulus controller:", fore: :light_blue, mode: :bold), ending: "\n")

            apply_controller_generation(plan)
          end

          private def preflight_controller_generation(name : String) : ControllerGenerationPlan
            filename = "#{name}_controller.js"
            controllers_path = project_root.join(CONTROLLERS_DIR).expand
            controller_path = controllers_path.join(filename).expand
            relative_controller_path = controller_path.relative_to?(controllers_path)

            if relative_controller_path.nil? || relative_controller_path.each_part.any? { |part| part == ".." }
              print_error_and_exit("Controller name '#{name}' resolves outside #{CONTROLLERS_DIR}")
            end

            initializer_path = manual_initializer_path
            unless File.exists?(initializer_path)
              print_error_and_exit("#{initializer_path} does not exist — run `marten importmap init` first")
            end

            initializer_content = File.read(initializer_path)
            modified_initializer_content = if controller_pin_all_from_configured?(initializer_content)
                                             nil
                                           else
                                             build_modified_initializer_content(initializer_content, initializer_path)
                                           end

            ControllerGenerationPlan.new(
              filename: filename,
              controller_path: controller_path.to_s,
              controller_content: build_controller_content(name),
              initializer_path: initializer_path,
              initializer_content: modified_initializer_content
            )
          end

          private def build_modified_initializer_content(content : String, path : String) : String
            if match = content.match(/^(\s+end\s*\n)(end[^\n]*\n?\z)/m)
              indent = match[1][/^\s+/]? || "  "
              insert_pos = match.begin(0).not_nil!
              pin_all_from_line = %(#{indent}  pin_all_from "src/assets/controllers", under: "controllers"\n)
              content[0, insert_pos] + pin_all_from_line + content[insert_pos..]
            else
              print_error_and_exit("Could not locate the draw block end in #{path}")
            end
          end

          private def apply_controller_generation(plan : ControllerGenerationPlan)
            print(%(› Creating #{style(plan.filename, fore: :cyan, mode: :bold)}...), ending: "")

            if File.exists?(plan.controller_path)
              step_skipped
            else
              Dir.mkdir_p(File.dirname(plan.controller_path))
              File.write(plan.controller_path, plan.controller_content)
              step_done
            end

            print(
              %(› Ensuring #{style(%(pin_all_from "src/assets/controllers"), fore: :cyan, mode: :bold)} in #{MANUAL_INITIALIZER_PATH}...),
              ending: ""
            )

            if initializer_content = plan.initializer_content
              File.write(plan.initializer_path, initializer_content)
              step_done
            else
              step_skipped
            end
          end

          private def controller_pin_all_from_configured?(content : String) : Bool
            !content.match(CONTROLLER_PIN_ALL_FROM_PATTERN).nil?
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

          private getter subcommand
          private getter type
          private getter name
        end
      end
    end
  end
end
