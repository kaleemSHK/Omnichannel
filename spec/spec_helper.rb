# frozen_string_literal: true

require 'rspec'
require_relative '../lib/blink_one/branding'

RSpec.configure do |config|
  config.expect_with :rspec do |c|
    c.syntax = :expect
  end
end
