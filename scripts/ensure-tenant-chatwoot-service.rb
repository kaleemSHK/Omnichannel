#!/usr/bin/env ruby
# Idempotent: create BlinkOne automation user + access token per Chatwoot account.
# Usage: ACCOUNT_ID=1 bundle exec rails runner /tmp/ensure-tenant-chatwoot-service.rb

require 'digest'
account_id = Integer(ENV.fetch('ACCOUNT_ID', ARGV[0] || '1'))
tenant_id = ENV.fetch('TENANT_ID', account_id.to_s)
secret = ENV.fetch('TENANT_CHATWOOT_SERVICE_SECRET', ENV.fetch('PLATFORM_TOKEN', 'blinkone-dev'))
digest = Digest::SHA256.hexdigest("cw-automation:#{tenant_id}")
password = "Bn-#{digest[0, 20]}!1"
email = "blinkone-automation+#{account_id}@system.blinksone.internal"
name = 'BlinkOne Automation'

account = Account.find(account_id)
user = User.find_by(email: email)

unless user
  user = User.new(name: name, email: email, password: password, password_confirmation: password)
  user.skip_confirmation! if user.respond_to?(:skip_confirmation!)
  user.save!
  puts "created user #{user.id} #{email}"
else
  user.update!(password: password, password_confirmation: password)
  puts "updated password for user #{user.id} #{email}"
end

au = AccountUser.find_or_initialize_by(account_id: account.id, user_id: user.id)
au.role = :administrator
au.save!

token = user.access_token&.token
unless token.present?
  at = AccessToken.create!(owner: user)
  token = at.token
end

puts "TOKEN=#{token}"
puts "USER_ID=#{user.id}"
puts "EMAIL=#{email}"
puts "TENANT_ID=#{tenant_id}"
