# frozen_string_literal: true
# Seed Pakistani demo contacts + conversations on Chatwoot (CE).
# Run on the server (bash must NOT expand "!"):
#
#   docker compose exec -T chatwoot bundle exec rails runner \
#     < /opt/blinkone/scripts/chatwoot_seed_pk_demo.rb
#
# Or copy this file into the chatwoot container and:
#   docker compose exec chatwoot bundle exec rails runner /tmp/chatwoot_seed_pk_demo.rb

account = Account.first
raise 'No Chatwoot account found' unless account

agent = account.users.first
raise 'No agent user on account' unless agent

channel = Channel::Api.find_by(account_id: account.id)
channel ||= Channel::Api.create!(account: account)

inbox = account.inboxes.find_by(name: 'WhatsApp Support')
unless inbox
  inbox = Inbox.create!(
    account: account,
    channel: channel,
    name: 'WhatsApp Support',
    timezone: 'Asia/Karachi',
    working_hours_enabled: false,
    enable_auto_assignment: true
  )
end
InboxMember.find_or_create_by!(inbox: inbox, user: agent)

demo_data = [
  { name: 'Ahmed Khan', phone: '+923001234567', email: 'ahmed.khan@gmail.com', company: 'Khan Traders',
    msg: 'I need help with my order delivery', status: 'open' },
  { name: 'Sara Malik', phone: '+923211234568', email: 'sara.malik@yahoo.com', company: 'Malik Enterprises',
    msg: 'When will my invoice be ready?', status: 'open' },
  { name: 'Usman Ali', phone: '+923451234569', email: 'usman.ali@gmail.com', company: 'Ali & Sons',
    msg: 'Product return request #4521', status: 'pending' },
  { name: 'Fatima Zahra', phone: '+923011234570', email: 'fatima.z@hotmail.com', company: 'Zahra Boutique',
    msg: 'I want to upgrade my plan', status: 'open' },
  { name: 'Bilal Hussain', phone: '+923331234571', email: 'bilal.h@gmail.com', company: 'Hussain Corp',
    msg: 'Payment failed for order 8821', status: 'resolved' },
  { name: 'Nadia Farooq', phone: '+923151234572', email: 'nadia.f@gmail.com', company: 'Farooq Solutions',
    msg: 'Need technical support urgently', status: 'open' },
  { name: 'Tariq Mehmood', phone: '+923061234573', email: 'tariq.m@outlook.com', company: 'Mehmood Industries',
    msg: 'Can I change my delivery address?', status: 'resolved' },
  { name: 'Zainab Raza', phone: '+923421234574', email: 'zainab.r@gmail.com', company: 'Raza Fabrics',
    msg: 'Bulk order inquiry for Eid season', status: 'open' },
  { name: 'Kamran Sheikh', phone: '+923201234575', email: 'kamran.s@gmail.com', company: 'Sheikh Motors',
    msg: 'Account verification needed', status: 'pending' },
  { name: 'Hina Qureshi', phone: '+923091234576', email: 'hina.q@yahoo.com', company: 'Qureshi Foods',
    msg: 'Complaint about damaged goods', status: 'open' },
  { name: 'Asim Javed', phone: '+923251234577', email: 'asim.j@gmail.com', company: 'Javed Electronics',
    msg: 'Request for service contract', status: 'resolved' },
  { name: 'Sobia Nawaz', phone: '+923101234578', email: 'sobia.n@gmail.com', company: 'Nawaz Textiles',
    msg: 'Pricing for wholesale account', status: 'open' },
]

created = 0
demo_data.each_with_index do |d, i|
  source_id = "pk-demo-#{d[:email]}"
  next if ContactInbox.find_by(inbox: inbox, source_id: source_id)

  contact_inbox = ContactInboxWithContactBuilder.new(
    source_id: source_id,
    inbox: inbox,
    contact_attributes: {
      name: d[:name],
      email: d[:email],
      phone_number: d[:phone],
      additional_attributes: { company_name: d[:company] },
    }
  ).perform

  hours_ago = (demo_data.length - i).hours.ago
  convo = Conversation.create!(
    account: account,
    inbox: inbox,
    contact: contact_inbox.contact,
    contact_inbox: contact_inbox,
    status: d[:status],
    assignee: agent,
    created_at: hours_ago
  )

  Message.create!(
    account: account,
    inbox: inbox,
    conversation: convo,
    message_type: :incoming,
    content: d[:msg],
    sender: contact_inbox.contact,
    created_at: hours_ago
  )

  reply = if d[:status] == 'resolved'
            'Thank you for reaching out. Your issue has been resolved. Have a great day!'
          else
            'Hello! Thank you for contacting BlinkOne support. How can I assist you today?'
          end

  Message.create!(
    account: account,
    inbox: inbox,
    conversation: convo,
    message_type: :outgoing,
    content: reply,
    sender: agent,
    created_at: hours_ago + 5.minutes
  )

  created += 1
  puts "Created: #{d[:name]} (#{d[:status]})"
end

puts "Done. #{created} new conversations (inbox: WhatsApp Support, account ##{account.id})."
