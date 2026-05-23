# frozen_string_literal: true

module BlinkOne
  # Idempotent demo data for local/staging BlinkOne (Chatwoot CE models).
  class DemoSeeder
    DEMO_AGENT_EMAIL = 'demo.agent@blinkone.ai'
    DEMO_AGENT_PASSWORD = 'DemoAgent1!'
    DEMO_ACCOUNT_NAME = 'BlinkOne Demo'

    class << self
      def run!(account_name: DEMO_ACCOUNT_NAME, min_conversations: 8)
        account = resolve_account(account_name)
        agent = resolve_agent(account)
        inbox = resolve_inbox(account, agent)

        existing = account.conversations.count
        if existing >= min_conversations
          puts "Demo: account ##{account.id} already has #{existing} conversations — skipping conversation seed."
          print_summary(account, agent)
          return account
        end

        seed_labels(account)
        seed_conversations(account, inbox, agent, min_conversations - existing)
        print_summary(account, agent)
        account
      end

      private

      def resolve_account(name)
        account = Account.find_by(name: name) || Account.first
        return account if account

        Account.create!(name: name)
      end

      def resolve_agent(account)
        user = User.find_by(email: DEMO_AGENT_EMAIL)
        unless user
          user = User.new(
            name: 'Sarah Al-Hinai',
            email: DEMO_AGENT_EMAIL,
            password: DEMO_AGENT_PASSWORD
          )
          user.skip_confirmation! if user.respond_to?(:skip_confirmation!)
          user.save!
        end

        au = AccountUser.find_or_initialize_by(account_id: account.id, user_id: user.id)
        au.role = :administrator if au.new_record? || au.role.blank?
        au.save!

        user
      end

      def resolve_inbox(account, agent)
        inbox = account.inboxes.find_by(name: 'Website Support')
        return ensure_inbox_member(inbox, agent) if inbox

        channel = Channel::WebWidget.find_by(account_id: account.id) ||
                  Channel::WebWidget.create!(
                    account: account,
                    website_url: ENV.fetch('FRONTEND_URL', 'http://localhost')
                  )
        inbox = Inbox.create!(
          account: account,
          channel: channel,
          name: 'Website Support',
          enable_auto_assignment: true
        )
        ensure_inbox_member(inbox, agent)
      end

      def ensure_inbox_member(inbox, agent)
        InboxMember.find_or_create_by!(inbox: inbox, user: agent)
        inbox
      end

      def seed_labels(account)
        %w[sales support billing vip sla-risk].each do |title|
          account.labels.find_or_create_by!(title: title) { |l| l.description = "Demo label #{title}" }
        end
      end

      def seed_conversations(account, inbox, agent, count)
        samples = [
          { name: 'Ahmed Al-Balushi', email: 'ahmed@example.om', phone: '+96890001001', subject: 'Fiber plan upgrade',
            priority: :high, status: :open, messages: [
              ['incoming', 'Salam, I want to upgrade my home fiber to 1 Gbps.'],
              ['outgoing', 'Marhaba Ahmed! I can help — your account is eligible for the 1 Gbps plan.'],
              ['incoming', 'What is the monthly price?']
            ] },
          { name: 'Fatima Al-Lawati', email: 'fatima@example.om', phone: '+96890001002', subject: 'Bill inquiry',
            priority: :medium, status: :pending, messages: [
              ['incoming', 'My last bill seems higher than usual.'],
              ['outgoing', 'I will review your usage for March and get back to you.']
            ] },
          { name: 'Yusuf Khan', email: 'yusuf@example.om', phone: '+96890001003', subject: 'Outage in Muscat',
            priority: :urgent, status: :open, messages: [
              ['incoming', 'Internet down since 9am in Al Khuwair.'],
              ['outgoing', 'We see a node issue in your area — ETA restore 2 hours.']
            ], labels: %w[support sla-risk] },
          { name: 'Maryam Al-Habsi', email: 'maryam@example.om', phone: '+96890001004', subject: 'New business line',
            priority: :low, status: :open, messages: [
              ['incoming', 'Need 5 SIP lines for our office in Ruwi.']
            ], labels: %w[sales vip] },
          { name: 'Khalid Al-Rashdi', email: 'khalid@example.om', phone: '+96890001005', subject: 'Resolved — thank you',
            priority: :low, status: :resolved, messages: [
              ['incoming', 'Router replacement worked, thanks!'],
              ['outgoing', 'Glad to hear that, Khalid! Closing this ticket.']
            ] },
          { name: 'Layla Al-Abri', email: 'layla@example.om', phone: '+96890001006', subject: 'Mobile roaming',
            priority: :medium, status: :open, messages: [
              ['incoming', 'Roaming package for UAE trip next week?']
            ] },
          { name: 'Hassan Al-Farsi', email: 'hassan@example.om', phone: '+96890001007', subject: 'Payment failed',
            priority: :high, status: :open, messages: [
              ['incoming', 'Card payment failed twice on the portal.'],
              ['outgoing', 'Please try again — we reset the payment session on our side.']
            ], labels: %w[billing] },
          { name: 'Aisha Al-Said', email: 'aisha@example.om', phone: '+96890001008', subject: 'General question',
            priority: :medium, status: :snoozed, messages: [
              ['incoming', 'Do you offer Arabic IVR for call centers?']
            ], labels: %w[sales] }
        ]

        samples.first(count).each_with_index do |sample, idx|
          create_conversation(account, inbox, agent, sample, idx)
        end
      end

      def create_conversation(account, inbox, agent, sample, idx)
        contact_inbox = ContactInboxWithContactBuilder.new(
          source_id: "demo-#{idx}-#{sample[:email]}",
          inbox: inbox,
          contact_attributes: {
            name: sample[:name],
            email: sample[:email],
            phone_number: sample[:phone]
          }
        ).perform

        conv = Conversation.create!(
          account: account,
          inbox: inbox,
          contact: contact_inbox.contact,
          contact_inbox: contact_inbox,
          status: sample[:status],
          priority: sample[:priority],
          assignee: sample[:status] == :resolved ? agent : (sample[:status] == :open ? agent : nil),
          additional_attributes: { subject: sample[:subject] }
        )

        (sample[:messages] || []).each do |direction, content|
          Message.create!(
            account: account,
            inbox: inbox,
            conversation: conv,
            content: content,
            message_type: direction.to_sym,
            sender: direction == 'incoming' ? contact_inbox.contact : agent
          )
        end

        if sample[:labels].present? && conv.respond_to?(:add_labels)
          conv.add_labels(sample[:labels])
        end

        puts "  conversation ##{conv.display_id} — #{sample[:subject]}"
      end

      def print_summary(account, agent)
        puts ''
        puts '── BlinkOne demo data ──────────────────────────'
        puts "Account:  #{account.name} (id=#{account.id})"
        puts "Agent:    #{agent.email} / #{DEMO_AGENT_PASSWORD}"
        puts "Inbox:    Website Support"
        puts "Contacts: #{account.contacts.count} | Conversations: #{account.conversations.count}"
        login = ENV.fetch('FRONTEND_URL', 'http://127.0.0.1').to_s.sub(%r{/$}, '')
        puts "Login:    #{login}/app/login"
        puts '────────────────────────────────────────────────'
      end
    end
  end
end
