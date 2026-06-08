token = ENV['IG_VERIFY_TOKEN'] || 'blinkone_ig_2026'
cfg = InstallationConfig.find_or_initialize_by(name: 'IG_VERIFY_TOKEN')
cfg.value = token
cfg.locked = false
cfg.save!
puts "IG_VERIFY_TOKEN set to: #{cfg.value}"
