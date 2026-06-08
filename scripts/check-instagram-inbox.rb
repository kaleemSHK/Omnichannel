inbox = Inbox.find_by(id: 6)
abort('inbox 6 not found') unless inbox

ch = inbox.channel
puts "INBOX=#{inbox.name} id=#{inbox.id}"
puts "CHANNEL=#{ch.class.name}"
puts "IG_ID=#{ch.instagram_id}"
puts "ATTRS=#{ch.attributes.keys.sort.join(',')}"
puts "REAUTH=#{ch.try(:reauthorization_required?)}"
puts "TOKEN=#{ch.try(:access_token).present?}"
puts "MEMBERS=#{inbox.inbox_members.pluck(:user_id).join(',')}"
puts "CONVERSATIONS=#{inbox.conversations.count}"

inbox.conversations.order(id: :desc).limit(5).each do |c|
  last = c.messages.last
  text = last ? last.content.to_s[0, 80] : '(none)'
  puts "  conv=#{c.id} msgs=#{c.messages.count} last=#{text}"
end
