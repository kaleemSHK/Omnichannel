# frozen_string_literal: true

# BLINKONE: Resolve Host → tenant_id for white-label multi-domain (Prompt 8).
class BlinkoneHostResolver
  def initialize(app)
    @app = app
  end

  def call(env)
    host = (env['HTTP_HOST'] || '').split(':').first.to_s.downcase
    resolved = resolve_host(host)
    if resolved
      env['BLINKONE_TENANT_ID'] = resolved[:tenant_id]
      env['BLINKONE_BRANDING'] = resolved[:branding]
      RequestStore.store[:blinkone_tenant_id] = resolved[:tenant_id] if defined?(RequestStore)
    end
    @app.call(env)
  end

  private

  def resolve_host(host)
    return nil if host.blank? || %w[localhost 127.0.0.1].include?(host)

    base = ENV.fetch('TENANT_SERVICE_URL', 'http://tenant:8802')
    token = ENV.fetch('TENANT_TOKEN', ENV.fetch('PLATFORM_TOKEN', ''))
    return nil if token.blank?

    uri = URI("#{base}/v1/resolve-host?host=#{CGI.escape(host)}")
    req = Net::HTTP::Get.new(uri)
    req['Authorization'] = "Bearer #{token}"
    res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: uri.scheme == 'https', open_timeout: 2, read_timeout: 2) do |http|
      http.request(req)
    end
    return nil unless res.is_a?(Net::HTTPSuccess)

    data = JSON.parse(res.body)['data'] || {}
    {
      tenant_id: data['tenantId'] || data['tenant_id'],
      branding: data['branding'] || {}
    }
  rescue StandardError
    nil
  end
end
