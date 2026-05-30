# frozen_string_literal: true

module BlinkOne
  class CallsBroadcastController < ApplicationController
    before_action :verify_internal_token

    def create
      account_id = params[:accountId]
      payload = {
        type: params[:type],
        callId: params[:callId],
        conversationId: params[:conversationId],
        eventType: params[:eventType],
        callSession: params[:callSession],
      }.compact
      ActionCable.server.broadcast("blinkone_calls_#{account_id}", payload)
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
