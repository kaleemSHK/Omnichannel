# frozen_string_literal: true

require 'yaml'

module BlinkOne
  # Brand tokens loaded from config/blinkone/branding.yml
  class Branding
    CONFIG_PATH = ENV.fetch('BLINKONE_BRANDING_CONFIG', File.expand_path('../../config/blinkone/branding.yml', __dir__))

    class << self
      def reload!
        @config = nil
        @loaded_at = nil
      end

      def config
        return @config if @config && !development?

        @config = load_yaml
        @loaded_at = Time.now
        @config
      end

      def product_name = dig(:product_name)
      def company_name = dig(:company_name)
      def primary_color = dig(:primary_color)
      def secondary_color = dig(:secondary_color)
      def tagline = dig(:tagline)
      def email_from = "#{dig(:email_from_name)} <#{dig(:email_from_address)}>"
      def email_from_name = dig(:email_from_name)
      def email_from_address = dig(:email_from_address)
      def support_url = dig(:support_url)
      def marketing_url = dig(:marketing_url)
      def terms_url = dig(:terms_url)
      def privacy_url = dig(:privacy_url)
      def assets_base_url = dig(:assets_base_url).to_s.chomp('/')

      def favicon_url = asset_url(dig(:favicon))
      def og_image_url = asset_url(dig(:og_image))
      def splash_url = asset_url(dig(:splash))

      def logo_url(variant = :full, account_id: nil)
        key = case variant.to_sym
              when :full then :full
              when :mark then :mark
              when :email then :email
              else variant.to_sym
              end
        logos = dig(:logos, account_id: account_id) || {}
        filename = logos[key.to_s] || logos[key] || logos['full']
        asset_url(filename, account_id: account_id)
      end

      def copyright_line(year: Time.now.year, account_id: nil)
        name = dig(:company_name, account_id: account_id)
        product = dig(:product_name, account_id: account_id)
        "© #{year} #{name}. #{product} is a product of #{name}."
      end

      def for_tenant(account_id)
        TenantBranding.new(account_id)
      end

      def as_json(account_id: nil)
        {
          productName: dig(:product_name, account_id: account_id),
          companyName: dig(:company_name, account_id: account_id),
          primaryColor: dig(:primary_color, account_id: account_id),
          secondaryColor: dig(:secondary_color, account_id: account_id),
          tagline: dig(:tagline, account_id: account_id),
          emailFrom: email_from_for(account_id),
          emailFromName: dig(:email_from_name, account_id: account_id),
          emailFromAddress: dig(:email_from_address, account_id: account_id),
          supportUrl: dig(:support_url, account_id: account_id),
          marketingUrl: dig(:marketing_url, account_id: account_id),
          termsUrl: dig(:terms_url, account_id: account_id),
          privacyUrl: dig(:privacy_url, account_id: account_id),
          copyrightLine: copyright_line(account_id: account_id),
          logoUrl: {
            full: logo_url(:full, account_id: account_id),
            mark: logo_url(:mark, account_id: account_id),
            email: logo_url(:email, account_id: account_id)
          },
          faviconUrl: favicon_url_for(account_id),
          ogImageUrl: og_image_url_for(account_id),
          splashUrl: splash_url_for(account_id)
        }
      end

      private

      def development?
        ENV['RAILS_ENV'] == 'development' && ENV['BLINKONE_BRANDING_CACHE'] != 'true'
      end

      def load_yaml
        raise Errno::ENOENT, "Missing #{CONFIG_PATH}" unless File.file?(CONFIG_PATH)

        raw = YAML.safe_load(File.read(CONFIG_PATH), permitted_classes: [Symbol], aliases: true) || {}
        raw.transform_keys(&:to_sym)
      end

      def merged(account_id: nil)
        base = (config[:default] || {}).transform_keys(&:to_sym)
        return base if account_id.nil?

        tenant = (config.dig(:tenants, account_id.to_s) || config.dig(:tenants, account_id.to_i) || {}).transform_keys(&:to_sym)
        deep_merge(base, tenant)
      end

      def deep_merge(a, b)
        a.merge(b) do |key, x, y|
          if x.is_a?(Hash) && y.is_a?(Hash)
            deep_merge(x, y)
          else
            y
          end
        end
      end

      def dig(key, account_id: nil)
        merged(account_id: account_id)[key]
      end

      def asset_url(filename, account_id: nil)
        return nil if filename.nil? || filename.to_s.empty?

        override = tenant_asset_override(account_id, filename)
        return override if override

        "#{assets_base_url_for(account_id)}/#{filename}"
      end

      def tenant_asset_override(account_id, filename)
        return nil if account_id.nil?

        uploads = config.dig(:tenant_assets, account_id.to_s) || {}
        uploads[filename.to_s]
      end

      def assets_base_url_for(account_id) = dig(:assets_base_url, account_id: account_id).to_s.chomp('/')
      def email_from_for(account_id) = "#{dig(:email_from_name, account_id: account_id)} <#{dig(:email_from_address, account_id: account_id)}>"
      def favicon_url_for(account_id) = asset_url(dig(:favicon, account_id: account_id), account_id: account_id)
      def og_image_url_for(account_id) = asset_url(dig(:og_image, account_id: account_id), account_id: account_id)
      def splash_url_for(account_id) = asset_url(dig(:splash, account_id: account_id), account_id: account_id)
    end

    class TenantBranding
      def initialize(account_id)
        @account_id = account_id
      end

      def method_missing(name, *args, &block)
        if Branding.respond_to?(name)
          Branding.public_send(name, *args, account_id: @account_id, &block)
        else
          super
        end
      end

      def respond_to_missing?(name, include_private = false)
        Branding.respond_to?(name, include_private) || super
      end

      def as_json = Branding.as_json(account_id: @account_id)
    end
  end
end
