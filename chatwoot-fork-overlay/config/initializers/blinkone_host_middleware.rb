# frozen_string_literal: true

# BLINKONE: Insert host resolver before Rails stack (Prompt 8).
Rails.application.config.middleware.use BlinkoneHostResolver if defined?(BlinkoneHostResolver)
