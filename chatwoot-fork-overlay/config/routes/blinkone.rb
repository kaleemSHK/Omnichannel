# BLINKONE: Loaded via draw(:blinkone) in config/routes.rb (patched at image build)

# Legacy admin-panel URLs → Chatwoot Settings (telephony)
get '/blinkone/admin', to: 'blinkone/admin_redirects#index'
get '/blinkone/admin/ivr', to: 'blinkone/admin_redirects#ivr'
get '/blinkone/admin/routing', to: 'blinkone/admin_redirects#routing'
get '/blinkone/admin/sla/policies', to: 'blinkone/admin_redirects#sla_policies'
get '/blinkone/admin/sla/dashboard', to: 'blinkone/admin_redirects#sla_dashboard'
get '/blinkone/admin/escalations', to: 'blinkone/admin_redirects#escalations'
get '/blinkone/admin/ai/knowledge-base', to: 'blinkone/admin_redirects#ai_knowledge_base'
get '/blinkone/platform/tenants', to: 'blinkone/admin_redirects#platform_tenants'
get '/blinkone/platform/billing', to: 'blinkone/admin_redirects#platform_billing'
get '/blinkone/platform/plans', to: 'blinkone/admin_redirects#platform_plans'
get '/blinkone/admin/billing', to: 'blinkone/admin_redirects#admin_billing'
get '/blinkone/admin/integrations', to: 'blinkone/admin_redirects#admin_integrations'
get '/blinkone/admin/sso', to: 'blinkone/admin_redirects#admin_sso'
get '/blinkone/admin/audit', to: 'blinkone/admin_redirects#admin_audit'
get '/blinkone/admin/webhooks', to: 'blinkone/admin_redirects#admin_webhooks'
get '/blinkone/admin/branding', to: 'blinkone/admin_redirects#branding'

namespace :blinkone do
  post 'api/v1/calls/broadcast', to: 'calls_broadcast#create'

  namespace :api do
    namespace :v1 do
      resource :branding, only: %i[show update], controller: 'blinkone/api/v1/branding' do
        post :assets, action: :upload_asset, on: :member
      end
    end
  end
end
