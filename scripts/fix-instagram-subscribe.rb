require 'httparty'

ch = Channel::Instagram.joins(:inbox).find_by(inboxes: { id: 6 })
abort('channel not found for inbox 6') unless ch

token = ch.access_token
puts "IG_ID=#{ch.instagram_id}"
puts "EXPIRES_AT=#{ch.expires_at}"
puts "TOKEN_LEN=#{token.to_s.length}"

get_url = "https://graph.instagram.com/v22.0/#{ch.instagram_id}/subscribed_apps"
get_res = HTTParty.get(get_url, query: { access_token: token })
puts "GET_SUBSCRIBED=#{get_res.code} #{get_res.body.to_s[0, 500]}"

post_res = HTTParty.post(
  get_url,
  query: {
    subscribed_fields: %w[messages message_reactions messaging_seen],
    access_token: token
  }
)
puts "POST_SUBSCRIBE=#{post_res.code} #{post_res.body.to_s[0, 500]}"

get_res2 = HTTParty.get(get_url, query: { access_token: token })
puts "GET_AFTER=#{get_res2.code} #{get_res2.body.to_s[0, 500]}"
