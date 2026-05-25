# frozen_string_literal: true
account = Account.first
raise 'No account' unless account

if account.users.find_by(email: 'agent@blinksone.com')
  puts 'Agent already exists: agent@blinksone.com'
else
  agent = User.new(
    name: 'Demo Agent',
    email: 'agent@blinksone.com',
    password: 'Demo@2026!',
    password_confirmation: 'Demo@2026!',
  )
  agent.skip_confirmation!
  agent.save!
  AccountUser.create!(account: account, user: agent, role: :agent)
  puts 'Created agent@blinksone.com / Demo@2026!'
end
