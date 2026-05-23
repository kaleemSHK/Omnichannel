# frozen_string_literal: true

# BLINKONE: Load brand tokens at boot (Chatwoot fork)
require Rails.root.join('lib/blink_one/branding')

BlinkOne::Branding.reload! if Rails.env.development?

Rails.application.config.to_prepare do
  BlinkOne::Branding.reload! if Rails.env.development?
end
