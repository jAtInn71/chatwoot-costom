account = Account.find_or_create_by!(name: 'My Company')
user = User.create!(name: 'Admin', email: 'admin@example.com', password: 'Password123!', password_confirmation: 'Password123!')
user.confirm
AccountUser.create!(account: account, user: user, role: :administrator)
puts 'Admin created successfully!'