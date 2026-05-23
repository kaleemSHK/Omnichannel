# frozen_string_literal: true

# BLINKONE: Mailer layout and sender defaults (Wave D)
Rails.application.config.to_prepare do
  ApplicationMailer.class_eval do
    layout 'mailer/blinkone_base'

    default from: lambda {
      name = InstallationConfig.find_by(name: 'INSTALLATION_NAME')&.value || 'BlinkOne'
      email = ENV.fetch('MAILER_SENDER_EMAIL', 'noreply@blinkone.ai')
      "#{name} <#{email}>"
    }
  end
end
