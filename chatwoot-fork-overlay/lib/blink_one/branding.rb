# frozen_string_literal: true

module BlinkOne
  # Per-tenant branding (Prompt 8) — shadows FRONTEND_URL where needed.
  module Branding
    class << self
      def for_tenant(tenant_id)
        return default_branding if tenant_id.blank?

        cached = cache[tenant_id.to_s]
        return cached if cached

        fetched = fetch_from_tenant_service(tenant_id)
        cache[tenant_id.to_s] = fetched || default_branding
        cache[tenant_id.to_s]
      end

      def frontend_url(tenant_id)
        for_tenant(tenant_id)[:frontend_url] || ENV.fetch('FRONTEND_URL', 'http://localhost')
      end

      def clear_cache!(tenant_id = nil)
        if tenant_id
          cache.delete(tenant_id.to_s)
        else
          cache.clear
        end
      end

      private

      def cache
        @cache ||= {}
      end

      def default_branding
        {
          product_name: ENV.fetch('INSTALLATION_NAME', 'BlinkOne'),
          primary_color: '#0B5FFF',
          frontend_url: ENV.fetch('FRONTEND_URL', 'http://localhost')
        }
      end

      def fetch_from_tenant_service(tenant_id)
        base = ENV.fetch('TENANT_SERVICE_URL', 'http://tenant:8802')
        token = ENV.fetch('TENANT_TOKEN', ENV.fetch('PLATFORM_TOKEN', ''))
        return nil if token.blank?

        uri = URI("#{base}/v1/tenants/#{tenant_id}/branding")
        req = Net::HTTP::Get.new(uri)
        req['Authorization'] = "Bearer #{token}"
        res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https', open_timeout: 2, read_timeout: 2) do |http|
          http.request(req)
        end
        return nil unless res.is_a?(Net::HTTPSuccess)

        body = JSON.parse(res.body)
        brand = body.dig('data', 'brand') || body['brand'] || {}
        {
          product_name: brand['product_name'] || brand['productName'],
          primary_color: brand['primary_color'] || brand['primaryColor'],
          frontend_url: brand['frontend_url'] || brand['frontendUrl']
        }.compact
      rescue StandardError
        nil
      end
    end
  end
end
