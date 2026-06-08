# Seed Chatwoot InstallationConfig for Instagram OAuth + webhooks.
token = ENV['IG_VERIFY_TOKEN'] || ENV['INSTAGRAM_VERIFY_TOKEN'] || 'blinkone_ig_2026'
ig_app_id = ENV['INSTAGRAM_APP_ID'] || ENV['FB_APP_ID'] || ''
ig_app_secret = ENV['INSTAGRAM_APP_SECRET'] || ENV['FB_APP_SECRET'] || ''

{
  'IG_VERIFY_TOKEN' => token,
  'INSTAGRAM_VERIFY_TOKEN' => token,
  'INSTAGRAM_APP_ID' => ig_app_id,
  'INSTAGRAM_APP_SECRET' => ig_app_secret,
  'FB_APP_ID' => ENV['FB_APP_ID'] || ig_app_id,
  'FB_APP_SECRET' => ENV['FB_APP_SECRET'] || ig_app_secret,
  'FB_VERIFY_TOKEN' => ENV['FB_VERIFY_TOKEN'] || 'blinkone_fb_2026',
}.each do |name, value|
  next if value.to_s.strip.empty?
  cfg = InstallationConfig.find_or_initialize_by(name: name)
  cfg.value = value
  cfg.locked = false
  cfg.save!
  puts "#{name}=set"
end

puts "FRONTEND_URL=#{ENV['FRONTEND_URL']}"
puts "instagram_callback=#{ENV.fetch('FRONTEND_URL', 'http://localhost:3000')}/instagram/callback"
