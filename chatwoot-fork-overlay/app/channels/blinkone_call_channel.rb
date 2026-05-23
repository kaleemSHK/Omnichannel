# frozen_string_literal: true

class BlinkoneCallChannel < ApplicationCable::Channel
  def subscribed
    account_id = params[:account_id]
    stream_from "blinkone_calls_#{account_id}"
  end

  def unsubscribed
    stop_all_streams
  end
end
