account = Account.find(1)
url = ENV.fetch('CHATWOOT_WEBHOOK_URL', 'https://app.blinksone.com/api/webhooks/chatwoot')
subs = %w[
  conversation_created
  conversation_updated
  conversation_status_changed
  message_created
]

hook = account.webhooks.find_or_initialize_by(url: url)
hook.subscriptions = subs
hook.save!
puts "webhook_id=#{hook.id} url=#{hook.url} subscriptions=#{hook.subscriptions.join(',')}"
