# frozen_string_literal: true

# BlinkOne SLIM overlay: append the call-event broadcast ingress without
# touching Chatwoot's own config/routes.rb. `append` adds the route after the
# host application's routes are drawn.
Rails.application.routes.append do
  post '/blinkone/api/v1/calls/broadcast', to: 'blinkone_calls_broadcast#create'
end
