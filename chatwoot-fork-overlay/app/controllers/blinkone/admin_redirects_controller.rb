# frozen_string_literal: true

module BlinkOne
  # Redirect legacy /blinkone/admin/* URLs into Chatwoot Settings (telephony).
  class AdminRedirectsController < DashboardController
    def index
      redirect_to telephony_settings_path('blinkone/ivr')
    end

    def ivr
      redirect_to telephony_settings_path('blinkone/ivr')
    end

    def routing
      redirect_to telephony_settings_path('blinkone/routing')
    end

    def sla_policies
      redirect_to telephony_settings_path('blinkone/sla/policies')
    end

    def sla_dashboard
      redirect_to telephony_settings_path('blinkone/sla/dashboard')
    end

    def escalations
      redirect_to telephony_settings_path('blinkone/escalations')
    end

    def ai_knowledge_base
      redirect_to telephony_settings_path('blinkone/ai/knowledge-base')
    end

    def platform_tenants
      redirect_to telephony_settings_path('blinkone/platform/tenants')
    end

    def platform_billing
      redirect_to telephony_settings_path('blinkone/platform/billing')
    end

    def platform_plans
      redirect_to telephony_settings_path('blinkone/platform/plans')
    end

    def admin_billing
      redirect_to telephony_settings_path('blinkone/admin/billing')
    end

    def admin_integrations
      redirect_to telephony_settings_path('blinkone/admin/integrations')
    end

    def admin_sso
      redirect_to telephony_settings_path('blinkone/admin/sso')
    end

    def admin_audit
      redirect_to telephony_settings_path('blinkone/admin/audit')
    end

    def admin_webhooks
      redirect_to telephony_settings_path('blinkone/admin/webhooks')
    end

    def branding
      redirect_to telephony_settings_path('blinkone/branding')
    end

    private

    def telephony_settings_path(suffix)
      account_id = params[:account_id].presence || account&.id || current_user&.accounts&.first&.id
      "/app/accounts/#{account_id}/settings/#{suffix}"
    end
  end
end
