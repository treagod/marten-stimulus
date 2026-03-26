module MartenStimulus
  class App < Marten::App
    label "marten_stimulus"

    def setup
      Marten.settings.importmap.draw do
        pin "stimulus-loading", "stimulus-loading.js"
      end
    end
  end
end
