# frozen_string_literal: true
a = Account.first
puts "account=#{a&.id}"
puts "inboxes=#{a&.inboxes&.pluck(:id, :name)&.inspect}"
puts "conversations=#{Conversation.count} open=#{Conversation.open.count}"
puts "contacts=#{Contact.count}"
Conversation.limit(3).each do |c|
  puts "  convo #{c.id} status=#{c.status} inbox=#{c.inbox_id} assignee=#{c.assignee_id}"
end
