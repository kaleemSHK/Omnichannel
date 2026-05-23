# frozen_string_literal: true

module BlinkOne
  class CallBroadcastService
    def self.broadcast(account_id:, type:, payload: {})
      ActionCable.server.broadcast(
        "blinkone_calls_#{account_id}",
        { type:, accountId: account_id, **payload },
      )
    end
  end
end
