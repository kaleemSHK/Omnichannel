# frozen_string_literal: true

namespace :blinkone do
  namespace :demo do
    desc 'Seed demo account, agent, inbox, contacts, and conversations (idempotent)'
    task seed: :environment do
      require Rails.root.join('lib/blink_one/demo_seeder')
      BlinkOne::DemoSeeder.run!
    end

    desc 'Seed demo data and enable dashboard account creation (dev-friendly)'
    task seed_dev: :environment do
      if (cfg = InstallationConfig.find_by(name: 'CREATE_NEW_ACCOUNT_FROM_DASHBOARD'))
        cfg.value = true
        cfg.save!
        GlobalConfig.clear_cache
        puts 'Enabled CREATE_NEW_ACCOUNT_FROM_DASHBOARD'
      end
      Rake::Task['blinkone:demo:seed'].invoke
    end
  end
end
