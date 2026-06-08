account = Account.find(1)
tenant_id = account.id.to_s
count = 0
Conversation.where(account_id: account.id, status: :open).find_each do |conv|
  inbox = conv.inbox
  payload = {
    type: 'conversation.created',
    conversation: {
      id: conv.id,
      status: conv.status,
      inbox_id: conv.inbox_id,
      priority: conv.priority,
      channel: inbox&.channel_type,
      assignee_id: conv.assignee_id,
      meta: {
        channel: inbox&.channel_type,
        assignee: conv.assignee ? { id: conv.assignee.id, name: conv.assignee.name } : nil,
      },
    },
  }
  res = HTTParty.post(
    'http://escalation:8797/v1/conversations/sync',
    headers: {
      'Content-Type' => 'application/json',
      'Authorization' => "Bearer #{ENV['ESCALATION_TOKEN'] || ENV['TOKEN']}",
      'X-Blinkone-Tenant-Id' => tenant_id,
    },
    body: payload.to_json,
  )
  if res.success?
    count += 1
  else
    puts "conv=#{conv.id} failed #{res.code} #{res.body.to_s[0, 120]}"
  end
end
puts "backfilled=#{count}"
