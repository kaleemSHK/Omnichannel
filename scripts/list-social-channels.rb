Channel::Instagram.all.each { |c| puts "instagram id=#{c.instagram_id} inbox=#{c.inbox&.id}" }
Channel::FacebookPage.all.each { |c| puts "facebook page=#{c.page_id} ig=#{c.instagram_id} inbox=#{c.inbox&.id}" }
