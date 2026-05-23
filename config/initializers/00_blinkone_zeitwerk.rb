# frozen_string_literal: true

# lib/blink_one → BlinkOne:: ; app/**/blinkone → BlinkOne::
Rails.autoloaders.each do |autoloader|
  autoloader.inflector.inflect('blinkone' => 'BlinkOne')
end

Rails.autoloaders.main.ignore(Rails.root.join('lib/blinkone'))
