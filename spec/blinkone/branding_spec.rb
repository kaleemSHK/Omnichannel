# frozen_string_literal: true

require 'spec_helper'
require 'fileutils'
require 'yaml'

RSpec.describe BlinkOne::Branding do
  let(:fixture_yml) do
    File.join(Dir.mktmpdir, 'branding.yml')
  end

  before do
    File.write(fixture_yml, <<~YAML)
      default:
        product_name: BlinkOne
        company_name: LABBIK Telecom S.P.C
        primary_color: "#0B5FFF"
        secondary_color: "#0A0F1C"
        tagline: Test tagline
        email_from_name: BlinkOne
        email_from_address: noreply@blinkone.ai
        support_url: https://example.com/support
        marketing_url: https://example.com
        terms_url: https://example.com/terms
        privacy_url: https://example.com/privacy
        assets_base_url: /blinkone-brand
        logos:
          full: logo-full.svg
          mark: logo-mark.svg
          email: logo-email.png
        favicon: favicon.ico
      tenants:
        "42":
          primary_color: "#FF0000"
          product_name: Acme Blink
    YAML
    stub_const('BlinkOne::Branding::CONFIG_PATH', fixture_yml)
    described_class.reload!
  end

  after { FileUtils.rm_rf(File.dirname(fixture_yml)) }

  it 'exposes default product name' do
    expect(described_class.product_name).to eq('BlinkOne')
  end

  it 'builds logo URLs from assets base' do
    expect(described_class.logo_url(:full)).to eq('/blinkone-brand/logo-full.svg')
    expect(described_class.logo_url(:mark)).to eq('/blinkone-brand/logo-mark.svg')
  end

  it 'formats email_from' do
    expect(described_class.email_from).to eq('BlinkOne <noreply@blinkone.ai>')
  end

  it 'merges tenant overrides via for_tenant' do
    tenant = described_class.for_tenant(42)
    expect(tenant.primary_color).to eq('#FF0000')
    expect(tenant.product_name).to eq('Acme Blink')
    expect(tenant.logo_url(:full)).to eq('/blinkone-brand/logo-full.svg')
  end

  it 'returns global defaults for unknown tenant' do
    expect(described_class.for_tenant(999).primary_color).to eq('#0B5FFF')
  end

  it 'serializes public JSON' do
    json = described_class.as_json(account_id: 42)
    expect(json[:productName]).to eq('Acme Blink')
    expect(json[:logoUrl][:full]).to include('logo-full.svg')
  end

  it 'includes copyright line' do
    expect(described_class.copyright_line).to include('LABBIK Telecom')
  end
end
