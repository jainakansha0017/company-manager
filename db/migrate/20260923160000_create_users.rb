class CreateUsers < ActiveRecord::Migration[7.1]
  def change
    create_table :users do |t|
      # Who is signing in. Everyone sees the same companies, so this table says
      # who may look rather than what they may look at.
      t.string :name, null: false
      t.string :email, null: false
      t.string :password_digest, null: false

      t.timestamps
    end

    # Emails are stored already downcased, so a plain unique index is enough to
    # stop the same person being registered twice under a different case.
    add_index :users, :email, unique: true
  end
end
