# frozen_string_literal: true

namespace :blinkone do
  desc 'Apply BlinkOne branding to InstallationConfig (Wave A)'
  task apply_branding: :environment do
    require Rails.root.join('lib/blink_one/branding')

    yaml_path = Rails.root.join('config/blinkone/branding.yml')
    raw = YAML.safe_load(File.read(yaml_path), permitted_classes: [Symbol], aliases: true)
    defaults = raw['default'] || raw[:default] || {}

    mapping = {
      'INSTALLATION_NAME' => defaults['product_name'] || 'BlinkOne',
      'BRAND_NAME' => defaults['product_name'] || 'BlinkOne',
      'BRAND_URL' => defaults['marketing_url'] || 'https://blinkone.ai',
      'WIDGET_BRAND_URL' => defaults['marketing_url'] || 'https://blinkone.ai',
      'TERMS_URL' => defaults['terms_url'] || 'https://blinkone.ai/terms',
      'PRIVACY_URL' => defaults['privacy_url'] || 'https://blinkone.ai/privacy',
      'LOGO' => '/blinkone-brand/logo-full.svg',
      'LOGO_DARK' => '/blinkone-brand/logo-full-dark.svg',
      'LOGO_THUMBNAIL' => '/blinkone-brand/logo-mark.svg'
    }

    mapping.each do |name, value|
      record = InstallationConfig.find_or_initialize_by(name: name)
      record.value = value
      record.save!
      puts "  #{name} = #{value}"
    end

    GlobalConfig.clear_cache
    puts 'BlinkOne branding applied to InstallationConfig.'
  end
end
