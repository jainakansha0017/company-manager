class AddSessionTokenToUsers < ActiveRecord::Migration[7.1]
  # The session cookie carries this alongside the user's id, so rotating it ends
  # every session the user has open. Existing users are given one rather than
  # left null, which would match a cookie that has no token in it at all.
  def up
    add_column :users, :session_token, :string

    select_values("SELECT id FROM users").each do |id|
      execute(<<~SQL.squish)
        UPDATE users SET session_token = #{quote(SecureRandom.base58(24))}
        WHERE id = #{Integer(id)}
      SQL
    end

    change_column_null :users, :session_token, false
    add_index :users, :session_token, unique: true
  end

  def down
    remove_column :users, :session_token
  end
end
