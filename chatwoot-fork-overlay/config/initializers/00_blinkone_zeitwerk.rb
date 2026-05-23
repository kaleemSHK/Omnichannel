# frozen_string_literal: true

Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect('blinkone' => 'BlinkOne')
end

Rails.autoloaders.main.ignore(Rails.root.join('lib/blinkone'))
