require 'httparty'

ch = Channel::Instagram.joins(:inbox).find_by(inboxes: { id: 6 })
token = ch.access_token

me = HTTParty.get('https://graph.instagram.com/v22.0/me', query: {
  fields: 'user_id,username,name',
  access_token: token
})
puts "ME=#{me.code} #{me.body}"

info = HTTParty.get("https://graph.instagram.com/v22.0/#{ch.instagram_id}", query: {
  fields: 'username,name',
  access_token: token
})
puts "BUSINESS=#{info.code} #{info.body}"
