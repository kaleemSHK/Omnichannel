account = Account.find(1)
tenant_id = account.id.to_s
token = ENV['SLA_TOKEN'] || ENV['TOKEN']
created = 0
skipped = 0
failed = 0

Conversation.where(account_id: account.id, status: :open).find_each do |conv|
  inbox = conv.inbox
  body = {
    conversationId: conv.id,
    conversation_id: conv.id,
    priority: conv.priority.presence || 'medium',
    channel: inbox&.channel_type || 'web',
    inboxId: conv.inbox_id,
    inbox_id: conv.inbox_id,
  }

  res = HTTParty.post(
    "http://sla:8796/v1/sla/recalculate",
    headers: {
      'Content-Type' => 'application/json',
      'Authorization' => "Bearer #{token}",
      'X-Blinkone-Tenant-Id' => tenant_id,
    },
    body: body.to_json,
  )

  if res.success?
    data = res.parsed_response
    payload = data.is_a?(Hash) ? (data['data'] || data) : {}
    if payload['status'] == 'skipped'
      skipped += 1
    else
      created += 1
      puts "conv=#{conv.id} ok created=#{payload['created'] || payload['count'] || 'yes'}"
    end
  else
    failed += 1
    puts "conv=#{conv.id} failed #{res.code} #{res.body.to_s[0, 160]}"
  end
end

puts "backfill created=#{created} skipped=#{skipped} failed=#{failed}"
