# frozen_string_literal: true

module BlinkOne
  class CallsBroadcastController < ApplicationController
    before_action :verify_internal_token

    def create
      account_id = params[:accountId]
      ActionCable.server.broadcast(
        "blinkone_calls_#{account_id}",
        {
          type: params[:type],
          callId: params[:callId],
          conversationId: params[:conversationId],
        },
      )
      head :ok
    end

    private

    def verify_internal_token
      expected = ENV['CHATWOOT_BOT_TOKEN'].to_s
      token = request.headers['X-Blinkone-Internal-Token'].to_s
      head :unauthorized if expected.blank? || token != expected
    end
  end
end
