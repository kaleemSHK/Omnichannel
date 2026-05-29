# frozen_string_literal: true

# BlinkOne SLIM overlay: internal ingress that fans call events onto the
# `blinkone_calls_<account>` Action Cable stream the BlinkOne (Next.js) app
# subscribes to via { channel: 'BlinkoneCallChannel' }.
#
# Inherits ActionController::API (not Chatwoot's ApplicationController) so no
# CSRF/auth before_actions apply — this endpoint is guarded by a shared
# internal token instead. Flat class name avoids namespace inflection issues.
class BlinkoneCallsBroadcastController < ActionController::API
  before_action :verify_internal_token

  def create
    account_id = params[:accountId]
    payload = {
      type: params[:type],
      callId: params[:callId],
      conversationId: params[:conversationId],
      eventType: params[:eventType],
      callSession: params[:callSession]
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
